import { api } from './client'
import type { PayrollPreview } from './payroll'

export interface ClosingIssue { code: string; detail: string | null }
export interface ColumnMatch { key: string; nonzero: number; exact: number }
export interface ClosingAutoSummary {
  token: string; period: string; people: number; withIssues: number; issueCounts: Record<string, number>
  hrPeople: number; compared: number; totalMatches: number; differFromHr: number; columns: ColumnMatch[]
  status: 'draft' | 'locked'; lockedBy: string | null; lockedAt: string | null; builtAt: string; fromCache: boolean; edited: number; tablesReady: boolean
}
export interface ColumnDiff { key: string; auto: number; hr: number }
export interface ClosingAutoRow {
  employeeId: string; fullName: string; department: string; position: string; issues: ClosingIssue[]
  total: number; hrTotal: number | null; dayHours: number; nightHours: number; otHours: number; leave: number
  inHr: boolean; differsFromHr: boolean; diffs: ColumnDiff[]; edited: boolean; note: string | null
}
export interface ClosingAutoPage { total: number; page: number; pageSize: number; rows: ClosingAutoRow[] }
export interface PayAdjustmentView { closing: Record<string, number>; inputs: Record<string, number>; items: Record<string, number>; note: string | null; updatedBy: string | null; updatedAt: string | null }
export interface ClosingAutoDetail {
  employeeId: string; fullName: string; department: string; issues: ClosingIssue[]
  auto: Record<string, number>; adjusted: Record<string, number>; hr: Record<string, number>; adjustment: PayAdjustmentView | null
}
/** Một ngày của người đang sửa (từ bảng chấm công): để HR thấy ngày vắng, OT tính ít hơn đăng ký… */
export interface ClosingDay {
  date: string; dayKind: string; shift: string; timeIn: string | null; timeOut: string | null; dayHours: number; nightHours: number; ot: number; otRegistered: number; leave: number
  status: string; absent: boolean; hungYen: string | null; otFrom: string | null; otTo: string | null; forms: number; otRegs: number; businessTrip?: boolean
}
export interface AdjustBody { closing: Record<string, number>; inputs: Record<string, number>; items: Record<string, number>; note: string | null }
export interface ClosingLockResult { written: number; updated: number; period: string }


const base = '/admin/closing-auto'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const closingAuto = {
  preview: (period: string, refresh = false, group?: 'op' | 'staff' | 'temp') => api.post<ClosingAutoSummary>(`${base}/preview`, { period, refresh, group }, { timeout: 600000 }).then((r) => r.data),
  results: (token: string, p: { search?: string; view?: string; issue?: string; page: number; pageSize: number }) =>
    api.get<ClosingAutoPage>(`${base}/results`, { params: { token, search: p.search || undefined, view: p.view || undefined, issue: p.issue || undefined, page: p.page, pageSize: p.pageSize } }).then((r) => r.data),
  detail: (token: string, employeeId: string) => api.get<ClosingAutoDetail>(`${base}/detail`, { params: { token, employeeId } }).then((r) => r.data),
  days: (token: string, employeeId: string) => api.get<ClosingDay[]>(`${base}/days`, { params: { token, employeeId } }).then((r) => r.data),
  adjust: (token: string, employeeId: string, b: AdjustBody) => api.put<ClosingAutoRow>(`${base}/adjust`, { token, employeeId, ...b }).then((r) => r.data),
  lock: (token: string) => api.post<ClosingLockResult>(`${base}/lock`, { token }, { timeout: 600000 }).then((r) => r.data),
  unlock: (period: string) => api.post(`${base}/unlock`, { period }).then(() => undefined),
  draft: async (token: string) => saveBlob(await api.get<Blob>(`${base}/draft`, { params: { token }, responseType: 'blob', timeout: 180000 }), 'ChotCongTuDong.xlsx'),
  compare: async (token: string) => saveBlob(await api.get<Blob>(`${base}/compare`, { params: { token }, responseType: 'blob', timeout: 180000 }), 'DoiChieuChotCong.xlsx'),
  payroll: (token: string) => api.post<PayrollPreview>(`${base}/payroll`, { token }, { timeout: 600000 }).then((r) => r.data),
}
