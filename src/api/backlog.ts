import { api } from './client'

export interface BacklogKind { kind: string; level: number; forms: number; oldestDays: number }
export interface BacklogRow { approverKey: string; approverId: string; approverName: string; email: string | null; reachable: boolean; forms: number; groups: number; oldestDays: number; kinds: BacklogKind[] }

export const backlog = {
  report: (days: number) => api.get<BacklogRow[]>('/admin/approval-backlog', { params: { days } }).then((r) => r.data),
  remind: (days: number, approverKey?: string) => api.post<{ reminded: number }>('/admin/approval-backlog/remind', { days, approverKey }).then((r) => r.data),
}
