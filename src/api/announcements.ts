import { api } from './client'

/** Thông báo của HR hiện ở trang chủ (html đã được máy chủ lọc). */
/** id = ID thông báo. Người dùng tiếng Anh / Hàn: title / html là bản dịch (nếu đã dịch), origTitle / origHtml là bản gốc, translation = ai | ok. */
export interface Announcement { title: string; type: string; createdAt: string; html: string; id?: number; origTitle?: string | null; origHtml?: string | null; translation?: string | null }

export const announcements = {
  recent: (take = 5) => api.get<Announcement[]>('/announcements', { params: { take } }).then((r) => r.data),
}
