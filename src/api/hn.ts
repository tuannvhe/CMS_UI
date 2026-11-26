import { api } from './client'
import type { BirthdayPerson } from './birthdays'
import type { MonthCalendar } from './calendar'
export { HN_MODULE } from '../config/hnModules'

/** API của cơ sở Ninh Bình (Hà Nam): /api/hn/*. Lỗi trả ProblemDetails, `title` là mã lỗi. */

export interface HnPermission { module: string; view: boolean; add: boolean; edit: boolean; delete: boolean; import: boolean; export: boolean }
export interface HnMe {
  userId: string; fullName: string; employeeId: string; groupId: string; groupName: string; email: string; site: 'HN'
  permissions: HnPermission[]
}
/** Một dòng dữ liệu lấy nguyên từ nguồn: không tin kiểu của cột lạ. */
export type HnRow = Record<string, unknown>
export interface HnNotice { id: string | number; title: string; contents: string; createdAt: string; type?: string }
export interface HnHome { notice: HnNotice | null; holidays: HnRow[] }
export interface HnProfile {
  employeeId: string; fullName: string; department: string; position: string; process: string; title: string; titleEn: string
  startWork: string; workStatus: string; email: string; phone: string; birthday: string; sex: string; nation: string; married: string
  identityCardMasked: string; identityIssued: string; identityPlace: string; place: string; address: string
  school: string; major: string; education: string; educationEn: string
}
export interface HnFinger { from: string; to: string; count: number; rows: HnRow[] }
export interface HnNotification { id: string; type: string; title: string; description: string; link: string | null; timestamp: string; read: boolean; fromUserId: string | null }
export interface HnNotificationList { unread: number; items: HnNotification[] }

export interface HnPayslipItem { key: string; label: string; percent: number | null; hours: number | null; amount: number | null; hoursProbation: number | null; amountProbation: number | null }
export interface HnPayslipPeriod { period: string; fromDate: string; toDate: string }
export interface HnPayslip {
  period: string; fromDate: string; toDate: string; employeeId: string; employeeName: string; department: string; position: string
  contract: HnPayslipItem[]; income: HnPayslipItem[]; deductions: HnPayslipItem[]; grossIncome: number; totalDeductions: number; netSalary: number
}

export type HnRequestKind = 'overtime' | 'leave' | 'finger-register' | 'late-early'
export type HnRequestStatus = 'pending' | 'inProgress' | 'rejected' | 'done'
export interface HnApprovalLevel { level: number; approverId: string; approverName: string; decision: boolean | null; decidedAt: string | null; rejectReason: string | null }
/** Một đơn (OT / nghỉ phép / quên vân tay / đi muộn về sớm). `detail` tuỳ loại đơn: khoá lạ được hiển thị nguyên. */
export interface HnRequest {
  id: number | string; groupId: string | null; employeeId: string; employeeName: string; department: string
  date: string; dateTo: string | null; shift: string | null; reason: string | null
  status: HnRequestStatus; currentLevel: number; pendingForMe: boolean
  levels: HnApprovalLevel[]; submittedAt: string | null; detail: Record<string, unknown> | null
}
export interface HnPage<T> { items: T[]; total: number; page: number; pageSize: number }
/** pendingForMe: số dòng của nhóm đang chờ chính tôi duyệt (0 = không có). */
export interface HnOtGroup { groupId: string; firstId: number | string; date: string; department: string; reason: string | null; count: number; pendingForMe: number }
export interface HnMineParams { from?: string; to?: string; page: number; pageSize: number }
export interface HnApprovalParams { state: 'pending' | 'all'; page: number; pageSize: number }
export interface HnSummaryParams { from?: string; to?: string; empId?: string; name?: string; dept?: string; status?: HnRequestStatus; page: number; pageSize: number }

