import { api } from './client'

export interface MonthStat {
  year: number
  month: number
  workDays: number
  workHours: number
  otHours: number
  nightHours: number
  leaveDays: number
  forgot: number
  lateEarly: number
  attendanceBonus: boolean
}
/** level 0 = chưa đạt, 1..4 = Đồng, Bạc, Vàng, Kim cương; target = mốc cấp kế tiếp (đã tối đa thì là mốc cuối). */
export interface BadgeProgress { key: string; earned: boolean; level: number; current: number; target: number; levels: number[] }
export interface MonthRef { year: number; month: number }

/** "Tháng của tôi": một kỳ chốt công của chính người đăng nhập và tủ huy hiệu cả năm (máy chủ lấy mã nhân viên từ phiên đăng nhập). */
export interface MonthReview {
  year: number
  month: number
  employeeId: string
  name: string
  department: string | null
  current: MonthStat | null
  previous: MonthStat | null
  otPercentile: number | null
  workPercentile: number | null
  monthBadges: string[]
  newBadges: string[]
  shelf: BadgeProgress[]
  available: MonthRef[]
}

export const monthReview = {
  /** Không truyền tháng = kỳ mới nhất đã chốt. */
  mine: (p?: MonthRef) => api.get<MonthReview>('/month-review/me', { params: p }).then((r) => r.data),
}
