import { api } from './client'

/** Một dòng chốt công: values theo khoá của CLOSED_FIELDS (chuỗi như bảng cũ lưu). */
export interface ClosedRecord {
  id: number; period: string; employeeId: string; fullName: string; department: string; position: string; title: string
  values: Record<string, string>
  /** Trợ cấp đi Hưng Yên (bảng riêng Tbl_TimeWorkExtra); null / thiếu nếu chưa có bảng hoặc chưa nhập. */
  extras?: Record<string, string> | null
  createdAt: string | null; createdBy: string | null; changedAt: string | null; changedBy: string | null
}
export interface PeriodSummary { period: string; rows: number; firstCreated: string | null; lastChanged: string | null; lastBy: string | null }
export interface RowIssue { excelRow: number; code: string; detail: string | null }
export interface ClosedInput { excelRow: number; period: string; employeeId: string; fullName: string; department: string; position: string; title: string; values: Record<string, string>; extras?: Record<string, string> | null }
export interface PeriodPreview { period: string; rows: number; new: number; updated: number }
export interface ImportPreview {
  token: string; fileName: string; totalRows: number; periods: PeriodPreview[]; unknownEmployees: number
  errors: RowIssue[]; warnings: RowIssue[]; ignoredRows: number; sample: ClosedInput[]
  /** Số dòng có điền trợ cấp Hưng Yên; extraReady = bảng trợ cấp đã tạo chưa. */
  extraRows: number; extraReady: boolean
}
export interface ImportResult { inserted: number; updated: number; periods: string[]; extrasSaved: number }
export interface ClosedPage { total: number; page: number; pageSize: number; rows: ClosedRecord[] }

/** Nhóm hiển thị của từng cột số liệu. */
export type FieldGroup = 'official' | 'probation' | 'summary' | 'allowance'

const DETAIL = [
  'tongGioCaNgay', 'tongGioCaDem', 'huongLe', 'nghiHuong70', 'nghiHuong50', 'tangCaNgayTruoc22h', 'tangCaNgaySau22h',
  'tangCaDem', 'tangCaNgayChuNhat', 'tangCaDemChuNhat', 'tangCaNgayLe', 'tangCaDemLe', 'troCap30LuuTru', 'tongNghiKhongLuong',
] as const
const SUMMARY = ['nghiPhep', 'nghiKhongLuong', 'nghiHuongBHXH', 'nghiKhamThai', 'nghiDacBiet', 'nghiKhongLuongKhongPhep', 'quenChamVanTay', 'tongCongHuongLuong', 'thuongChuyenCan'] as const

/** Cột số liệu theo đúng thứ tự file Excel mẫu: key (khớp backend), nhãn gốc (khoá i18n cls.f.*) và nhóm. */
export const CLOSED_FIELDS: { key: string; label: string; group: FieldGroup }[] = [
  ...DETAIL.map((d) => ({ key: `${d}CT`, label: d, group: 'official' as const })),
  ...DETAIL.map((d) => ({ key: `${d}TV`, label: d, group: 'probation' as const })),
  ...SUMMARY.map((s) => ({ key: s, label: s, group: 'summary' as const })),
  // Trợ cấp đi Hưng Yên: hai cột cuối file Excel, lưu ở bảng riêng (đọc từ `extras`, không nằm trong `values`).
  { key: 'hungYenTravel', label: 'hungYenTravel', group: 'allowance' as const },
  { key: 'hungYenLodging', label: 'hungYenLodging', group: 'allowance' as const },
]

/** Giá trị của một cột: số liệu chốt công (values) hoặc trợ cấp Hưng Yên (extras). */
export const closedValue = (r: { values: Record<string, string>; extras?: Record<string, string> | null }, key: string) => r.values[key] ?? r.extras?.[key]

/** Script tạo bảng trợ cấp (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng, không đụng Tbl_TimeWork của hệ thống cũ). */
export const EXTRA_TABLE_SQL = `CREATE TABLE dbo.Tbl_TimeWorkExtra (
    ID              int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    KYLUONG         nvarchar(50)  NOT NULL,   -- kỳ lương "MM/yyyy" (khớp Tbl_TimeWork.KyLuong)
    MANV            nvarchar(50)  NOT NULL,   -- mã nhân viên (khớp Tbl_TimeWork.MaNV)
    HUNGYEN_TRAVEL  decimal(18,2) NULL,       -- trợ cấp đi Hưng Yên
    HUNGYEN_LODGING decimal(18,2) NULL,       -- trợ cấp chuyển trọ xuống Hưng Yên
    CREATEDATE      datetime      NULL,
    CREATEBY        nvarchar(50)  NULL,
    CHANGEDATE      datetime      NULL,
    CHANGEBY        nvarchar(50)  NULL,
    CONSTRAINT UQ_Tbl_TimeWorkExtra UNIQUE (KYLUONG, MANV)
);`

const base = '/admin/closed-attendance'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const closedAttendance = {
  mine: () => api.get<ClosedRecord[]>('/closed-attendance/mine').then((r) => r.data),
  preview: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<ImportPreview>(`${base}/preview`, fd, { timeout: 180000 }).then((r) => r.data)
  },
  commit: (token: string) => api.post<ImportResult>(`${base}/commit`, { token }, { timeout: 180000 }).then((r) => r.data),
  periods: () => api.get<PeriodSummary[]>(`${base}/periods`).then((r) => r.data),
  extraStatus: () => api.get<{ ready: boolean }>(`${base}/extra-status`).then((r) => r.data),
  list: (period: string, search: string, page: number, pageSize: number) =>
    api.get<ClosedPage>(base, { params: { period, search: search || undefined, page, pageSize } }).then((r) => r.data),
  exportPeriod: async (period: string) => saveBlob(await api.get<Blob>(`${base}/export`, { params: { period }, responseType: 'blob', timeout: 180000 }), 'ChotCong.xlsx'),
  template: async () => saveBlob(await api.get<Blob>(`${base}/template`, { responseType: 'blob' }), 'MauNhapChotCong.xlsx'),
}

/** Mã lỗi (title của ProblemDetails). */
export function closedError(e: unknown): { code: string; detail: string } {
  const d = (e as { response?: { data?: { title?: string; detail?: string } } }).response?.data
  return { code: d?.title ?? '', detail: d?.detail ?? '' }
}
