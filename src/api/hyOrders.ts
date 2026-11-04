import { api } from './client'

export type HyShift = 'day' | 'night'
export type HyOrderStatus = 'approved' | 'pending' | 'rejected'
export interface HyOrder {
  id: number; date: string; shift: HyShift; leaveAt: string; department: string | null; qty: number; note: string | null
  status: HyOrderStatus; late: boolean; registeredBy: string; registeredByName: string | null; createdAt: string
  decidedBy: string | null; decidedAt: string | null; rejectReason: string | null
  /** Dòng xin sửa (cancel = false) / xin huỷ (cancel = true) đăng ký số replacesId sau giờ khoá, chờ duyệt. */
  replacesId: number | null; cancel: boolean
}
export interface HyOrdersMe { canRegister: boolean; manager: boolean; department: string | null; today: string; now: string; lockHour: number; dayTimes: string[]; nightTimes: string[] }
/** Một cột của lưới / bảng: ca + giờ về. */
export interface HySlot { shift: HyShift; time: string }
export const slotsOf = (me: Pick<HyOrdersMe, 'dayTimes' | 'nightTimes'>): HySlot[] =>
  [...me.dayTimes.map((time) => ({ shift: 'day' as const, time })), ...me.nightTimes.map((time) => ({ shift: 'night' as const, time }))]
export const slotKey = (s: HySlot) => `${s.shift}|${s.time}`

/** Danh sách đi ngày D khoá lúc lockHour giờ ngày D-1 (giờ máy khách ≈ giờ Việt Nam; máy chủ kiểm tra lại). */
export const hyLocked = (me: HyOrdersMe, date: string) => {
  const at = new Date(`${date.slice(0, 10)}T00:00:00`)
  at.setDate(at.getDate() - 1)
  at.setHours(me.lockHour, 0, 0, 0)
  return Date.now() >= at.getTime()
}

const base = '/trips/hy-orders'
export const hyOrders = {
  me: () => api.get<HyOrdersMe>(`${base}/me`).then((r) => r.data),
  list: (from: string, to: string) => api.get<HyOrder[]>(base, { params: { from, to } }).then((r) => r.data),
  add: (b: { date: string; shift: HyShift; leaveAt: string; department?: string; qty: number; note?: string }) => api.post<{ id: number; status: HyOrderStatus }>(base, b).then((r) => r.data),
  update: (id: number, b: { qty: number; leaveAt?: string; note?: string | null; department?: string | null }) => api.put<{ status: string }>(`${base}/${id}`, b).then((r) => r.data),
  remove: (id: number) => api.delete<{ status: string }>(`${base}/${id}`).then((r) => r.data),
  pending: () => api.get<HyOrder[]>(`${base}/pending`).then((r) => r.data),
  decide: (ids: number[], approve: boolean, reason?: string) => api.post<{ done: number }>(`${base}/pending/decide`, { ids, approve, reason }).then((r) => r.data),
}
