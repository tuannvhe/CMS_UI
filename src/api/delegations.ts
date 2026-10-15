import { api } from './client'

export type DelegationStatus = 'active' | 'upcoming' | 'expired' | 'cancelled'
export interface DelegationRow { id: number; fromUser: string; fromName: string; toUser: string; toName: string; startDate: string; endDate: string; reason: string | null; status: DelegationStatus; createdBy: string | null }
export interface DelegationList { ready: boolean; items: DelegationRow[] }
export interface PersonHit { userId: string; fullName: string; email: string | null }
export interface DelegationInput { toUser: string; startDate: string; endDate: string; reason?: string; fromUser?: string }

export const delegations = {
  list: (all: boolean) => api.get<DelegationList>('/delegations', { params: { all } }).then((r) => r.data),
  people: (search: string) => api.get<PersonHit[]>('/delegations/people', { params: { search } }).then((r) => r.data),
  create: (b: DelegationInput) => api.post<{ id: number }>('/delegations', b).then((r) => r.data),
  cancel: (id: number) => api.post(`/delegations/${id}/cancel`).then(() => undefined),
}

/** Script tạo bảng ủy quyền duyệt (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const DELEGATION_TABLE_SQL = `CREATE TABLE dbo.Tbl_ApprovalDelegations (
    ID         int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FROMUSER   nvarchar(50)  NOT NULL,   -- người ủy quyền (người duyệt gốc)
    TOUSER     nvarchar(50)  NOT NULL,   -- người được ủy quyền
    STARTDATE  date          NOT NULL,
    ENDDATE    date          NOT NULL,
    REASON     nvarchar(200) NULL,
    CANCELLED  bit           NOT NULL CONSTRAINT DF_Tbl_ApprovalDelegations_Cancelled DEFAULT 0,
    CREATEBY   nvarchar(50)  NULL,
    CREATEDATE datetime      NULL
);
CREATE INDEX IX_Tbl_ApprovalDelegations_TO ON dbo.Tbl_ApprovalDelegations (TOUSER, STARTDATE, ENDDATE);
CREATE INDEX IX_Tbl_ApprovalDelegations_FROM ON dbo.Tbl_ApprovalDelegations (FROMUSER, STARTDATE, ENDDATE);`
