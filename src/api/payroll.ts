import { api } from './client'
import type { RowIssue } from './closedAttendance'
import type { PayslipPreview } from './payslip'

export interface PayParam { key: string; label: string; value: number; unit: string; group: string }
export interface PayInput { key: string; label: string; header: string; default: number; persist?: boolean }
export type PayKind = 'income' | 'deduction' | 'total' | 'calc' | 'info'
export interface PayItem { key: string; label: string; kind: PayKind; formula: string; payslip: string | null; visible: boolean; round: boolean }
export interface TaxBracket { upTo: number | null; rate: number }
export interface PayrollConfig { params: PayParam[]; inputs: PayInput[]; items: PayItem[]; taxBrackets: TaxBracket[] }
export interface PayrollVersion { id: number; effectiveFrom: string; name: string; config: PayrollConfig; updatedBy: string | null; updatedAt: string | null; builtin: boolean }
export interface ConfigIssue { code: string; where: string; detail: string | null }
export interface CatalogVariable { name: string; label: string; group: string }
export interface PayrollConfigState {
  ready: boolean; usingBuiltin: boolean; versions: PayrollVersion[]
  variables: CatalogVariable[]; payslipFields: { key: string; group: string; kind: string }[]; functions: string[]
}

export interface PayrollPeriodSummary { period: string; versionName: string; effectiveFrom: string; people: number; errorRows: number; totalGross: number; totalDeduction: number; totalNet: number }
export interface PayrollPreview {
  token: string; fileName: string; totalRows: number; periods: PayrollPeriodSummary[]; unknownEmployees: number; errorRows: number
  errors: RowIssue[]; warnings: RowIssue[]; ignoredRows: number; usingBuiltin: boolean
  flagCounts?: Record<string, number>; flaggedRows?: number
}
export interface PayrollColumn { key: string; label: string; kind: PayKind }
export interface PayrollResultRow { excelRow: number; period: string; employeeId: string; fullName: string; department: string; position: string; values: Record<string, number>; errors: string[]; flags?: string[] }
export interface PayrollResultPage { total: number; page: number; pageSize: number; columns: PayrollColumn[]; rows: PayrollResultRow[] }

/** Script tạo bảng cấu hình lương (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const PAYROLL_TABLE_SQL = `CREATE TABLE dbo.Tbl_PayrollConfig (
    ID            int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EFFECTIVEFROM varchar(7)    NOT NULL,   -- kỳ bắt đầu áp dụng, dạng MM/yyyy
    NAME          nvarchar(100) NOT NULL,
    CONFIGJSON    nvarchar(max) NOT NULL,   -- mức tiền, cột nhập thêm, công thức, biểu thuế
    CREATEDBY     nvarchar(50)  NULL,
    CREATEDATE    datetime      NULL,
    UPDATEDBY     nvarchar(50)  NULL,
    UPDATEDATE    datetime      NULL,
    CONSTRAINT UQ_Tbl_PayrollConfig UNIQUE (EFFECTIVEFROM)
);`

const base = '/admin/payroll'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

/** Lỗi trả về: code = title của ProblemDetails, issues = danh sách lỗi cấu hình (nếu có). */
export function payrollError(e: unknown): { code: string; detail: string; issues: ConfigIssue[] } {
  const d = (e as { response?: { data?: { title?: string; detail?: string; issues?: ConfigIssue[] } } }).response?.data
  return { code: d?.title ?? '', detail: d?.detail ?? '', issues: d?.issues ?? [] }
}

export const payroll = {
  config: () => api.get<PayrollConfigState>(`${base}/config`).then((r) => r.data),
  validate: (config: PayrollConfig) => api.post<{ issues: ConfigIssue[] }>(`${base}/config/validate`, config).then((r) => r.data.issues),
  test: (config: PayrollConfig, variables: Record<string, number>) => api.post<{ values: Record<string, number>; errors: string[] }>(`${base}/config/test`, { config, variables }).then((r) => r.data),
  create: (b: { effectiveFrom: string; name: string; config: PayrollConfig }) => api.post<{ id: number }>(`${base}/config`, b).then((r) => r.data),
  update: (id: number, b: { effectiveFrom: string; name: string; config: PayrollConfig }) => api.put(`${base}/config/${id}`, b).then(() => undefined),
  remove: (id: number) => api.delete(`${base}/config/${id}`).then(() => undefined),
  reset: () => api.post<{ count: number }>(`${base}/config/reset`).then((r) => r.data),
  seed: () => api.post<{ count: number }>(`${base}/config/seed`).then((r) => r.data),
  template: async () => saveBlob(await api.get<Blob>(`${base}/template`, { responseType: 'blob', timeout: 60000 }), 'MauTinhLuong.xlsx'),
  preview: ({ file, group }: { file: File; group?: 'op' | 'staff' | 'temp' }) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<PayrollPreview>(`${base}/preview`, fd, { timeout: 300000, params: { group } }).then((r) => r.data)
  },
  results: (token: string, search: string, page: number, pageSize: number, flag?: string) =>
    api.get<PayrollResultPage>(`${base}/results`, { params: { token, search: search || undefined, page, pageSize, flag: flag || undefined } }).then((r) => r.data),
  exportXlsx: async (token: string) => saveBlob(await api.get<Blob>(`${base}/export`, { params: { token }, responseType: 'blob', timeout: 180000 }), 'BangLuong.xlsx'),
  publishPreview: (token: string) => api.post<PayslipPreview>(`${base}/publish/preview`, { token }, { timeout: 180000 }).then((r) => r.data),
}

