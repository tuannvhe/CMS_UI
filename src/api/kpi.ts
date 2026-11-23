import { api } from './client'

/** KPI phòng ban (giai đoạn 1): kỳ, thư viện chỉ tiêu, phiếu KPI theo phòng ban, nhập thực tế, duyệt, báo cáo. */
export type KpiCategory = 'Q' | 'C' | 'D' | 'S' | 'P'
export type KpiValueType = 'number' | 'rating' | 'yesno'
export type KpiSourceKind = 'manual' | 'excel'
export type KpiFrequency = 'monthly' | 'quarterly' | 'yearly'
export type KpiPeriodStatus = 'open' | 'closing' | 'locked'
export type KpiSheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'locked'
export type KpiSite = 'BN' | 'HY'

export interface KpiName { vi: string; en: string | null; ko: string | null }
export type KpiByCat = Record<KpiCategory, number | null>

export interface KpiPeriod {
  id: number; code: string; kind: string; start: string; end: string; submitDue: string | null; status: KpiPeriodStatus
  createdBy: string | null; createdAt: string | null; lockedBy: string | null; lockedAt: string | null
}
export interface KpiIndicator {
  id: number; code: string; name: KpiName; unit: string; category: KpiCategory; lowerBetter: boolean; valueType: KpiValueType
  formula: string | null; source: string | null; sourceKind: KpiSourceKind; frequency: KpiFrequency; active: boolean; used: boolean
}
export interface KpiIndicatorBody {
  code: string; nameVi: string; nameEn?: string | null; nameKo?: string | null; unit: string; category: KpiCategory; lowerBetter: boolean
  valueType: KpiValueType; formula?: string | null; source?: string | null; sourceKind: KpiSourceKind; frequency: KpiFrequency
}
export interface KpiPerson { id: string; name: string; position: string | null }
export interface KpiSheetRow {
  id: number; periodId: number; periodCode: string; unitId: number; unitName: string; department: string | null; site: string | null
  status: KpiSheetStatus; score: number | null; owners: KpiPerson[]; submittedAt: string | null
}
export interface KpiSheet {
  id: number; periodId: number; periodCode: string; periodStatus: KpiPeriodStatus; unitId: number; unitName: string; department: string | null; site: string | null
  status: KpiSheetStatus; score: number | null; owners: KpiPerson[]; submittedBy: string | null; submittedAt: string | null
  approvedBy: string | null; approvedAt: string | null; rejectedBy: string | null; rejectedAt: string | null; rejectReason: string | null; rowVersion: string
}
export interface KpiHistoryPoint { periodCode: string; actual: number | null; achieve: number | null }
export interface KpiItem {
  id: number; indicator: KpiIndicator; weight: number; target: number; actual: number | null; note: string | null; achieve: number | null; sort: number
  history: KpiHistoryPoint[]
}
export interface KpiApprover { id: string; name: string; level: number }
export interface KpiLog {
  id: number; itemId: number | null; indicatorCode: string | null; action: string; oldValue: string | null; newValue: string | null
  reason: string | null; by: string; byName: string | null; at: string
}
export interface KpiCan { edit: boolean; submit: boolean; approve: boolean; reject: boolean }
export interface KpiSheetDetail { sheet: KpiSheet; items: KpiItem[]; byCat: KpiByCat; approvers: KpiApprover[]; log: KpiLog[]; can: KpiCan }

export interface KpiOverviewUnit {
  sheetId: number; unitId: number; unitName: string; department: string | null; site: string | null; status: KpiSheetStatus
  score: number | null; prevScore: number | null; count: number; passed: number; low: number; byCat: KpiByCat
}
export interface KpiOverview {
  period: KpiPeriod | null; units: KpiOverviewUnit[]; trend: { periodCode: string; avg: number | null }[]
  attention: { sheetId: number; unitName: string; indicatorCode: string; name: KpiName; achieve: number }[]
}
export interface KpiInbox { mine: KpiSheetRow[]; toApprove: KpiSheetRow[] }
export interface KpiTargetItem { indicator: KpiIndicator; weight: number; target: number; sort: number }
export interface KpiTargets { sheet: KpiSheet | null; items: KpiTargetItem[]; weightSum: number; canEdit: boolean }
export interface KpiReport { periods: string[]; rows: { unitId: number; unitName: string; department: string | null; site: string | null; scores: (number | null)[] }[] }
export interface KpiImportResult {
  rows: { excelRow: number; unitName: string; indicatorCode: string; actual: number; old: number | null }[]
  errors: { excelRow: number; code: string; detail: string | null }[]
  applied: number
}
export interface KpiPeriodAction { period: KpiPeriod; unapproved: string[]; done: boolean }
export interface KpiAssignment {
  unit: { id: number; name: string; department: string; site: string | null; active: boolean }
  sheetId: number | null; status: KpiSheetStatus | null; itemCount: number; weightSum: number; owners: KpiPerson[]
}
export interface KpiAssignBody { periodId: number; unitId: number; ownerIds: string[]; items: { indicatorId: number; weight: number; target: number; sort: number }[] }
export interface KpiCopyResult { created: number; skipped: { unitId: number; reason: string }[] }
export interface KpiOwnerSuggestion { id: string; name: string; position: string | null; isLeader: boolean }

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
const upload = (url: string, file: File, dryRun: boolean) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<KpiImportResult>(url, fd, { params: { dryRun }, timeout: 180000 }).then((r) => r.data)
}
const opt = <T,>(v: T | null | undefined | '') => (v === '' || v == null ? undefined : v)

