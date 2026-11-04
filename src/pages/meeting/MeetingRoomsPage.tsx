import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Checkbox, DatePicker, Empty, Form, Input, Segmented, Select, Space, Spin, Switch, Tag, TimePicker, Tooltip, type SelectProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalendarOutlined, EditOutlined, LeftOutlined, PlusOutlined, RightOutlined, StopOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { conflictsOf, MEETING_LOCATIONS, meetingRooms, personLabel, type MeetingBooking, type MeetingRoom } from '../../api/meetingRooms'
import { adminError } from '../../api/userAdmin'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import { useToast } from '../../hooks/useToast'
import { PeoplePicker } from './PeoplePicker'

const OPEN = 6, CLOSE = 22, SPAN = CLOSE - OPEN
const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const pct = (hhmm: string) => `${Math.min(100, Math.max(0, ((minutes(hhmm) - OPEN * 60) / (SPAN * 60)) * 100))}%`
const DAY_FMT = 'YYYY-MM-DD'

interface BookValues { room: string; date?: Dayjs; range?: [Dayjs, Dayjs]; skipWeekend: boolean; from: Dayjs; to: Dayjs; title: string; note?: string; attendees: string[] }

/** Các ngày được đặt: một ngày, hoặc mọi ngày trong khoảng (có thể bỏ thứ 7 / chủ nhật). */
function daysOf(v: BookValues, multi: boolean): string[] {
  if (!multi) return v.date ? [v.date.format(DAY_FMT)] : []
  const [a, b] = v.range ?? []
  if (!a || !b) return []
  const out: string[] = []
  for (let d = a.startOf('day'); !d.isAfter(b, 'day') && out.length <= 31; d = d.add(1, 'day'))
    if (!v.skipWeekend || (d.day() !== 0 && d.day() !== 6)) out.push(d.format(DAY_FMT))
  return out
}

/**
 * Đặt phòng họp (thay web đặt phòng cũ, dùng chung bảng BM_*): lịch một ngày của mọi phòng theo nhà máy, bấm vào chỗ trống để đặt, bấm vào lượt để xem / sửa / huỷ;
 * mời người dự họp (họ nhận chuông + mail). Tab "Cuộc họp của tôi": lượt mình đặt và cuộc họp mình được mời.
 */
