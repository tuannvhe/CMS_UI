import { api } from './client'

export interface YearReviewStatus { enabled: boolean; open: boolean; year: number; preview: boolean }
export interface YearMonthStat { month: number; workHours: number; otHours: number; attendanceBonus: boolean; lateEarly: number }

/** Tổng kết năm của chính người đăng nhập (máy chủ lấy mã nhân viên từ phiên đăng nhập). */
export interface YearReview {
  year: number
  employeeId: string
  name: string
  department: string | null
  position: string | null
  startWork: string | null
  tenureMonths: number
  joinedThisYear: boolean
  monthsWithData: number
  workDays: number
  workHours: number
  nightHours: number
  otHours: number
  otPercentile: number | null
  workPercentile: number | null
  topMonth: number | null
  leaveDays: number
  forgot: number
  lateEarly: number
  attendanceMonths: number
  attendanceStreak: number
  cleanMonths: number
  hungYenTrips: number
  months: YearMonthStat[]
  badges: string[]
  message: string | null
  messageBy: string | null
}

export const yearReview = {
  status: () => api.get<YearReviewStatus>('/year-review/status').then((r) => r.data),
  mine: () => api.get<YearReview>('/year-review/me').then((r) => r.data),
}
