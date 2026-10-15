import { api } from './client'

export type RequestKind = 'finger' | 'overtime'

export interface Option { value: string; label: string }
export interface Approver { userId: string; name: string; email?: string | null; level: number }
export interface ShiftTimes { start: string[]; end: string[] }

export interface ApproverPick { name?: string; userId?: string }
export interface ApproversInput { one?: ApproverPick; two?: ApproverPick; three?: ApproverPick }

export interface FingerForm {
  employeeIds: string[]; date: string; shift: string; timeIn: string; timeOut: string
  reasonCode: string; reasonText?: string; approvers: ApproversInput
}
export interface OvertimeForm {
  employeeIds: string[]; date: string; shift: string; timeStart: string; timeEnd: string
  reasonText: string; approvers: ApproversInput
}
export type RequestForm = FingerForm | OvertimeForm

export interface CreateResult { created: number; skipped: { employeeId: string; reason: string; detail?: string | null }[]; warnings?: { employeeId: string; reason: string; detail?: string | null }[] }
export interface SubmitResult { groupId: string; submitted: number }

export interface DraftRow {
  id: number; employeeId: string; fullName: string; department: string | null; date: string; dayName: string
  timeFrom: string; timeTo: string; hours: string; minutes: string; reason: string; shift: string
  approverOne: string; approverTwo: string; approverThree: string
}

export type StepStatus = 'none' | 'waiting' | 'approved' | 'rejected'
export interface ApprovalStep { name: string; status: StepStatus; rejectReason: string | null }
export interface SubmittedRow {
  employeeId: string; fullName: string; department: string | null; date: string; dayName: string
  timeFrom: string; timeTo: string; hours: string; reason: string; shift: string
  senderId: string; senderName: string; submittedAt: string | null
  one: ApprovalStep; two: ApprovalStep; three: ApprovalStep; overall: 'approved' | 'rejected' | 'waiting'
}

/** sent = do tôi gửi · mine = đơn của chính tôi · all = tất cả (chỉ quản trị) */
export type SubmittedScope = 'sent' | 'mine' | 'all'

const get = <T>(url: string, params?: object) => api.get<T>(`/requests/${url}`, { params }).then((r) => r.data)
const post = <T>(url: string, body: object) => api.post<T>(`/requests/${url}`, body).then((r) => r.data)
const put = (url: string, body: object) => api.put(`/requests/${url}`, body).then(() => undefined)

/** Nội dung đầy đủ của một đơn nháp (nạp vào form sửa). approverIds theo cấp; cấp không dùng = ''. */
export interface DraftForm {
  id: number; employeeId: string; fullName: string; date: string; dateTo: string | null; shift: string; timeFrom: string; timeTo: string
  reasonCode: string | null; reasonText: string | null; totalDays: string | null; personTakeJob: string | null; approverIds: string[]
}

export const lookups = {
  departments: () => get<string[]>('lookups/departments'),
  employees: (department: string) => get<Option[]>('lookups/employees', { department }),
  approvers: (department: string) => get<Approver[]>('lookups/approvers', { department }),
  shifts: () => get<Option[]>('lookups/shifts'),
  times: (kind: RequestKind, shift: string) =>
    get<ShiftTimes>(kind === 'finger' ? 'lookups/finger-times' : 'lookups/overtime-times', { shift }),
  fingerReasons: () => get<Option[]>('lookups/finger-reasons'),
}

export const requests = {
  drafts: (kind: RequestKind) => get<DraftRow[]>(`${kind}/drafts`),
  create: (kind: RequestKind, form: RequestForm) => post<CreateResult>(`${kind}/drafts`, form),
  draft: (kind: RequestKind, id: number) => get<DraftForm>(`${kind}/drafts/${id}`),
  updateDraft: (kind: RequestKind, id: number, form: RequestForm) => put(`${kind}/drafts/${id}`, form),
  remove: (kind: RequestKind, ids: number[]) => post<{ deleted: number }>(`${kind}/drafts/delete`, { ids }),
  submit: (kind: RequestKind, ids: number[]) => post<SubmitResult>(`${kind}/submit`, { ids }),
  submitted: (kind: RequestKind, from: string, to: string, scope: SubmittedScope, sender?: string) =>
    get<SubmittedRow[]>(`${kind}/submitted`, { from, to, scope, sender: sender || undefined }),
}

/** Mã lỗi (title của ProblemDetails) từ lỗi axios. */
export function apiErrorCode(e: unknown): { code: string; detail: string } {
  const r = (e as { response?: { data?: { title?: string; detail?: string } } }).response?.data
  return { code: r?.title ?? '', detail: r?.detail ?? '' }
}

// ---------------- Nghỉ phép ----------------
export interface LeaveApproversInput { one?: ApproverPick; two?: ApproverPick; three?: ApproverPick; four?: ApproverPick }

export interface LeaveForm {
  employeeIds: string[]; from: string; to: string; totalDays: number; shift: string; timeIn: string; timeOut: string
  reasonCode: string; otherReason?: string; personTakeJob: string; approvers: LeaveApproversInput
}

export interface LeaveDraftRow {
  id: number; employeeId: string; fullName: string; department: string | null; from: string; to: string; totalDays: string
  timeIn: string; timeOut: string; shift: string; reason: string; personTakeJob: string
  approverOne: string; approverTwo: string; approverThree: string; approverFour: string
}

export interface LeaveSubmittedRow {
  employeeId: string; fullName: string; department: string | null; from: string; to: string; totalDays: string
  timeIn: string; timeOut: string; shift: string; reason: string; personTakeJob: string
  senderId: string; senderName: string; submittedAt: string | null
  one: ApprovalStep; two: ApprovalStep; three: ApprovalStep; four: ApprovalStep; overall: 'approved' | 'rejected' | 'waiting'
}

export interface LeaveBalance {
  employeeId: string; fullName: string; department: string | null; year: number
  entitledHours: number; usedHours: number; remainingHours: number; monthlyUsed: number[]
}

export const leave = {
  balance: (employeeIds?: string[]) =>
    get<LeaveBalance[]>('leave/balance', { employeeIds: employeeIds && employeeIds.length ? employeeIds.join(',') : undefined }),
  reasons: () => get<Option[]>('lookups/leave-reasons'),
  drafts: () => get<LeaveDraftRow[]>('leave/drafts'),
  create: (form: LeaveForm) => post<CreateResult>('leave/drafts', form),
  draft: (id: number) => get<DraftForm>(`leave/drafts/${id}`),
  updateDraft: (id: number, form: LeaveForm) => put(`leave/drafts/${id}`, form),
  remove: (ids: number[]) => post<{ deleted: number }>('leave/drafts/delete', { ids }),
  submit: (ids: number[]) => post<SubmitResult>('leave/submit', { ids }),
  submitted: (from: string, to: string, scope: SubmittedScope, sender?: string) =>
    get<LeaveSubmittedRow[]>('leave/submitted', { from, to, scope, sender: sender || undefined }),
}
