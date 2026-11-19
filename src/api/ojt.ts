import { api } from './client'

export type OjtStatus = 'pending' | 'active' | 'done' | 'cancelled'

export interface OjtPlan {
  id: number; employeeId: string; employeeName: string | null; department: string | null; position: string | null; applicationId: number | null
  mentorId: string | null; mentorName: string | null; startDate: string; endDate: string; status: OjtStatus
  createdBy: string; createdAt: string; mentorBy: string | null; mentorAt: string | null; written: number; approverIds: string[]; mentorIds?: string[]
}
export interface OjtLog { id: number; planId: number; date: string; content: string; difficulty: string | null; mentorNote: string | null; mentorNoteBy: string | null; mentorNoteAt: string | null; updatedAt: string | null; vi?: boolean }
export interface OjtDay { date: string; log: OjtLog | null; canWrite: boolean; onLeave: boolean }
export type OjtConclusion = 'pass' | 'extend' | 'fail'
export interface OjtReview {
  id: number; planId: number; kind: 'week' | 'proposal' | 'final'; periodStart: string; periodEnd: string | null
  s1: number | null; s2: number | null; s3: number | null; s4: number | null; avg: number | null
  conclusion: OjtConclusion | null; comment: string | null; by: string; byName: string | null; at: string
}
export interface OjtRow { plan: OjtPlan; due: number; missing: number; streak: number; uncommented: number; lastAvg: number | null; proposal: OjtConclusion | null; final: OjtConclusion | null; mentors?: OjtPerson[]; viDays?: number; weeksOwed?: number }
export interface OjtReviewBody { weekStart?: string; s1?: number; s2?: number; s3?: number; s4?: number; conclusion?: OjtConclusion; comment?: string; extendTo?: string }
export interface OjtDetail { plan: OjtPlan; days: OjtDay[]; due: number; isMentor: boolean; isApprover: boolean; isSelf: boolean; reviews?: OjtReview[]; canReview?: boolean; canConclude?: boolean; canAssign?: boolean; leaders?: OjtPerson[]; mentors?: OjtPerson[] }
export interface OjtPerson { id: string; name: string; department: string | null; position: string | null; status: string | null }
export interface OjtLeader { person: OjtPerson; isLeader: boolean }
export interface OjtImportIssue { excelRow: number; code: string; detail: string | null }
export interface OjtImportResult { created: number; updated: number; errors: OjtImportIssue[] }
export interface OjtCreateResult { plan: OjtPlan; approvers: string[] }

export const ojt = {
  mine: () => api.get<{ detail: OjtDetail | null }>('/ojt/mine').then((r) => r.data.detail),
  saveLog: (date: string, b: { content: string; difficulty?: string }) => api.put(`/ojt/mine/${date}`, b).then(() => undefined),
  team: (status?: string) => api.get<{ items: OjtPlan[] }>('/ojt/team', { params: { status } }).then((r) => r.data.items),
  overview: (status?: string) => api.get<{ items: OjtRow[] }>('/ojt/overview', { params: { status } }).then((r) => r.data.items),
  reviewWeek: (id: number, b: OjtReviewBody) => api.put<OjtReview>(`/ojt/plans/${id}/review`, b).then((r) => r.data),
  propose: (id: number, b: OjtReviewBody) => api.put<OjtReview>(`/ojt/plans/${id}/proposal`, b).then((r) => r.data),
  conclude: (id: number, b: OjtReviewBody) => api.put<OjtReview>(`/ojt/plans/${id}/final`, b).then((r) => r.data),
  detail: (id: number) => api.get<OjtDetail>(`/ojt/plans/${id}`).then((r) => r.data),
  setMentor: (id: number, mentorId: string) => api.put<OjtPlan>(`/ojt/plans/${id}/mentor`, { mentorId }).then((r) => r.data),
  replaceMentor: (id: number, fromId: string, toId: string) => api.put<OjtPlan>(`/ojt/plans/${id}/mentor/${encodeURIComponent(fromId)}`, { mentorId: toId }).then((r) => r.data),
  removeMentor: (id: number, mentorId: string) => api.delete<OjtPlan>(`/ojt/plans/${id}/mentor/${encodeURIComponent(mentorId)}`).then((r) => r.data),
  note: (id: number, date: string, note: string) => api.put(`/ojt/plans/${id}/note/${date}`, { note }).then(() => undefined),
  avatars: (ids: string[]) => api.get<Record<string, string>>('/ojt/avatars', { params: { ids: ids.join(',') } }).then((r) => r.data),
  people: (q: string) => api.get<OjtPerson[]>('/ojt/people', { params: { q } }).then((r) => r.data),
  ready: () => api.get<{ ready: boolean }>('/admin/ojt/status').then((r) => r.data.ready),
  create: (b: { employeeId: string; startDate?: string; endDate?: string; applicationId?: number; approverIds?: string[] }) => api.post<OjtCreateResult>('/admin/ojt/plans', b).then((r) => r.data),
  byApplication: (applicationId: number) => api.get<{ plan: OjtPlan | null; final: OjtConclusion | null }>(`/admin/ojt/by-application/${applicationId}`).then((r) => r.data),
  suggest: (applicationId: number) => api.get<OjtPerson[]>(`/admin/ojt/suggest/${applicationId}`).then((r) => r.data),
  leaders: (employeeId: string) => api.get<OjtLeader[]>('/admin/ojt/leaders', { params: { employeeId } }).then((r) => r.data),
  importPlans: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<OjtImportResult>('/admin/ojt/plans/import', fd, { timeout: 180000 }).then((r) => r.data)
  },
  template: async () => {
    const res = await api.get<Blob>('/admin/ojt/plans/template', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = 'MauNhapOJT.xlsx'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
  report: async (status?: string) => {
    const res = await api.get<Blob>('/admin/ojt/report', { params: status ? { status } : {}, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = `BaoCaoOJT_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
  cancel: (id: number) => api.delete(`/admin/ojt/plans/${id}`).then(() => undefined),
}
