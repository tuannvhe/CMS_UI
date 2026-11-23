import { api } from './client'

export interface HealthRow { id: string; title: string; detail: string | null; department: string | null }
export interface HealthCheck { key: string; severity: 'error' | 'warning' | 'info'; total: number; rows: HealthRow[] }
export interface HealthReport { at: string; take: number; problems: number; checks: HealthCheck[] }

/** Người hồ sơ ghi đã nghỉ mà còn cờ bật / tài khoản mở / đứng trong line duyệt. */
export interface QuitPerson { employeeId: string; name: string; department: string | null; statusWorking: string | null; flagOn: boolean; accountOn: boolean; approverLines: number }
export interface QuitSyncResult { applied: boolean; skippedReason: string | null; people: number; flagsFixed: number; accountsLocked: number; linesOff: number; items: QuitPerson[]; manual: boolean }

export const dataHealth = {
  quitPreview: () => api.get<{ items: QuitPerson[]; enabled: boolean; runAt: string; maxAuto: number }>('/admin/data-health/quit-sync', { timeout: 120000 }).then((r) => r.data),
  quitRun: () => api.post<QuitSyncResult>('/admin/data-health/quit-sync', null, { timeout: 300000 }).then((r) => r.data),
  lockResigned: () => api.post<{ count: number }>('/admin/data-health/lock-resigned', null, { timeout: 120000 }).then((r) => r.data),
  disableApprovers: (kind: string) => api.post<{ count: number }>(`/admin/data-health/disable-approvers/${kind}`, null, { timeout: 120000 }).then((r) => r.data),
  report: (take?: number) => api.get<HealthReport>('/admin/data-health', { params: { take }, timeout: 120000 }).then((r) => r.data),
}
