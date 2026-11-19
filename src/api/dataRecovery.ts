import { api } from './client'

export interface SnapshotSummary { id: number; at: string; actorId: string; action: string; reqId: string; table: string; op: 'UPDATE' | 'DELETE' | 'INSERT'; key: string; restoredAt: string | null; restoredBy: string | null }
export interface SnapshotRow extends SummaryBase { before: string | null; after: string | null }
interface SummaryBase { id: number; at: string; actorId: string; action: string; reqId: string; table: string; op: string; key: string; restoredAt: string | null; restoredBy: string | null }
export interface ColumnDiff { column: string; current: string | null; snapshot: string | null }
export interface SnapshotDetail { row: SnapshotRow; current: string | null; diff: ColumnDiff[]; newerExists: boolean }
export interface SnapshotStatus { ready: boolean; retentionDays: number; enabled: boolean; total: number; oldest: string | null; tables: { table: string; count: number }[] }
export interface RestoreOutcome { id: number; table: string; key: string; result: string }
export interface RestoreSummary { applied: boolean; restored: number; same: number; conflict: number; failed: number; items: RestoreOutcome[] }
export interface SnapshotQuery { from: string; to: string; table?: string; actor?: string; text?: string; take?: number }

export interface DeletedItem { reqId: string; at: string; actorId: string; action: string; module: string; title: string; primaryId: number; count: number; rows: number; tables: { table: string; count: number }[]; purgeAt: string }
export interface DeletedPage { items: DeletedItem[]; total: number }
export interface DeletedQuery { from: string; to: string; module?: string; text?: string; page: number; pageSize: number }
/** Các module của tab "Đã xóa" (khớp DeletedRegistry ở backend). */
export const DELETED_MODULES = ['overtime', 'finger', 'leave', 'short', 'evaluation', 'line', 'recruit', 'payroll', 'meal', 'trip', 'calendar', 'kpi', 'idcard', 'special', 'feed', 'notice', 'meeting', 'user'] as const

export const dataRecovery = {
  deleted: (q: DeletedQuery) => api.get<DeletedPage>('/admin/data/deleted', { params: q }).then((r) => r.data),
  status: () => api.get<SnapshotStatus>('/admin/data/status').then((r) => r.data),
  search: (q: SnapshotQuery) => api.get<SnapshotSummary[]>('/admin/data/snapshots', { params: q }).then((r) => r.data),
  detail: (id: number) => api.get<SnapshotDetail>(`/admin/data/snapshots/${id}`).then((r) => r.data),
  restore: (id: number, force: boolean) => api.post<RestoreSummary>(`/admin/data/snapshots/${id}/restore`, { force }).then((r) => r.data),
  restoreRequest: (reqId: string, force: boolean) => api.post<RestoreSummary>(`/admin/data/requests/${reqId}/restore`, { force }).then((r) => r.data),
}

