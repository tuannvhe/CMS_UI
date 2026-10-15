import { api } from './client'

export type QaChannel = 'salary' | 'common'
export interface QaThread { channel: QaChannel; groupId: string; title: string; employeeId: string; employeeName: string; department: string | null; createdAt: string; posts: number; lastAt: string; lastByName: string | null; awaitingStaff: boolean }
export interface QaPost { id: number; employeeId: string; name: string; department: string | null; content: string; createdAt: string; isAsker: boolean }
export interface QaConversation { thread: QaThread; posts: QaPost[] }

/** mine = hỏi đáp của chính mình; manage = nhân sự xem / trả lời mọi chủ đề. */
export type QaMode = 'mine' | 'manage'
const base = (mode: QaMode, ch: QaChannel) => (mode === 'mine' ? `/qa/${ch}` : `/admin/qa/${ch}`)

export interface QaTemplate { id: number; title: string; content: string; channel: 'all' | QaChannel; createdBy: string | null; createdAt: string | null }

/** Script tạo bảng mẫu trả lời nhanh (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const QA_TEMPLATE_SQL = `CREATE TABLE dbo.Tbl_QaTemplates (
    ID         int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TITLE      nvarchar(100)  NOT NULL,
    CONTENT    nvarchar(4000) NOT NULL,
    CHANNEL    varchar(10)    NOT NULL,   -- salary | common | all
    CREATEDBY  nvarchar(50)   NULL,
    CREATEDATE datetime       NULL
);`

export const qaSummary = {
  mine: () => api.get<{ lastStaffReplyAt: string | null }>('/qa-summary').then((r) => r.data),
  pending: () => api.get<{ pending: number }>('/admin/qa-summary').then((r) => r.data),
}

export const qa = {
  templates: (channel?: QaChannel) => api.get<{ ready: boolean; items: QaTemplate[] }>('/admin/qa-templates', { params: { channel } }).then((r) => r.data),
  addTemplate: (b: { title: string; content: string; channel: string }) => api.post('/admin/qa-templates', b).then(() => undefined),
  updateTemplate: (id: number, b: { title: string; content: string; channel: string }) => api.put(`/admin/qa-templates/${id}`, b).then(() => undefined),
  deleteTemplate: (id: number) => api.delete(`/admin/qa-templates/${id}`).then(() => undefined),
  threads: (mode: QaMode, ch: QaChannel, p?: { search?: string; pendingOnly?: boolean }) => api.get<QaThread[]>(`${base(mode, ch)}/threads`, { params: p }).then((r) => r.data),
  conversation: (mode: QaMode, ch: QaChannel, group: string) => api.get<QaConversation>(`${base(mode, ch)}/threads/${encodeURIComponent(group)}`).then((r) => r.data),
  ask: (ch: QaChannel, b: { title: string; content: string }) => api.post<{ groupId: string }>(`/qa/${ch}/threads`, b).then((r) => r.data),
  reply: (mode: QaMode, ch: QaChannel, group: string, content: string) => api.post(`${base(mode, ch)}/threads/${encodeURIComponent(group)}/reply`, { content }).then(() => undefined),
}
