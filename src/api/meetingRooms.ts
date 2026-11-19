import { api } from './client'

export interface MeetingRoom { code: string; name: string; location: string | null; active: boolean; display: string }

/** Các nhà máy luôn có tab ở màn đặt phòng (kể cả khi chưa có phòng); địa điểm khác do quản trị nhập vẫn hiện thêm. */
export const MEETING_LOCATIONS = ['Bắc Ninh', 'Bắc Giang', 'Hưng Yên']

/** Người dự họp (máy chủ không trả email). */
export interface MeetingPerson { userId: string; fullName: string; department: string | null }

/** Cách hiện một người dự: "Tên - Bộ phận" (không có bộ phận thì chỉ tên). */
export const personLabel = (p: MeetingPerson) => (p.department ? `${p.fullName} - ${p.department}` : p.fullName)

/** Lượt đặt phòng (BM_Bookings, dùng chung với web đặt phòng cũ). status: 1 đã đặt, 2 bị từ chối, 3 đã huỷ. invited = mình được mời dự (không phải người đặt). */
export interface MeetingBooking {
  code: string; title: string; roomName: string; note: string | null; userName: string | null
  day: string; from: string; to: string; status: number; reasonCancel: string | null; createdAt: string | null
  mine: boolean; canCancel: boolean; canEdit: boolean; invited: boolean; ended: boolean; attendees: MeetingPerson[]
}

export interface BookInput { roomCode: string; days: string[]; from: string; to: string; title: string; note?: string; attendees: string[] }
export interface EditInput { roomCode: string; day: string; from: string; to: string; title: string; note?: string; attendees: string[] }

const enc = encodeURIComponent

export const meetingRooms = {
  rooms: () => api.get<MeetingRoom[]>('/meeting-rooms').then((r) => r.data),
  day: (date: string) => api.get<MeetingBooking[]>('/meeting-rooms/bookings', { params: { date } }).then((r) => r.data),
  mine: () => api.get<MeetingBooking[]>('/meeting-rooms/mine').then((r) => r.data),
  people: (search: string) => api.get<MeetingPerson[]>('/meeting-rooms/people', { params: { search } }).then((r) => r.data),
  book: (b: BookInput) => api.post<{ codes: string[] }>('/meeting-rooms/bookings', b).then((r) => r.data),
  edit: (code: string, b: EditInput) => api.put(`/meeting-rooms/bookings/${enc(code)}`, b).then(() => undefined),
  cancel: (code: string, reason?: string) => api.post(`/meeting-rooms/bookings/${enc(code)}/cancel`, { reason }).then(() => undefined),
  // Quản trị
  allRooms: () => api.get<MeetingRoom[]>('/admin/meeting-rooms').then((r) => r.data),
  addRoom: (b: { name: string; location?: string }) => api.post<{ code: string }>('/admin/meeting-rooms', b).then((r) => r.data),
  updateRoom: (code: string, b: { name: string; location?: string }) => api.put(`/admin/meeting-rooms/${enc(code)}`, b).then(() => undefined),
  toggleRoom: (code: string) => api.post<{ active: boolean }>(`/admin/meeting-rooms/${enc(code)}/toggle`).then((r) => r.data),
  adminEdit: (code: string, b: EditInput) => api.put(`/admin/meeting-rooms/bookings/${enc(code)}`, b).then(() => undefined),
  adminCancel: (code: string, reason: string) => api.post(`/admin/meeting-rooms/bookings/${enc(code)}/cancel`, { reason }).then(() => undefined),
}

/** Các lượt đang chiếm chỗ khi đặt trùng (máy chủ trả kèm lỗi 409). */
export function conflictsOf(e: unknown): MeetingBooking[] {
  const d = (e as { response?: { data?: { conflicts?: MeetingBooking[] } } })?.response?.data
  return d?.conflicts ?? []
}
