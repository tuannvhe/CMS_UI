import { api } from './client'

export type EmployeeKind = 'all' | 'official' | 'temporary'

export interface AttendanceDay {
  employeeId: string
  fullName: string
  position: string | null
  department: string | null
  employeeType: string
  date: string
  dayName: string
  dayKind: string
  shift: string
  timeIn: string | null
  timeOut: string | null
  dayWorkHours: number | null
  nightWorkHours: number | null
  status: string
  hoursOnRecord: number | null
  annualLeaveHours: number | null
  source: string
  group: string
  otFrom: string | null
  otTo: string | null
  otSunday: number | null
  otSundayNight: number | null
  otHoliday: number | null
  otHolidayNight: number | null
  otBefore22: number | null
  otAfter22: number | null
  otNight: number | null
  leaveAnnual: number | null
  leaveInsurance: number | null
  leaveSpecial: number | null
  leaveMaternity: number | null
  leaveUnpaid: number | null
  leaveFrom: string | null
  leaveTo: string | null
  totalOt: number
  /** Đi Hưng Yên trong ngày (đã đăng ký và được xác nhận): day | night | both; null = không đi. */
  hungYen?: 'day' | 'night' | 'both' | null
  /** Ngày thuộc một đợt công tác đã xác nhận (đăng ký công tác) */
  businessTrip?: boolean
  /** Ngày làm bù (danh sách ngày làm bù đang bật) */
  swapDay?: boolean
  /** Lần chấm của ngày là lúc VỀ đến nơi sau ca đêm đi Hưng Yên (không phải giờ vào làm). */
  hungYenArrival?: boolean
  /** Các form đăng ký vân tay trong ngày khi có từ 2 form (công chỉ tính theo form Used). */
  /** Có giá trị khi lần chấm đầu của ngày là giờ ra ca đêm tăng ca của ngày này. */
  overnightExitOf?: string | null
  /** Các đơn đăng ký tăng ca trong ngày khi có từ 2 đơn. */
  otRegs?: { id: number; from: string | null; to: string | null; hours: string | null; shift: string | null; reason: string | null; state: 'approved' | 'pending' }[]
  forms?: { id: number; timeIn: string | null; timeOut: string | null; reason: string | null; state: 'approved' | 'pending'; used: boolean }[]
  /** Mã các cờ "cần xem lại" của người-ngày (rỗng = bình thường). */
  flags?: string[]
}

export interface MyAttendance {
  employeeId: string
  fullName: string
  department: string | null
  position: string | null
  group: string
  summary: {
    presentDays: number
    absentDays: number
    manualDays: number
    dayWorkHours: number
    nightWorkHours: number
    totalWorkHours: number
    annualLeaveHours: number
    otHours: number
  }
  rows: AttendanceDay[]
}

export interface EmployeeSummary {
  employeeId: string; fullName: string; position: string | null; department: string | null; group: string
  presentDays: number; absentDays: number; manualDays: number; dayWorkHours: number; nightWorkHours: number; otHours: number
}
export interface DepartmentSummary {
  department: string; group: string; employees: number
  presentDays: number; absentDays: number; manualDays: number; dayWorkHours: number; nightWorkHours: number; otHours: number
}
export interface DaySummary {
  date: string; dayName: string; dayKind: string; group: string
  total: number; present: number; absent: number; manualRegistered: number; dayWorkHours: number; nightWorkHours: number; otHours: number
}

export type FactoryMode = 'emp' | 'dept' | 'day' | 'detail'

export interface FactoryFilter {
  from: string
  to: string
  type: EmployeeKind
  department?: string
  name?: string
  employeeId?: string
}

/** Chấm công cá nhân: KHÔNG có tham số nhân viên – máy chủ lấy mã từ token đăng nhập. */
export const getMyAttendance = (from: string, to: string) =>
  api.get<MyAttendance>('/attendance/me', { params: { from, to } }).then((r) => r.data)

