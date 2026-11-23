import { api } from './client'

export type QaChannel = 'salary' | 'common'
export interface QaThread { channel: QaChannel; groupId: string; title: string; employeeId: string; employeeName: string; department: string | null; createdAt: string; posts: number; lastAt: string; lastByName: string | null; awaitingStaff: boolean; /** Nội dung tin mới nhất (đã bỏ mã ảnh, tối đa 140 ký tự) */ lastText?: string | null; /** Ảnh đại diện người hỏi / người nhắn cuối (null = chưa có ảnh) */ avatarUrl?: string | null; lastByAvatarUrl?: string | null }
export interface QaPost { id: number; employeeId: string; name: string; department: string | null; content: string; createdAt: string; isAsker: boolean; images?: string[]; avatarUrl?: string | null }
/** Ảnh vừa tải lên, chờ gửi kèm: key đưa vào images khi gửi, url để xem trước. */
export interface QaImage { key: string; url: string }
/** Câu hỏi mới luôn vào kênh chung; chủ đề lương cũ vẫn mở / trả lời theo kênh của nó. */
export const QA_DEFAULT_CHANNEL: QaChannel = 'common'
export interface QaConversation { thread: QaThread; posts: QaPost[] }

/** mine = hỏi đáp của chính mình; manage = nhân sự xem / trả lời mọi chủ đề. */
export type QaMode = 'mine' | 'manage'
const base = (mode: QaMode, ch: QaChannel) => (mode === 'mine' ? `/qa/${ch}` : `/admin/qa/${ch}`)

export interface QaTemplate { id: number; title: string; content: string; channel: 'all' | QaChannel; createdBy: string | null; createdAt: string | null }


export const qaSummary = {
  mine: () => api.get<{ lastStaffReplyAt: string | null }>('/qa-summary').then((r) => r.data),
  pending: () => api.get<{ pending: number; latestAt: string | null }>('/admin/qa-summary').then((r) => r.data),
}

export const qa = {
  templates: (channel?: QaChannel) => api.get<{ ready: boolean; items: QaTemplate[] }>('/admin/qa-templates', { params: { channel } }).then((r) => r.data),
  addTemplate: (b: { title: string; content: string; channel: string }) => api.post('/admin/qa-templates', b).then(() => undefined),
  updateTemplate: (id: number, b: { title: string; content: string; channel: string }) => api.put(`/admin/qa-templates/${id}`, b).then(() => undefined),
  deleteTemplate: (id: number) => api.delete(`/admin/qa-templates/${id}`).then(() => undefined),
  threads: (mode: QaMode, ch: QaChannel, p?: { search?: string; pendingOnly?: boolean }) => api.get<QaThread[]>(`${base(mode, ch)}/threads`, { params: p }).then((r) => r.data),
  conversation: (mode: QaMode, ch: QaChannel, group: string) => api.get<QaConversation>(`${base(mode, ch)}/threads/${encodeURIComponent(group)}`).then((r) => r.data),
  /** Mọi chủ đề của cả hai kênh trong một danh sách, mới hoạt động nhất lên đầu. */
  allThreads: async (mode: QaMode, p?: { search?: string; pendingOnly?: boolean }): Promise<QaThread[]> => {
    const [a, b] = await Promise.all((['common', 'salary'] as QaChannel[]).map((ch) => qa.threads(mode, ch, p)))
    return [...a, ...b].sort((x, y) => (x.lastAt < y.lastAt ? 1 : x.lastAt > y.lastAt ? -1 : 0))
  },
  ask: (ch: QaChannel, b: { title: string; content: string; images?: string[] }) => api.post<{ groupId: string }>(`/qa/${ch}/threads`, b).then((r) => r.data),
  reply: (mode: QaMode, ch: QaChannel, group: string, content: string, images?: string[]) => api.post(`${base(mode, ch)}/threads/${encodeURIComponent(group)}/reply`, { content, images }).then(() => undefined),
  uploadImage: (mode: QaMode, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<QaImage>(mode === 'mine' ? '/qa/images' : '/admin/qa/images', fd, { timeout: 120000 }).then((r) => r.data)
  },
}
