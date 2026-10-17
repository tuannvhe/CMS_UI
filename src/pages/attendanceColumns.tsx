import { Table, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { CheckOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TFunction } from 'i18next'
import dayjs from 'dayjs'
import type { AttendanceDay, ColumnSums } from '../api/attendance'
import { num } from '../utils/format'

const numCol = (title: string, key: keyof AttendanceDay, width = 66, cls = ''): ColumnsType<AttendanceDay>[number] => ({
  title, dataIndex: key, width, align: 'right', className: `num ${cls}`.trim(),
  render: (v: number | null) => (v == null || v === 0 ? '' : num(v)),
})

/** Ngày có nhiều đơn tăng ca: mỗi đơn một dòng (từ giờ nào tới giờ nào), không chỉ giờ sớm nhất / muộn nhất. */
function otTimes(r: AttendanceDay, side: 'from' | 'to', fallback: string | null) {
  if ((r.otRegs?.length ?? 0) < 2) return fallback
  return <>{r.otRegs!.map((o) => <div key={o.id} style={{ whiteSpace: 'nowrap', opacity: o.state === 'pending' ? 0.55 : 1 }}>{(side === 'from' ? o.from : o.to) ?? ''}</div>)}</>
}

const FINGER_FLAGS = ['missing_in', 'missing_out', 'absent', 'hy_no_punch']

/** Ô cờ "cần xem lại": các thẻ lý do và đường tắt tới màn tạo đơn bổ sung (quên vân tay / tăng ca) đã điền sẵn người, ngày, bộ phận. */
function flagCell(t: TFunction, r: AttendanceDay) {
  const flags = r.flags ?? []
  if (flags.length === 0) return null
  const q = new URLSearchParams({ employee: r.employeeId, date: dayjs(r.date).format('YYYY-MM-DD'), ...(r.department ? { department: r.department } : {}) }).toString()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {flags.map((f) => <Tag key={f} color="gold" style={{ marginInlineEnd: 0 }}>{t(`attFlag.code.${f}`, { defaultValue: f })}</Tag>)}
      {flags.some((f) => FINGER_FLAGS.includes(f)) && <Link to={`/finger-forms?${q}`}>{t('attFlag.fixFinger')}</Link>}
      {flags.includes('ot_short') && <Link to={`/overtime?${q}`}>{t('attFlag.fixOt')}</Link>}
    </div>
  )
}

