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

export const dataRecovery = {
  status: () => api.get<SnapshotStatus>('/admin/data/status').then((r) => r.data),
  search: (q: SnapshotQuery) => api.get<SnapshotSummary[]>('/admin/data/snapshots', { params: q }).then((r) => r.data),
  detail: (id: number) => api.get<SnapshotDetail>(`/admin/data/snapshots/${id}`).then((r) => r.data),
  restore: (id: number, force: boolean) => api.post<RestoreSummary>(`/admin/data/snapshots/${id}/restore`, { force }).then((r) => r.data),
  restoreRequest: (reqId: string, force: boolean) => api.post<RestoreSummary>(`/admin/data/requests/${reqId}/restore`, { force }).then((r) => r.data),
}

/** Script tạo bảng ảnh chụp dữ liệu (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const DATA_SNAPSHOT_TABLE_SQL = `CREATE TABLE dbo.Tbl_DataSnapshots (
    ID         bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    AT         datetime NOT NULL,
    ACTORID    nvarchar(50)  NOT NULL,
    ACTION     nvarchar(120) NOT NULL,
    REQID      nvarchar(36)  NOT NULL,
    TABLENAME  nvarchar(128) NOT NULL,
    OP         nvarchar(10)  NOT NULL,
    KEYJSON    nvarchar(400) NOT NULL,
    BEFOREJSON nvarchar(max) NULL,
    AFTERJSON  nvarchar(max) NULL,
    RESTOREDAT datetime NULL,
    RESTOREDBY nvarchar(50) NULL
);
CREATE INDEX IX_Tbl_DataSnapshots_AT ON dbo.Tbl_DataSnapshots (AT);
CREATE INDEX IX_Tbl_DataSnapshots_REQ ON dbo.Tbl_DataSnapshots (REQID);
CREATE INDEX IX_Tbl_DataSnapshots_TABLE ON dbo.Tbl_DataSnapshots (TABLENAME, AT);`
