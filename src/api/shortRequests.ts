import { api } from './client'
import type { ApproverPick, CreateResult, SubmitResult, SubmittedScope } from './requests'

/** goout = ra ngoài · late = đi muộn · early = về sớm (mỗi loại đúng một người duyệt). */
export type ShortKind = 'goout' | 'late' | 'early'

export interface ShortForm {
  employeeIds: string[]
  date: string
  /** Chỉ đơn ra ngoài: "tới ngày" (tuỳ chọn). */
  dateTo?: string
  /** Ra ngoài: giờ ra. Đi muộn / về sớm: từ giờ (HH:mm). */
  timeFrom: string
  /** Chỉ đi muộn / về sớm: đến giờ (HH:mm). */
  timeTo?: string
  company: boolean
  comeBack: boolean
  comeBackTime?: string
  reason: string
  approver: ApproverPick
}

export interface ShortDraft {
  id: number; employeeId: string; fullName: string; department: string | null
  date: string; dateTo: string | null; timeFrom: string; timeTo: string
  purpose: 'company' | 'personal' | null; comeBackTime: string | null; reason: string; approverName: string
}

export interface ShortSubmitted extends ShortDraft {
  senderId: string; senderName: string; submittedAt: string | null
  overall: 'approved' | 'rejected' | 'waiting'
  decidedAt: string | null; rejectReason: string | null
  securityName: string | null; securityAt: string | null
}

const base = (kind: ShortKind) => `/requests/short/${kind}`

export const shortRequests = {
  drafts: (kind: ShortKind) => api.get<ShortDraft[]>(`${base(kind)}/drafts`).then((r) => r.data),
  create: (kind: ShortKind, form: ShortForm) => api.post<CreateResult>(`${base(kind)}/drafts`, form).then((r) => r.data),
  remove: (kind: ShortKind, ids: number[]) => api.post<{ deleted: number }>(`${base(kind)}/drafts/delete`, { ids }).then((r) => r.data),
  submit: (kind: ShortKind, ids: number[]) => api.post<SubmitResult>(`${base(kind)}/submit`, { ids }).then((r) => r.data),
  submitted: (kind: ShortKind, from: string, to: string, scope: SubmittedScope, sender?: string) =>
    api.get<ShortSubmitted[]>(`${base(kind)}/submitted`, { params: { from, to, scope, sender: sender || undefined } }).then((r) => r.data),
}