export const kpi = {
  // Staff (/api/kpi)
  periods: () => api.get<KpiPeriod[]>('/kpi/periods').then((r) => r.data),
  overview: (periodId?: number, site?: string) => api.get<KpiOverview>('/kpi/overview', { params: { periodId: opt(periodId), site: opt(site) } }).then((r) => r.data),
  sheets: (p: { periodId?: number; site?: string; department?: string }) =>
    api.get<KpiSheetRow[]>('/kpi/sheets', { params: { periodId: opt(p.periodId), site: opt(p.site), department: opt(p.department) } }).then((r) => r.data),
  sheet: (id: number) => api.get<KpiSheetDetail>(`/kpi/sheets/${id}`).then((r) => r.data),
  saveActuals: (id: number, rowVersion: string, items: { itemId: number; actual: number | null; note: string | null }[]) =>
    api.put<KpiSheetDetail>(`/kpi/sheets/${id}/actuals`, { rowVersion, items }).then((r) => r.data),
  sheetTemplate: async (id: number) => saveBlob(await api.get<Blob>(`/kpi/sheets/${id}/actuals/template`, { responseType: 'blob', timeout: 60000 }), 'MauNhapKPI.xlsx'),
  importSheet: (id: number, file: File, dryRun: boolean) => upload(`/kpi/sheets/${id}/actuals/import`, file, dryRun),
  submit: (id: number, rowVersion: string) => api.post<KpiSheetDetail>(`/kpi/sheets/${id}/submit`, { rowVersion }).then((r) => r.data),
  approve: (id: number, rowVersion: string, comment?: string) => api.post<KpiSheetDetail>(`/kpi/sheets/${id}/approve`, { rowVersion, comment: opt(comment) }).then((r) => r.data),
  reject: (id: number, rowVersion: string, reason: string) => api.post<KpiSheetDetail>(`/kpi/sheets/${id}/reject`, { rowVersion, reason }).then((r) => r.data),
  inbox: (periodId?: number) => api.get<KpiInbox>('/kpi/inbox', { params: { periodId: opt(periodId) } }).then((r) => r.data),
  targets: (periodId: number, unitId: number) => api.get<KpiTargets>('/kpi/targets', { params: { periodId, unitId } }).then((r) => r.data),
  report: (p: { from?: string; to?: string; site?: string }) =>
    api.get<KpiReport>('/kpi/report', { params: { from: opt(p.from), to: opt(p.to), site: opt(p.site) } }).then((r) => r.data),
  exportReport: async (p: { from?: string; to?: string; site?: string }) =>
    saveBlob(await api.get<Blob>('/kpi/report/export', { params: { from: opt(p.from), to: opt(p.to), site: opt(p.site) }, responseType: 'blob', timeout: 120000 }), 'BaoCaoKPI.xlsx'),
  indicators: () => api.get<KpiIndicator[]>('/kpi/indicators').then((r) => r.data),

  // HR (/api/admin/kpi)
  ready: () => api.get<{ ready: boolean }>('/admin/kpi/status').then((r) => r.data.ready),
  allIndicators: () => api.get<KpiIndicator[]>('/admin/kpi/indicators', { params: { all: true } }).then((r) => r.data),
  createIndicator: (b: KpiIndicatorBody) => api.post<KpiIndicator>('/admin/kpi/indicators', b).then((r) => r.data),
  updateIndicator: (id: number, b: KpiIndicatorBody) => api.put<KpiIndicator>(`/admin/kpi/indicators/${id}`, b).then((r) => r.data),
  setIndicatorActive: (id: number, active: boolean) => api.put(`/admin/kpi/indicators/${id}/active`, { active }).then(() => undefined),
  createPeriod: (b: { code: string; kind?: string; start?: string; end?: string; submitDue?: string }) => api.post<KpiPeriod>('/admin/kpi/periods', b).then((r) => r.data),
  updatePeriod: (id: number, b: { start?: string; end?: string; submitDue?: string }) => api.put<KpiPeriod>(`/admin/kpi/periods/${id}`, b).then((r) => r.data),
  closing: (id: number) => api.post<KpiPeriodAction>(`/admin/kpi/periods/${id}/closing`).then((r) => r.data),
  lock: (id: number, force?: boolean) => api.post<KpiPeriodAction>(`/admin/kpi/periods/${id}/lock`, { force: !!force }).then((r) => r.data),
  reopenPeriod: (id: number, reason: string) => api.post<KpiPeriodAction>(`/admin/kpi/periods/${id}/reopen`, { reason }).then((r) => r.data),
  assignments: (periodId: number) => api.get<KpiAssignment[]>(`/admin/kpi/periods/${periodId}/assignments`).then((r) => r.data),
  saveAssignment: (b: KpiAssignBody) => api.put<KpiSheetDetail>('/admin/kpi/sheets', b).then((r) => r.data),
  copyFrom: (periodId: number, fromPeriodId: number, unitIds?: number[]) =>
    api.post<KpiCopyResult>(`/admin/kpi/periods/${periodId}/copy-from/${fromPeriodId}`, { unitIds: unitIds?.length ? unitIds : undefined }).then((r) => r.data),
  reopenSheet: (id: number, reason: string) => api.post<KpiSheetDetail>(`/admin/kpi/sheets/${id}/reopen`, { reason }).then((r) => r.data),
  periodTemplate: async (periodId: number) => saveBlob(await api.get<Blob>(`/admin/kpi/periods/${periodId}/actuals/template`, { responseType: 'blob', timeout: 120000 }), 'MauNhapKPI.xlsx'),
  importPeriod: (periodId: number, file: File, dryRun: boolean) => upload(`/admin/kpi/periods/${periodId}/actuals/import`, file, dryRun),
  suggestOwners: (unitId: number) => api.get<KpiOwnerSuggestion[]>('/admin/kpi/owners/suggest', { params: { unitId } }).then((r) => r.data),
}
