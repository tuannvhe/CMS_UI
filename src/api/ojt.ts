import { api } from './client'

export type OjtStatus = 'pending' | 'active' | 'done' | 'cancelled'

export interface OjtPlan {
  id: number; employeeId: string; employeeName: string | null; department: string | null; position: string | null; applicationId: number | null
  mentorId: string | null; mentorName: string | null; startDate: string; endDate: string; status: OjtStatus
  createdBy: string; createdAt: string; mentorBy: string | null; mentorAt: string | null; written: number; approverIds: string[]
}
export interface OjtLog { id: number; planId: number; date: string; content: string; difficulty: string | null; mentorNote: string | null; mentorNoteBy: string | null; mentorNoteAt: string | null; updatedAt: string | null }
export interface OjtDay { date: string; log: OjtLog | null; canWrite: boolean; onLeave: boolean }
export interface OjtDetail { plan: OjtPlan; days: OjtDay[]; due: number; isMentor: boolean; isApprover: boolean; isSelf: boolean }
export interface OjtPerson { id: string; name: string; department: string | null; position: string | null; status: string | null }
export interface OjtCreateResult { plan: OjtPlan; approvers: string[] }

/** Script tạo 3 bảng OJT (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const OJT_SQL = `IF OBJECT_ID('dbo.Tbl_Ojt_Plan','U') IS NULL
CREATE TABLE dbo.Tbl_Ojt_Plan (
    ID             int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EMPLOYEEID     varchar(30)   NOT NULL,
    DEPARTMENT     nvarchar(100) NULL,
    APPLICATION_ID int           NULL,
    MENTOR_ID      varchar(30)   NULL,
    START_DATE     date          NOT NULL,
    END_DATE       date          NOT NULL,
    STATUS         varchar(10)   NOT NULL,   -- pending | active | done | cancelled
    CREATED_BY     varchar(50)   NOT NULL,
    CREATED_AT     datetime      NOT NULL,
    MENTOR_BY      varchar(50)   NULL,
    MENTOR_AT      datetime      NULL,
    APPROVER_IDS   varchar(200)  NULL        -- mã người được báo và phân mentor, cách nhau bằng dấu phẩy (HR chọn)
);
GO
IF COL_LENGTH('dbo.Tbl_Ojt_Plan','APPROVER_IDS') IS NULL ALTER TABLE dbo.Tbl_Ojt_Plan ADD APPROVER_IDS varchar(200) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Tbl_Ojt_Plan_Emp' AND object_id = OBJECT_ID('dbo.Tbl_Ojt_Plan'))
    CREATE UNIQUE INDEX UX_Tbl_Ojt_Plan_Emp ON dbo.Tbl_Ojt_Plan(EMPLOYEEID);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tbl_Ojt_Plan_Mentor' AND object_id = OBJECT_ID('dbo.Tbl_Ojt_Plan'))
    CREATE INDEX IX_Tbl_Ojt_Plan_Mentor ON dbo.Tbl_Ojt_Plan(MENTOR_ID) WHERE MENTOR_ID IS NOT NULL;
GO
IF OBJECT_ID('dbo.Tbl_Ojt_Log','U') IS NULL
CREATE TABLE dbo.Tbl_Ojt_Log (
    ID              int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PLAN_ID         int            NOT NULL,
    LOG_DATE        date           NOT NULL,
    CONTENT         nvarchar(2000) NOT NULL,
    DIFFICULTY      nvarchar(1000) NULL,
    MENTOR_NOTE     nvarchar(1000) NULL,
    MENTOR_NOTE_BY  varchar(50)    NULL,
    MENTOR_NOTE_AT  datetime       NULL,
    CREATED_AT      datetime       NOT NULL,
    UPDATED_AT      datetime       NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Tbl_Ojt_Log_PlanDate' AND object_id = OBJECT_ID('dbo.Tbl_Ojt_Log'))
    CREATE UNIQUE INDEX UX_Tbl_Ojt_Log_PlanDate ON dbo.Tbl_Ojt_Log(PLAN_ID, LOG_DATE);`


export const ojt = {
  mine: () => api.get<{ detail: OjtDetail | null }>('/ojt/mine').then((r) => r.data.detail),
  saveLog: (date: string, b: { content: string; difficulty?: string }) => api.put(`/ojt/mine/${date}`, b).then(() => undefined),
  team: (status?: string) => api.get<{ items: OjtPlan[] }>('/ojt/team', { params: { status } }).then((r) => r.data.items),
  detail: (id: number) => api.get<OjtDetail>(`/ojt/plans/${id}`).then((r) => r.data),
  setMentor: (id: number, mentorId: string) => api.put<OjtPlan>(`/ojt/plans/${id}/mentor`, { mentorId }).then((r) => r.data),
  note: (id: number, date: string, note: string) => api.put(`/ojt/plans/${id}/note/${date}`, { note }).then(() => undefined),
  people: (q: string) => api.get<OjtPerson[]>('/ojt/people', { params: { q } }).then((r) => r.data),
  ready: () => api.get<{ ready: boolean }>('/admin/ojt/status').then((r) => r.data.ready),
  create: (b: { employeeId: string; startDate?: string; endDate?: string; applicationId?: number; approverIds: string[] }) => api.post<OjtCreateResult>('/admin/ojt/plans', b).then((r) => r.data),
  cancel: (id: number) => api.delete(`/admin/ojt/plans/${id}`).then(() => undefined),
}
