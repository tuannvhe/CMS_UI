import { api } from './client'

/** Thông báo của HR hiện ở trang chủ (html đã được máy chủ lọc). */
export interface Announcement { title: string; type: string; createdAt: string; html: string }

export const announcements = {
  recent: (take = 5) => api.get<Announcement[]>('/announcements', { params: { take } }).then((r) => r.data),
}