const clean = (f: FactoryFilter) => ({
  from: f.from, to: f.to, type: f.type,
  department: f.department || undefined, name: f.name || undefined, employeeId: f.employeeId || undefined,
})

export const getFactory = <T>(mode: FactoryMode, f: FactoryFilter) =>
  api.get<T[]>('/admin/attendance', { params: { ...clean(f), mode }, timeout: 180000 }).then((r) => r.data)

/** Tổng giờ từng cột công / tăng ca / nghỉ. */
export type ColumnSums = Partial<Record<
  'dayWorkHours' | 'nightWorkHours' | 'otSunday' | 'otSundayNight' | 'otHoliday' | 'otHolidayNight' | 'otBefore22' | 'otAfter22' | 'otNight' |
  'leaveAnnual' | 'leaveUnpaid' | 'leaveInsurance' | 'leaveMaternity' | 'leaveSpecial' | 'hungYenDays', number>>

export const sumColumns = (rows: AttendanceDay[]): ColumnSums => {
  const keys = ['dayWorkHours', 'nightWorkHours', 'otSunday', 'otSundayNight', 'otHoliday', 'otHolidayNight', 'otBefore22', 'otAfter22', 'otNight',
    'leaveAnnual', 'leaveUnpaid', 'leaveInsurance', 'leaveMaternity', 'leaveSpecial'] as const
  const out: ColumnSums = {}
  for (const k of keys) out[k] = rows.reduce((s, r) => s + (r[k] ?? 0), 0)
  out.hungYenDays = rows.filter((r) => !!r.hungYen).length   // tổng số ngày đi Hưng Yên
  return out
}

export interface DetailPage {
  totals: { rows: number; dayWorkHours: number; nightWorkHours: number; otHours: number; columns: ColumnSums; flaggedRows: number; flaggedPeople: number }
  page: number
  pageSize: number
  rows: AttendanceDay[]
}

/** Chi tiết từng người-ngày, phân trang phía máy chủ (tải ban đầu có thể mất vài chục giây, sau đó đổi trang rất nhanh). */
export const getFactoryDetail = (f: FactoryFilter, page: number, pageSize: number, flaggedOnly = false) =>
  api.get<DetailPage>('/admin/attendance', { params: { ...clean(f), mode: 'detail', page, pageSize, flaggedOnly: flaggedOnly || undefined }, timeout: 300000 }).then((r) => r.data)

/** Số dòng / người có cờ "cần xem lại" trong khoảng lọc, dùng để cảnh báo HR trước khi xuất Excel. */
export interface FlagSummary { rows: number; flaggedRows: number; flaggedPeople: number; byCode: Record<string, number> }
export const getFlagSummary = (f: FactoryFilter) =>
  api.get<FlagSummary>('/admin/attendance/flags', { params: clean(f), timeout: 300000 }).then((r) => r.data)

export const getDepartments = () => api.get<string[]>('/admin/attendance/departments').then((r) => r.data)

/** Tải file Excel (có header Authorization) rồi cho trình duyệt lưu. */
export async function downloadExcel(f: FactoryFilter) {
  const res = await api.get<Blob>('/admin/attendance/export', { params: clean(f), responseType: 'blob', timeout: 300000 })
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers['content-disposition'] ?? '')
  const name = m ? decodeURIComponent(m[1]) : `ChamCong_${f.from}_${f.to}.xlsx`
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Lấy mã lỗi (title của ProblemDetails) từ lỗi axios; với blob thì đọc nội dung JSON. */
export async function errorCode(e: unknown): Promise<string> {
  const err = e as { response?: { status?: number; data?: unknown } }
  const data = err.response?.data
  try {
    if (data instanceof Blob) return (JSON.parse(await data.text()) as { title?: string }).title ?? ''
    return (data as { title?: string } | undefined)?.title ?? (err.response?.status === 403 ? 'forbidden' : '')
  } catch { return '' }
}
