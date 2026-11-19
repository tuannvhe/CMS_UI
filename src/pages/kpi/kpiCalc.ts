/** Quy tắc tính KPI dùng chung (giống KpiCalc ở máy chủ): % đạt từng chỉ tiêu, điểm có trọng số, trạng thái và màu. */
export type KpiStatus = 'ok' | 'near' | 'low'
export type CalcValueType = 'number' | 'rating' | 'yesno'

const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * % đạt của một chỉ tiêu (0–120, làm tròn 1 chữ số). number / rating: cao tốt = thực tế / mục tiêu (mục tiêu ≤ 0: có thực tế > 0 là 120, ngược lại 100);
 * thấp tốt = mục tiêu / thực tế (thực tế ≤ 0 là 120). yesno: thực tế ≥ 1 là 100, ngược lại 0. Chưa có thực tế → null.
 */
export function achieve(valueType: CalcValueType, lowerBetter: boolean, target: number, actual: number | null | undefined): number | null {
  if (actual == null || Number.isNaN(actual)) return null
  if (valueType === 'yesno') return actual >= 1 ? 100 : 0
  let v: number
  if (lowerBetter) v = actual <= 0 ? 120 : Math.min(120, (target / actual) * 100)
  else if (target <= 0) v = actual > 0 ? 120 : 100
  else v = Math.min(120, (actual / target) * 100)
  return Math.max(0, r1(v))
}

/** Điểm = Σ(% đạt × trọng số) / Σ trọng số trên các chỉ tiêu đã có % đạt; không chỉ tiêu nào có → null. */
export function weightedScore(items: { weight: number; achieve: number | null | undefined }[]): number | null {
  const xs = items.filter((i): i is { weight: number; achieve: number } => i.achieve != null)
  const w = xs.reduce((s, i) => s + i.weight, 0)
  if (xs.length === 0 || w <= 0) return null
  return r1(xs.reduce((s, i) => s + i.achieve * i.weight, 0) / w)
}

export const statusOf = (pct: number): KpiStatus => (pct >= 100 ? 'ok' : pct >= 90 ? 'near' : 'low')
export const STATUS_COLOR: Record<KpiStatus, string> = { ok: '#12B76A', near: '#E0A526', low: '#D92D20' }
/** Màu chữ theo trạng thái (đậm hơn STATUS_COLOR để đủ tương phản trên nền trắng). */
export const STATUS_TEXT: Record<KpiStatus, string> = { ok: '#067647', near: '#B54708', low: '#B42318' }
