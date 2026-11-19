import type { TFunction } from 'i18next'
import { trData } from './dataText'

/**
 * Giá trị tiếng Việt cố định do máy chủ trả về (Search_FingerCore, Tbl_Shift…) → khóa i18n để HIỂN THỊ theo ngôn ngữ đang chọn.
 * Chỉ dùng ở chỗ hiển thị (render ô, tag); dữ liệu gốc để lọc / so sánh / xuất Excel giữ nguyên tiếng Việt.
 */
const SERVER_TEXT: Record<string, string> = {
  // Loại ngày (NgayLamViec)
  'Ngày thường': 'srv.dayKind.work',
  'Ngày nghỉ': 'srv.dayKind.off',
  'Ngày Lễ': 'srv.dayKind.holiday',
  'Ngày lễ': 'srv.dayKind.holiday',
  // Ca (Shift): NCN / DCN = ca ngày / ca đêm vào ngày nghỉ
  'Ngày': 'srv.shift.day',
  'Đêm': 'srv.shift.night',
  NCN: 'srv.shift.dayRest',
  DCN: 'srv.shift.nightRest',
  'Ca ngày': 'srv.shift.dayShift',
  'Ca đêm': 'srv.shift.nightShift',
  // Thứ (DayinWeek)
  CN: 'srv.dow.sun',
  'Chủ nhật': 'srv.dow.sun',
  'Thứ 2': 'srv.dow.mon',
  'Thứ 3': 'srv.dow.tue',
  'Thứ 4': 'srv.dow.wed',
  'Thứ 5': 'srv.dow.thu',
  'Thứ 6': 'srv.dow.fri',
  'Thứ 7': 'srv.dow.sat',
  // Trạng thái (Statuss), Nguồn (Nguon), Nhóm (Nhom), Loại NV (TypeEmployee)
  'Đã đăng ký vân tay': 'srv.status.manual',
  'Không đi làm': 'srv.status.absent',
  'Hệ thống': 'srv.status.system',
  'Đăng ký tay': 'srv.source.manual',
  'Máy vân tay': 'srv.source.machine',
  'Công nhân': 'srv.group.worker',
  'Cán bộ': 'srv.group.staff',
  'Chính thức': 'srv.empType.official',
  'Thời vụ': 'srv.empType.temporary',
}

/** Dịch một giá trị máy chủ để hiển thị; không có trong bảng thì tra từ điển dữ liệu (bộ phận, chức vụ…), vẫn không có thì trả nguyên văn. */
export function trServer<T extends string | null | undefined>(value: T, t: TFunction): T | string {
  if (!value) return value
  const key = SERVER_TEXT[value.trim()]
  return key ? t(key, { defaultValue: value }) : trData(value)
}
