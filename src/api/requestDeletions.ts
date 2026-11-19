import { api } from './client'

export type DeletableKind = 'overtime' | 'finger' | 'leave'

/** Một đơn đã duyệt đủ cấp. Đơn nghỉ (mọi loại nghỉ) dùng date → dateTo; amount là số giờ (tăng ca, quên vân tay) hoặc số ngày (đơn nghỉ). */
export interface ApprovedRow {
  id: number
  employeeId: string
  fullName: string
  department: string | null
  date: string
  dateTo: string | null
  timeFrom: string
  timeTo: string
  amount: string
  reason: string
  /** Chỉ đơn nghỉ: tên loại nghỉ (nghỉ phép năm, việc riêng, BHXH, khám thai…). Rỗng với tăng ca / quên vân tay. */
  leaveType: string
  groupId: string
  senderId: string
  senderName: string
  submittedAt: string | null
}

export interface DeleteResult { deleted: ApprovedRow[]; skipped: number; archived: boolean }

export const requestDeletions = {
  find: (kind: DeletableKind, employeeId: string, from: string, to: string) =>
    api.get<ApprovedRow[]>('/admin/request-deletions', { params: { kind, employeeId, from, to } }).then((r) => r.data),
  remove: (kind: DeletableKind, ids: number[]) =>
    api.post<DeleteResult>('/admin/request-deletions/delete', { kind, ids }).then((r) => r.data),
}
