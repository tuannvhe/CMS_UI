import { api } from './client'

export interface EvaluationItem {
  id: string; employeeId: string; fullName: string; position: string; startWork: string | null
  department: string; typeRate: string; dateRate: string | null; round: number
}

export interface EvaluationRound { no: number; evaluatorId: string; evaluatorName: string; confirmed: boolean }
export interface ScoreRow { titleId: number; name: string; maxPoint: number | null; scores: (number | null)[] }
export interface LabelValue { label: string; value: string }
export interface EvaluationDetail {
  employeeId: string; fullName: string; position: string; department: string; startWork: string | null; dateRate: string; typeRate: string
  rounds: EvaluationRound[]; scores: ScoreRow[]; attendance: LabelValue[]; comments: LabelValue[]
  other: Record<string, string>; myRound: number | null; canEdit: boolean
}

export interface EvaluationSubmission {
  employeeId: string; dateRate: string; marks: Record<string, number | null>; other: Record<string, string>; confirm: boolean
}

export interface EvaluationDoneItem {
  id: string; employeeId: string; fullName: string; position: string; startWork: string | null; department: string; typeRate: string
  dateRate: string | null; round: number; confirmedAt: string | null; myTotal: number | null; roundsDone: number; roundsTotal: number
}

export interface EvaluationCandidate {
  employeeId: string; fullName: string; department: string; position: string; startWork: string | null; typeRate: string; dateRate: string; daysLeft: number | null
}
export interface LineRound { round: number; userId: string; fullName?: string | null }
export interface AuditRound { id: number; round: number; userId: string; fullName: string | null; active: boolean | null; confirmed: boolean; markCount: number | null }
export interface EvaluationSet {
  employeeId: string; fullName: string; position: string; department: string; startWork: string | null; typeRate: string; dateRate: string
  rounds: AuditRound[]; issues: string[]
}
export interface ReviewRow {
  employeeId: string; fullName: string; position: string; department: string; typeRate: string; dateRate: string
  line: { round: number; userId: string; fullName: string | null; active: boolean | null }[]; issues: string[]; customized: boolean; dateChanged: boolean
}
/** Lỗi chặn đăng ký (phải sửa line); các mã còn lại chỉ là cảnh báo. */
export const BLOCKING_ISSUES = ['no_line', 'duplicate_person', 'missing_self', 'line', 'line_user', 'line_off_unit', 'line_duplicate', 'line_self', 'date_exists', 'date_invalid', 'already_registered', 'inactive', 'no_start_work']

export interface RegisterResult { created: number; rounds: number; skipped: { employeeId: string; reason: string }[] }
export interface ManualLookup {
  employee: { employeeId: string; fullName: string; department: string; position: string; startWork: string | null; active: boolean; statusWorking: string | null }
  suggestedType: string; existing: { employeeId: string; typeRate: string; dateRate: string }[]
}
export const EVALUATION_TYPES = ['Evaluation of probation contract', 'Evaluation of 1 year contract 2nd time', 'Evaluation of signing an indefinite contract']

export const evaluations = {
  review: (items: { employeeId: string; dateRate: string; line?: LineRound[]; newDateRate?: string }[]) => api.post<ReviewRow[]>('/evaluations/register/review', { items }).then((r) => r.data),
  audit: (p: { from?: string; department?: string; search?: string }) => api.get<EvaluationSet[]>('/evaluations/audit', { params: p }).then((r) => r.data),
  auditSet: (employeeId: string, dateRate: string, typeRate: string) =>
    api.get<EvaluationSet>('/evaluations/audit/set', { params: { employeeId, dateRate, typeRate } }).then((r) => r.data),
  deleteBatch: (items: { employeeId: string; dateRate: string; typeRate: string }[]) =>
    api.post<{ deleted: number; skipped: { employeeId: string; reason: string }[] }>('/evaluations/audit/delete-batch', { items }).then((r) => r.data),
  deleteSet: (employeeId: string, dateRate: string, typeRate: string, force: boolean) =>
    api.delete<{ rounds: number; scoreRows: number }>('/evaluations/audit/set', { params: { employeeId, dateRate, typeRate, force } }).then((r) => r.data),
  fixLine: (body: { employeeId: string; dateRate: string; typeRate: string; line: LineRound[]; newDateRate?: string }) => api.put('/evaluations/audit/line', body).then(() => undefined),
  parts: () => api.get<string[]>('/evaluations/register/parts').then((r) => r.data),
  candidates: (p: { department?: string; employeeId?: string; dateRate?: string; overdue?: boolean }) =>
    api.get<EvaluationCandidate[]>('/evaluations/register/candidates', { params: p }).then((r) => r.data),
  defaultLine: (employeeId: string, dateRate: string) =>
    api.get<LineRound[]>('/evaluations/register/line', { params: { employeeId, dateRate } }).then((r) => r.data),
  register: (items: { employeeId: string; dateRate: string; line?: LineRound[]; newDateRate?: string }[]) => api.post<RegisterResult>('/evaluations/register', { items }).then((r) => r.data),
  manualLookup: (employeeId: string) => api.get<ManualLookup>('/evaluations/register/manual/lookup', { params: { employeeId } }).then((r) => r.data),
  manualReview: (b: { employeeId: string; typeRate: string; dateRate: string; line?: LineRound[] }) => api.post<ReviewRow>('/evaluations/register/manual/review', b).then((r) => r.data),
  manualRegister: (b: { employeeId: string; typeRate: string; dateRate: string; line?: LineRound[] }) => api.post<RegisterResult>('/evaluations/register/manual', b).then((r) => r.data),
  done: (from: string, to: string) => api.get<EvaluationDoneItem[]>('/evaluations/done', { params: { from, to } }).then((r) => r.data),
  submit: (body: EvaluationSubmission) => api.post('/evaluations/submit', body).then(() => undefined),
  detail: (employeeId: string, dateRate: string) =>
    api.get<EvaluationDetail>('/evaluations/detail', { params: { employeeId, dateRate } }).then((r) => r.data),
  mine: () => api.get<EvaluationItem[]>('/evaluations/mine').then((r) => r.data),
}
