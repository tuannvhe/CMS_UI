import { api } from './client'

/** sunday = nghỉ Chủ nhật · biweekly = nghỉ cách tuần · holiday = nghỉ lễ · rest = ngày nghỉ khác (dòng cũ không có mô tả) */
export type HolidayKind = 'sunday' | 'biweekly' | 'holiday' | 'rest'
export interface Holiday { id: number; date: string; description: string; kind: HolidayKind; createdBy: string | null }
export interface HolidayAddInput { kind: Exclude<HolidayKind, 'rest'>; from: string; to: string; description?: string }
export interface HolidayUpdateInput { kind: Exclude<HolidayKind, 'rest'>; date: string; description?: string }

export const holidays = {
  list: (year: number) => api.get<Holiday[]>('/holidays', { params: { year } }).then((r) => r.data),
  add: (b: HolidayAddInput) => api.post<{ created: number; skipped: string[] }>('/holidays', b).then((r) => r.data),
  update: (id: number, b: HolidayUpdateInput) => api.put(`/holidays/${id}`, b).then(() => undefined),
  remove: (ids: number[]) => api.post<{ deleted: number }>('/holidays/delete', { ids }).then((r) => r.data),
}
