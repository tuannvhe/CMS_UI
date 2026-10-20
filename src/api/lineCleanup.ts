import { api } from './client'

export type CleanupBucket = 'live' | 'department' | 'emptied' | 'never'
export interface CleanupLine { id: number; round: number; userId: string; fullName: string | null; personActive: boolean | null }
export interface CleanupGroup { name: string; bucket: CleanupBucket; activeEmployees: number; registered: boolean; suggestedDepartment: string | null; suggestedUnit: string | null; lines: CleanupLine[] }
export interface UncoveredUnit { part: string; department: string; employees: number; registered: boolean; sources: { part: string; lines: number }[] }
export interface LineCleanupReport {
  totalLines: number; totalNames: number; orgReady: boolean
  groups: CleanupGroup[]; uncovered: UncoveredUnit[]; blankPart: { department: string; employees: number }[]
}
export interface CleanupResult { done: number; skipped: number }

const base = '/lines/evaluators/cleanup'

export const lineCleanup = {
  report: () => api.get<LineCleanupReport>(base, { timeout: 120000 }).then((r) => r.data),
  remove: (ids: number[]) => api.post<CleanupResult>(`${base}/delete`, { ids }).then((r) => r.data),
  restore: (rows: { department: string; round: number; userId: string }[]) => api.post<{ done: number; duplicate: number; invalid: number }>(`${base}/restore`, { rows }).then((r) => r.data),
  copy: (from: string, to: string) => api.post<CleanupResult>(`${base}/copy`, { from, to }).then((r) => r.data),
}
