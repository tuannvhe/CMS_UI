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

export const gate = {
  list: (factory?: string) => api.get<GateList>('/security/gate/go-out', { params: { factory: factory || undefined } }).then((r) => r.data),
  confirmOut: (id: number) => api.post('/security/gate/go-out/confirm-out', { id }).then(() => undefined),
  confirmBack: (id: number) => api.post('/security/gate/go-out/confirm-back', { id }).then(() => undefined),
}
