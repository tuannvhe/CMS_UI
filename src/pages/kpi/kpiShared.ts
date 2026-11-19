import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { adminError } from '../../api/userAdmin'
import { kpi, type KpiName, type KpiSheetStatus } from '../../api/kpi'

/** Tiện ích dùng chung cho các màn KPI dữ liệu thật (không phải thành phần giao diện). */

/** Tên 3 ngôn ngữ của chỉ tiêu: thiếu bản dịch thì dùng tiếng Việt. */
export const pickName = (n: KpiName | null | undefined, lang: string) =>
  !n ? '' : (lang.startsWith('ko') ? n.ko : lang.startsWith('en') ? n.en : n.vi) || n.vi

/** Số hiển thị: số nguyên giữ nguyên, số lẻ tối đa 2 chữ số; kèm đơn vị ('%' dính liền). */
export function fmtNum(v: number | null | undefined, unit?: string) {
  if (v == null) return '—'
  const s = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
  return unit ? `${s}${unit === '%' ? '%' : ' ' + unit}` : s
}

export const isKpiAdmin = (user: { isAdmin?: boolean; grantedPages?: string[] } | null | undefined) => !!user?.isAdmin || !!user?.grantedPages?.includes('kpiAdmin')

export const SHEET_STATUS_COLOR: Record<KpiSheetStatus, string> = { draft: 'default', submitted: 'processing', approved: 'success', rejected: 'error', locked: 'purple' }

export const errInfo = (e: unknown) => ({ ...adminError(e), status: (e as { response?: { status?: number } } | null)?.response?.status })
export const isNotReady = (e: unknown) => errInfo(e).code === 'not_ready'

/** Thông báo lỗi theo ProblemDetails {title, detail} của /api/kpi và /api/admin/kpi. */
export function kpiErrText(t: TFunction, e: unknown): string {
  const { code, detail, status } = errInfo(e)
  if (code === 'not_ready') return t('kpi.notReady')
  if (code === 'stale') return t('kpi.err.stale')
  if (code === 'forbidden' || status === 403) return t('kpi.err.forbidden')
  if (code === 'too_large' || status === 413) return t('kpi.err.too_large')
  if (code === 'not_found' || status === 404) return t('kpi.err.not_found')
  if (detail) return t(`kpi.err.${detail}`, { defaultValue: t('kpi.err.generic') })
  return t('kpi.err.generic')
}

/** Danh sách kỳ KPI (mới nhất trước), dùng chung cho mọi màn. */
export const usePeriods = () => useQuery({ queryKey: ['kpi-periods'], queryFn: kpi.periods, staleTime: 60_000 })

/** Làm mới mọi dữ liệu KPI có thể đổi sau một thao tác ghi. */
export function invalidateKpi(qc: QueryClient) {
  for (const k of ['kpi-periods', 'kpi-inbox', 'kpi-overview', 'kpi-sheets', 'kpi-sheet', 'kpi-report', 'kpi-targets', 'kpi-assignments']) qc.invalidateQueries({ queryKey: [k] })
}

/** Giá trị trễ (debounce) cho ô tìm kiếm. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h) }, [value, ms])
  return v
}
