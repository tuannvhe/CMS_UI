import { api } from './client'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

const upload = <T,>(url: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<T>(url, fd, { timeout: 180000 }).then((r) => r.data)
}

/** Mã lỗi (title của ProblemDetails) và chi tiết. */
export function apiError(e: unknown): { code: string; detail: string } {
  const d = (e as { response?: { data?: { title?: string; detail?: string } } }).response?.data
  return { code: d?.title ?? '', detail: d?.detail ?? '' }
}

export interface ImportIssue { excelRow: number; code: string; detail: string | null }

export interface CommitResult { inserted: number; updated: number }

// ---------------- Phép năm ----------------
/** Phép năm đã tính (theo ngày; 1 ngày = 8 giờ khi hiển thị giờ). months = giờ HR nhập từng tháng, monthDays = số ngày tương ứng. */
export interface AnnualLeaveRow {
  id: number; code: string; fullName: string; department: string | null; position: string | null; statusWorking: string | null
  startWork: string | null; endWork: string | null; dateStart: string | null; year: number; asOf: string
  serviceMonths: number; seniorityDays: number; accrualMonths: number; entitledDays: number
  months: string[]; monthDays: number[]; usedHours: number; usedDays: number; remainingDays: number; entitledHours: number; remainingHours: number
  flags: string[]; usedSource: 'requests' | 'hr'; hrUsedDays: number
}
export interface LeaveDetail { id: number; fromDate: string | null; toDate: string | null; timeIn: string; timeOut: string; days: number; shift: string; leaveType: string; reason: string }
export interface LeaveInput { excelRow: number; employeeId: string; months: string[]; dateStart: string; dateEnd: string | null; year: number }
export interface LeavePreview {
  token: string; fileName: string; totalRows: number; years: { year: number; rows: number; new: number; updated: number }[]; unknownEmployees: number
  errors: ImportIssue[]; warnings: ImportIssue[]; ignoredRows: number; sample: LeaveInput[]
}
export interface LeaveReportFilter { year: number; date?: string; employeeId?: string; department?: string }

const adminLeave = '/admin/annual-leave'
const reportParams = (f: LeaveReportFilter) => ({ year: f.year, date: f.date || undefined, employeeId: f.employeeId || undefined, department: f.department || undefined })

export const leaveApi = {
  mine: () => api.get<AnnualLeaveRow[]>('/annual-leave/mine').then((r) => r.data),
  month: (year: number, m: number) => api.get<LeaveDetail[]>(`/annual-leave/mine/month/${m}`, { params: { year } }).then((r) => r.data),
  report: (f: LeaveReportFilter) => api.get<AnnualLeaveRow[]>(adminLeave, { params: reportParams(f), timeout: 120000 }).then((r) => r.data),
  exportReport: async (f: LeaveReportFilter) => saveBlob(await api.get<Blob>(`${adminLeave}/export`, { params: reportParams(f), responseType: 'blob', timeout: 180000 }), `PhepNam_${f.year}.xlsx`),
  updateMonths: (id: number, months: string[]) => api.put(`${adminLeave}/${id}/months`, { months }).then(() => undefined),
  preview: (file: File) => upload<LeavePreview>(`${adminLeave}/preview`, file),
  commit: (token: string) => api.post<CommitResult>(`${adminLeave}/commit`, { token }, { timeout: 180000 }).then((r) => r.data),
  template: async () => saveBlob(await api.get<Blob>(`${adminLeave}/template`, { responseType: 'blob' }), 'MauNhapPhepNam.xlsx'),
  departments: () => api.get<string[]>('/admin/attendance/departments').then((r) => r.data),
}
