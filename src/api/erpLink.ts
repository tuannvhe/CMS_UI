import { api } from './client'

/** Phòng ban ERP (CHỈ ĐỌC từ VINATECVN). */
export interface ErpDept { deptSeq: number; name: string; engName: string; uppDeptSeq: number; uppName: string; bossNames: string[] }
export interface ErpEmployee { empSeq: number; empId: string; name: string; deptSeq: number; deptName: string; uppDeptName: string; retired: boolean; userId: string | null; userName: string | null }
export type ErpVia = 'none' | 'auto' | 'manual'
export interface DeptLinkRow { cmsId: number; cmsName: string; vietnamese: string; cmsEmployees: number; erp: ErpDept | null; via: ErpVia }
export interface DeptLinkOverview { rows: DeptLinkRow[]; unmatchedErp: ErpDept[] }
export interface CmsEmployee { employeeId: string; fullName: string; department: string; partCode: string }
export interface EmpLinkRow { cms: CmsEmployee; erp: ErpEmployee | null; via: ErpVia; deptMatches: boolean }
export interface EmpLinkPage { total: number; page: number; pageSize: number; rows: EmpLinkRow[] }

export interface PartLinkRow { unit: string; department: string; erp: ErpDept | null }
export interface PartLinkOverview { rows: PartLinkRow[]; erpDepartments: ErpDept[] }
export interface EmpMove { employeeId: string; fullName: string; fromDepartment: string; fromPart: string; toDepartment: string; toPart: string }
export interface SyncPreview { moves: EmpMove[]; skipped: Record<string, number> }

export interface OrgImportInfo { count: number; at: string | null; by: string | null }
export interface ValueUsage { column: string; value: string; employees: number; inDepartments: boolean; inUnits: boolean; usedAsDepartment: boolean; usedAsPart: boolean }
export interface ColumnSummary { column: string; distinct: number; asDepartment: number; asUnit: number; missing: number }
export interface OrgPair { employeeId: string; fullName: string; active: boolean; cmsDepartment: string; cmsPart: string; department: string; team: string; part: string }
export interface OrgCompare {
  import: OrgImportInfo; excelEmployees: number; matchedActive: number; matchedInactive: number; excelNotInCms: number; cmsActiveNotInExcel: number
  cmsActiveNotInExcelSample: CmsEmployee[]; columns: ColumnSummary[]; values: ValueUsage[]; agree: Record<string, number>; pairs: OrgPair[]
}

export interface OrgDeactivation { employeeId: string; fullName: string; department: string; partCode: string }
export interface OrgSyncPreview { moves: EmpMove[]; deactivations: OrgDeactivation[]; skipped: Record<string, number> }

export const erpLink = {
  status: () => api.get<{ configured: boolean }>('/admin/erp/status').then((r) => r.data),
  departments: () => api.get<DeptLinkOverview>('/admin/erp/departments', { timeout: 60000 }).then((r) => r.data),
  employees: (search: string, page: number, pageSize: number) =>
    api.get<EmpLinkPage>('/admin/erp/employees', { params: { search: search || undefined, page, pageSize }, timeout: 60000 }).then((r) => r.data),
  link: (kind: 'DEPT' | 'EMP' | 'PART', cmsKey: string, erpSeq: number) => api.put('/admin/erp/links', { kind, cmsKey, erpSeq }),
  unlink: (kind: 'DEPT' | 'EMP' | 'PART', cmsKey: string) => api.delete('/admin/erp/links', { params: { kind, cmsKey } }),
  unlinked: () => api.get<CmsEmployee[]>('/admin/erp/employees/unlinked', { timeout: 120000 }).then((r) => r.data),
  parts: () => api.get<PartLinkOverview>('/admin/erp/parts', { timeout: 60000 }).then((r) => r.data),
  syncPreview: () => api.get<SyncPreview>('/admin/erp/sync/preview', { timeout: 120000 }).then((r) => r.data),
  orgCompare: () => api.get<OrgCompare>('/admin/erp/org/compare', { timeout: 120000 }).then((r) => r.data),
  orgImport: (file: File) => {
    const f = new FormData(); f.append('file', file)
    return api.post<{ imported: number; warnings: string[] }>('/admin/erp/org/import', f, { timeout: 120000 }).then((r) => r.data)
  },
  orgAccountJob: () => api.get<OrgAccountStatus>('/admin/erp/org/account-job').then((r) => r.data),
  saveOrgAccountJob: (b: { enabled: boolean; groupId: string | null; syncEmployees: boolean; positionGroups: Record<string, string>; hrGroupId?: string | null }) => api.put<OrgAccountStatus>('/admin/erp/org/account-job', b).then((r) => r.data),
  runOrgAccountJob: () => api.post<{ employeesAdded: number; accountsCreated: number; failed: number; erpNew: number; erpResigned: number }>('/admin/erp/org/account-job/run', null, { timeout: 300000 }).then((r) => r.data),
  orgSyncPreview: () => api.get<OrgSyncPreview>('/admin/erp/org/sync/preview', { timeout: 120000 }).then((r) => r.data),
}

export interface OrgAccountStatus { settings: { enabled: boolean; groupId: string | null; syncEmployees: boolean; positionGroups: Record<string, string> | null; hrGroupId?: string | null }; positions: { position: string; employees: number }[]; pending: number; sample: string[]; lastRun: string | null; lastCreated: number; lastFailed: number }
