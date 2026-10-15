import { api } from './client'

/** Một đợt tập thể dục buổi sáng (endDate = null: chưa kết thúc): trong đợt này đi trễ 07:45–08:00 mới bị trừ điểm văn hóa (G) của OP. */
export interface ExerciseSeason { id: number; name: string; startDate: string; endDate: string | null; active: boolean }
export interface ExerciseSeasonInput { name: string; startDate: string; endDate: string | null; active: boolean }

export const seasons = {
  list: () => api.get<ExerciseSeason[]>('/exercise-seasons').then((r) => r.data),
  add: (b: ExerciseSeasonInput) => api.post<{ id: number }>('/exercise-seasons', b).then((r) => r.data),
  update: (id: number, b: ExerciseSeasonInput) => api.put(`/exercise-seasons/${id}`, b).then(() => undefined),
  remove: (id: number) => api.delete(`/exercise-seasons/${id}`).then(() => undefined),
}
