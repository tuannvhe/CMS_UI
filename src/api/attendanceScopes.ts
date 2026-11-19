import { api } from './client'

/** Một mục phạm vi: bộ phận (part rỗng = cả bộ phận) hoặc một part của bộ phận. */
export interface ScopeEntry { department: string; part: string }
/** Một người được cấp xem Tổng hợp công theo phạm vi: includeOp = toàn bộ công nhân OP; entries = các bộ phận / part thêm; people = số người đang làm trong phạm vi. */
export interface AttendanceScopeRow {
  userId: string; fullName: string; employeeId: string | null; department: string | null
  includeOp: boolean; entries: ScopeEntry[]; people: number; updatedBy: string | null; updatedAt: string | null
}
export interface AttendanceScopeList { ready: boolean; items: AttendanceScopeRow[] }
/** Bộ phận và các part đang có người làm (để chọn phạm vi). */
export interface ScopeDepartment { department: string; parts: string[]; people: number }
/** Phạm vi của chính người đăng nhập. */
export interface MyScope { allowed: boolean; includeOp: boolean; entries: ScopeEntry[]; departments: string[]; people: number }

const base = '/admin/attendance-scopes'

export const attendanceScopes = {
  list: () => api.get<AttendanceScopeList>(base).then((r) => r.data),
  options: () => api.get<ScopeDepartment[]>(`${base}/options`).then((r) => r.data),
  save: (userId: string, b: { includeOp: boolean; entries: ScopeEntry[] }) => api.put(`${base}/${encodeURIComponent(userId)}`, b).then(() => undefined),
  remove: (userId: string) => api.delete(`${base}/${encodeURIComponent(userId)}`).then(() => undefined),
  /** Phạm vi của chính mình (màn Công được cấp). */
  mine: () => api.get<MyScope>('/attendance/scoped/me').then((r) => r.data),
}
