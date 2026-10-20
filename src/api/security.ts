import { api } from './client'

export type GateState = 'waiting_out' | 'out' | 'back'

/** Một đơn ra ngoài đã duyệt của hôm nay để bảo vệ xác nhận ra / vào cổng. */
export interface GateRow {
  id: number; employeeId: string; fullName: string; department: string | null; factory: string | null
  date: string; timeOut: string; purpose: 'company' | 'personal'; reason: string; comeBackTime: string | null
  approverName: string; senderName: string
  confirmedBy: string | null; confirmedAt: string | null; actualComeBackAt: string | null
  state: GateState
}

export interface GateList { date: string; rows: GateRow[] }

/** Nhân viên tìm được ở cổng để đăng ký đi muộn. identityCard chỉ còn 4 số cuối. */
export interface GateEmployee {
  employeeId: string; fullName: string; position: string | null; department: string | null; factory: string | null; identityCard: string | null; status: string | null
  registeredToday: boolean; registeredAt: string | null; avatarUrl: string | null
}
export interface GateLateRow { id: number; employeeId: string; fullName: string; department: string | null; factory: string | null; at: string; registeredBy: string | null }

export const gate = {
  lateLookup: (id: string) => api.get<GateEmployee>('/security/gate/late/lookup', { params: { id } }).then((r) => r.data),
  lateRegister: (id: string, time?: string) => api.post('/security/gate/late', { id, time }).then(() => undefined),
  lateToday: (factory?: string) => api.get<{ date: string; rows: GateLateRow[] }>('/security/gate/late/today', { params: { factory: factory || undefined } }).then((r) => r.data),
  list: (factory?: string) => api.get<GateList>('/security/gate/go-out', { params: { factory: factory || undefined } }).then((r) => r.data),
  confirmOut: (id: number) => api.post('/security/gate/go-out/confirm-out', { id }).then(() => undefined),
  confirmBack: (id: number) => api.post('/security/gate/go-out/confirm-back', { id }).then(() => undefined),
}
