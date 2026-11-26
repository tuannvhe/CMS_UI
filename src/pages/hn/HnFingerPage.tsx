import { useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Empty, Segmented, Skeleton, Table, Tag, Tooltip } from 'antd'
import { ClockCircleOutlined, ExclamationCircleFilled, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorKey, type HnRow } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { PageBanner } from '../../components/PageBanner'
import { fmtCell, isEmptyCell } from '../../utils/hnFormat'

/* 2026-11-26 [Truong] - HN finger page redesign: summary cards, compact columns (no repeated name/department), status/day-type tags, one-punch warning, range presets */

const MAX_DAYS = 62
const MAX_ROWS = 500
const OT_KEYS = ['OTBefore22h', 'OTAfter22h', 'OTDem', 'OTNgayChuNhat', 'OTDemChuNhat', 'OTNgayLe', 'OTDemLe'] as const
const LEAVE_KEYS = ['TimeNghiPhep', 'TimeNghiBHXH', 'TimeNghiDacBiet', 'TimeNghiKhamThai', 'TimeNghiKhongLuong'] as const
const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')

type Preset = 'last7' | 'thisMonth' | 'lastMonth'
const presetRange = (p: Preset): [Dayjs, Dayjs] => {
  const now = dayjs()
  if (p === 'thisMonth') return [now.startOf('month'), now]
  if (p === 'lastMonth') { const m = now.subtract(1, 'month'); return [m.startOf('month'), m.endOf('month')] }
  return [now.subtract(6, 'day'), now]
}

/** Số từ ô nguồn (decimal về dạng number hoặc chuỗi ".00"); rỗng / không phải số -> 0. */
const num = (v: unknown) => { if (isEmptyCell(v)) return 0; const n = Number(String(v).trim()); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown) => fmtCell(v).trim()
const hours = (n: number) => (Math.round(n * 100) / 100).toString()
/** Bỏ dấu để so khớp nhãn tiếng Việt do thủ tục trả về ("Không đi làm", "Da dang ky vân tay", "Hệ thống"...). */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

type Status = 'machine' | 'registered' | 'absent' | 'other'
const statusOf = (r: HnRow): Status => {
  const s = plain(str(r.Statuss))
  if (s.includes('khong di')) return 'absent'
  if (s.includes('dang ky')) return 'registered'
  if (s.includes('he thong')) return 'machine'
  return 'other'
}
type DayType = 'work' | 'off' | 'holiday' | 'other'
const dayTypeOf = (r: HnRow): DayType => {
  const s = plain(str(r.NgayLamViec))
  if (s.includes('le')) return 'holiday'
  if (s.includes('nghi')) return 'off'
  if (s.includes('thuong')) return 'work'
  return 'other'
}
const timeIn = (r: HnRow) => str(r.TIMEIN), timeOut = (r: HnRow) => str(r.TIMEOUT)
/** Có đúng một lần chấm: thiếu giờ vào hoặc giờ ra, hoặc vào = ra (máy chỉ ghi một lần). */
const onePunch = (r: HnRow) => { const a = timeIn(r), b = timeOut(r); return (!!a || !!b) && (!a || !b || a === b) }
const leaveHours = (r: HnRow) => LEAVE_KEYS.reduce((s, k) => s + num(r[k]), 0)

