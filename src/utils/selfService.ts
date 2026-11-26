import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { lookups, type SelfServiceRule, type WindowKind } from '../api/requests'

/** Lịch khóa / mở tự gửi đơn của máy chủ; lỗi / chưa tải thì coi như mở (máy chủ vẫn chặn). */
export function useSelfService() {
  return useQuery({ queryKey: ['req', 'self-service'], queryFn: lookups.selfService, staleTime: 5 * 60 * 1000, retry: false }).data
}

const periodOrder = (p: string) => { const m = /^(\d{1,2})\/(\d{4})$/.exec(p.trim()); return m ? Number(m[2]) * 100 + Number(m[1]) : 0 }

/**
 * Ngày này đã hết được tự gửi đơn loại kind chưa (không xét quyền). Kỳ có trong lịch khóa / mở thì theo lịch (mở / khóa / hạn chót HR đặt);
 * không có thì cùng cách tính mặc định với máy chủ: hết ngày untilDay của tháng sau.
 */
export function isPastSelfService(date: string | Dayjs | null | undefined, rule: SelfServiceRule | undefined, kind?: WindowKind, now: Dayjs = dayjs()) {
  if (!date || !rule) return false
  const d = dayjs(date)
  if (!d.isValid()) return false
  const w = kind ? rule.windows?.find((x) => x.kind === kind && x.period === d.format('MM/YYYY')) : undefined
  if (w) {
    if (w.mode === 'open') return false
    if (w.mode === 'locked') return true
    return !!w.deadline && !now.isBefore(dayjs(w.deadline)) && (!w.reopenAt || now.isBefore(dayjs(w.reopenAt)))
  }
  if (rule.untilDay <= 0) return false
  const from = periodOrder(rule.fromPeriod)
  if (from > 0 && d.year() * 100 + d.month() + 1 < from) return false
  const deadline = d.startOf('month').add(1, 'month').add(Math.min(rule.untilDay, 27), 'day')
  const reopenDay = rule.reopenDay ?? 0
  const reopen = reopenDay > rule.untilDay ? d.startOf('month').add(1, 'month').add(Math.min(reopenDay, 27), 'day') : null
  return !now.isBefore(deadline) && (!reopen || now.isBefore(reopen))
}
