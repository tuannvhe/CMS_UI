import { api } from './client'

export interface LineOption { value: string; label: string }
export interface DepartmentOption { code: string; name: string }
export interface UnitOption { name: string; department: string }
export interface LineLookups { departments: DepartmentOption[]; units: UnitOption[]; people: LineOption[]; levels: LineOption[]; parts: string[] }

export interface ApproverLineRow {
  id: number; department: string; userId: string; fullName: string; email: string | null; level: number; levelName: string
  active: boolean; createdAt: string | null; createdBy: string | null
}
export interface EvaluatorLineRow { id: number; department: string; round: number; userId: string; fullName: string | null }
export interface EvaluatorProblem { line: EvaluatorLineRow; issues: ('unknown_unit' | 'inactive_person' | 'unknown_person')[]; suggestedUnit: string | null }

/** Mã vị trí của màn cũ → vòng đánh giá. */
export const POSITION_CODES = ['TC', 'TL', 'GL', 'SL', 'HL'] as const
export type PositionCode = (typeof POSITION_CODES)[number]

export const lines = {
  lookups: () => api.get<LineLookups>('/lines/lookups').then((r) => r.data),
  approvers: (p: { department?: string; search?: string }) => api.get<ApproverLineRow[]>('/lines/approvers', { params: p }).then((r) => r.data),
  addApprover: (body: { department: string; userId: string; level: string }) => api.post('/lines/approvers', body).then(() => undefined),
  toggleApprover: (id: number) => api.post(`/lines/approvers/${id}/toggle`).then(() => undefined),
  deleteApprover: (id: number) => api.delete(`/lines/approvers/${id}`).then(() => undefined),
  evaluators: (p: { department?: string; userId?: string }) => api.get<EvaluatorLineRow[]>('/lines/evaluators', { params: p }).then((r) => r.data),
  addEvaluator: (body: { department: string; userId: string; position: PositionCode }) => api.post('/lines/evaluators', body).then(() => undefined),
  updateEvaluator: (id: number, userId: string) => api.put(`/lines/evaluators/${id}`, { userId }).then(() => undefined),
  evaluatorProblems: () => api.get<EvaluatorProblem[]>('/lines/evaluators/problems').then((r) => r.data),
  moveEvaluator: (id: number, department: string) => api.post(`/lines/evaluators/${id}/move`, { department }).then(() => undefined),
  deleteEvaluator: (id: number) => api.delete(`/lines/evaluators/${id}`).then(() => undefined),
}

// ---------------- Đối soát line đánh giá ----------------
/** Bộ phận = DEPARTMENTNAME, phòng ban = PARTCODE (đơn vị có line đánh giá). */
export interface PartCoverage { part: string; employees: number; uncovered: number; rounds: number[]; evaluators: number; invalidEvaluators: number; status: 'ok' | 'no_line' | 'blank' | 'gap' | 'invalid' }
export interface DepartmentCoverage { department: string; employees: number; uncovered: number; parts: PartCoverage[] }
export interface CoverageSummary { departments: number; parts: number; employees: number; uncovered: number; partsWithoutLine: number; items: DepartmentCoverage[] }
export interface CoverageEmployee { employeeId: string; fullName: string; position: string; department: string; part: string; level: number | null; evaluators: number }

export const coverage = {
  summary: () => api.get<CoverageSummary>('/lines/coverage', { timeout: 120000 }).then((r) => r.data),
  employees: (department: string, part: string) => api.get<CoverageEmployee[]>('/lines/coverage/employees', { params: { department, part } }).then((r) => r.data),
}
