import { api } from './client'

export interface AuditRow { id: number; at: string; actorId: string; actorName: string; action: string; entity: string; entityKey: string | null; detail: string | null; before: string | null; after: string | null; status: number; ip: string | null; note: string | null }
export interface AuditResult { ready: boolean; items: AuditRow[] }
export interface AuditQuery { from: string; to: string; actor?: string; entity?: string; text?: string; failedOnly?: boolean; take?: number }

export const audit = {
  search: (q: AuditQuery) => api.get<AuditResult>('/admin/audit', { params: q }).then((r) => r.data),
}

/** Script tạo bảng nhật ký thao tác (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const AUDIT_TABLE_SQL = `CREATE TABLE dbo.Tbl_AuditLog (
    ID         bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    AT         datetime NOT NULL,
    ACTORID    nvarchar(50)  NOT NULL,
    ACTORNAME  nvarchar(100) NULL,
    ACTION     nvarchar(120) NOT NULL,
    ENTITY     nvarchar(60)  NOT NULL,
    ENTITYKEY  nvarchar(100) NULL,
    DETAIL     nvarchar(max) NULL,
    BEFOREJSON nvarchar(max) NULL,
    AFTERJSON  nvarchar(max) NULL,
    STATUSCODE int NOT NULL,
    IP         nvarchar(45)  NULL,
    NOTE       nvarchar(500) NULL
);
CREATE INDEX IX_Tbl_AuditLog_AT ON dbo.Tbl_AuditLog (AT);
CREATE INDEX IX_Tbl_AuditLog_ACTOR ON dbo.Tbl_AuditLog (ACTORID, AT);`
