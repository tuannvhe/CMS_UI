import type { ReactNode } from 'react'
import type { ColumnType } from 'antd/es/table'
import { ArrowRightOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { initialsOf } from './UserAvatar'

/** Ô hiển thị dùng chung cho các bảng danh sách: giúp mắt phân biệt nhanh người, bộ phận, ca, thứ, giờ. */

const HUES = [152, 200, 265, 24, 330, 175, 45, 290, 100, 220]
const hueOf = (key: string) => {
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

/** Nhân viên: avatar chữ cái đầu (màu theo mã) + họ tên đậm + mã nhân viên nhỏ phía dưới. */
export function PersonCell({ id, name }: { id?: string; name?: string }) {
  const hue = hueOf(id || name || '')
  return (
    <div className="cell-person">
      <span className="cell-avatar" style={{ background: `hsl(${hue} 55% 92%)`, color: `hsl(${hue} 60% 30%)` }}>{initialsOf(name)}</span>
      <span className="cell-person-txt">
        <b title={name}>{name || '—'}</b>
        <em>{id}</em>
      </span>
    </div>
  )
}

/** Bộ phận: viên thuốc có chấm màu riêng cho từng bộ phận. */
export function DeptChip({ value }: { value?: string | null }) {
  if (!value) return <span className="cell-muted">—</span>
  const hue = hueOf(value)
  return (
    <span className="cell-chip" title={value}>
      <i style={{ background: `hsl(${hue} 60% 48%)` }} />
      <span>{value}</span>
    </span>
  )
}

/** Ca làm việc: ca đêm màu chàm kèm biểu tượng trăng, ca ngày màu hổ phách kèm biểu tượng mặt trời. */
export function ShiftChip({ value }: { value?: string | null }) {
  if (!value) return <span className="cell-muted">—</span>
  const night = /đêm|night|dem/i.test(value)
  const day = /ngày|day|ngay/i.test(value)
  const cls = night ? 'shift-night' : day ? 'shift-day' : 'shift-other'
  return <span className={`cell-pill ${cls}`}>{night ? <MoonOutlined /> : day ? <SunOutlined /> : null}{value}</span>
}

/** Thứ trong tuần: cuối tuần tô nổi bật. */
export function DayChip({ raw, label }: { raw?: string; label: ReactNode }) {
  const weekend = /bảy|chủ nhật|chu nhat|saturday|sunday/i.test(raw ?? '')
  return <span className={`cell-day${weekend ? ' weekend' : ''}`}>{label}</span>
}

/** Khoảng giờ: "08:00 → 17:00" dạng khối gọn, số cùng độ rộng. */
export function TimeRange({ from, to }: { from?: string; to?: string }) {
  if (!from && !to) return <span className="cell-muted">—</span>
  return (
    <span className="cell-time">
      <b>{from || '—'}</b><ArrowRightOutlined /><b>{to || '—'}</b>
    </span>
  )
}

/** Số giờ / số ngày: số đậm trong huy hiệu nhẹ. */
export function AmountBadge({ value, unit }: { value?: string | number | null; unit?: string }) {
  if (value === undefined || value === null || value === '') return <span className="cell-muted">—</span>
  return <span className="cell-amount"><b>{value}</b>{unit ? <small>{unit}</small> : null}</span>
}

/** Cột "Nhân viên" gộp mã + họ tên. */
export function personColumn<T extends { employeeId: string; fullName: string }>(title: string, width = 230): ColumnType<T> {
  return { title, width, render: (_: unknown, r: T) => <PersonCell id={r.employeeId} name={r.fullName} /> }
}

/** Cột "Bộ phận" dạng chip. */
export function deptColumn<T extends { department?: string | null }>(title: string, width = 200): ColumnType<T> {
  return { title, dataIndex: 'department', width, render: (v: string | null) => <DeptChip value={v} /> }
}
