import { api } from './client'
import type { WindowKind, WindowMode } from './requests'

/** Trạng thái hiệu lực của (kỳ, loại đơn): custom = HR đặt riêng; closed = người thường đã hết được tự gửi. */
export interface WindowState {
  period: string; kind: WindowKind; mode: WindowMode; deadline: string | null; custom: boolean; closed: boolean
  note: string | null; updatedBy: string | null; updatedAt: string | null
}
export interface WindowList { ready: boolean; untilDay: number; fromPeriod: string; items: WindowState[] }
export interface WindowInput { period: string; kinds: WindowKind[]; mode: WindowMode; deadline?: string | null; note?: string }

const base = '/admin/request-windows'

export const requestWindows = {
  list: (year: number) => api.get<WindowList>(base, { params: { year } }).then((r) => r.data),
  save: (b: WindowInput) => api.put<WindowState[]>(base, b).then((r) => r.data),
}