export default function MeetingRoomsPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = !!user?.isAdmin || !!user?.grantedPages?.includes('meetingRoomsManage')
  const tabs = [{ key: 'schedule', label: t('mtg.tabSchedule') }, { key: 'mine', label: t('mtg.tabMine') }]
  const [tab, setTab] = usePageTab(tabs)
  const [date, setDate] = useState(dayjs().startOf('day'))
  const [location, setLocation] = useState<string>('all')
  const [booking, setBooking] = useState(false)
  const [editing, setEditing] = useState<MeetingBooking | null>(null)
  const [multi, setMulti] = useState(false)
  const [conflicts, setConflicts] = useState<MeetingBooking[]>([])
  const [viewing, setViewing] = useState<MeetingBooking | null>(null)
  const [cancelling, setCancelling] = useState<MeetingBooking | null>(null)
  const [reason, setReason] = useState('')
  const [form] = Form.useForm<BookValues>()
  // Đồng hồ cập nhật mỗi phút để vạch giờ hiện tại và trạng thái "đang trống / đang họp" của từng phòng luôn đúng
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => { const id = window.setInterval(() => setTick(Date.now()), 60_000); return () => window.clearInterval(id) }, [])

  // Giờ đã qua không được chọn: nếu bắt đầu hôm nay thì giờ bắt đầu phải từ thời điểm hiện tại trở đi (làm tròn lên bước 15 phút của ô chọn giờ)
  const clock = dayjs(tick)
  const nowMinutes = clock.hour() * 60 + clock.minute()
  const earliestStart = Math.ceil(nowMinutes / 15) * 15
  const watchedDate = Form.useWatch('date', form)
  const watchedRange = Form.useWatch('range', form)
  const startDay = multi && !editing ? watchedRange?.[0] : watchedDate
  const startsToday = !!startDay && startDay.isSame(clock, 'day')
  /** Ô chọn giờ: ngoài giờ làm việc và (khi bắt đầu hôm nay) giờ đã qua đều bị vô hiệu. Giờ kết thúc phải sau hiện tại. */
  const timeLimits = (kind: 'from' | 'to') => {
    const slots = [0, 15, 30, 45]
    const lowest = Math.max(OPEN * 60, startsToday ? (kind === 'from' ? earliestStart : nowMinutes + 1) : 0)
    const highest = kind === 'from' ? CLOSE * 60 - 15 : CLOSE * 60
    const ok = (h: number, m: number) => h * 60 + m >= lowest && h * 60 + m <= highest
    return {
      disabledHours: () => Array.from({ length: 24 }, (_, h) => h).filter((h) => !slots.some((m) => ok(h, m))),
      disabledMinutes: (h: number) => slots.filter((m) => !ok(h, m)),
    }
  }

  const rooms = useQuery({ queryKey: ['meeting-rooms', 'rooms'], queryFn: meetingRooms.rooms })
  const day = useQuery({ queryKey: ['meeting-rooms', 'day', date.format(DAY_FMT)], queryFn: () => meetingRooms.day(date.format(DAY_FMT)), enabled: tab === 'schedule' })
  const mine = useQuery({ queryKey: ['meeting-rooms', 'mine'], queryFn: meetingRooms.mine, enabled: tab === 'mine' })
  const refresh = () => qc.invalidateQueries({ queryKey: ['meeting-rooms'] })
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`mtg.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }

  // Luôn có tab Bắc Ninh / Bắc Giang / Hưng Yên; địa điểm khác quản trị nhập thì thêm sau.
  const locations = useMemo(() => [...new Set([...MEETING_LOCATIONS, ...(rooms.data ?? []).map((r) => r.location ?? '').filter(Boolean)])], [rooms.data])
  const shownRooms = useMemo(() => (rooms.data ?? []).filter((r) => location === 'all' || r.location === location), [rooms.data, location])
  // Nhãn luôn kèm địa điểm vì nhiều nơi có phòng trùng tên (Phòng họp lớn - Bắc Ninh / Bắc Giang)
  const roomOptions: SelectProps['options'] = locations
    .map((l) => ({ label: l, options: (rooms.data ?? []).filter((r) => r.location === l).map((r) => ({ value: r.code, label: r.display })) }))
    .filter((g) => g.options.length > 0)
  const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(i18n.language, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  const canAdminAct = (b: MeetingBooking) => canManage && b.status === 1 && !b.ended
  const editable = (b: MeetingBooking) => b.canEdit || canAdminAct(b)
  const cancellable = (b: MeetingBooking) => b.canCancel || canAdminAct(b)

  const save = useMutation({
    mutationFn: (v: BookValues) => {
      const common = { roomCode: v.room, from: v.from.format('HH:mm'), to: v.to.format('HH:mm'), title: v.title.trim(), note: v.note?.trim() || undefined, attendees: v.attendees ?? [] }
      if (editing) {
        const body = { ...common, day: (v.date ?? dayjs(editing.day)).format(DAY_FMT) }
        return (editing.canEdit ? meetingRooms.edit(editing.code, body) : meetingRooms.adminEdit(editing.code, body)).then(() => 0)
      }
      return meetingRooms.book({ ...common, days: daysOf(v, multi) }).then((r) => r.codes.length)
    },
    onSuccess: (n) => { msg.success(editing ? t('mtg.saved') : t('mtg.booked', { n })); setBooking(false); setEditing(null); setConflicts([]); refresh() },
    onError: (e) => { const c = conflictsOf(e); setConflicts(c); if (!c.length) msg.error(errText(e)) },
  })
  const cancel = useMutation({
    mutationFn: (b: MeetingBooking) => (b.canCancel ? meetingRooms.cancel(b.code, reason.trim() || undefined) : meetingRooms.adminCancel(b.code, reason.trim())),
    onSuccess: () => { msg.success(t('mtg.cancelled')); setCancelling(null); setViewing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  /** Mở hộp đặt phòng, điền sẵn phòng / ngày / giờ (bấm vào chỗ trống trên lịch thì lấy giờ ở vị trí bấm, làm tròn 30 phút). */
  const openBook = (room?: MeetingRoom, startMinutes?: number) => {
    let start = startMinutes ?? Math.max(OPEN * 60, date.isSame(clock, 'day') ? Math.ceil(nowMinutes / 30) * 30 : 8 * 60)
    if (date.isSame(clock, 'day')) start = Math.max(start, earliestStart)   // giờ đã qua không được chọn
    start = Math.min(start, (CLOSE - 1) * 60)
    const base = date.startOf('day')
    setEditing(null); setMulti(false); setConflicts([])
    form.setFieldsValue({
      room: room?.code ?? shownRooms[0]?.code, date: date, range: [date, date.add(4, 'day')], skipWeekend: true,
      from: base.add(start, 'minute'), to: base.add(Math.min(start + 60, CLOSE * 60), 'minute'), title: '', note: '', attendees: [],
    })
    setBooking(true)
  }

  /** Mở hộp sửa với dữ liệu của lượt đặt (phòng tra theo tên hiển thị; lượt cũ mang tên phòng không còn thì phải chọn lại). */
  const openEdit = (b: MeetingBooking) => {
    const d = dayjs(b.day)
    setViewing(null); setEditing(b); setMulti(false); setConflicts([])
    form.setFieldsValue({
      room: (rooms.data ?? []).find((r) => r.display === b.roomName)?.code, date: d,
      from: d.add(minutes(b.from), 'minute'), to: d.add(minutes(b.to), 'minute'), title: b.title, note: b.note ?? '', attendees: b.attendees.map((a) => a.userId),
    })
    setBooking(true)
  }

  const clickTrack = (room: MeetingRoom, e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const raw = ((e.clientX - box.left) / box.width) * SPAN * 60   // phút kể từ giờ mở cửa
    if (date.isSame(clock, 'day') && OPEN * 60 + raw < nowMinutes) { msg.warning(t('mtg.err.past')); return }   // bấm vào vùng giờ đã qua
    openBook(room, OPEN * 60 + Math.floor(raw / 30) * 30)
  }

  /** Dời giờ mặc định về hiện tại khi đổi sang ngày hôm nay (tránh để sẵn giờ đã qua). Sửa lượt đang diễn ra thì giữ nguyên giờ gốc. */
  const clampStart = (all: BookValues) => {
    const d = multi && !editing ? all.range?.[0] : all.date
    if (editing || !d || !all.from || !d.isSame(clock, 'day') || all.from.hour() * 60 + all.from.minute() >= earliestStart) return
    const start = Math.min(earliestStart, (CLOSE - 1) * 60)
    form.setFieldsValue({ from: d.startOf('day').add(start, 'minute'), to: d.startOf('day').add(Math.min(start + 60, CLOSE * 60), 'minute') })
  }

  const now = dayjs(tick)
  const isToday = date.isSame(now, 'day')
  const nowText = now.format('HH:mm')
  const nowPct = pct(nowText)
  const nowInRange = minutes(nowText) >= OPEN * 60 && minutes(nowText) <= CLOSE * 60
  const pastWidth = date.isBefore(now, 'day') ? '100%' : isToday ? nowPct : '0%'   // phần giờ đã qua phủ mờ
  const byRoom = (r: MeetingRoom) => (day.data ?? []).filter((b) => b.roomName === r.display)
  const busyNow = (r: MeetingRoom) => byRoom(r).find((b) => b.status === 1 && minutes(b.from) <= minutes(nowText) && minutes(nowText) < minutes(b.to))
  const unknownRooms = (day.data ?? []).filter((b) => !(rooms.data ?? []).some((r) => r.display === b.roomName))   // lượt cũ mang tên phòng đã đổi / không có địa điểm

  /** Dưới tên phòng (chỉ khi xem hôm nay): đang trống hay đang họp đến mấy giờ */
  const roomState = (r: MeetingRoom) => {
    if (!isToday) return null
    const b = busyNow(r)
    return b ? <em className="mtg-state busy">{t('mtg.busyUntil', { t: b.to })}</em> : <em className="mtg-state free">{t('mtg.freeNow')}</em>
  }

  const statusChip = (b: MeetingBooking) => b.status === 3
    ? <span className="org-chip bad">{t('mtg.st.cancelled')}</span>
    : b.status === 2 ? <span className="org-chip bad">{t('mtg.st.rejected')}</span>
      : b.ended ? <span className="org-chip">{t('mtg.st.ended')}</span> : <span className="org-chip ok">{t('mtg.st.booked')}</span>

  const actions = (b: MeetingBooking) => (
    <Space size={4}>
      {editable(b) && <Tooltip title={t('mtg.edit')}><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(b)} aria-label={t('mtg.edit')} /></Tooltip>}
      {cancellable(b) && <Tooltip title={t('mtg.cancel')}><Button size="small" danger icon={<StopOutlined />} onClick={() => { setReason(''); setCancelling(b) }} aria-label={t('mtg.cancel')} /></Tooltip>}
    </Space>
  )

  const listColumns: ColumnsType<MeetingBooking> = [
    { title: t('mtg.day'), dataIndex: 'day', width: 150, render: fmtDay },
    { title: t('mtg.time'), key: 'time', width: 120, render: (_, b) => `${b.from} – ${b.to}` },
    { title: t('mtg.room'), dataIndex: 'roomName', width: 210 },
    { title: t('mtg.titleCol'), dataIndex: 'title', ellipsis: true },
    { title: t('mtg.bookedBy'), key: 'bookedBy', dataIndex: 'userName', width: 170, responsive: ['md'] },
    { title: t('mtg.attendees'), key: 'attendees', width: 90, align: 'center', render: (_, b) => b.attendees.length
      ? <Tooltip title={<>{b.attendees.map((a) => <div key={a.userId}>{personLabel(a)}</div>)}</>}><Tag icon={<TeamOutlined />}>{b.attendees.length}</Tag></Tooltip> : <span className="cell-muted">–</span> },
    { title: t('mtg.role'), key: 'role', width: 110, render: (_, b) => b.mine ? <span className="org-chip ok">{t('mtg.roleOwner')}</span> : <span className="org-chip warn">{t('mtg.roleInvited')}</span> },
    { title: t('cov.status'), key: 'status', width: 110, render: (_, b) => statusChip(b) },
    { title: '', key: 'act', width: 90, align: 'right', render: (_, b) => actions(b) },
  ]

  const schedule = (
    <>
      <div className="mtg-toolbar">
        <div className="mtg-date">
          <Button icon={<LeftOutlined />} onClick={() => setDate((d) => d.subtract(1, 'day'))} aria-label={t('mtg.prevDay')} />
          <DatePicker allowClear={false} value={date} onChange={(d) => d && setDate(d.startOf('day'))} format="ddd DD/MM/YYYY" />
          <Button icon={<RightOutlined />} onClick={() => setDate((d) => d.add(1, 'day'))} aria-label={t('mtg.nextDay')} />
          {!isToday && <Button onClick={() => setDate(dayjs().startOf('day'))}>{t('mtg.today')}</Button>}
          <Segmented value={location} onChange={(v) => setLocation(String(v))} options={[{ value: 'all', label: t('mtg.allLocations') }, ...locations.map((l) => ({ value: l, label: l }))]} />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openBook()} disabled={!shownRooms.length || date.isBefore(clock, 'day') || (date.isSame(clock, 'day') && earliestStart > CLOSE * 60 - 15)}>{t('mtg.book')}</Button>
      </div>
      <Card className="mtg-timeline" styles={{ body: { padding: '8px 16px 14px' } }}>
        {rooms.isLoading ? <Spin /> : !shownRooms.length ? (
          <Empty description={location === 'all' ? t('mtg.noRooms') : t('mtg.noRoomsAt', { loc: location })}>
            {canManage && <Button onClick={() => navigate('/meeting-rooms/manage')} icon={<PlusOutlined />}>{t('mtg.addRoom')}</Button>}
          </Empty>
        ) : (
          <div className="mtg-scroll">
            <div className="mtg-grid">
              <div className="mtg-hours">
                <span />
                <div className="mtg-scale">{isToday && nowInRange && <div className="mtg-now-tag" style={{ left: nowPct }}>{nowText}</div>}{Array.from({ length: SPAN + 1 }, (_, i) => <span key={i} style={{ left: `${(i / SPAN) * 100}%` }}>{String(OPEN + i).padStart(2, '0')}</span>)}</div>
              </div>
              {shownRooms.map((r) => (
                <div className="mtg-row" key={r.code}>
                  <div className="mtg-room"><b title={r.name}>{r.name}</b><span>{r.location}</span>{roomState(r)}</div>
                  <div className="mtg-track" onClick={(e) => !date.isBefore(dayjs(), 'day') && clickTrack(r, e)} title={t('mtg.clickToBook')}>
                    {pastWidth !== '0%' && <div className="mtg-past" style={{ width: pastWidth }} title={t('mtg.pastHint')} />}
                    {isToday && nowInRange && <div className="mtg-now" style={{ left: nowPct }} />}
                    {byRoom(r).map((b) => (
                      <Tooltip key={b.code} title={<>{b.from} – {b.to} · {b.title}<br />{b.userName}{b.attendees.length > 0 && <><br />{t('mtg.attendeesN', { n: b.attendees.length })}</>}{b.note ? <><br />{b.note}</> : null}</>}>
                        <div className={`mtg-block${b.mine ? ' mine' : ''}${b.invited ? ' invited' : ''}${b.ended ? ' ended' : ''}`} style={{ left: pct(b.from), width: `calc(${pct(b.to)} - ${pct(b.from)})` }}
                          onClick={(e) => { e.stopPropagation(); setViewing(b) }}>
                          <b>{b.title}</b><span>{b.from}–{b.to} · {b.userName}</span>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mtg-legend">
          <span><i className="mine" />{t('mtg.legendMine')}</span><span><i className="invited" />{t('mtg.legendInvited')}</span><span><i />{t('mtg.legendOthers')}</span>{isToday && <span><i className="now" />{t('mtg.legendNow')}</span>}<span>{t('mtg.legendHint')}</span>
        </div>
      </Card>
      {unknownRooms.length > 0 && <Alert type="info" showIcon style={{ marginTop: 12 }} title={t('mtg.unknownRooms', { n: unknownRooms.length })} />}
      <DataTable<MeetingBooking>
        rowKey="code" loading={day.isLoading} columns={listColumns.filter((c) => c.key !== 'role')}
        dataSource={(day.data ?? []).filter((b) => location === 'all' || shownRooms.some((r) => r.display === b.roomName) || unknownRooms.includes(b))} pagination={false}
        locale={{ emptyText: day.isError ? t('usr.err.generic') : t('mtg.emptyDay') }}
        toolbar={<b>{t('mtg.dayList', { d: fmtDay(date.format(DAY_FMT)) })}</b>}
      />
    </>
  )

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CalendarOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.meetingRooms')} subtitle={t('nav.meetingRoomsDesc')} />
      <PageTabs items={tabs} active={tab} onChange={setTab} />
      {tab === 'schedule' ? schedule : (
        <DataTable<MeetingBooking>
          rowKey="code" loading={mine.isLoading} columns={listColumns} dataSource={mine.data ?? []} pagination={{ pageSize: 15, showSizeChanger: false }}
          locale={{ emptyText: mine.isError ? t('usr.err.generic') : t('mtg.emptyMine') }}
          toolbar={<span className="cell-muted">{t('mtg.mineHint')}</span>}
        />
      )}

      <AppModal open={booking} onClose={() => { setBooking(false); setEditing(null) }} title={editing ? t('mtg.editTitle') : t('mtg.bookTitle')} subtitle={editing?.code}
        icon={editing ? <EditOutlined /> : <CalendarOutlined />} size="md" onOk={() => form.submit()} okText={editing ? t('mtg.saveChanges') : t('mtg.book')} okLoading={save.isPending}>
        <Form form={form} layout="vertical" autoComplete="off" onFinish={(v) => save.mutate(v)} onValuesChange={(changed, all) => { if (conflicts.length) setConflicts([]); if ('date' in changed || 'range' in changed) clampStart(all) }}>
          <div className="dlg-form">
            <Form.Item name="room" label={t('mtg.room')} rules={[{ required: true }]} extra={editing && !(rooms.data ?? []).some((r) => r.display === editing.roomName) ? t('mtg.pickRoomAgain', { name: editing.roomName }) : undefined}>
              <Select options={roomOptions} />
            </Form.Item>
            {!editing && (
              <Form.Item label={t('mtg.multiDay')}>
                <Switch checked={multi} onChange={setMulti} />
              </Form.Item>
            )}
          </div>
          {multi && !editing ? (
            <div className="dlg-form">
              <Form.Item name="range" label={t('mtg.range')} rules={[{ required: true }]} extra={t('mtg.rangeHint')}>
                <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" allowClear={false}
                  disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.isAfter(dayjs().add(180, 'day'), 'day')} />
              </Form.Item>
              <Form.Item name="skipWeekend" label=" " valuePropName="checked"><Checkbox>{t('mtg.skipWeekend')}</Checkbox></Form.Item>
            </div>
          ) : (
            <Form.Item name="date" label={t('mtg.day')} rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="ddd DD/MM/YYYY" allowClear={false}
                disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.isAfter(dayjs().add(180, 'day'), 'day')} />
            </Form.Item>
          )}
          <div className="dlg-form">
            <Form.Item name="from" label={t('mtg.from')} dependencies={['date', 'range']} rules={[{ required: true }, ({ getFieldValue }) => ({
              validator: (_, v: Dayjs | undefined) => {
                if (!v || !startsToday) return Promise.resolve()
                // Cuộc họp đang diễn ra được sửa khi giữ nguyên giờ bắt đầu gốc (giống quy tắc ở máy chủ)
                const unchanged = !!editing && v.format('HH:mm') === editing.from && (getFieldValue('date') as Dayjs | undefined)?.format(DAY_FMT) === editing.day
                return unchanged || v.hour() * 60 + v.minute() >= nowMinutes - 5 ? Promise.resolve() : Promise.reject(new Error(t('mtg.err.past')))
              },
            })]}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} needConfirm={false} allowClear={false} showNow={false}
                disabledTime={() => timeLimits('from')} />
            </Form.Item>
            <Form.Item name="to" label={t('mtg.to')} dependencies={['from']} rules={[{ required: true }, ({ getFieldValue }) => ({
              validator: (_, v: Dayjs | undefined) => {
                const f: Dayjs | undefined = getFieldValue('from')
                if (!v || !f) return Promise.resolve()
                const a = f.hour() * 60 + f.minute(), b = v.hour() * 60 + v.minute()
                return b > a && b <= CLOSE * 60 ? Promise.resolve() : Promise.reject(new Error(t('mtg.err.time')))
              },
            })]}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} needConfirm={false} allowClear={false} showNow={false}
                disabledTime={() => timeLimits('to')} />
            </Form.Item>
          </div>
          <Form.Item name="title" label={t('mtg.titleCol')} rules={[{ required: true, whitespace: true }, { min: 2 }, { max: 200 }]}>
            <Input maxLength={200} placeholder={t('mtg.titlePh')} />
          </Form.Item>
          <Form.Item name="attendees" label={t('mtg.attendees')} extra={t('mtg.attendeesExtra')}>
            <PeoplePicker initial={editing?.attendees} />
          </Form.Item>
          <Form.Item name="note" label={t('mtg.note')} rules={[{ max: 1000 }]}>
            <Input.TextArea rows={2} maxLength={1000} placeholder={t('mtg.notePh')} />
          </Form.Item>
        </Form>
        {conflicts.length > 0 && (
          <Alert type="error" showIcon title={t('mtg.err.overlap')} description={
            <ul className="mtg-conflicts">{conflicts.map((c) => <li key={c.code}>{fmtDay(c.day)} · {c.from}–{c.to} · {c.title} ({c.userName})</li>)}</ul>
          } />
        )}
      </AppModal>

      <AppModal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title} subtitle={viewing?.roomName} icon={<CalendarOutlined />} size="sm"
        footer={viewing && (editable(viewing) || cancellable(viewing)) ? (
          <Space>
            {editable(viewing) && <Button icon={<EditOutlined />} onClick={() => openEdit(viewing)}>{t('mtg.edit')}</Button>}
            {cancellable(viewing) && <Button danger icon={<StopOutlined />} onClick={() => { setReason(''); setCancelling(viewing) }}>{t('mtg.cancel')}</Button>}
          </Space>
        ) : null}>
        {viewing && (
          <div className="dlg-form">
            <div><div className="cell-muted">{t('mtg.day')}</div><b>{fmtDay(viewing.day)}</b></div>
            <div><div className="cell-muted">{t('mtg.time')}</div><b>{viewing.from} – {viewing.to}</b></div>
            <div><div className="cell-muted">{t('mtg.bookedBy')}</div><b>{viewing.userName}</b></div>
            <div><div className="cell-muted">{t('mtg.code')}</div><b>{viewing.code}</b></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="cell-muted">{t('mtg.attendees')}</div>
              {viewing.attendees.length ? <Space size={[4, 4]} wrap>{viewing.attendees.map((a) => <Tag key={a.userId}>{personLabel(a)}</Tag>)}</Space> : <span className="cell-muted">{t('mtg.noAttendees')}</span>}
            </div>
            {viewing.note && <div style={{ gridColumn: '1 / -1' }}><div className="cell-muted">{t('mtg.note')}</div>{viewing.note}</div>}
          </div>
        )}
      </AppModal>

      <AppModal open={!!cancelling} onClose={() => setCancelling(null)} title={t('mtg.cancelTitle')} subtitle={cancelling && `${cancelling.roomName} · ${fmtDay(cancelling.day)} ${cancelling.from}–${cancelling.to}`}
        icon={<StopOutlined />} size="sm" danger onOk={() => cancelling && cancel.mutate(cancelling)} okText={t('mtg.cancel')} okLoading={cancel.isPending}
        okDisabled={!!cancelling && !cancelling.canCancel && reason.trim().length < 2}>
        <p>{cancelling?.canCancel ? t('mtg.cancelOwn') : t('mtg.cancelOther', { name: cancelling?.userName })}</p>
        {!!cancelling?.attendees.length && <p className="cell-muted">{t('mtg.cancelAttendees', { n: cancelling.attendees.length })}</p>}
        <Input.TextArea rows={2} maxLength={250} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={cancelling?.canCancel ? t('mtg.reasonOptional') : t('mtg.reasonRequired')} />
      </AppModal>
    </div>
  )
}
