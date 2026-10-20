import { api } from './client'

/** sunday = nghỉ Chủ nhật · biweekly = nghỉ cách tuần · holiday = nghỉ lễ · rest = ngày nghỉ khác (dòng cũ không có mô tả) */
export type HolidayKind = 'sunday' | 'biweekly' | 'holiday' | 'rest'
export interface Holiday { id: number; date: string; description: string; kind: HolidayKind; createdBy: string | null }
export interface HolidayAddInput { kind: Exclude<HolidayKind, 'rest'>; from: string; to: string; description?: string }
export interface HolidayUpdateInput { kind: Exclude<HolidayKind, 'rest'>; date: string; description?: string }

export interface HolidayPlanItem { date: string; kind: Exclude<HolidayKind, 'rest'>; description: string; exists: boolean; existingKind: HolidayKind | null }
export interface HolidayPlan { year: number; biweeklyAnchor: string | null; needsAnchor: boolean; items: HolidayPlanItem[] }
export interface HolidayPlanInput { year: number; sunday: boolean; biweekly: boolean; holidays: boolean; biweeklyAnchor?: string | null }

export const holidays = {
  plan: (b: HolidayPlanInput) => api.post<HolidayPlan>('/holidays/plan', b).then((r) => r.data),
  apply: (items: { date: string; kind: string; description: string }[]) => api.post<{ created: number; skipped: string[] }>('/holidays/apply', { items }).then((r) => r.data),
  list: (year: number) => api.get<Holiday[]>('/holidays', { params: { year } }).then((r) => r.data),
  add: (b: HolidayAddInput) => api.post<{ created: number; skipped: string[] }>('/holidays', b).then((r) => r.data),
  update: (id: number, b: HolidayUpdateInput) => api.put(`/holidays/${id}`, b).then(() => undefined),
  remove: (ids: number[]) => api.post<{ deleted: number }>('/holidays/delete', { ids }).then((r) => r.data),
}
