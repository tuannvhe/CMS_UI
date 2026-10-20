import { api } from './client'

export type RecruitStatus = 'new' | 'screening' | 'screen_fail' | 'to_schedule' | 'withdrawn'
export type RecruitLevel = 'op' | 'staff'
export const RECRUIT_STATUSES: RecruitStatus[] = ['new', 'screening', 'to_schedule', 'screen_fail', 'withdrawn']
export const STATUS_TONE: Record<RecruitStatus, string> = { new: 'warn', screening: 'info', to_schedule: 'good', screen_fail: 'bad', withdrawn: 'muted' }

export interface RecruitApplication {
  id: number; fullName: string; phone: string | null; email: string | null; position: string; level: RecruitLevel; department: string | null; factory: string | null
  status: RecruitStatus; note: string | null; restricted: boolean; hasFile: boolean; createdBy: string; createdAt: string; closedAt: string | null
}
export interface RecruitScreening {
  id: number; applicationId: number; reviewerId: string; reviewerName: string | null; sentAt: string; dueDate: string
  decision: 'invite' | 'reject' | null; comment: string | null; decidedAt: string | null; revoked: boolean; overdue: boolean
}
export interface RecruitEvent { id: number; kind: string; fromStatus: string | null; toStatus: string | null; byUser: string; at: string; note: string | null }
export interface RecruitDetail { application: RecruitApplication; screenings: RecruitScreening[]; events: RecruitEvent[]; file: { id: number; name: string; size: number; uploadedAt: string } | null }
export interface RecruitList { ready: boolean; items: RecruitApplication[] }
export interface RecruitMine { screening: RecruitScreening; application: RecruitApplication }
export interface RecruitUser { userId: string; fullName: string }

export interface RecruitCreate {
  fullName: string; phone?: string; email?: string; position: string; level: RecruitLevel; department?: string; factory?: string; note?: string; restricted?: boolean; file?: File
}

const form = (v: Record<string, unknown>) => {
  const f = new FormData()
  Object.entries(v).forEach(([k, val]) => { if (val !== undefined && val !== null && val !== '') f.append(k, val instanceof File ? val : String(val)) })
  return f
}

/** Đường dẫn xem CV (PDF) — cùng nguồn gốc nên cookie phiên tự gửi kèm, không có đường dẫn công khai. */
export const cvUrl = (id: number, admin: boolean) => (admin ? `/api/admin/recruit/${id}/cv` : `/api/recruit/${id}/cv`)

export const recruit = {
  list: (p: { status?: string; level?: string; search?: string }) => api.get<RecruitList>('/admin/recruit', { params: p }).then((r) => r.data),
  get: (id: number) => api.get<RecruitDetail>(`/admin/recruit/${id}`).then((r) => r.data),
  create: (b: RecruitCreate) => api.post<{ id: number }>('/admin/recruit', form({ ...b, restricted: b.restricted ? 'true' : 'false' })).then((r) => r.data),
  replaceCv: (id: number, file: File) => api.post(`/admin/recruit/${id}/cv`, form({ file })).then(() => undefined),
  send: (id: number, reviewers: string[], dueDays?: number) => api.post(`/admin/recruit/${id}/send`, { reviewers, dueDays }).then(() => undefined),
  revoke: (id: number, userId: string) => api.post(`/admin/recruit/${id}/revoke`, { userId }).then(() => undefined),
  toSchedule: (id: number) => api.post(`/admin/recruit/${id}/to-schedule`).then(() => undefined),
  reopen: (id: number) => api.post(`/admin/recruit/${id}/reopen`).then(() => undefined),
  withdraw: (id: number, note?: string) => api.post(`/admin/recruit/${id}/withdraw`, { note }).then(() => undefined),
  users: (q: string) => api.get<RecruitUser[]>('/admin/recruit/users', { params: { q } }).then((r) => r.data),
  mine: (pending = false) => api.get<RecruitMine[]>('/recruit/mine', { params: { pending } }).then((r) => r.data),
  mineGet: (id: number) => api.get<RecruitDetail>(`/recruit/${id}`).then((r) => r.data),
  decide: (id: number, decision: 'invite' | 'reject', comment?: string) => api.post(`/recruit/${id}/decide`, { decision, comment }).then(() => undefined),
}

/** Script tạo các bảng tuyển dụng (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng, không đụng bảng cũ). */
export const RECRUIT_TABLES_SQL = `CREATE TABLE dbo.Tbl_Rec_Application (
    ID          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FULLNAME    nvarchar(100)  NOT NULL,
    PHONE       nvarchar(30)   NULL,
    EMAIL       nvarchar(200)  NULL,
    POSITION    nvarchar(100)  NOT NULL,
    LEVEL       nvarchar(10)   NOT NULL,   -- op | staff
    DEPARTMENT  nvarchar(100)  NULL,
    FACTORY     nvarchar(50)   NULL,
    STATUS      nvarchar(16)   NOT NULL,   -- new | screening | to_schedule | screen_fail | withdrawn
    NOTE        nvarchar(1000) NULL,
    RESTRICTED  bit            NOT NULL DEFAULT 0,
    CREATEDBY   nvarchar(50)   NOT NULL,
    CREATEDATE  datetime       NULL,
    UPDATEDATE  datetime       NULL,
    CLOSEDDATE  datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_Application_STATUS ON dbo.Tbl_Rec_Application (STATUS, ID);

CREATE TABLE dbo.Tbl_Rec_File (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    STOREDNAME   nvarchar(64)   NOT NULL,
    ORIGINALNAME nvarchar(200)  NOT NULL,
    SIZE         bigint         NOT NULL,
    UPLOADEDBY   nvarchar(50)   NOT NULL,
    UPLOADEDAT   datetime       NULL,
    PURGEDAT     datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_File_APP ON dbo.Tbl_Rec_File (APPLICATIONID);

CREATE TABLE dbo.Tbl_Rec_Screening (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    REVIEWERID   nvarchar(50)   NOT NULL,
    SENTBY       nvarchar(50)   NOT NULL,
    SENTAT       datetime       NULL,
    DUEDATE      date           NOT NULL,
    DECISION     nvarchar(10)   NULL,       -- invite | reject
    COMMENT      nvarchar(1000) NULL,
    DECIDEDAT    datetime       NULL,
    REVOKED      bit            NOT NULL DEFAULT 0
);
CREATE INDEX IX_Tbl_Rec_Screening_APP ON dbo.Tbl_Rec_Screening (APPLICATIONID, REVIEWERID);
CREATE INDEX IX_Tbl_Rec_Screening_REV ON dbo.Tbl_Rec_Screening (REVIEWERID, REVOKED, DECISION);

CREATE TABLE dbo.Tbl_Rec_Event (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    KIND         nvarchar(30)   NOT NULL,
    FROMSTATUS   nvarchar(16)   NULL,
    TOSTATUS     nvarchar(16)   NULL,
    BYUSER       nvarchar(50)   NOT NULL,
    AT           datetime       NULL,
    NOTE         nvarchar(1000) NULL
);
CREATE INDEX IX_Tbl_Rec_Event_APP ON dbo.Tbl_Rec_Event (APPLICATIONID);

CREATE TABLE dbo.Tbl_Rec_FileAccess (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    FILEID       int            NOT NULL,
    USERID       nvarchar(50)   NOT NULL,
    ACTION       nvarchar(10)   NOT NULL,
    AT           datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_FileAccess_APP ON dbo.Tbl_Rec_FileAccess (APPLICATIONID, AT);`
