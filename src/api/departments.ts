import { api } from './client'

/** Phòng ban chuẩn của hệ thống (Tbl_Departments). employees = số nhân viên đang dùng đúng tên tiếng Anh. */
export interface DepartmentInfo { id: number; code: string; english: string; vietnamese: string; korean: string; active: boolean; employees: number; approverLines: number }
export interface NewDepartment { english: string; vietnamese?: string; korean?: string }

const base = '/admin/departments'

export const departmentsApi = {
  list: () => api.get<DepartmentInfo[]>(base).then((r) => r.data),
  add: (b: NewDepartment) => api.post<DepartmentInfo>(base, b).then((r) => r.data),
  toggle: (id: number) => api.post<{ active: boolean }>(`${base}/${id}/toggle`).then((r) => r.data),
}
