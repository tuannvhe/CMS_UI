import { api } from './client'
import type { AddressConversion } from './idCards'

export interface AdminUnitInfo { version: string | null; source: string | null; syncedAt: string | null; oldProvinces: number; newProvinces: number; newWards: number; oldWards: number }
export interface AdminUnitSyncState {
  running: boolean; done: number; total: number; step: string | null; startedAt: string | null; finishedAt: string | null; by: string | null; error: string | null; result: string | null
}
/** splitWards = số xã mới có nhận một phần xã cũ bị chia (địa chỉ cũ ở đó phải chọn tay). */
export interface NewProvinceRow { code: string; name: string; type: string; wardCount: number; mergedFrom: string[]; splitWards: number }
export interface OldWardRef { code: string; name: string; district: string | null; province: string | null; partial: boolean }
export interface NewWardRow { code: string; name: string; type: string; oldWards: OldWardRef[] }
export interface WardHit { provinceCode: string; provinceName: string; ward: NewWardRow }

const base = '/admin/admin-units'
export const adminUnits = {
  info: () => api.get<{ data: AdminUnitInfo; sync: AdminUnitSyncState }>(`${base}/info`).then((r) => r.data),
  provinces: () => api.get<NewProvinceRow[]>(`${base}/provinces`).then((r) => r.data),
  wards: (code: string) => api.get<NewWardRow[]>(`${base}/provinces/${code}/wards`).then((r) => r.data),
  search: (q: string) => api.get<WardHit[]>(`${base}/search`, { params: { q } }).then((r) => r.data),
  convert: (address: string) => api.get<AddressConversion>(`${base}/convert`, { params: { address } }).then((r) => r.data),
  sync: () => api.post<AdminUnitSyncState>(`${base}/sync`).then((r) => r.data),
}