export const hnApi = {
  requestsMine: (kind: HnRequestKind, params: HnMineParams) => api.get<HnPage<HnRequest>>(`/hn/${kind}/mine`, { params }).then((r) => r.data),
  requestsApprovals: (kind: Exclude<HnRequestKind, 'overtime'>, params: HnApprovalParams) => api.get<HnPage<HnRequest>>(`/hn/${kind}/approvals`, { params }).then((r) => r.data),
  otGroups: (params: HnApprovalParams) => api.get<HnPage<HnOtGroup>>('/hn/overtime/approvals', { params }).then((r) => r.data),
  otGroup: (groupId: string) => api.get<{ groupId: string; items: HnRequest[] }>(`/hn/overtime/groups/${encodeURIComponent(groupId)}`).then((r) => r.data),
  summary: (kind: 'overtime' | 'leave', params: HnSummaryParams) => api.get<HnPage<HnRequest>>(`/hn/${kind}/summary`, { params }).then((r) => r.data),
  me: () => api.get<HnMe>('/hn/me').then((r) => r.data),
  home: () => api.get<HnHome>('/hn/home').then((r) => r.data),
  /* 2026-11-26 [Truong] - HN home blocks from CMS_HN (same shapes as /birthdays, /calendar/month, /online) */
  homeBirthdays: () => api.get<{ today: BirthdayPerson[]; upcoming: BirthdayPerson[] }>('/hn/home/birthdays').then((r) => r.data),
  homeCalendar: (year: number, month: number) => api.get<MonthCalendar>('/hn/home/calendar', { params: { year, month } }).then((r) => r.data),
  homeOnline: () => api.get<{ online: number; windowMinutes: number }>('/hn/home/online').then((r) => r.data),
  profile: () => api.get<HnProfile>('/hn/profile').then((r) => r.data),
  timework: (period?: string, take?: number) => api.get<{ periods: HnRow[] }>('/hn/timework', { params: { period, take } }).then((r) => r.data),
  payslipPeriods: () => api.get<{ periods: HnPayslipPeriod[] }>('/hn/payslip/periods').then((r) => r.data),
  payslip: (period?: string) => api.get<HnPayslip>('/hn/payslip', { params: period ? { period } : {} }).then((r) => r.data),
  finger: (from: string, to: string) => api.get<HnFinger>('/hn/finger', { params: { from, to } }).then((r) => r.data),
  notifications: (take = 30) => api.get<HnNotificationList>('/hn/notifications', { params: { take } }).then((r) => r.data),
  markRead: (id: string) => api.post(`/hn/notifications/${encodeURIComponent(id)}/read`).then(() => undefined),
  /* 2026-11-26 [Truong] - HN requests: create + approve / reject */
  requestRules: () => api.get<HnRequestRules>('/hn/requests/rules').then((r) => r.data),
  approvers: (q?: string) => api.get<{ items: HnApprover[] }>('/hn/requests/approvers', { params: { q: q || undefined, take: 50 } }).then((r) => r.data.items),
  otEmployees: (q?: string, dept?: string) => api.get<{ items: HnPickEmployee[] }>('/hn/requests/employees', { params: { q: q || undefined, dept: dept || undefined, take: 200 } }).then((r) => r.data.items),
  createRequest: (kind: HnRequestKind, body: HnRequestInput) => api.post<HnWriteOk>(`/hn/${kind}`, body).then((r) => r.data),
  decide: (kind: HnRequestKind, id: number | string, body: HnDecisionBody) => api.post<HnWriteOk>(`/hn/${kind}/${encodeURIComponent(String(id))}/decision`, body).then((r) => r.data),
  decideOtGroup: (groupId: string, body: HnDecisionBody) => api.post<HnWriteOk>(`/hn/overtime/groups/${encodeURIComponent(groupId)}/decision`, body).then((r) => r.data),
}

export interface HnLevelRule { standard: number; op: number; maxStandard: number; maxOp: number }
export interface HnRequestRules {
  shifts: { code: string; name: string }[]
  levelsFor: { overtime: HnLevelRule; leave: HnLevelRule; finger: HnLevelRule; lateEarly: HnLevelRule }
  writeMode: 'off' | 'test' | 'live'
  allowedEmployees: boolean
  me: { id: string; name: string | null; department: string | null; isOp: boolean } | null
}
export interface HnApprover { id: string; name: string | null; department: string | null; position: string | null; title: string | null }
export interface HnPickEmployee { id: string; name: string | null; department: string | null; isOp: boolean }
export interface HnRequestInput {
  date: string; dateTo?: string; timeFrom?: string; timeTo?: string; shift?: string; reason: string; handoverTo?: string
  approvers: (string | null)[]; employeeIds?: string[]
}
export interface HnDecisionBody { action: 'approve' | 'reject'; reason?: string }
export interface HnWriteOk { count: number; groupId: string | null }