/** Cột bảng chi tiết chấm công – cùng thứ tự và tên cột với màn hình "Tìm vân tay" của hệ thống cũ. */
export function detailColumns(t: TFunction, opts: { withEmployee: boolean; toggle?: (r: AttendanceDay) => React.ReactNode }): ColumnsType<AttendanceDay> {
  const who: ColumnsType<AttendanceDay> = opts.withEmployee
    ? [
        { title: t('att.empId'), dataIndex: 'employeeId', width: 77, className: 'g-info', fixed: 'left' },
        { title: t('att.name'), dataIndex: 'fullName', width: 136, className: 'g-info', fixed: 'left' },
        { title: t('att.position'), dataIndex: 'position', width: 80, className: 'g-info' },
        { title: t('att.dept'), dataIndex: 'department', width: 120, className: 'g-info' },
        { title: t('att.type'), dataIndex: 'employeeType', width: 88, align: 'center', className: 'g-info' },
      ]
    : []
  return [
    ...who,
    { title: t('att.date'), dataIndex: 'date', width: 120, className: 'g-info', render: (v: string, r) => <>{dayjs(v).format('DD/MM/YYYY')}{opts.toggle && <div>{opts.toggle(r)}</div>}{r.swapDay && <div><Tag color="orange" style={{ marginInlineEnd: 0 }}>{t('att.swapDay')}</Tag></div>}{r.businessTrip && <div><Tag color="purple" style={{ marginInlineEnd: 0 }}>{t('att.businessTrip')}</Tag></div>}{r.hungYenArrival && <div><Tag color="cyan" style={{ marginInlineEnd: 0 }}>{t('attFlag.arrival')}</Tag></div>}</> },
    { title: t('att.dayKind'), dataIndex: 'dayKind', width: 90, className: 'g-info' },
    { title: t('att.day'), dataIndex: 'dayName', width: 54, className: 'g-info' },
    { title: t('att.shift'), dataIndex: 'shift', width: 70, align: 'center', className: 'g-info', onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
    {
      title: t('att.timeIn'), dataIndex: 'timeIn', width: 56, align: 'center', className: 'g-info',
      render: (v: string | null, r: AttendanceDay) => (r.overnightExitOf && v ? <span title={t('att.overnightExit', { date: dayjs(r.overnightExitOf).format('DD/MM') })}>{v}<Tag color="geekblue" style={{ marginInlineStart: 4, marginInlineEnd: 0 }}>{t('att.overnightExitShort', { date: dayjs(r.overnightExitOf).format('DD/MM') })}</Tag></span> : v),
    },
    { title: t('att.timeOut'), dataIndex: 'timeOut', width: 56, align: 'center', className: 'g-info' },
    {
      title: t('att.groupWork'), className: 'g-work',
      children: [numCol(t('att.dayWork'), 'dayWorkHours', 58, 'g-work g-first'), numCol(t('att.nightWork'), 'nightWorkHours', 58, 'g-work')],
    },
    {
      title: t('att.groupOt'), className: 'g-ot',
      children: [
        { title: t('att.otFrom'), dataIndex: 'otFrom', width: 52, align: 'center', className: 'g-ot g-first', render: (v: string | null, r: AttendanceDay) => otTimes(r, 'from', v) },
        { title: t('att.otTo'), dataIndex: 'otTo', width: 52, align: 'center', className: 'g-ot', render: (v: string | null, r: AttendanceDay) => otTimes(r, 'to', v) },
        numCol(t('att.otSunday'), 'otSunday', 48, 'g-ot'),
        numCol(t('att.otSundayNight'), 'otSundayNight', 48, 'g-ot'),
        numCol(t('att.otHoliday'), 'otHoliday', 54, 'g-ot'),
        numCol(t('att.otHolidayNight'), 'otHolidayNight', 54, 'g-ot'),
        numCol(t('att.otBefore22'), 'otBefore22', 54, 'g-ot'),
        numCol(t('att.otAfter22'), 'otAfter22', 54, 'g-ot'),
        numCol(t('att.otNight'), 'otNight', 48, 'g-ot'),
      ],
    },
    {
      title: t('att.groupLeave'), className: 'g-leave',
      children: [
        numCol(t('att.leaveAnnual'), 'leaveAnnual', 56, 'g-leave g-first'),
        numCol(t('att.leaveUnpaid'), 'leaveUnpaid', 40, 'g-leave'),
        numCol(t('att.leaveInsurance'), 'leaveInsurance', 60, 'g-leave'),
        numCol(t('att.leaveMaternity'), 'leaveMaternity', 58, 'g-leave'),
        numCol(t('att.leaveSpecial'), 'leaveSpecial', 56, 'g-leave'),
      ],
    },
    // Cột cuối bảng: có đi Hưng Yên trong ngày thì hiện dấu tích (rê chuột để xem ca ngày / ca đêm).
    {
      title: t('att.hungYen'), dataIndex: 'hungYen', width: 80, align: 'center', className: 'g-info',
      render: (v: AttendanceDay['hungYen']) => (v ? <CheckOutlined title={t(`att.hy.${v}`)} style={{ color: '#12B76A', fontWeight: 700 }} aria-label={t('att.hungYen')} /> : ''),
    },
    ...(opts.withEmployee ? [{ title: t('attFlag.col'), width: 230, className: 'g-info', render: (_: unknown, r: AttendanceDay) => flagCell(t, r) } as ColumnsType<AttendanceDay>[number]] : []),
  ]
}

/** Dòng có từ 2 form đăng ký vân tay mở rộng được để xem đủ các form; form được dùng để tính công có dấu. */
export const hasDetails = (r: AttendanceDay) => (r.forms?.length ?? 0) > 1 || (r.otRegs?.length ?? 0) > 1

/**
 * Mở rộng dòng bằng nút trong cột "Ngày" (không dùng cột mũi tên mặc định để bảng không bị thụt vào): hiện đủ các đơn tăng ca và các form đăng ký vân tay của ngày đó.
 */
export const formsExpandable = (t: TFunction, keys: React.Key[], setKeys: (k: React.Key[]) => void) => ({
  showExpandColumn: false,
  expandedRowKeys: keys,
  onExpandedRowsChange: (k: readonly React.Key[]) => setKeys([...k]),
  rowExpandable: hasDetails,
  expandedRowRender: (r: AttendanceDay) => (
    <div className="att-forms">
      {(r.otRegs?.length ?? 0) > 1 && (
        <>
          <div className="att-forms-note">{t('att.ots.note')}</div>
          <table>
            <thead><tr><th>#</th><th>{t('att.otFrom')}</th><th>{t('att.otTo')}</th><th>{t('att.ots.hours')}</th><th>{t('att.shift')}</th><th>{t('att.forms.reason')}</th><th>{t('att.forms.state')}</th></tr></thead>
            <tbody>
              {r.otRegs!.map((o, i) => (
                <tr key={o.id}><td>{i + 1}</td><td>{o.from ?? ''}</td><td>{o.to ?? ''}</td><td>{o.hours ?? ''}</td><td>{o.shift === 'S01' ? t('att.ots.shiftDay') : o.shift === 'S02' ? t('att.ots.shiftNight') : (o.shift ?? '')}</td><td>{o.reason ?? ''}</td>
                  <td>{o.state === 'pending' ? <Tag>{t('att.forms.pending')}</Tag> : <Tag color="green">{t('att.ots.approved')}</Tag>}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {(r.forms?.length ?? 0) > 1 && <>
      <div className="att-forms-note">{t('att.forms.note')}</div>
      <table>
        <thead><tr><th>#</th><th>{t('att.timeIn')}</th><th>{t('att.timeOut')}</th><th>{t('att.forms.reason')}</th><th>{t('att.forms.state')}</th></tr></thead>
        <tbody>
          {r.forms!.map((f, i) => (
            <tr key={f.id} className={f.used ? 'used' : ''}>
              <td>{i + 1}</td><td>{f.timeIn ?? ''}</td><td>{f.timeOut ?? ''}</td><td>{f.reason ?? ''}</td>
              <td>{f.used ? <Tag color="green">{t('att.forms.used')}</Tag> : f.state === 'pending' ? <Tag>{t('att.forms.pending')}</Tag> : <Tag color="orange">{t('att.forms.ignored')}</Tag>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </>}
    </div>
  ),
})

/** Nút nhỏ cạnh ngày để mở / đóng chi tiết các đơn trong ngày. */
export function DayToggle({ r, keys, setKeys, rowKey, t }: { r: AttendanceDay; keys: React.Key[]; setKeys: (k: React.Key[]) => void; rowKey: (r: AttendanceDay) => string; t: TFunction }) {
  if (!hasDetails(r)) return null
  const k = rowKey(r); const open = keys.includes(k)
  const n = Math.max(r.forms?.length ?? 0, r.otRegs?.length ?? 0)
  return <Tag color="gold" style={{ cursor: 'pointer', marginInlineEnd: 0 }} title={t('att.forms.hint')} onClick={() => setKeys(open ? keys.filter((x) => x !== k) : [...keys, k])}>{open ? '▾' : '▸'} {t('att.forms.badge', { n })}</Tag>
}

/** Dòng "Tổng" cuối bảng: cộng giờ của từng cột công / tăng ca / nghỉ (thứ tự cột phải khớp detailColumns). */
export function totalsRow(t: TFunction, sums: ColumnSums | undefined, opts: { withEmployee: boolean }) {
  if (!sums) return null
  const info = (opts.withEmployee ? 5 : 0) + 6
  const cell = (key: keyof ColumnSums, i: number, cls: string) => (
    <Table.Summary.Cell key={key} index={i} align="right" className={`num ${cls}`}>
      <strong>{num(sums[key] ?? 0) || ''}</strong>
    </Table.Summary.Cell>
  )
  let i = info
  const work = (['dayWorkHours', 'nightWorkHours'] as const).map((k) => cell(k, i++, 'g-work'))
  const blank = (n: number) => Array.from({ length: n }, () => <Table.Summary.Cell key={`b${i}`} index={i++} className="g-ot" />)
  const otBlank = blank(2)
  const ot = (['otSunday', 'otSundayNight', 'otHoliday', 'otHolidayNight', 'otBefore22', 'otAfter22', 'otNight'] as const).map((k) => cell(k, i++, 'g-ot'))
  const leave = (['leaveAnnual', 'leaveUnpaid', 'leaveInsurance', 'leaveMaternity', 'leaveSpecial'] as const).map((k) => cell(k, i++, 'g-leave'))
  const tail = (   // cột "Đi Hưng Yên" ở cuối bảng: tổng số ngày đi
    <Table.Summary.Cell key="hy" index={i++} align="center" className="g-info"><strong title={t('att.hungYenTotal')}>{sums.hungYenDays || ''}</strong></Table.Summary.Cell>
  )
  return (
    <Table.Summary fixed="top">
      <Table.Summary.Row className="att-total-row">
        <Table.Summary.Cell index={0} colSpan={info}><strong>{t('att.total')}</strong></Table.Summary.Cell>
        {work}{otBlank}{ot}{leave}{tail}
      </Table.Summary.Row>
    </Table.Summary>
  )
}

export const rowClass = (r: AttendanceDay) =>
  r.dayKind === 'Ngày Lễ' ? 'row-holiday' : r.dayKind === 'Ngày nghỉ' ? 'row-off' : r.status === 'Không đi làm' ? 'row-absent' : ''