// ---------------- Dữ liệu lương riêng từng người (mã hóa trong CSDL) ----------------
export interface PersonPay { employeeId: string; effectiveFrom: string; values: Record<string, number>; updatedBy: string | null; updatedAt: string | null }
export interface PersonPayView { pay: PersonPay; fullName: string; department: string; title: string }
export interface PersonPayPage { total: number; rows: PersonPayView[] }
export interface PersonPayEmployee { employeeId: string; fullName: string; department: string; title: string; hasPay: boolean }
export interface PersonPayState { tableReady: boolean; keyReady: boolean; keyStatus?: string; environment?: string }
export interface PersonPayDiff { employeeId: string; fullName: string; old: number | null; new: number }
export interface PersonPayCompare { token: string; period: string; new: number; changed: number; same: number; lowHours: number; noPayslip: number; suspect: number; newSample: PersonPayDiff[]; changedSample: PersonPayDiff[] }
export interface PersonPayPreview { token: string; rows: number; new: number; updated: number; unknown: number; errors: RowIssue[]; warnings: RowIssue[] }

/** Script tạo bảng dữ liệu lương riêng (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). Cột DATA là dữ liệu đã mã hóa. */
export const PERSON_PAY_TABLE_SQL = `CREATE TABLE dbo.Tbl_EmployeePay (
    ID            int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EMPLOYEEID    nvarchar(50)  NOT NULL,
    EFFECTIVEFROM varchar(7)    NOT NULL,   -- kỳ bắt đầu áp dụng, dạng MM/yyyy (nâng lương = thêm dòng mới)
    DATA          nvarchar(max) NOT NULL,   -- lương và các khoản riêng, MÃ HÓA AES-256-GCM (khóa nằm ngoài CSDL)
    CREATEDBY     nvarchar(50)  NULL,
    CREATEDATE    datetime      NULL,
    UPDATEDBY     nvarchar(50)  NULL,
    UPDATEDATE    datetime      NULL,
    CONSTRAINT UQ_Tbl_EmployeePay UNIQUE (EMPLOYEEID, EFFECTIVEFROM)
);`

/** Lệnh tạo khóa mã hóa 32 byte (base64) để đặt vào user-secrets / biến môi trường Payroll__EncryptionKey. */
export const PAY_KEY_COMMAND = `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`

const peopleBase = '/admin/payroll-people'

export const payrollPeople = {
  state: () => api.get<PersonPayState>(`${peopleBase}/state`).then((r) => r.data),
  list: (search: string, page: number, pageSize: number) => api.get<PersonPayPage>(peopleBase, { params: { search: search || undefined, page, pageSize } }).then((r) => r.data),
  save: (b: { employeeId: string; effectiveFrom: string; values: Record<string, number> }) => api.put(peopleBase, b).then(() => undefined),
  remove: (employeeId: string, effectiveFrom: string) => api.post(`${peopleBase}/delete`, { employeeId, effectiveFrom }).then(() => undefined),
  employees: (search: string) => api.get<PersonPayEmployee[]>(`${peopleBase}/employees`, { params: { search } }).then((r) => r.data),
  template: async () => saveBlob(await api.get<Blob>(`${peopleBase}/template`, { responseType: 'blob', timeout: 60000 }), 'MauLuongTungNguoi.xlsx'),
  importPreview: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<PersonPayPreview>(`${peopleBase}/import/preview`, fd, { timeout: 300000 }).then((r) => r.data)
  },
  fromRunPreview: (token: string) => api.post<PersonPayPreview>(`${peopleBase}/from-run/preview`, { token }, { timeout: 180000 }).then((r) => r.data),
  fromPayslips: (period: string) => api.post<PersonPayCompare>(`${peopleBase}/from-payslips/preview`, { period }, { timeout: 180000 }).then((r) => r.data),
  bootstrapPreview: (period: string) => api.post<PersonPayPreview>(`${peopleBase}/bootstrap/preview`, { period }, { timeout: 180000 }).then((r) => r.data),
  commit: (token: string) => api.post<{ rows: number }>(`${peopleBase}/commit`, { token }, { timeout: 180000 }).then((r) => r.data),
}