/* 2026-11-25 [Truong] - HN HR tools: upload timework / payslip (preview → commit) and all-employee finger report */
export type HnImportKind = 'timework' | 'payslip'
export type HnWriteModeName = 'off' | 'test' | 'live'
export interface HnImportIssue { excelRow: number; code: string; detail: string | null }
export interface HnImportLine { excelRow: number; employeeId: string; fullName: string | null; department: string | null; period: string; status: 'new' | 'update' | 'unknown' | 'skipped' }
export interface HnImportPreview {
  token: string | null; kind: HnImportKind; fileName: string; writeMode: HnWriteModeName; periods: string[]
  total: number; new: number; update: number; unknown: number; skipped: number; errors: HnImportIssue[]; lines: HnImportLine[]
}
export interface HnFingerFilter { from: string; to: string; empId?: string; name?: string; dept?: string; type?: string }
export const hnAdminApi = {
  writeMode: () => api.get<{ mode: HnWriteModeName; allowed: string[] }>('/hn/admin/write-mode').then((r) => r.data),
  preview: (kind: HnImportKind, file: File, period?: string) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<HnImportPreview>(`/hn/admin/${kind}/preview`, fd, { params: period ? { period } : {}, timeout: 180000 }).then((r) => r.data)
  },
  commit: (kind: HnImportKind, token: string) => api.post<{ written: number; skipped: number }>(`/hn/admin/${kind}/commit`, { token }, { timeout: 180000 }).then((r) => r.data),
  finger: (f: HnFingerFilter) => api.get<{ from: string; to: string; count: number; rows: HnRow[] }>('/hn/admin/finger', { params: f, timeout: 180000 }).then((r) => r.data),
  fingerExport: async (f: HnFingerFilter) => {
    const res = await api.get<Blob>('/hn/admin/finger/export', { params: f, responseType: 'blob', timeout: 180000 })
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = m ? decodeURIComponent(m[1]) : `VanTay_${f.from}_${f.to}.xlsx`
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}

/* 2026-11-25 [Truong] - HN HR: employee management (list / detail / edit Tbl_Employees) */
export interface HnEmployeeListItem { id: number | null; employeeId: string; fullName: string | null; department: string | null; position: string | null; process: string | null; startWork: string | null; workStatus: string | null; createdAt: string | null }
export interface HnEmployeeList { items: HnEmployeeListItem[]; truncated: boolean; canEdit: boolean; canAdd: boolean; canExport: boolean; writeMode: HnWriteModeName; allowed: string[] }
export interface HnEmployeeDetail {
  id: number | null; employeeId: string; fullName: string | null; department: string | null; position: string | null; process: string | null; title: string | null; titleEn: string | null
  startWork: string | null; endWork: string | null; workStatus: string | null; email: string | null; phone: string | null; birthday: string | null; sex: boolean | null; nation: string | null; married: boolean | null
  identityCard: string | null; identityIssued: string | null; identityPlace: string | null; place: string | null; address: string | null; taxCode: string | null
  education: string | null; educationEn: string | null; school: string | null; major: string | null; createdAt: string | null; hasAvatar: boolean
}
/** Ngày dạng yyyy-MM-dd; avatarBase64 null = giữ ảnh cũ. */
export interface HnEmployeeUpdate {
  fullName: string; department: string; position: string; process?: string | null; title?: string | null
  startWork?: string | null; endWork?: string | null; workStatus?: string | null; email?: string | null; phone?: string | null; birthday?: string | null
  sex?: boolean | null; nation?: string | null; married?: boolean | null; identityCard?: string | null; identityIssued?: string | null; identityPlace?: string | null
  place?: string | null; address?: string | null; taxCode?: string | null; education?: string | null; avatarBase64?: string | null; removeAvatar?: boolean
  /** Chỉ dùng khi thêm mới. */
  employeeId?: string
}
/* 2026-11-26 [Truong] - HN account management (module 'Quản lý tài khoản'); passwords are never returned */
export interface HnAccount { id: number; userId: string; employeeId: string | null; fullName: string | null; department: string | null; groupId: string | null; groupName: string | null; email: string | null; active: boolean; createdAt: string | null; failedLogins: number | null }
export interface HnAccountList { items: HnAccount[]; truncated: boolean; groups: { id: string; name: string }[]; canAdd: boolean; canEdit: boolean; canDelete: boolean; me: string; writeMode: HnWriteModeName; allowed: string[] }
export const hnAccountsApi = {
  list: (q?: string) => api.get<HnAccountList>('/hn/admin/accounts', { params: { q: q || undefined } }).then((r) => r.data),
  create: (b: { employeeId: string; userId?: string; groupId: string; email?: string }) => api.post<HnAccount>('/hn/admin/accounts', b).then((r) => r.data),
  update: (id: number, b: { groupId?: string; active?: boolean; email?: string }) => api.put<HnAccount>(`/hn/admin/accounts/${id}`, b).then((r) => r.data),
  resetPassword: (id: number) => api.post(`/hn/admin/accounts/${id}/reset-password`).then(() => undefined),
  remove: (id: number) => api.delete(`/hn/admin/accounts/${id}`).then(() => undefined),
}

