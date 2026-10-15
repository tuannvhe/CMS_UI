import { api } from './client'

/** Ngày làm bù (thường là Thứ 7 đi làm thay ngày khác). */
export interface SwapDay { id: number; date: string; note: string | null; active: boolean; createdBy: string | null }
export interface SwapDayInput { date: string; note?: string; active: boolean }

export const swapDays = {
  list: (year: number) => api.get<SwapDay[]>('/swap-days', { params: { year } }).then((r) => r.data),
  add: (b: SwapDayInput) => api.post<{ id: number }>('/swap-days', b).then((r) => r.data),
  update: (id: number, b: SwapDayInput) => api.put(`/swap-days/${id}`, b).then(() => undefined),
  remove: (ids: number[]) => api.post<{ deleted: number }>('/swap-days/delete', { ids }).then((r) => r.data),
}
