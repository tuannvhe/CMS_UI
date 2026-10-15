import { api } from './client'
import type { ApprovalStep, RequestKind } from './requests'

/** finger | overtime | leave (nghỉ phép có 4 cấp duyệt) | goout | late | early (ra ngoài, đi muộn, về sớm: một người duyệt) */
export type ApprovalKind = RequestKind | 'leave' | 'goout' | 'late' | 'early'

/** Các loại đơn chỉ có một người duyệt. */
export const isSingleApprover = (k: ApprovalKind) => k === 'goout' || k === 'late' || k === 'early'

export interface PendingGroup { level: 1 | 2 | 3 | 4; groupId: string; department: string | null; date: string | null; count: number }

export interface ApprovalRow {
  id: number; employeeId: string; fullName: string; department: string | null; date: string; dayName: string
  timeFrom: string; timeTo: string; hours: string; reason: string; shift: string
  senderId: string; senderName: string; submittedAt: string | null
  one: ApprovalStep; two: ApprovalStep; three: ApprovalStep; four: ApprovalStep
  /** Chỉ đơn nghỉ: ngày kết thúc và người nhận bàn giao (hours = số ngày nghỉ) */
  dateTo: string | null; extra: string
  /** Chỉ đơn ra ngoài: mục đích và giờ quay lại (null nếu không quay lại) */
  purpose: 'company' | 'personal' | null; comeBackTime: string | null
  /** Chỉ đơn tăng ca: các đơn khác của cùng người trùng khung giờ với đơn này */
  overlaps?: OtOverlapInfo[]
}

export interface OtOverlapInfo { id: number; date: string; start: string; end: string; hours: string; state: 'approved' | 'pending'; overlapHours: number }

export interface DoneRow {
  id: number; level: number; groupId: string; employeeId: string; fullName: string; department: string | null
  date: string; dateTo: string | null; hours: string; senderName: string; approved: boolean; decidedAt: string | null; reason: string | null
}

const base = (kind: ApprovalKind) => `/approvals/${kind}`

export const approvals = {
  pending: (kind: ApprovalKind) => api.get<PendingGroup[]>(`${base(kind)}/pending`).then((r) => r.data),
  done: (kind: ApprovalKind, from: string, to: string) => api.get<DoneRow[]>(`${base(kind)}/done`, { params: { from, to } }).then((r) => r.data),
  group: (kind: ApprovalKind, level: number, groupId: string) =>
    api.get<ApprovalRow[]>(`${base(kind)}/groups/${encodeURIComponent(groupId)}`, { params: { level } }).then((r) => r.data),
  approve: (kind: ApprovalKind, level: number, groupId: string) => api.post(`${base(kind)}/approve`, { level, groupId }).then(() => undefined),
  approveMany: (kind: ApprovalKind, items: { level: number; groupId: string }[]) =>
    api.post<{ groups: number; forms: number; failed: string[] }>(`${base(kind)}/approve-many`, { items }, { timeout: 120000 }).then((r) => r.data),
  approveRecords: (kind: ApprovalKind, level: number, groupId: string, ids: number[]) =>
    api.post<{ approved: number }>(`${base(kind)}/approve-records`, { level, groupId, ids }).then((r) => r.data),
  rejectGroup: (kind: ApprovalKind, level: number, groupId: string, reason: string) =>
    api.post(`${base(kind)}/reject-group`, { level, groupId, reason }).then(() => undefined),
  rejectRecord: (kind: ApprovalKind, level: number, groupId: string, id: number, reason: string) =>
    api.post(`${base(kind)}/reject-record`, { level, groupId, id, reason }).then(() => undefined),
}

export interface PendingSummary { kind: ApprovalKind; groups: number; forms: number }
export const approvalSummary = () => api.get<PendingSummary[]>('/approvals/summary').then((r) => r.data)
