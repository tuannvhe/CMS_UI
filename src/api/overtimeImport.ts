import { api } from './client'
import type { ApproversInput } from './requests'

export interface OvertimePreviewRow {
  excelRow: number; employeeId: string; fullName: string; part: string; cellLine: string; process: string
  timeFrom: string | null; timeTo: string | null; reason: string | null; known: boolean; issue: string | null
}
export interface OvertimeIssue { excelRow: number; code: string; detail: string | null }
export interface OvertimeImportPreview {
  token: string; fileName: string; totalRows: number; titleDate: string | null; unknown: number; missingTime: number; missingReason: number
  rows: OvertimePreviewRow[]; errors: OvertimeIssue[]; warnings: OvertimeIssue[]
}
export interface OvertimeImportCommit {
  token: string; date: string; shift: string; defaultFrom?: string; defaultTo?: string; defaultReason?: string; approvers: ApproversInput
}
export interface OvertimeImportResult {
  created: number; groups: number
  skipped: { employeeId: string; reason: string; detail?: string | null }[]
  warnings: { employeeId: string; reason: string; detail?: string | null }[]
}

export const overtimeImport = {
  preview: (file: File) => {
    const f = new FormData()
    f.append('file', file)
    return api.post<OvertimeImportPreview>('/requests/overtime/import/preview', f, { timeout: 120000 }).then((r) => r.data)
  },
  commit: (b: OvertimeImportCommit) => api.post<OvertimeImportResult>('/requests/overtime/import/commit', b, { timeout: 180000 }).then((r) => r.data),
  template: async (night: boolean) => {
    const r = await api.get<Blob>('/requests/overtime/import/template', { params: { night }, responseType: 'blob' })
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url; a.download = night ? 'MauTangCaDem.xlsx' : 'MauTangCaNgay.xlsx'
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}
