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

