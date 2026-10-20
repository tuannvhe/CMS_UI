import { api } from './client'

/** Bộ phận (DEPARTMENTNAME) gồm nhiều phòng ban (PARTCODE); mỗi phòng ban có line duyệt và line đánh giá riêng. */
export type UnitStatus = 'ok' | 'no_line' | 'gap' | 'invalid'
export interface UnitNode {
  id: number; name: string; active: boolean; employees: number; uncovered: number; approverLines: number
  rounds: number[]; evaluators: number; invalidEvaluators: number; status: UnitStatus
}
export interface DepartmentNode { id: number; code: string; name: string; active: boolean; employees: number; approverLines: number; units: UnitNode[]; unassigned: number }
export interface OrphanUnit { name: string; kind: 'unit' | 'part' | 'mismatch'; unitId: number | null; currentDepartment: string | null; employees: number; suggestedDepartment: string | null; breakdown: { department: string; employees: number }[] }
export interface OrgOverview { ready: boolean; departments: DepartmentNode[]; unitsTotal: number; unitsWithoutApprover: number; unitsWithoutEvaluator: number; employeesWithoutUnit: number; orphans: OrphanUnit[] }

const base = '/admin/org'

export const org = {
  overview: () => api.get<OrgOverview>(base, { timeout: 120000 }).then((r) => r.data),
  addUnit: (b: { name: string; department: string }) => api.post(`${base}/units`, b).then(() => undefined),
  assignUnit: (b: { name: string; department: string }) => api.post<{ employees: number }>(`${base}/units/assign`, b).then((r) => r.data),
  toggleUnit: (id: number) => api.post<{ active: boolean }>(`${base}/units/${id}/toggle`).then((r) => r.data),
}

/** Script tạo bảng phòng ban (chạy một lần trên CMS_VINA). */
export const ORG_TABLE_SQL = `CREATE TABLE dbo.Tbl_OrgUnits (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UNITNAME     nvarchar(100) NOT NULL,   -- phòng ban (PARTCODE)
    DEPARTMENT   nvarchar(50)  NOT NULL,   -- bộ phận cha = Tbl_Departments.DEPARTMENT_ENGLISH
    STATUSACTIVE bit NOT NULL CONSTRAINT DF_Tbl_OrgUnits_Active DEFAULT 1,
    CREATEBY     nvarchar(50) NULL,
    CREATEDATE   datetime NULL
);
CREATE UNIQUE INDEX UX_Tbl_OrgUnits_UNITNAME ON dbo.Tbl_OrgUnits (UNITNAME);
CREATE INDEX IX_Tbl_OrgUnits_DEPARTMENT ON dbo.Tbl_OrgUnits (DEPARTMENT);`
