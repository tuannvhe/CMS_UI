import { api } from './client'

export type HrSite = 'BN' | 'HY' | 'OTHER'

export interface HrSiteCount { site: HrSite; total: number; op: number; seasonal: number }
export interface HrNamedCount { name: string; count: number }
export interface HrHeadcount { total: number; op: number; other: number; seasonal: number; bySite: HrSiteCount[]; byStatus: HrNamedCount[] }
export interface HrTodaySite { site: HrSite; active: number; present: number; onLeave: number }
export interface HrToday { date: string; active: number; present: number; onLeave: number; notPunched: number; bySite: HrTodaySite[] }
export interface HrMonth { month: string; headcount: number; joiners: number; leavers: number; turnoverPct: number }
export interface HrAttrition { leavers: number; earlyLeavers: number; earlyPct: number; quitWithoutEndDate: number }
export interface HrOtPerson { employeeId: string; name: string; department: string | null; isOp: boolean; hours: number; limit: number }
export interface HrOvertime {
  approvedHours: number; people: number; avgHours: number; waitingForms: number; waitingHours: number
  limitOp: number; limitStaff: number; overLimit: HrOtPerson[]; top: HrOtPerson[]
}
export interface HrDepartmentRow {
  department: string; site: HrSite; headcount: number; op: number; joiners: number; leavers: number
  otHours: number; otPerHead: number; leaveDays: number; overLimit: number
}
export interface HrDashboard {
  generatedAt: string; month: string; site: HrSite | 'ALL'; headcount: HrHeadcount; today: HrToday | null
  trend: HrMonth[]; attrition: HrAttrition; overtime: HrOvertime; departments: HrDepartmentRow[]; overtimeTruncated: boolean
}

export const getHrDashboard = (month: string, site?: HrSite) =>
  api.get<HrDashboard>('/admin/hr-dashboard', { params: { month, site: site || undefined }, timeout: 180000 }).then((r) => r.data)
