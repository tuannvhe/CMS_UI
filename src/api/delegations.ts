import { api } from './client'

export type DelegationStatus = 'active' | 'upcoming' | 'expired' | 'cancelled'
export interface DelegationRow { id: number; fromUser: string; fromName: string; toUser: string; toName: string; startDate: string; endDate: string; reason: string | null; status: DelegationStatus; createdBy: string | null }
export interface DelegationList { ready: boolean; items: DelegationRow[] }
export interface PersonHit { userId: string; fullName: string; email: string | null }
export interface DelegationInput { toUser: string; startDate: string; endDate: string; reason?: string; fromUser?: string }

export const delegations = {
  list: (all: boolean) => api.get<DelegationList>('/delegations', { params: { all } }).then((r) => r.data),
  people: (search: string) => api.get<PersonHit[]>('/delegations/people', { params: { search } }).then((r) => r.data),
  create: (b: DelegationInput) => api.post<{ id: number }>('/delegations', b).then((r) => r.data),
  cancel: (id: number) => api.post(`/delegations/${id}/cancel`).then(() => undefined),
}

