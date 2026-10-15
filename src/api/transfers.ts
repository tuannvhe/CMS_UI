import { api } from './client'

export type TransferStatus = 'done' | 'scheduled' | 'cancelled'
export interface TransferRow {
  id: number; employeeId: string; employeeName: string; fromDepartment: string | null; fromPart: string | null; toDepartment: string; toPart: string
  effectiveDate: string; status: TransferStatus; source: 'manual' | 'import' | 'org' | 'cleanup'; reason: string | null; createdBy: string | null; createdAt: string | null; appliedAt: string | null
}
export interface EmployeeBrief { employeeId: string; fullName: string; department: string; part: string; position: string; active: boolean }
export interface TransferList { ready: boolean; items: TransferRow[] }
export interface TransferInput { employeeId: string; toDepartment: string; toPart: string; effectiveDate: string; reason?: string }

export const transfers = {
  list: (p: { employeeId?: string; status?: string }) => api.get<TransferList>('/admin/transfers', { params: p }).then((r) => r.data),
  employees: (search: string) => api.get<EmployeeBrief[]>('/admin/transfers/employees', { params: { search } }).then((r) => r.data),
  create: (b: TransferInput) => api.post<{ applied: boolean }>('/admin/transfers', b).then((r) => r.data),
  cancel: (id: number) => api.post(`/admin/transfers/${id}/cancel`).then(() => undefined),
}

/** Script tạo bảng lịch sử điều chuyển (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const TRANSFER_TABLE_SQL = `CREATE TABLE dbo.Tbl_EmployeeTransfers (
    ID             int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EMPLOYEEID     nvarchar(50)  NOT NULL,
    FROMDEPARTMENT nvarchar(100) NULL,
    FROMPART       nvarchar(100) NULL,
    TODEPARTMENT   nvarchar(100) NOT NULL,
    TOPART         nvarchar(100) NOT NULL,
    EFFECTIVEDATE  date          NOT NULL,
    STATUS         nvarchar(12)  NOT NULL,   -- done | scheduled | cancelled
    SOURCE         nvarchar(12)  NOT NULL,   -- manual | import | org | cleanup
    REASON         nvarchar(300) NULL,
    CREATEBY       nvarchar(50)  NULL,
    CREATEDATE     datetime      NULL,
    APPLIEDDATE    datetime      NULL
);
CREATE INDEX IX_Tbl_EmployeeTransfers_EMP ON dbo.Tbl_EmployeeTransfers (EMPLOYEEID, EFFECTIVEDATE);
CREATE INDEX IX_Tbl_EmployeeTransfers_STATUS ON dbo.Tbl_EmployeeTransfers (STATUS, EFFECTIVEDATE);`
