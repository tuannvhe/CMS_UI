import { api } from './client'

/**
 * Đối soát tờ khai ECUS ↔ permit ERP (chỉ đọc cả hai phía). Trang quản trị cấp được: khoá "customsReconcile"; team Logistic tự được vào.
 * Lỗi là ProblemDetails, mã ở `title` (đọc bằng customsError trong api/customs.ts).
 */

export type ReconcileStatus = 'matched' | 'mismatch' | 'notPushed' | 'notApplicable' | 'orphanPermit' | 'duplicate'
export type ReconcileField = 'date' | 'currency' | 'lines' | 'qty' | 'curAmt' | 'domAmt' | 'importTax' | 'vat'
export type ReconcileResult = 'ok' | 'over' | 'warn' | 'skip'
export type ReconcileReason = 'cancelled' | 'superseded' | 'kindNotMapped'

export const RECONCILE_STATUSES: ReconcileStatus[] = ['matched', 'mismatch', 'notPushed', 'notApplicable', 'orphanPermit', 'duplicate']

export interface ReconcileTolerance { dateDays: number; qty: number; curAmt: number; domAmtPercent: number; domAmtMin: number; tax: number }
export interface ReconcileStatusInfo {
  ecusConfigured: boolean; erpConfigured: boolean; erpSource: 'ErpCustoms' | 'Erp' | string; maxRangeDays: number; maxDeclarations: number
  tolerance: ReconcileTolerance; taxCompareFrom: string | null
}
/** permitDate dạng "yyyyMMdd" (như ERP lưu). */
export interface ReconcilePermit { permitSeq: number; permitNo: string | null; permitRefNo: string | null; permitDate: string | null }
/** diff = ERP − ECUS. */
export interface ReconcileCheck {
  field: ReconcileField | string; result: ReconcileResult | string; ecusText: string | null; erpText: string | null
  ecusValue: number | null; erpValue: number | null; diff: number | null; tolerance: number | null
}
/** Dòng orphanPermit: soToKhai = PermitRefNo gốc, ngayDangKy = PermitDate. */
export interface ReconcileRow {
  soToKhai: string; loai: 'N' | 'X' | string; ngayDangKy: string | null; maLoaiHinh: string | null; doiTac: string | null; soHoaDon: string | null
  status: ReconcileStatus; reason: ReconcileReason | null; supersededBy: string | null; permits: ReconcilePermit[]; checks: ReconcileCheck[]; note: string | null
}
export type ReconcileCounts = Record<ReconcileStatus, number>
export interface ReconcilePage {
  rows: ReconcileRow[]; total: number; page: number; pageSize: number; counts: ReconcileCounts
  from: string; to: string; kind: string | null; status: string | null; erpDatabase: string | null; erpSource: string | null; generatedAt: string
}
export interface ReconcileQuery { from: string; to: string; kind?: 'N' | 'X'; status?: ReconcileStatus }

const base = '/admin/customs-reconcile'
const clean = (q: ReconcileQuery) => ({ from: q.from, to: q.to, kind: q.kind || undefined, status: q.status || undefined })

export const customsReconcile = {
  status: () => api.get<ReconcileStatusInfo>(`${base}/status`).then((r) => r.data),
  /** refresh = true: bỏ bộ nhớ đệm phía máy chủ, đọc lại ECUS + ERP. */
  list: (q: ReconcileQuery & { page: number; pageSize: number; refresh?: boolean }) =>
    api.get<ReconcilePage>(base, { params: { ...clean(q), page: q.page, pageSize: q.pageSize, refresh: q.refresh || undefined }, timeout: 120000 }).then((r) => r.data),
  get: (soToKhai: string, q: Omit<ReconcileQuery, 'status'>) =>
    api.get<ReconcileRow>(`${base}/${encodeURIComponent(soToKhai)}`, { params: { from: q.from, to: q.to, kind: q.kind || undefined }, timeout: 120000 }).then((r) => r.data),
  exportExcel: async (q: ReconcileQuery) => {
    const res = await api.get<Blob>(`${base}/export`, { params: clean(q), responseType: 'blob', timeout: 300000 })
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = m ? decodeURIComponent(m[1]) : `DoiSoat_${q.from.replace(/-/g, '')}_${q.to.replace(/-/g, '')}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}