export const hnEmployeesApi = {
  list: (q?: string) => api.get<HnEmployeeList>('/hn/admin/employees', { params: q ? { q } : {} }).then((r) => r.data),
  get: (id: string) => api.get<HnEmployeeDetail>(`/hn/admin/employees/${encodeURIComponent(id)}`).then((r) => r.data),
  /** Ảnh đại diện dạng object URL (người gọi tự revoke); null nếu không có ảnh. */
  avatar: async (id: string) => {
    try { return URL.createObjectURL((await api.get<Blob>(`/hn/admin/employees/${encodeURIComponent(id)}/avatar`, { responseType: 'blob' })).data) }
    catch (e) { if ((e as { response?: { status?: number } }).response?.status === 404) return null; throw e }
  },
  update: (id: string, body: HnEmployeeUpdate) => api.put<HnEmployeeDetail>(`/hn/admin/employees/${encodeURIComponent(id)}`, body).then((r) => r.data),
  create: (body: HnEmployeeUpdate & { employeeId: string }) => api.post<HnEmployeeDetail>('/hn/admin/employees', body).then((r) => r.data),
  /** Tải file Excel 14 cột (cùng bộ lọc q như danh sách). */
  exportFile: async (q?: string) => {
    const res = await api.get<Blob>('/hn/admin/employees/export', { params: q ? { q } : {}, responseType: 'blob', timeout: 180000 })
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = m ? decodeURIComponent(m[1]) : 'DanhSachNhanVien.xlsx'
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}

const KNOWN = new Set(['module_forbidden', 'bad_avatar', 'value_too_long', 'duplicate_employee', 'employee_exists', 'create_failed', 'site_disabled', 'hn_schema_mismatch', 'hn_unavailable', 'invalid_range', 'range_too_long', 'invalid_period', 'no_employee', 'unauthorized', 'not_found', 'site_not_supported', 'invalid_state', 'invalid_status', 'invalid_group', 'invalid_level', 'payslip_not_found', 'payroll_key_missing', 'payroll_decrypt_failed',
  'empty_file', 'file_too_large', 'bad_file', 'bad_layout', 'no_sheet', 'write_disabled', 'preview_expired', 'invalid_input',
  'employees_required', 'too_many_employees', 'employee_not_found', 'invalid_date', 'date_out_of_range', 'invalid_time', 'invalid_shift', 'reason_required', 'reason_too_long',
  'levels_required', 'approver_invalid', 'employee_not_allowed', 'not_current_approver', 'already_decided', 'invalid_action',
  'user_exists', 'employee_has_account', 'employee_inactive', 'self_forbidden'])

/** Mã lỗi (ProblemDetails.title) của lỗi axios; rỗng nếu không có phản hồi. */
export function hnErrorCode(e: unknown): string {
  const d = (e as { response?: { data?: { title?: string; code?: string } } }).response?.data
  if (typeof d?.title === 'string' && d.title) return d.title
  return typeof d?.code === 'string' ? d.code : ''
}
/** Khoá i18n thân thiện cho lỗi của API HN (mã lạ hoặc mất mạng: lỗi chung). */
export function hnErrorKey(e: unknown): string {
  const c = hnErrorCode(e)
  if (KNOWN.has(c)) return `hn.err.${c}`
  const st = (e as { response?: { status?: number } }).response?.status
  if (st === 403) return 'hn.err.module_forbidden'
  if (st === 503) return 'hn.err.hn_unavailable'
  return 'hn.err.generic'
}
