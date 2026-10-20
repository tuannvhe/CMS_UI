import { api } from './client'

export type RecruitStatus = 'new' | 'screening' | 'screen_fail' | 'to_schedule' | 'scheduled' | 'evaluated' | 'pass' | 'fail' | 'withdrawn'
export type RecruitLevel = 'op' | 'staff'
export const RECRUIT_STATUSES: RecruitStatus[] = ['new', 'screening', 'to_schedule', 'scheduled', 'evaluated', 'pass', 'fail', 'screen_fail', 'withdrawn']
export const STATUS_TONE: Record<RecruitStatus, string> = { new: 'warn', screening: 'info', to_schedule: 'good', scheduled: 'info', evaluated: 'warn', pass: 'good', fail: 'bad', screen_fail: 'bad', withdrawn: 'muted' }

export interface RecruitApplication {
  id: number; fullName: string; phone: string | null; email: string | null; position: string; level: RecruitLevel; department: string | null; factory: string | null
  status: RecruitStatus; note: string | null; restricted: boolean; hasFile: boolean; createdBy: string; createdAt: string; closedAt: string | null; hrNote: string | null
}
export interface RecruitScreening {
  id: number; applicationId: number; reviewerId: string; reviewerName: string | null; sentAt: string; dueDate: string
  decision: 'invite' | 'reject' | null; comment: string | null; decidedAt: string | null; revoked: boolean; overdue: boolean
}
export interface RecruitEvent { id: number; kind: string; fromStatus: string | null; toStatus: string | null; byUser: string; at: string; note: string | null }
export type InterviewStatus = 'planned' | 'done' | 'cancelled' | 'no_show'
export interface PanelMember { id: number; interviewerId: string; interviewerName: string | null; result: 'pass' | 'fail' | null; strengths: string | null; weaknesses: string | null; comment: string | null; submittedAt: string | null }
export interface RecruitInterview { id: number; applicationId: number; round: number; startAt: string; location: string | null; note: string | null; status: InterviewStatus; panel: PanelMember[] }
export interface RecruitDetail { application: RecruitApplication; screenings: RecruitScreening[]; events: RecruitEvent[]; file: { id: number; name: string; size: number; uploadedAt: string } | null; interviews: RecruitInterview[] }
export interface AllInterview { interview: RecruitInterview; application: RecruitApplication }
export interface MyInterview {
  interview: Omit<RecruitInterview, 'panel'>
  mine: { result: 'pass' | 'fail' | null; strengths: string | null; weaknesses: string | null; comment: string | null; submittedAt: string | null }
  application: RecruitApplication
}
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
export interface ImportResult { created: number; errors: { row: number; reason: string }[] }
export const importTemplateUrl = '/api/admin/recruit/import/template'
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
  importOp: (file: File) => { const f = new FormData(); f.append('file', file); return api.post<ImportResult>('/admin/recruit/import', f).then((r) => r.data) },
  users: (q: string) => api.get<RecruitUser[]>('/admin/recruit/users', { params: { q } }).then((r) => r.data),
  mine: (pending = false, all = false) => api.get<RecruitMine[]>('/recruit/mine', { params: { pending, all } }).then((r) => r.data),
  allInterviews: (pending = false) => api.get<AllInterview[]>('/recruit/interviews/all', { params: { pending } }).then((r) => r.data),
  mineGet: (id: number) => api.get<RecruitDetail>(`/recruit/${id}`).then((r) => r.data),
  decide: (id: number, decision: 'invite' | 'reject', comment?: string) => api.post(`/recruit/${id}/decide`, { decision, comment }).then(() => undefined),
  schedule: (id: number, b: { startAt: string; location?: string; note?: string; interviewers: string[] }) => api.post<{ id: number }>(`/admin/recruit/${id}/schedule`, b).then((r) => r.data),
  closeInterview: (interviewId: number, kind: 'cancel' | 'no_show', note?: string) => api.post(`/admin/recruit/interviews/${interviewId}/close`, { kind, note }).then(() => undefined),
  finalize: (id: number, result: 'pass' | 'fail', note?: string) => api.post(`/admin/recruit/${id}/final`, { result, note }).then(() => undefined),
  myInterviews: (pending = false) => api.get<MyInterview[]>('/recruit/interviews/mine', { params: { pending } }).then((r) => r.data),
  evaluate: (interviewId: number, b: { result: 'pass' | 'fail'; strengths?: string; weaknesses?: string; comment?: string }) => api.post(`/recruit/interviews/${interviewId}/evaluate`, b).then(() => undefined),
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
    STATUS      nvarchar(16)   NOT NULL,   -- new | screening | to_schedule | scheduled | evaluated | pass | fail | screen_fail | withdrawn
    NOTE        nvarchar(1000) NULL,
    RESTRICTED  bit            NOT NULL DEFAULT 0,
    CREATEDBY   nvarchar(50)   NOT NULL,
    CREATEDATE  datetime       NULL,
    UPDATEDATE  datetime       NULL,
    CLOSEDDATE  datetime       NULL,
    HRNOTE      nvarchar(1000) NULL        -- ghi chú chốt cuối của HR
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
CREATE INDEX IX_Tbl_Rec_FileAccess_APP ON dbo.Tbl_Rec_FileAccess (APPLICATIONID, AT);

CREATE TABLE dbo.Tbl_Rec_Interview (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    ROUNDNO      int            NOT NULL,
    STARTAT      datetime       NOT NULL,
    LOCATION     nvarchar(100)  NULL,
    NOTE         nvarchar(1000) NULL,
    STATUS       nvarchar(10)   NOT NULL,   -- planned | done | cancelled | no_show
    CREATEDBY    nvarchar(50)   NOT NULL,
    CREATEDATE   datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_Interview_APP ON dbo.Tbl_Rec_Interview (APPLICATIONID, ROUNDNO);
CREATE INDEX IX_Tbl_Rec_Interview_START ON dbo.Tbl_Rec_Interview (STARTAT);

CREATE TABLE dbo.Tbl_Rec_InterviewPanel (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    INTERVIEWID  int            NOT NULL,
    INTERVIEWERID nvarchar(50)  NOT NULL,
    RESULT       nvarchar(10)   NULL,       -- pass | fail
    STRENGTHS    nvarchar(1000) NULL,
    WEAKNESSES   nvarchar(1000) NULL,
    COMMENT      nvarchar(1000) NULL,
    SUBMITTEDAT  datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_InterviewPanel_IV ON dbo.Tbl_Rec_InterviewPanel (INTERVIEWID);
CREATE INDEX IX_Tbl_Rec_InterviewPanel_USER ON dbo.Tbl_Rec_InterviewPanel (INTERVIEWERID, RESULT);`

export interface RecruitReportData {
  ready?: boolean
  byStatus: Record<string, number>
  byLevel: Record<string, number>
  byDepartment: { key: string; value: number }[]
  screeningsSent: number; screeningsInvite: number; screeningsReject: number; screeningsPending: number; screeningsOverdue: number; avgScreeningHours: number | null
  interviewsPlanned: number; interviewsDone: number; interviewsNoShow: number; interviewsCancelled: number
  evaluationsPass: number; evaluationsFail: number
  finalPass: number; finalFail: number; avgDaysToFinal: number | null
}

export const recruitReport = (from: string, to: string) => api.get<RecruitReportData>('/admin/recruit/report', { params: { from, to } }).then((r) => r.data)
