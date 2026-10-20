import { api } from './client'

export interface NoticeCaseState {
  key: string; group: string; hasMail: boolean; mailEnabled: boolean; bellEnabled: boolean
  mailDefault: boolean; bellDefault: boolean; updatedBy: string | null; updatedAt: string | null
}
export interface NoticeMaster { mail: boolean; bell: boolean; updatedBy: string | null; updatedAt: string | null }
export type MailRouteMode = 'default' | 'only' | 'also'
export interface MailRecipient { userId: string | null; email: string; fullName: string | null }
export interface NoticeSettings { master: NoticeMaster; cases: NoticeCaseState[]; routes: Record<string, { mode: MailRouteMode; count: number }> }

export const noticeSettings = {
  get: () => api.get<NoticeSettings>('/admin/notification-settings').then((r) => r.data),
  setMaster: (channel: 'mail' | 'bell', active: boolean) => api.put(`/admin/notification-settings/master/${channel}`, { active }).then(() => undefined),
  getRecipients: (key: string) => api.get<{ mode: MailRouteMode; recipients: MailRecipient[] }>(`/admin/notification-settings/cases/${encodeURIComponent(key)}/recipients`).then((r) => r.data),
  setRecipients: (key: string, mode: MailRouteMode, recipients: MailRecipient[]) => api.put(`/admin/notification-settings/cases/${encodeURIComponent(key)}/recipients`, { mode, recipients }).then(() => undefined),
  setCase: (key: string, channel: 'mail' | 'bell', active: boolean) => api.put(`/admin/notification-settings/cases/${encodeURIComponent(key)}/${channel}`, { active }).then(() => undefined),
}

/** Script tạo bảng người nhận email riêng (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const MAIL_ROUTE_SQL = `CREATE TABLE dbo.Tbl_MailRecipients (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, CASEKEY varchar(40) NOT NULL, MODE varchar(5) NOT NULL, USERID nvarchar(50) NULL,
    EMAIL nvarchar(200) NOT NULL, FULLNAME nvarchar(100) NULL, CREATEDBY nvarchar(50) NULL, CREATEDATE datetime NULL);
CREATE INDEX IX_Tbl_MailRecipients_CASE ON dbo.Tbl_MailRecipients (CASEKEY);`
