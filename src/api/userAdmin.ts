import { api } from './client'

export interface AdminUser {
  id: number; userId: string; employeeId: string; fullName: string; department: string | null; email: string
  groupId: string; groupName: string | null; factoryCode: string; active: boolean; createdAt: string | null; passwordChangedAt: string | null
}
export interface AdminUserPage { total: number; page: number; pageSize: number; rows: AdminUser[] }
export interface UserStats { total: number; active: number; locked: number; approvers: number }
export interface AdminGroup { groupId: string; name: string; nameVi: string; nameKo: string; active: boolean }
export interface EmployeeBrief { employeeId: string; fullName: string; department: string | null; email: string | null; factoryCode: string | null; active: boolean }
export interface NewUser { userId: string; employeeId: string; password: string; email?: string; groupId: string; factoryCode?: string }
export interface UpdateUser { groupId: string; email?: string; factoryCode?: string }

const base = '/admin/users'

export const userAdmin = {
  list: (search: string, groupId: string | undefined, status: string, page: number, pageSize: number) =>
    api.get<AdminUserPage>(base, { params: { search: search || undefined, groupId: groupId || undefined, status, page, pageSize } }).then((r) => r.data),
  stats: () => api.get<UserStats>(`${base}/stats`).then((r) => r.data),
  groups: () => api.get<AdminGroup[]>(`${base}/groups`).then((r) => r.data),
  factories: () => api.get<string[]>(`${base}/factories`).then((r) => r.data),
  employee: (id: string) => api.get<EmployeeBrief>(`${base}/employee/${encodeURIComponent(id)}`).then((r) => r.data),
  create: (b: NewUser) => api.post(base, b).then(() => undefined),
  update: (id: number, b: UpdateUser) => api.put(`${base}/${id}`, b).then(() => undefined),
  toggle: (id: number) => api.post<{ active: boolean }>(`${base}/${id}/toggle`).then((r) => r.data),
  password: (id: number, password: string) => api.post(`${base}/${id}/password`, { password }).then(() => undefined),
  remove: (id: number) => api.delete(`${base}/${id}`).then(() => undefined),
}

/** Nhập nhân viên từ Excel. */
export interface EmployeeInput {
  excelRow: number; department: string; employeeId: string; fullName: string; position: string; birthday: string | null; identityCard: string; phone: string; email: string
  startWork: string | null; endWork: string | null; statusWorking: string; active: boolean; pictures: string; partCode: string; dateRate: string | null; bankId: string; sex: boolean | null; factoryCode: string
}
export interface EmployeeIssue { excelRow: number; code: string; detail: string | null }
export interface EmployeeImportPreview {
  token: string; fileName: string; totalRows: number; new: number; updated: number; active: number; inactive: number
  errors: EmployeeIssue[]; warnings: EmployeeIssue[]; ignoredRows: number; sample: EmployeeInput[]
  departments: NameUsage[]; parts: NameUsage[]
  moves: number; moveSample: EmployeeMove[]; newNamesToConfirm: string[]; accountsToCreate: number; accountSkipped: string[]
}
export interface ImportOptions { departments: string[]; parts: string[]; groups: { groupId: string; name: string }[]; defaultGroupId: string | null }
export interface CommitOptions { mappings: Record<string, string>; createAccounts: boolean; groupId?: string }
export interface EmployeeMove { employeeId: string; fullName: string; fromDepartment: string; toDepartment: string; fromPart: string; toPart: string }
export interface NameUsage { name: string; count: number; isNew: boolean; hasLine: boolean; suggestion: string | null; normalized: number }
export interface EmployeeImportResult { inserted: number; updated: number; accountsCreated: number; accountsSkipped: number }

const imp = '/admin/employee-import'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const employeeImport = {
  preview: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<EmployeeImportPreview>(`${imp}/preview`, fd, { timeout: 180000 }).then((r) => r.data)
  },
  commit: (token: string, o: CommitOptions) => api.post<EmployeeImportResult>(`${imp}/commit`, { token, ...o }, { timeout: 180000 }).then((r) => r.data),
  options: () => api.get<ImportOptions>(`${imp}/options`).then((r) => r.data),
  template: async () => saveBlob(await api.get<Blob>(`${imp}/template`, { responseType: 'blob' }), 'MauNhapNhanVien.xlsx'),
}

/** Mã lỗi (title của ProblemDetails) và chi tiết. */
export function adminError(e: unknown): { code: string; detail: string } {
  const d = (e as { response?: { data?: { title?: string; detail?: string } } }).response?.data
  return { code: d?.title ?? '', detail: d?.detail ?? '' }
}
