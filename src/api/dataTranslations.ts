import { api } from './client'

/** Một mục từ điển dịch dữ liệu: chữ gốc tiếng Việt → tiếng Anh / tiếng Hàn. status 'ai' = AI gợi ý chưa duyệt, 'ok' = HR đã duyệt. */
export interface DataTranslation {
  id: number
  kind: string
  source: string
  en: string | null
  ko: string | null
  status: 'ai' | 'ok' | string
  employees: number
  updatedBy: string | null
  updatedAt: string | null
}
export interface DataTranslationList { ready: boolean; aiEnabled: boolean; items: DataTranslation[] }
export interface DataTranslationRun { added: number; filled: number; failed: boolean }

const base = '/admin/data-translations'

export const dataTranslations = {
  /** Bản đồ chữ gốc → bản dịch của ngôn ngữ lang (mọi người đã đăng nhập). */
  dictionary: (lang: string) => api.get<Record<string, string>>('/data-translations', { params: { lang } }).then((r) => r.data),
  list: () => api.get<DataTranslationList>(base).then((r) => r.data),
  scan: () => api.post<DataTranslationRun>(`${base}/scan`).then((r) => r.data),
  suggest: (ids?: number[]) => api.post<DataTranslationRun>(`${base}/suggest`, { ids: ids ?? [] }, { timeout: 15 * 60 * 1000 }).then((r) => r.data),
  save: (id: number, b: { en: string | null; ko: string | null; approve: boolean }) => api.put(`${base}/${id}`, { id, ...b }).then(() => undefined),
  remove: (id: number) => api.delete(`${base}/${id}`).then(() => undefined),
}
