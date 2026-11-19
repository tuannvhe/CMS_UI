import type { MonthRef } from '../../api/monthReview'

export const MONTH_BADGE_ICON: Record<string, string> = { m_attendance: '📅', m_clean: '✨', m_ot_up: '🚀' }

/** Kỳ "Tháng của tôi" mới nhất đã mở xem trên máy này (chỉ để hiện chữ MỚI ở trang chủ; mất cũng không sao). */
const SEEN_KEY = 'mr-seen'
export const periodKey = (p: MonthRef) => `${p.year}-${String(p.month).padStart(2, '0')}`
export function seenPeriod(): string {
  try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' }
}
export function markSeen(p: MonthRef) {
  try { if (periodKey(p) > seenPeriod()) localStorage.setItem(SEEN_KEY, periodKey(p)) } catch { /* trình duyệt chặn lưu: bỏ qua */ }
}
