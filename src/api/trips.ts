import { api } from './client'

export interface TripEntry {
  id: number; date: string; employeeId: string; employeeName: string; department: string | null; registeredBy: string; registeredByName: string | null; createdAt: string | null
  /** confirmed | pending (đăng ký bù đang chờ nhân sự xác nhận) */
  status: 'confirmed' | 'pending'; late: boolean; reason: string | null
  /** day = ca ngày, night = ca đêm */
  shift: TripShift
  /** Giờ rời Hưng Yên thực tế (HH:mm) của người không đi xe theo lịch; null = đi xe công ty theo lịch. Chỉ dùng cho ca ngày. */
  leaveAt?: string | null
  /** Người duyệt xin bỏ người này sau giờ khoá: vẫn tính là đi tới khi nhân sự xác nhận. */
  removeRequested?: boolean
}
/** Kết quả lưu danh sách (một hoặc nhiều ngày): pendingAdded / pendingRemoved = thay đổi sau giờ khoá đang chờ nhân sự xác nhận. */
export interface TripSaveResult { added: number; removed: number; pendingAdded: number; pendingRemoved: number; days: number }
export type TripShift = 'day' | 'night'
export interface TripCandidate { employeeId: string; name: string; department: string | null }
export interface TripMe { canRegister: boolean; all: boolean; departments: string[]; ready: boolean; today: string; now: string; lockHour: number }


const base = '/trips/hung-yen'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const trips = {
  me: () => api.get<TripMe>(`${base}/me`).then((r) => r.data),
  candidates: () => api.get<TripCandidate[]>(`${base}/candidates`).then((r) => r.data),
  list: (date: string) => api.get<TripEntry[]>(base, { params: { date } }).then((r) => r.data),
  /** Lưu danh sách cho ngày date hoặc khoảng date → dateTo (cùng một danh sách cho mọi ngày). */
  saveList: (date: string, department: string, employeeIds: string[], shift: TripShift, leaveTimes?: Record<string, string>, dateTo?: string) =>
    api.put<TripSaveResult>(base, { date, dateTo, department, employeeIds, shift, leaveTimes }).then((r) => r.data),
  submitLate: (date: string, department: string, employeeIds: string[], reason: string, shift: TripShift, leaveTimes?: Record<string, string>) =>
    api.post<{ added: number; skipped: number; pending: boolean }>(`${base}/late`, { date, department, employeeIds, reason, shift, leaveTimes }).then((r) => r.data),
  pending: () => api.get<TripEntry[]>(`${base}/late/pending`).then((r) => r.data),
  confirmLate: (ids: number[]) => api.post<{ count: number }>(`${base}/late/confirm`, { ids }).then((r) => r.data),
  rejectLate: (ids: number[], reason: string) => api.post<{ count: number }>(`${base}/late/reject`, { ids, reason }).then((r) => r.data),
  /** pending = true khi đã qua giờ khoá: thành yêu cầu bỏ chờ nhân sự xác nhận. */
  remove: (id: number) => api.delete<{ pending: boolean }>(`${base}/${id}`).then((r) => r.data),
  /** Đặt giờ rời Hưng Yên thực tế (HH:mm) cho một đăng ký ca ngày; null = xoá. */
  setLeave: (id: number, time: string | null) => api.put(`${base}/${id}/leave`, { time }).then(() => undefined),
  cancelLate: (id: number) => api.delete(`${base}/late/${id}`).then(() => undefined),
  exportRange: async (from: string, to: string) => saveBlob(await api.get<Blob>(`${base}/export`, { params: { from, to }, responseType: 'blob', timeout: 120000 }), `DiHungYen_${from}_${to}.xlsx`),
}
