import { api } from './client'
import type { RowIssue } from './closedAttendance'

export interface PayslipItem { key: string; group: string; kind: 'money' | 'number' | 'text'; raw: string; amount: number | null }
export interface Payslip { period: string; employeeId: string; fullName: string; department: string; title: string; items: PayslipItem[]; importedAt: string | null }
export interface PayslipPeriod { period: string; rows: number; lastImported: string | null }
export interface PayslipPeriodPreview { period: string; rows: number; new: number; updated: number; totalNetPay: number }
export interface PayslipSample { excelRow: number; employeeId: string; fullName: string; department: string; period: string; netPay: number | null }
export interface PayslipPreview {
  token: string; fileName: string; totalRows: number; periods: PayslipPeriodPreview[]; unknownEmployees: number
  errors: RowIssue[]; warnings: RowIssue[]; ignoredRows: number; sample: PayslipSample[]
}
export interface PayslipImportResult { inserted: number; updated: number; periods: string[] }

/** Thứ tự các nhóm trên phiếu lương. */
export const PAYSLIP_GROUPS = ['days', 'salary', 'overtime', 'allowance', 'total', 'deduction', 'note'] as const

const base = '/admin/payslip'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export interface PayslipExplainLine { key: string; args: Record<string, number> }

export const payslip = {
  periods: () => api.get<PayslipPeriod[]>('/payslip/periods').then((r) => r.data),
  explain: (period: string) => api.get<{ lines: PayslipExplainLine[] }>('/payslip/explain', { params: { period } }).then((r) => r.data.lines),
  mine: (period: string) => api.get<Payslip>('/payslip', { params: { period } }).then((r) => r.data),
  preview: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<PayslipPreview>(`${base}/preview`, fd, { timeout: 180000 }).then((r) => r.data)
  },
  commit: (token: string) => api.post<PayslipImportResult>(`${base}/commit`, { token }, { timeout: 180000 }).then((r) => r.data),
  adminPeriods: () => api.get<PayslipPeriod[]>(`${base}/periods`).then((r) => r.data),
  template: async () => saveBlob(await api.get<Blob>(`${base}/template`, { responseType: 'blob' }), 'MauNhapPhieuLuong.xlsx'),
}
