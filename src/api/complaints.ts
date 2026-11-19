import { api } from './client'

export type ComplaintStatus = 'new' | 'processing' | 'resolved' | 'rejected'
export type ComplaintCategory = 'missing_in' | 'missing_out' | 'wrong_ot' | 'wrong_leave' | 'wrong_hours' | 'other'
export const COMPLAINT_CATEGORIES: ComplaintCategory[] = ['missing_in', 'missing_out', 'wrong_ot', 'wrong_leave', 'wrong_hours', 'other']
export interface ComplaintRow {
  id: number; employeeId: string; employeeName: string; department: string | null; workDate: string; category: ComplaintCategory; message: string; status: ComplaintStatus
  handler: string | null; handlerName: string | null; reply: string | null; dueDate: string; createdAt: string | null; resolvedAt: string | null; overdue: boolean
}
export interface ComplaintLimits {
  max: number; windowHours: number; minGapMinutes: number; cooldownHours: number; used: number
  /** Giờ Việt Nam (không kèm múi giờ); null = gửi được ngay. */
  nextAllowedAt: string | null
  blocked: { date: string; reason: 'open' | 'cooldown'; until: string | null }[]
}
export interface ComplaintList { ready: boolean; items: ComplaintRow[]; limits?: ComplaintLimits }

export const complaints = {
  mine: () => api.get<ComplaintList>('/complaints/mine').then((r) => r.data),
  create: (b: { workDate: string; category: ComplaintCategory; message: string }) => api.post<{ id: number }>('/complaints', b).then((r) => r.data),
  manage: (p: { status?: string; search?: string }) => api.get<ComplaintList>('/admin/complaints', { params: p }).then((r) => r.data),
  take: (id: number) => api.post(`/admin/complaints/${id}/take`).then(() => undefined),
  close: (id: number, status: 'resolved' | 'rejected', reply: string) => api.post(`/admin/complaints/${id}/close`, { status, reply }).then(() => undefined),
}

