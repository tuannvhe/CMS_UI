import { api } from './client'

/** Giá trị phòng ban / bộ phận trong hồ sơ nhân viên nhưng ngoài danh mục chuẩn. value rỗng = nhân viên chưa có giá trị. */
export interface NonStandardValue { value: string; total: number; active: number; suggestion: string | null }
export interface CleanupScan { departments: NonStandardValue[]; parts: NonStandardValue[]; standardDepartments: string[]; standardParts: string[] }
export type CleanupKind = 'department' | 'part'

export const dataCleanup = {
  scan: () => api.get<CleanupScan>('/admin/data-cleanup', { timeout: 120000 }).then((r) => r.data),
  apply: (kind: CleanupKind, from: string, to: string) => api.post<{ employees: number }>('/admin/data-cleanup/apply', { kind, from, to }, { timeout: 120000 }).then((r) => r.data),
}
