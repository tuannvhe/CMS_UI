import { api } from './client'

export type RetroStatus = 'draft' | 'approved' | 'applied' | 'rejected'
export interface RetroRow {
  id: number; sourcePeriod: string; targetPeriod: string | null; employeeId: string; fullName: string; department: string; group: string; lateRequestId: number | null
  status: RetroStatus; delta: Record<string, number>; estimated: number | null; amount: number; note: string | null
  createdBy: string | null; createdAt: string | null; updatedBy: string | null; updatedAt: string | null; approvedBy: string | null; approvedAt: string | null; rejectReason: string | null
}
export interface LateRequestRow {
  id: number; kind: 'finger' | 'overtime' | 'leave'; requestId: number; employeeId: string; workDate: string; period: string
  complaintId: number | null; fault: 'company' | 'personal'; note: string | null; createdBy: string; createdAt: string
}
export interface LateRequestView { request: LateRequestRow; periodClosed: boolean; retroId: number | null; retroStatus: RetroStatus | null }
export interface RetroProposal {
  period: string; employeeId: string; fullName: string; department: string; group: string
  closed: Record<string, number>; recomputed: Record<string, number>; delta: Record<string, number>; estimated: number | null; lateRequests: LateRequestRow[]
}
export interface RetroInput { period: string; employeeId: string; delta: Record<string, number>; amount: number; note?: string; lateRequestId?: number | null }

const base = '/admin/payroll-retro'
const approveBase = '/admin/payroll-retro-approve'

export const payrollRetro = {
  list: (status?: string, period?: string) => api.get<RetroRow[]>(base, { params: { status: status || undefined, period: period || undefined } }).then((r) => r.data),
  late: (period: string) => api.get<LateRequestView[]>(`${base}/late`, { params: { period } }).then((r) => r.data),
  propose: (period: string, employeeId: string) => api.post<RetroProposal>(`${base}/propose`, { period, employeeId }, { timeout: 180000 }).then((r) => r.data),
  estimate: (period: string, employeeId: string, delta: Record<string, number>) =>
    api.post<{ estimated: number | null }>(`${base}/estimate`, { period, employeeId, delta }, { timeout: 120000 }).then((r) => r.data.estimated),
  create: (b: RetroInput) => api.post<RetroRow>(base, b, { timeout: 120000 }).then((r) => r.data),
  update: (id: number, b: RetroInput) => api.put<RetroRow>(`${base}/${id}`, b, { timeout: 120000 }).then((r) => r.data),
  remove: (id: number) => api.delete(`${base}/${id}`).then(() => undefined),
  /** Danh sách cho người duyệt (trang payrollRetroApprove). */
  approvals: (status?: string, period?: string) => api.get<RetroRow[]>(approveBase, { params: { status: status || undefined, period: period || undefined } }).then((r) => r.data),
  decide: (id: number, decision: 'approve' | 'reject' | 'revoke', reason?: string) => api.post<RetroRow>(`${approveBase}/${id}`, { decision, reason }).then((r) => r.data),
}
