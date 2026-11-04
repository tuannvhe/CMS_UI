import { api } from './client'

export type OrgKind = 'DEPT' | 'TEAM' | 'PART'
export interface OrgNode { nodeId: number; kind: OrgKind; name: string; parentId: number | null; isActive: boolean; employees: number }
export interface OrgEmployee {
  employeeId: string; fullName: string; position: string; isOp: boolean
  deptId: number | null; dept: string | null; teamId: number | null; team: string | null; partId: number | null; part: string | null
  isActive: boolean; source: 'EXCEL' | 'ERP'; erpEmpSeq: number | null; updatedAt: string
}
export interface OrgEmployeePage { total: number; page: number; pageSize: number; rows: OrgEmployee[] }
export interface OrgHrStats { total: number; active: number; left: number; op: number; noTeam: number; fromErp: number; fromExcel: number; lastSync: string | null }
export interface OrgLog { at: string; action: string; employeeId: string; detail: string }
export interface OrgErpPreview { configured: boolean; erpEmployees: number; newCount: number; resignCount: number; newSample: string[]; resignSample: string[] }
export interface OrgErpSyncResult { new: number; resigned: number; newNodes: number }
export interface OrgEmployeeQuery { search?: string; deptId?: number; teamId?: number; partId?: number; status: string; source?: string; page: number; pageSize: number }

const base = '/admin/org-model'

export const orgModel = {
  status: () => api.get<{ ready: boolean }>(`${base}/status`).then((r) => r.data),
  nodes: () => api.get<OrgNode[]>(`${base}/nodes`).then((r) => r.data),
  addNode: (b: { kind: OrgKind; name: string; parentId: number | null }) => api.post<{ nodeId: number }>(`${base}/nodes`, b).then((r) => r.data),
  updateNode: (id: number, b: { name: string; isActive: boolean }) => api.put(`${base}/nodes/${id}`, b),
  employees: (q: OrgEmployeeQuery) => api.get<OrgEmployeePage>(`${base}/employees`, { params: { ...q, search: q.search || undefined, source: q.source || undefined }, timeout: 60000 }).then((r) => r.data),
  stats: () => api.get<OrgHrStats>(`${base}/stats`).then((r) => r.data),
  log: (take = 100) => api.get<OrgLog[]>(`${base}/log`, { params: { take } }).then((r) => r.data),
  setPlacement: (id: string, b: { teamId: number | null; partId: number | null; isOp: boolean; position: string | null }) => api.put(`${base}/employees/${encodeURIComponent(id)}/placement`, b),
  setActive: (id: string, active: boolean) => api.put<{ active: boolean }>(`${base}/employees/${encodeURIComponent(id)}/active`, { active }).then((r) => r.data),
  erpPreview: () => api.get<OrgErpPreview>(`${base}/erp/preview`, { timeout: 120000 }).then((r) => r.data),
  erpSync: () => api.post<OrgErpSyncResult>(`${base}/erp/sync`, null, { timeout: 300000 }).then((r) => r.data),
}

export interface OrgLine { lineId: number; nodeId: number; kind: 'APPROVAL' | 'EVALUATION'; level: number; employeeId: string; fullName: string | null; position: string | null; personActive: boolean; isActive: boolean; createdAt: string; createdBy: string | null }
const lb = `${base}/lines`
export const orgLines = {
  counts: () => api.get<{ ready: boolean; counts: Record<string, number> }>(`${lb}/counts`).then((r) => r.data),
  list: (nodeId: number) => api.get<OrgLine[]>(`${lb}/${nodeId}`).then((r) => r.data),
  add: (nodeId: number, b: { kind: 'APPROVAL' | 'EVALUATION'; level: number; employeeId: string }) => api.post<{ lineId: number }>(`${lb}/${nodeId}`, b).then((r) => r.data),
  setActive: (lineId: number, active: boolean) => api.put(`${lb}/item/${lineId}/active`, { active }),
  remove: (lineId: number) => api.delete(`${lb}/item/${lineId}`),
  readiness: () => api.get<OrgReadiness>(`${lb}/readiness`, { timeout: 120000 }).then((r) => r.data),
  importOld: () => api.post<{ added: number; skipped: number }>(`${lb}/import-old`, null, { timeout: 300000 }).then((r) => r.data),
}

export interface OrgReadiness {
  ready: boolean; counts: { activeNoTeam: number; cmsActiveNotInOrg: number; orgActiveNotInCms: number; linesOnLeft: number }
  activeNodesWithPeople: number; nodesNoApproval: number; nodesNoEvaluation: number; noApprovalSample: string[]; noEvaluationSample: string[]
  oldApproval: number; oldEvaluation: number; toAdd: number; alreadyThere: number; unmappedLines: number; unknownPerson: number; badLevel: number; unmappedDepartments: string[]
}

const eb = `${base}/eval-job`
export interface OrgEvalJobStatus { ready: boolean; settings: { enabled: boolean; lastRun: string | null; lastCreated: number; lastHeld: number; lastHeldByReason: Record<string, number> | null } }
export interface OrgEvalRunResult { ran: boolean; candidates: number; created: number; held: number; heldByReason: Record<string, number> }
export const orgEvalJob = {
  status: () => api.get<OrgEvalJobStatus>(eb).then((r) => r.data),
  save: (enabled: boolean) => api.put<OrgEvalJobStatus>(eb, { enabled }).then((r) => r.data),
  run: () => api.post<OrgEvalRunResult>(`${eb}/run`, null, { timeout: 300000 }).then((r) => r.data),
}

export interface OrgAlignRow { employeeId: string; fullName: string; oldDept: string; newDept: string }
export interface OrgAlignPreview { ready: boolean; compared: number; differ: number; mappings: { oldDept: string; newDept: string; count: number }[]; sample: OrgAlignRow[] }
export interface OrgAlignStatus { ready: boolean; settings: { enabled: boolean; lastRun: string | null; lastChanged: number; lastBatch: string | null } }
const ab = `${base}/dept-align`
export const orgDeptAlign = {
  status: () => api.get<OrgAlignStatus>(ab).then((r) => r.data),
  save: (enabled: boolean) => api.put<OrgAlignStatus>(ab, { enabled }).then((r) => r.data),
  preview: () => api.get<OrgAlignPreview>(`${ab}/preview`, { timeout: 120000 }).then((r) => r.data),
  apply: () => api.post<{ ran: boolean; batch: string | null; changed: number }>(`${ab}/apply`, null, { timeout: 300000 }).then((r) => r.data),
  undo: () => api.post<{ restored: number }>(`${ab}/undo`, null, { timeout: 300000 }).then((r) => r.data),
}

export const orgSwitch = {
  get: () => api.get<{ useErp: boolean }>(`${base}/switch`).then((r) => r.data),
  save: (useErp: boolean) => api.put<{ useErp: boolean }>(`${base}/switch`, { useErp }).then((r) => r.data),
}
