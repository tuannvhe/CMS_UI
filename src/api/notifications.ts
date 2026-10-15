import { api } from './client'

export interface Notice { id: string; kind: string; title: string; body: string; link: string | null; at: string; read: boolean }
export interface NoticeList { items: Notice[]; unread: number }

export interface HrRecipient { id: number; userId: string; fullName: string; email: string; department: string | null; factory: string | null; active: boolean }
export interface UserHit { userId: string; fullName: string; email: string | null }
export interface AutoRunResult {
  dryRun: boolean; candidates: number; eligible: number; created: number; rounds: number
  held: { employeeId: string; fullName: string; department: string; typeRate: string; dateRate: string; reasons: string[] }[]
}

export const notifications = {
  list: (take = 30) => api.get<NoticeList>('/notifications', { params: { take } }).then((r) => r.data),
  read: (id?: string) => api.post('/notifications/read', { id: id ?? null }).then(() => undefined),
}

export const hrRecipients = {
  list: () => api.get<HrRecipient[]>('/hr-recipients').then((r) => r.data),
  factories: () => api.get<string[]>('/hr-recipients/factories').then((r) => r.data),
  users: (q: string) => api.get<UserHit[]>('/hr-recipients/users', { params: { q } }).then((r) => r.data),
  add: (b: { userId: string; fullName: string; email: string; department?: string; factory?: string }) => api.post('/hr-recipients', b).then(() => undefined),
  setActive: (id: number, active: boolean) => api.put(`/hr-recipients/${id}/active`, { active }).then(() => undefined),
  remove: (id: number) => api.delete(`/hr-recipients/${id}`).then(() => undefined),
  testMail: (to: string) => api.post<{ ok: boolean; error: string | null }>('/hr-recipients/test-mail', { to }).then((r) => r.data),
  /** Chạy kiểm tra ngay: dryRun = chỉ cảnh báo, không tạo đơn; notify = gửi mail/chuông cho nhân sự. */
  runNow: (dryRun: boolean, notify: boolean) => api.post<AutoRunResult>('/evaluations/auto/run', null, { params: { dryRun, notify } }).then((r) => r.data),
}
