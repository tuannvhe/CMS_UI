import { api } from './client'
import type { WindowKind, WindowMode } from './requests'

/** Trạng thái hiệu lực của (kỳ, loại đơn): custom = HR đặt riêng; closed = người thường đã hết được tự gửi. */
export interface WindowState {
  period: string; kind: WindowKind; mode: WindowMode; deadline: string | null; custom: boolean; closed: boolean
  note: string | null; updatedBy: string | null; updatedAt: string | null
  /** Chế độ auto: lúc tự mở lại sau hạn chót (mặc định 00:00 ngày reopenDay + 1 tháng sau); null = khóa luôn từ hạn chót. */
  reopenAt?: string | null
}
/** autoLock = lịch tự động đang bật; untilDay = đóng hết ngày này tháng sau; reopenDay = mở lại hết ngày này tháng sau (0 = không tự mở lại). */
export interface WindowList { ready: boolean; untilDay: number; fromPeriod: string; items: WindowState[]; autoLock?: boolean; reopenDay?: number }
export interface WindowInput { period: string; kinds: WindowKind[]; mode: WindowMode; deadline?: string | null; note?: string }

const base = '/admin/request-windows'

export const requestWindows = {
  list: (year: number) => api.get<WindowList>(base, { params: { year } }).then((r) => r.data),
  save: (b: WindowInput) => api.put<WindowState[]>(base, b).then((r) => r.data),
}
