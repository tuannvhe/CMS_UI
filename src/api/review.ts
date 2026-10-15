import { api } from './client'

/** Một đơn đánh giá kèm trạng thái các bước HR / trụ sở (Tbl_ManagementUserRate). */
export interface ReviewSet {
  employeeId: string; fullName: string; position: string; department: string; startWork: string | null
  typeRate: string; dateRate: string; rounds: number
  lastTransferred: boolean; hrConfirmed: boolean; hrTransferred: boolean
  hqStatus: string | null; hqResult: string | null; hqRemark: string | null
  promote: string | null; code: string | null; hrDate: string | null
  /** Đề xuất theo điểm (chỉ OP, theo quy tắc hệ thống cũ); null = HR tự chọn */
  suggest?: 'pass' | 'fail' | null; suggestReason?: string | null; total?: number | null
  /** Điểm G của nhóm hỗ trợ quản lý (OP) và điểm tổng hợp 70% F + 30% G; null = chưa nhập G */
  culture?: number | null; overall?: number | null
}
/** Điểm G của nhóm hỗ trợ quản lý: note = viết sổ cảm ơn (0–20), relation = quan hệ đồng nghiệp (0–25), g = tổng quy theo công thức cũ. */
export interface CultureScore { employeeId: string; dateRate: string; note: number | null; relation: number | null; g: number }
export const MAX_NOTE = 20
export const MAX_RELATION = 25
export type ReviewStageKey = 'pending' | 'done'
export interface ReviewKey { employeeId: string; dateRate: string; typeRate: string }
export interface ReviewBatchResult { done: number; skipped: { employeeId: string; reason: string }[] }
export interface FinalDecisionItem extends ReviewKey { pass: boolean; remark: string }
export interface ReviewCounts { pending: number }

/** Một kỳ đánh giá: tổng số đơn và số đơn HR đã chốt. */
export interface ReportPeriod { date: string; total: number; done: number }
export interface ReportRound { userName: string | null; status: string | null; mark: number | null }
export interface ReportRow {
  employeeId: string; fullName: string; position: string; department: string; startWork: string | null; dateRate: string; typeRate: string
  promote: string | null; hqResult: string | null; hqRemark: string | null; rounds: ReportRound[]; hrStatus: string | null; average: number | null
  culture: number | null; overall: number | null; suggest: 'pass' | 'fail' | null; suggestReason: string | null
}

/** Tổng quan tiến độ cho HR. */
export interface ReviewDashboard {
  rating: number; ratingLate: number; pending: number; doneRecent: number; unregistered: number; longOverdue: number
  departments: { department: string; rating: number; late: number; pending: number }[]
}

/** Một sự kiện trong lịch sử đơn đánh giá. */
export interface HistoryEvent { at: string; kind: 'created' | 'round_saved' | 'round_done' | 'hr_final'; round: number | null; by: string | null; byName: string | null; detail: string | null }

/** Một lần đánh giá trong hồ sơ nhiều kỳ của nhân viên. */
export interface EmployeeEvaluation {
  typeRate: string; dateRate: string; stage: 'rating' | 'pending' | 'done'; hrDate: string | null; result: 'pass' | 'fail' | null; remark: string | null; promote: string | null
  rounds: ReportRound[]; average: number | null; culture: number | null; overall: number | null; suggest: 'pass' | 'fail' | null
}

export const key = (s: { employeeId: string; dateRate: string; typeRate: string }) => `${s.employeeId}|${s.dateRate}|${s.typeRate}`
export const toKey = (s: ReviewSet | ReportRow): ReviewKey => ({ employeeId: s.employeeId, dateRate: s.dateRate.slice(0, 10), typeRate: s.typeRate })

export const review = {
  list: (stage: ReviewStageKey, from?: string, search?: string) =>
    api.get<ReviewSet[]>('/evaluations/review', { params: { stage, from, search: search || undefined } }).then((r) => r.data),
  suggestions: (from?: string) =>
    api.get<{ employeeId: string; dateRate: string; typeRate: string; suggest: 'pass' | 'fail'; suggestReason: string | null; total: number | null; culture: number | null; overall: number | null }[]>('/evaluations/review/suggestions', { params: { from } }).then((r) => r.data),
  culture: (from?: string) => api.get<CultureScore[]>('/evaluations/review/culture', { params: { from } }).then((r) => r.data),
  setCulture: (k: ReviewKey, note: number, relation: number) => api.put<CultureScore>('/evaluations/review/culture', { ...k, note, relation }).then((r) => r.data),
  dashboard: () => api.get<ReviewDashboard>('/evaluations/review/dashboard').then((r) => r.data),
  history: (k: ReviewKey) => api.get<HistoryEvent[]>('/evaluations/audit/history', { params: k }).then((r) => r.data),
  employeeHistory: (employeeId: string) => api.get<EmployeeEvaluation[]>('/evaluations/employee-history', { params: { employeeId } }).then((r) => r.data),
  counts: () => api.get<ReviewCounts>('/evaluations/review/counts').then((r) => r.data),
  finalize: (items: FinalDecisionItem[]) => api.post<ReviewBatchResult>('/evaluations/review/finalize', { items }).then((r) => r.data),
  reportDates: () => api.get<ReportPeriod[]>('/evaluations/report/dates').then((r) => r.data),
  report: (dateRate: string) => api.get<ReportRow[]>('/evaluations/report', { params: { dateRate } }).then((r) => r.data),
  promote: (k: ReviewKey, promote: boolean) => api.put('/evaluations/report/promote', { ...k, promote }).then(() => undefined),
  exportReport: (dateRate: string) => api.get<Blob>('/evaluations/report/export', { params: { dateRate }, responseType: 'blob' }).then((r) => r.data),
}
