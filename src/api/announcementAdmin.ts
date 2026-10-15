import { api } from './client'

export interface AnnouncementRow { id: number; title: string; type: string; html: string; createdAt: string; createdBy: string; active: boolean }
export interface AnnouncementList { items: AnnouncementRow[]; types: string[] }
export interface AnnouncementInput { title: string; type: string; html: string }

const base = '/admin/announcements'

export const announcementAdmin = {
  list: () => api.get<AnnouncementList>(base).then((r) => r.data),
  add: (b: AnnouncementInput) => api.post(base, b).then(() => undefined),
  update: (id: number, b: AnnouncementInput) => api.put(`${base}/${id}`, b).then(() => undefined),
  toggle: (id: number) => api.post<{ active: boolean }>(`${base}/${id}/toggle`).then((r) => r.data),
}