/** Xem vân tay của chính mình theo khoảng ngày (tối đa 62 ngày, mặc định 7 ngày gần nhất; máy chủ trả tối đa 500 dòng). */
export default function HnFingerPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [preset, setPreset] = useState<Preset | null>('last7')
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => presetRange('last7'))
  // Chỉ gọi API khi bấm "Xem" hoặc chọn nhanh: khoá truy vấn theo khoảng ngày đã áp dụng
  const [applied, setApplied] = useState<[Dayjs, Dayjs]>(range)
  const from = fmt(applied[0]), to = fmt(applied[1])
  const q = useQuery({ queryKey: ['hn', 'finger', user?.userId, from, to], queryFn: () => hnApi.finger(from, to), staleTime: 60_000, retry: false })
  const rows = useMemo(() => q.data?.rows ?? [], [q.data])

  // Không cho chọn quá 62 ngày: ô chọn tự chặn các ngày ngoài khoảng cho phép khi đã chọn đầu mút
  const [pick, setPick] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const disabled = (d: Dayjs) => !!pick?.[0] && !pick[1] && Math.abs(d.diff(pick[0], 'day')) >= MAX_DAYS

  const stats = useMemo(() => {
    const today = dayjs().startOf('day')
    let worked = 0, work = 0, missing = 0, absent = 0
    for (const r of rows) {
      const w = num(r.CongCaNgay) + num(r.CongCaDem)
      work += w
      if (timeIn(r) || timeOut(r)) worked++
      if (onePunch(r)) missing++
      const d = dayjs(String(r.DATEREGISTER ?? ''))
      if (statusOf(r) === 'absent' && dayTypeOf(r) === 'work' && leaveHours(r) === 0 && d.isValid() && d.isBefore(today)) absent++
    }
    return { worked, work, missing, absent }
  }, [rows])

  const head = rows[0]
  const chips = [
    head && str(head.FULLNAME), head && str(head.DEPARTMENT),
    q.data ? t('hn.finger.count', { n: q.data.count ?? rows.length }) : null,
  ].filter((x): x is string => !!x)

  const statusTag = (r: HnRow) => {
    const s = statusOf(r)
    if (s === 'other') return str(r.Statuss) ? <Tag>{str(r.Statuss)}</Tag> : null
    const color = s === 'machine' ? 'green' : s === 'registered' ? 'blue' : dayTypeOf(r) === 'work' && leaveHours(r) === 0 ? 'red' : 'default'
    return <Tag color={color} bordered={false}>{t(`hn.finger.st.${s}`)}</Tag>
  }
  const dayTag = (r: HnRow) => {
    const d = dayTypeOf(r)
    if (d === 'other') return str(r.NgayLamViec) || null
    return <Tag color={d === 'work' ? undefined : d === 'holiday' ? 'magenta' : 'gold'} bordered={false}>{t(`hn.finger.day.${d}`)}</Tag>
  }
  const chipsOf = (r: HnRow, keys: readonly string[], label: (k: string) => string, color: string) => {
    const items = keys.filter((k) => num(r[k]) > 0)
    if (items.length === 0) return <span className="hf-dash">—</span>
    return <div className="hf-chips">{items.map((k) => <Tag key={k} color={color} bordered={false}>{label(k)}: {hours(num(r[k]))}h</Tag>)}</div>
  }
  const otLabel = (k: string) => (k in { OTBefore22h: 1, OTAfter22h: 1, OTDem: 1 } ? t(`hn.finger.ot.${k}`) : t(`hn.fingerAll.col.${k}`))

  const columns: ColumnsType<HnRow> = [
    {
      title: t('hn.finger.c.date'), key: 'date', width: 130, fixed: 'left',
      render: (_, r) => (
        <div className="hf-date">
          <strong>{str(r.DATEREGISTER)}</strong>
          <span>{str(r.DayinWeek)}</span>
        </div>
      ),
    },
    { title: t('hn.finger.c.dayType'), key: 'dayType', width: 120, render: (_, r) => dayTag(r) },
    { title: t('hn.finger.c.shift'), key: 'shift', width: 80, render: (_, r) => str(r.Shift) || <span className="hf-dash">—</span> },
    { title: t('hn.finger.c.in'), key: 'in', width: 90, align: 'center', render: (_, r) => <span className="hf-time">{timeIn(r) || '—'}</span> },
    {
      title: t('hn.finger.c.out'), key: 'out', width: 100, align: 'center',
      render: (_, r) => (
        <span className="hf-time">
          {timeOut(r) || '—'}
          {onePunch(r) && <Tooltip title={t('hn.finger.onePunch')}><ExclamationCircleFilled className="hf-warn" aria-label={t('hn.finger.onePunch')} /></Tooltip>}
        </span>
      ),
    },
    {
      title: t('hn.finger.c.work'), key: 'work', width: 100, align: 'right',
      render: (_, r) => { const w = num(r.CongCaNgay) + num(r.CongCaDem); return w > 0 ? <strong>{hours(w)}h</strong> : <span className="hf-dash">—</span> },
    },
    { title: t('hn.finger.c.ot'), key: 'ot', width: 200, render: (_, r) => chipsOf(r, OT_KEYS, otLabel, 'purple') },
    {
      title: t('hn.finger.c.leave'), key: 'leave', width: 200,
      render: (_, r) => {
        const c = chipsOf(r, LEAVE_KEYS, (k) => t(`hn.fingerAll.col.${k}`), 'cyan')
        const span = [str(r.NghiTuGio), str(r.NghiToiGio)].filter(Boolean).join(' – ')
        return leaveHours(r) > 0 && span ? <>{c}<div className="hf-sub">{span}</div></> : c
      },
    },
    { title: t('hn.finger.c.status'), key: 'status', width: 170, render: (_, r) => statusTag(r) },
  ]

  const statCards = [
    { k: 'worked', v: String(stats.worked), unit: t('hn.finger.stat.days'), tone: 'ok' },
    { k: 'workHours', v: hours(stats.work), unit: t('hn.finger.stat.hours'), tone: 'ok' },
    { k: 'missing', v: String(stats.missing), unit: t('hn.finger.stat.days'), tone: stats.missing > 0 ? 'warn' : 'muted' },
    { k: 'absent', v: String(stats.absent), unit: t('hn.finger.stat.days'), tone: stats.absent > 0 ? 'bad' : 'muted' },
  ]

  return (
    <div className="page wide hn-finger">
      <PageBanner avatar={<ClockCircleOutlined style={{ fontSize: 30 }} />} title={t('hn.nav.finger')} subtitle={t('hn.nav.fingerDesc')} chips={chips.length ? chips : undefined} />

      <section className="hf-filter">
        <Segmented<Preset> value={preset ?? undefined} onChange={(p) => { const r = presetRange(p); setPreset(p); setRange(r); setApplied(r) }}
          options={(['last7', 'thisMonth', 'lastMonth'] as const).map((p) => ({ value: p, label: t(`hn.finger.preset.${p}`) }))} />
        <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} disabledDate={disabled}
          aria-label={t('hn.finger.range')}
          onCalendarChange={(v) => setPick(v as [Dayjs | null, Dayjs | null] | null)}
          onOpenChange={(o) => { if (!o) setPick(null) }}
          onChange={(v) => { if (v?.[0] && v[1]) { setRange([v[0], v[1]]); setPreset(null) } }} />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => setApplied(range)} loading={q.isFetching}>{t('hn.finger.search')}</Button>
        <span className="hf-hint">{t('hn.finger.hint')}</span>
      </section>

      {q.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={t(hnErrorKey(q.error))} />}
      {(q.data?.count ?? rows.length) >= MAX_ROWS && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('hn.finger.truncated')} />}

      {q.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          {rows.length > 0 && (
            <div className="hf-stats">
              {statCards.map((s) => (
                <div key={s.k} className={`hf-stat hf-${s.tone}`}>
                  <div className="hf-stat-label">{t(`hn.finger.stat.${s.k}`)}</div>
                  <div className="hf-stat-value">{s.v}<small>{s.unit}</small></div>
                </div>
              ))}
            </div>
          )}
          <Table<HnRow>
            className="hf-table"
            size="middle"
            rowKey={(r, i) => `${str(r.DATEREGISTER)}|${i}`}
            columns={columns}
            dataSource={rows}
            loading={q.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={rows.length > 31 ? { pageSize: 31, showSizeChanger: false } : false}
            rowClassName={(r) => (dayTypeOf(r) === 'off' || dayTypeOf(r) === 'holiday' ? 'hf-row-off' : statusOf(r) === 'absent' && dayTypeOf(r) === 'work' && leaveHours(r) === 0 ? 'hf-row-absent' : '')}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.finger.empty')} /> }}
          />
        </>
      )}
    </div>
  )
}
