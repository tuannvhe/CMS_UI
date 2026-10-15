import { api } from './client'

export interface HealthRow { id: string; title: string; detail: string | null; department: string | null }
export interface HealthCheck { key: string; severity: 'error' | 'warning' | 'info'; total: number; rows: HealthRow[] }
export interface HealthReport { at: string; take: number; problems: number; checks: HealthCheck[] }

export const dataHealth = {
  lockResigned: () => api.post<{ count: number }>('/admin/data-health/lock-resigned', null, { timeout: 120000 }).then((r) => r.data),
  disableApprovers: (kind: string) => api.post<{ count: number }>(`/admin/data-health/disable-approvers/${kind}`, null, { timeout: 120000 }).then((r) => r.data),
  report: (take?: number) => api.get<HealthReport>('/admin/data-health', { params: { take }, timeout: 120000 }).then((r) => r.data),
}
