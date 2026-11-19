import { api } from './client'
import type { TripCandidate } from './trips'

export interface BusinessTripEntry {
  id: number; employeeId: string; employeeName: string; department: string | null; from: string; to: string
  destination: string | null; reason: string | null
  /** confirmed (nhân sự đăng ký hoặc đã xác nhận: được tính công) | pending (chờ nhân sự xác nhận) */
  status: 'confirmed' | 'pending'
  registeredBy: string; createdAt: string | null; confirmedBy: string | null; confirmedAt: string | null
}
export interface BusinessTripMe { canRegister: boolean; all: boolean; departments: string[]; ready: boolean; today: string; hoursPerDay: number }
export interface RegisterBusinessTrip { from: string; to: string; employeeIds: string[]; destination: string; reason: string }


const base = '/trips/business'

export const businessTrips = {
  me: () => api.get<BusinessTripMe>(`${base}/me`).then((r) => r.data),
  candidates: () => api.get<TripCandidate[]>(`${base}/candidates`).then((r) => r.data),
  list: (from: string, to: string) => api.get<BusinessTripEntry[]>(base, { params: { from, to } }).then((r) => r.data),
  pending: () => api.get<BusinessTripEntry[]>(`${base}/pending`).then((r) => r.data),
  register: (b: RegisterBusinessTrip) => api.post<{ added: number; skipped: string[]; pending: boolean }>(base, b).then((r) => r.data),
  confirm: (ids: number[]) => api.post<{ confirmed: number }>(`${base}/confirm`, { ids }).then((r) => r.data),
  remove: (ids: number[]) => api.post<{ deleted: number }>(`${base}/delete`, { ids }).then((r) => r.data),
}
