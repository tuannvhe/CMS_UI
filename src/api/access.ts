import { api } from './client'

export interface AccessTotals { logins: number; users: number; failed: number; today: number; todayUsers: number; oldSystem: number; newSystem: number }
export interface AccessReport {
  totals: AccessTotals
  perDay: { day: string; logins: number; users: number; failed: number }[]
  perHour: { hour: number; logins: number }[]
  topUsers: { userId: string; fullName: string | null; department: string | null; logins: number; last: string }[]
  topIps: { ip: string; logins: number; users: number; last: string }[]
  browsers: { name: string; count: number }[]
  newReady: boolean
}
export interface AccessRow { at: string; userId: string; fullName: string | null; ip: string | null; browser: string; source: 'old' | 'new'; success: boolean }
export interface AccessPage { rows: AccessRow[]; total: number; page: number; pageSize: number }
export interface AccessQuery { from: string; to: string; source?: string; user?: string; ip?: string }

export const access = {
  report: (q: AccessQuery) => api.get<AccessReport>('/admin/access', { params: q, timeout: 120000 }).then((r) => r.data),
  recent: (q: AccessQuery & { page: number; pageSize: number }) => api.get<AccessPage>('/admin/access/recent', { params: q, timeout: 120000 }).then((r) => r.data),
}
