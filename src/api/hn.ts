import { api } from './client'
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
export interface HnOtGroup { groupId: string; firstId: number | string; date: string; department: string; reason: string | null; count: number; pendingForMe: boolean }
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
  profile: () => api.get<HnProfile>('/hn/profile').then((r) => r.data),
  timework: (period?: string, take?: number) => api.get<{ periods: HnRow[] }>('/hn/timework', { params: { period, take } }).then((r) => r.data),
  payslipPeriods: () => api.get<{ periods: HnPayslipPeriod[] }>('/hn/payslip/periods').then((r) => r.data),
  payslip: (period?: string) => api.get<HnPayslip>('/hn/payslip', { params: period ? { period } : {} }).then((r) => r.data),
  finger: (from: string, to: string) => api.get<HnFinger>('/hn/finger', { params: { from, to } }).then((r) => r.data),
  notifications: (take = 30) => api.get<HnNotificationList>('/hn/notifications', { params: { take } }).then((r) => r.data),
  markRead: (id: string) => api.post(`/hn/notifications/${encodeURIComponent(id)}/read`).then(() => undefined),
}

const KNOWN = new Set(['module_forbidden', 'site_disabled', 'hn_schema_mismatch', 'hn_unavailable', 'invalid_range', 'range_too_long', 'invalid_period', 'no_employee', 'unauthorized', 'not_found', 'site_not_supported', 'invalid_state', 'invalid_status', 'invalid_group', 'invalid_level', 'payslip_not_found', 'payroll_key_missing', 'payroll_decrypt_failed'])

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
