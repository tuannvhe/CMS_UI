import { api } from './client'

/** Bản dịch của một thông báo theo ngôn ngữ. status: none = chưa có, ai = AI dịch, ok = HR đã sửa, failed = AI lỗi. stale = bài gốc đã sửa sau khi dịch. */
export interface AnnouncementTranslation {
  lang: 'en' | 'ko'
  title: string | null
  html: string
  status: 'none' | 'ai' | 'ok' | 'failed' | string
  stale: boolean
  attempts: number
  updatedBy: string | null
  updatedAt: string | null
}
export interface AnnouncementTranslations { ready: boolean; aiEnabled: boolean; items: AnnouncementTranslation[] }

const base = (id: number) => `/admin/announcements/${id}/translations`

export const announcementTranslations = {
  get: (id: number) => api.get<AnnouncementTranslations>(base(id)).then((r) => r.data),
  save: (id: number, lang: string, b: { title: string | null; html: string }) => api.put(`${base(id)}/${lang}`, b).then(() => undefined),
  /** Dịch lại ngay bằng AI trên máy chủ (1–3 phút). */
  retranslate: (id: number, lang: string) => api.post(`${base(id)}/${lang}/ai`, null, { timeout: 10 * 60 * 1000 }).then(() => undefined),
}
