import { api } from './client'

export interface AnnouncementRow { id: number; title: string; type: string; html: string; createdAt: string; createdBy: string; active: boolean }
export interface AnnouncementList { items: AnnouncementRow[]; types: string[] }
export interface AnnouncementInput { title: string; type: string; html: string }

const base = '/admin/announcements'

export const announcementAdmin = {
  list: () => api.get<AnnouncementList>(base).then((r) => r.data),
  add: (b: AnnouncementInput) => api.post(base, b).then(() => undefined),
  update: (id: number, b: AnnouncementInput) => api.put(`${base}/${id}`, b).then(() => undefined),
  /** Tải nhiều ảnh một lần; trả về đường dẫn ảnh để chèn vào nội dung thông báo. */
  uploadImages: (files: File[]) => {
    const f = new FormData()
    files.forEach((x) => f.append('files', x))
    return api.post<{ urls: string[] }>(`${base}/images`, f, { timeout: 120000 }).then((r) => r.data.urls)
  },
  toggle: (id: number) => api.post<{ active: boolean }>(`${base}/${id}/toggle`).then((r) => r.data),
}

export interface UnionPoster { userId: string; fullName: string; department: string | null; addedBy: string | null; addedAt: string | null }

/** Người được cho phép đăng thông báo công đoàn (chỉ quản trị quản lý danh sách). */
export const unionPosters = {
  list: () => api.get<UnionPoster[]>(`${base}/union-posters`).then((r) => r.data),
  add: (userId: string) => api.post(`${base}/union-posters`, { userId }).then(() => undefined),
  remove: (userId: string) => api.delete(`${base}/union-posters/${encodeURIComponent(userId)}`).then(() => undefined),
}

const unionBase = '/union/announcements'

/** Đăng thông báo công đoàn: loại luôn là "Thông báo từ công đoàn", chỉ thấy và sửa thông báo loại này. */
export const unionAnnouncements: typeof announcementAdmin = {
  list: () => api.get<AnnouncementList>(unionBase).then((r) => r.data),
  add: (b: AnnouncementInput) => api.post(unionBase, b).then(() => undefined),
  update: (id: number, b: AnnouncementInput) => api.put(`${unionBase}/${id}`, b).then(() => undefined),
  uploadImages: (files: File[]) => {
    const f = new FormData()
    files.forEach((x) => f.append('files', x))
    return api.post<{ urls: string[] }>(`${unionBase}/images`, f, { timeout: 120000 }).then((r) => r.data.urls)
  },
  toggle: (id: number) => api.post<{ active: boolean }>(`${unionBase}/${id}/toggle`).then((r) => r.data),
}
