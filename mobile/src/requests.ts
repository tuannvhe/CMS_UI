/* 2026-11-23 [Truong] - Mobile app: request helpers (kinds, durations, error texts) — same rules as the web pages */
import type { TFunction } from 'i18next'
import { apiErrorCode, type ApprovalStep } from '@web/api/requests'

/** 6 loại đơn của app: finger / overtime / leave dùng /requests/*, goout / late / early dùng /requests/short/*. */
export type MobileRequestKind = 'overtime' | 'finger' | 'leave' | 'goout' | 'late' | 'early'
export const REQUEST_KINDS: MobileRequestKind[] = ['overtime', 'finger', 'leave', 'goout', 'late', 'early']
export const isRequestKind = (k: unknown): k is MobileRequestKind => typeof k === 'string' && (REQUEST_KINDS as string[]).includes(k)
export const isShortKind = (k: MobileRequestKind): k is 'goout' | 'late' | 'early' => k === 'goout' || k === 'late' || k === 'early'

/** Khoá react-query của danh sách nháp / đã gửi (dùng chung giữa tab Đơn từ và màn form). */
export const draftsKey = (kind: MobileRequestKind) =>
  kind === 'leave' ? ['req', 'leave-drafts'] : isShortKind(kind) ? ['short', 'drafts', kind] : ['req', 'drafts', kind]
export const submittedKey = (kind: MobileRequestKind) =>
  kind === 'leave' ? ['req', 'leave-submitted'] : isShortKind(kind) ? ['short', 'submitted', kind] : ['req', 'submitted', kind]

/** Nhãn loại đơn: dùng lại tên menu của web. */
const NAV: Record<MobileRequestKind, string> = {
  overtime: 'nav.overtime', finger: 'nav.fingerForm', leave: 'nav.leave', goout: 'nav.goOut', late: 'nav.lateForm', early: 'nav.earlyForm',
}
export const requestKindName = (t: TFunction, k: MobileRequestKind) => t(NAV[k], { defaultValue: t(`mobile.req.${k}`, { defaultValue: k }) })

/** Số cấp duyệt tối thiểu (components/ApproverChain.tsx của web). */
export const MIN_APPROVERS = 2

/**
 * Thời lượng như RegisterTab của web: giờ kết thúc ≤ giờ bắt đầu nghĩa là qua nửa đêm
 * (23:30 → 07:00 hôm sau = 7,5 giờ; 08:00 → 08:00 hôm sau = 24 giờ), giống cách máy chủ tính.
 */
export function duration(from?: string, to?: string) {
  const m = (s: string) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm }
  if (!from || !to || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) return null
  let minutes = m(to) - m(from)
  if (minutes <= 0) minutes += 24 * 60
  return { minutes, hours: Number((minutes / 60).toFixed(2)) }
}

/** Người gửi được huỷ đơn đã gửi: chính mình gửi, và chưa ai duyệt hoặc đã bị từ chối (components/CancelSubmitted.tsx). */
export function canCancelSteps(steps: ApprovalStep[], senderId: string, userId?: string) {
  if (!userId || senderId.trim().toLowerCase() !== userId.trim().toLowerCase()) return false
  if (steps.some((s) => s.status === 'rejected')) return true
  return !steps.some((s) => s.status === 'approved')
}

/** "2026-09-21 08:00 → 18:00" → "21/09/2026 08:00 → 18:00" */
const otRangeText = (d?: string | null) => (d ?? '').replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1')
const dmyList = (d?: string | null) => (d ? d.split(' → ').map((x) => x.slice(0, 10).split('-').reverse().join('/')).join(' → ') : '')

/** Một dòng "bị bỏ qua" của CreateResult / SubmitResult (req.skip.*). */
export function skipText(t: TFunction, s: { employeeId: string; reason: string; detail?: string | null }) {
  const detail = s.reason === 'overlap_ot' || s.reason === 'overlap_finger' ? otRangeText(s.detail)
    : s.reason === 'duplicate' || s.reason === 'overlap' ? dmyList(s.detail) : (s.detail ?? '')
  return `${s.employeeId}: ${t(`req.skip.${s.reason}`, { defaultValue: s.reason, detail })}`
}
export const warnText = (t: TFunction, s: { employeeId: string; reason: string; detail?: string | null }) =>
  `${s.employeeId}: ${t(`req.warn.${s.reason}`, { defaultValue: s.reason, detail: s.detail ?? '' })}`

/** Lỗi khi tạo / sửa / gửi / xoá đơn (draftErrorText + errMessage của web). */
export function requestError(t: TFunction, e: unknown, kind?: MobileRequestKind) {
  const { code, detail } = apiErrorCode(e)
  if (code === 'no_approver') return kind && isShortKind(kind) ? t('sh.err.approver') : t('req.err.no_approver')
  if (code === 'invalid_range') return kind && isShortKind(kind) ? t('sh.err.range') : t('att.invalid_range')
  if (code === 'not_found') return t('req.err.not_found')
  if (code === 'forbidden') return t('att.forbidden')
  if (code === 'invalid_input') {
    if (kind && isShortKind(kind)) return t(`sh.err.${detail}`, { defaultValue: t('req.err.invalid_input') })
    if (detail === 'totalDays') return t('leave.err.totalDays')
    if (detail === 'personTakeJob') return t('leave.err.personTakeJob')
    const [reason, extra] = detail.split(': ')
    if (reason === 'overlap_ot' || reason === 'overlap_finger') return t(`req.skip.${reason}`, { detail: otRangeText(extra) })
    if (reason === 'duplicate' || reason === 'overlap' || reason === 'employee_not_found') return t(`req.skip.${reason}`, { detail: dmyList(extra) })
    return `${t('req.err.invalid_input')}${detail ? ` (${detail})` : ''}`
  }
  if (!code && (e as { isAxiosError?: boolean; response?: unknown })?.isAxiosError && !(e as { response?: unknown }).response) return t('mobile.err.network')
  return t('req.err.generic')
}

/** yyyy-MM-dd ↔ Date theo giờ máy. */
export const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromYmd = (s?: string | null) => {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
export const dmy = (s?: string | null) => { const d = fromYmd(s); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '—' }
export const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
