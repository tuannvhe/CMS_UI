import { api } from './client'

/** Bộ phận (DEPARTMENTNAME) gồm nhiều phòng ban (PARTCODE); mỗi phòng ban có line duyệt và line đánh giá riêng. */
export type UnitStatus = 'ok' | 'no_line' | 'gap' | 'invalid'
export interface UnitNode {
  id: number; name: string; active: boolean; employees: number; uncovered: number; approverLines: number
  rounds: number[]; evaluators: number; invalidEvaluators: number; status: UnitStatus; selfEval?: boolean
}
export interface DepartmentNode { id: number; code: string; name: string; active: boolean; employees: number; approverLines: number; units: UnitNode[]; unassigned: number }
export interface OrphanUnit { name: string; kind: 'unit' | 'part' | 'mismatch'; unitId: number | null; currentDepartment: string | null; employees: number; suggestedDepartment: string | null; breakdown: { department: string; employees: number }[] }
export interface OrgOverview { ready: boolean; departments: DepartmentNode[]; unitsTotal: number; unitsWithoutApprover: number; unitsWithoutEvaluator: number; employeesWithoutUnit: number; orphans: OrphanUnit[] }

const base = '/admin/org'

export const org = {
  overview: () => api.get<OrgOverview>(base, { timeout: 120000 }).then((r) => r.data),
  addUnit: (b: { name: string; department: string }) => api.post(`${base}/units`, b).then(() => undefined),
  assignUnit: (b: { name: string; department: string }) => api.post<{ employees: number }>(`${base}/units/assign`, b).then((r) => r.data),
  deactivateEmployee: (employeeId: string) => api.post(`${base}/employees/${encodeURIComponent(employeeId)}/deactivate`).then(() => undefined),
  removeFromUnit: (employeeId: string) => api.post(`${base}/employees/${encodeURIComponent(employeeId)}/remove-from-unit`).then(() => undefined),
  setSelfEval: (id: number, on: boolean) => api.post(`${base}/units/${id}/self-eval`, { on }).then(() => undefined),
  toggleUnit: (id: number) => api.post<{ active: boolean }>(`${base}/units/${id}/toggle`).then((r) => r.data),
}

