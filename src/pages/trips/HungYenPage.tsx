import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Checkbox, DatePicker, Input, Popconfirm, Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CarOutlined, CheckCircleFilled, CheckOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, HistoryOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { TRIP_TABLE_SQL, trips, type TripCandidate, type TripEntry, type TripMe, type TripShift } from '../../api/trips'
import { adminError } from '../../api/userAdmin'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/** Giờ rời Hưng Yên có thể chọn: 07:00 → 23:30, mỗi 15 phút (người không đi xe công ty theo lịch). */
const LEAVE_TIMES = Array.from({ length: 67 }, (_, i) => { const m = 7 * 60 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })

/** Ca đêm: giờ rời Hưng Yên sáng hôm sau, 03:00 → 11:30 mỗi 15 phút. */
const NIGHT_LEAVE_TIMES = Array.from({ length: 35 }, (_, i) => { const m = 3 * 60 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })

/** Danh sách của ngày D khóa lúc lockHour giờ ngày D-1 (giờ máy khách ≈ giờ Việt Nam; máy chủ kiểm tra lại). Nhân sự không bị khóa. */
export const isLocked = (me: TripMe, d: Dayjs) => !me.all && !dayjs().isBefore(d.startOf('day').subtract(1, 'day').hour(me.lockHour))

/** Danh sách có ô tick để chọn người: tìm theo tên / mã, chọn tất cả những dòng đang hiện. */
export function PeoplePicker({ people, picked, onChange, loading, notes, lockedIds }: { people: TripCandidate[]; picked: string[]; onChange: (ids: string[]) => void; loading?: boolean; notes?: Record<string, string>; lockedIds?: string[] }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const isLockedId = (k: string) => !!lockedIds?.includes(k)
  const items = people.map((p) => ({ key: p.employeeId, title: `${p.name} · ${p.employeeId}`, note: notes?.[p.employeeId] }))
  const shown = items.filter((i) => i.title.toLowerCase().includes(search.trim().toLowerCase()))
  const allShown = shown.length > 0 && shown.every((i) => picked.includes(i.key))
  const someShown = shown.some((i) => picked.includes(i.key))
  const toggle = (key: string, on: boolean) => { if (!on && isLockedId(key)) return; onChange(on ? [...picked, key] : picked.filter((k) => k !== key)) }
  const toggleAll = (on: boolean) => onChange(on ? [...new Set([...picked, ...shown.map((i) => i.key)])] : picked.filter((k) => isLockedId(k) || !shown.some((i) => i.key === k)))
  return (
    <>
      <Input.Search allowClear value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('hy.search')} style={{ marginBottom: 8 }} />
      <div className="trip-pick">
        <div className="trip-pick-head">
          <Checkbox checked={allShown} indeterminate={someShown && !allShown} disabled={!shown.length} onChange={(e) => toggleAll(e.target.checked)}>{t('hy.selectAll')}</Checkbox>
          <b>{t('hy.selectedN', { n: picked.length })}</b>
        </div>
        <div className="trip-pick-list">
          {loading ? <div className="cell-muted" style={{ padding: 12 }}>…</div> : shown.length === 0 ? <div className="cell-muted" style={{ padding: 12 }}>{t('hy.noneFound')}</div> : shown.map((i) => (
            <label key={i.key} className={`trip-pick-row${picked.includes(i.key) ? ' on' : ''}`}>
              <Checkbox checked={picked.includes(i.key)} disabled={isLockedId(i.key)} onChange={(e) => toggle(i.key, e.target.checked)} />
              <span>{i.title}</span>
              {i.note && <Tag variant="filled" color="blue">{i.note}</Tag>}
              {isLockedId(i.key) && <Tag variant="filled">{t('hy.byOthers')}</Tag>}
            </label>
          ))}
        </div>
      </div>
    </>
  )
}

/** Chọn ca đi: hai thẻ lớn "Ca ngày" / "Ca đêm" (xe chạy theo ca), thẻ đang chọn nổi bật, kèm số người đã đăng ký ở mỗi ca (nếu có). */
function ShiftField({ value, onChange, counts }: { value: TripShift; onChange: (v: TripShift) => void; counts?: Partial<Record<TripShift, number>> }) {
  const { t } = useTranslation()
  const cards: { key: TripShift; icon: JSX.Element }[] = [{ key: 'day', icon: <SunOutlined /> }, { key: 'night', icon: <MoonOutlined /> }]
  return (
    <div className="shift-pick" role="radiogroup" aria-label={t('hy.shiftCol')}>
      {cards.map((c) => (
        <button key={c.key} type="button" role="radio" aria-checked={value === c.key} className={`shift-card ${c.key}${value === c.key ? ' on' : ''}`} onClick={() => onChange(c.key)}>
          <span className="shift-ico">{c.icon}</span>
          <span className="shift-txt">
            <b>{t(`hy.shift.${c.key}`)}</b>
            <small>{counts?.[c.key] ? t('hy.shiftCount', { n: counts[c.key] }) : t(`hy.shiftHint.${c.key}`)}</small>
          </span>
          {value === c.key && <CheckCircleFilled className="shift-check" />}
        </button>
      ))}
    </div>
  )
}

/** Khung chọn bộ phận dùng chung cho hai modal: người phụ trách một bộ phận thì chỉ hiện tên, nhiều bộ phận (hoặc nhân sự) thì có ô chọn. */
export function useDepartments(me: Pick<TripMe, 'all' | 'departments'>, open: boolean) {
  const people = useQuery({ queryKey: ['trip-candidates'], queryFn: trips.candidates, enabled: open, retry: false, staleTime: 30_000 })
  const departments = useMemo(() => (me.all
    ? [...new Set((people.data ?? []).map((p) => (p.department ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    : me.departments), [me.all, me.departments, people.data])
  return { people, departments }
}

export function DeptField({ departments, value, onChange, loading }: { departments: string[]; value?: string; onChange: (v: string) => void; loading?: boolean }) {
  const { t } = useTranslation()
  if (departments.length > 1) return <Select style={{ minWidth: 260 }} showSearch value={value} onChange={onChange} placeholder={t('hy.pickDept')} options={departments.map((d) => ({ value: d, label: d }))} loading={loading} />
  return departments.length === 1 ? <div className="cell-muted">{t('hy.dept')}: <b>{departments[0]}</b></div> : null
}

/**
 * Giờ về (rời Hưng Yên) của từng người, dùng chung cho đăng ký và đăng ký bù. Không bắt buộc: để trống = đi xe công ty theo lịch.
 * Nhiều người cùng giờ thì chọn giờ một lần rồi áp cho cả danh sách thay vì chọn từng người.
 */
function LeaveTimesPanel({ picked, names, shift, day, leave, setLeave, lockedIds = [] }: {
  picked: string[]; names: Record<string, string>; shift: TripShift; day: Dayjs; leave: Record<string, string>; setLeave: (f: (m: Record<string, string>) => Record<string, string>) => void; lockedIds?: string[]
}) {
  const { t } = useTranslation()
  const [bulk, setBulk] = useState<string>()
  const times = shift === 'night' ? NIGHT_LEAVE_TIMES : LEAVE_TIMES
  // Xe công ty theo lịch của ngày đang chọn (ca ngày: chiều tối hôm đó; ca đêm: sáng hôm sau).
  const quick = useMemo(() => { const wd = day.day() >= 1 && day.day() <= 4; return shift === 'night' ? (wd ? ['06:00', '08:00'] : ['05:00', '07:00']) : (wd ? ['18:00', '20:00'] : ['17:00', '19:00']) }, [day, shift])
  const apply = (time: string | undefined, onlyEmpty: boolean) => setLeave((m) => {
    const n = { ...m }
    for (const id of picked) { if (lockedIds.includes(id)) continue; if (onlyEmpty && n[id]) continue; if (time) n[id] = time; else delete n[id] }
    return n
  })
  const set = (id: string, v?: string) => setLeave((m) => { const n = { ...m }; if (v) n[id] = v; else delete n[id]; return n })
  const filled = picked.filter((id) => leave[id]).length
  return (
    <div className="hy-leave">
      <div className="hl-head">
        <b>{t('hy.leaveTitle')}</b>
        <Tag>{t('hy.leaveOptional')}</Tag>
        {filled > 0 && <Tag color="green">{t('hy.leaveFilled', { n: filled })}</Tag>}
      </div>
      <div className="hl-hint">{t(shift === 'night' ? 'hy.leaveHintNightShort' : 'hy.leaveHintDay')}</div>
      <div className="hl-bulk">
        <span className="hl-lbl">{t('hy.leaveQuick')}</span>
        <Space wrap size={6}>
          {quick.map((x) => <Button key={x} size="small" type={bulk === x ? 'primary' : 'default'} onClick={() => setBulk(x)}>{x}</Button>)}
          <Select size="small" showSearch allowClear style={{ width: 120 }} placeholder={t('hy.leaveOther')} value={bulk && !quick.includes(bulk) ? bulk : undefined} options={times.map((x) => ({ value: x, label: x }))} onChange={(v) => setBulk(v)} />
        </Space>
        <Space wrap size={6} className="hl-acts">
          <Button size="small" type="primary" disabled={!bulk} onClick={() => apply(bulk, false)}>{t('hy.leaveApplyAll')}</Button>
          <Button size="small" disabled={!bulk} onClick={() => apply(bulk, true)}>{t('hy.leaveApplyEmpty')}</Button>
          <Button size="small" danger disabled={filled === 0} onClick={() => apply(undefined, false)}>{t('hy.leaveClearAll')}</Button>
        </Space>
      </div>
      <div className="hl-list">
        {picked.map((id) => (
          <div key={id} className="hl-row">
            <span className="hl-name">{names[id] ?? id}<span className="hl-id"> · {id}</span></span>
            <Select size="small" allowClear showSearch style={{ width: 130 }} placeholder={t('hy.leaveCompany')} disabled={lockedIds.includes(id)}
              value={leave[id] || undefined} options={times.map((x) => ({ value: x, label: x }))} onChange={(v: string | undefined) => set(id, v)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Modal đăng ký: chọn ngày (mặc định ngày hôm sau), bộ phận và những người đi; lưu là thay cả danh sách của bộ phận trong ngày đó. */
type Preset = { date: Dayjs; dept?: string; shift: TripShift } | null

function RegisterModal({ open, onClose, me, onSaved, preset }: { open: boolean; onClose: () => void; me: TripMe; onSaved: (d: Dayjs) => void; preset?: Preset }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  // Ngày mặc định = ngày hôm sau; người duyệt đã quá giờ khóa thì lấy ngày kế tiếp còn mở
  const tomorrow = useMemo(() => { let d = dayjs(me.today).add(1, 'day'); while (isLocked(me, d)) d = d.add(1, 'day'); return d }, [me])
  const [day, setDay] = useState<Dayjs>(tomorrow)
  const [dept, setDept] = useState<string>()
  const [shift, setShift] = useState<TripShift>('day')
  const [picked, setPicked] = useState<string[]>([])
  const date = day.format('YYYY-MM-DD')

  // Mở để đăng ký mới: ngày đi mặc định là ngày hôm sau, ca ngày. Mở để sửa một danh sách đã đăng ký: giữ đúng ngày / bộ phận / ca của danh sách đó.
  useEffect(() => { if (open) { setDay(preset?.date ?? tomorrow); setDept(preset?.dept); setShift(preset?.shift ?? 'day') } }, [open, tomorrow, preset])

  const { people, departments } = useDepartments(me, open)
  const list = useQuery({ queryKey: ['trip-list', date], queryFn: () => trips.list(date), enabled: open, retry: false })
  const current = dept ?? departments[0]
  const registered = useMemo(() => (list.data ?? []).filter((r) => same(r.department, current) && r.shift === shift).map((r) => r.employeeId), [list.data, current, shift])
  const shiftCounts = useMemo(() => {
    const mine = (list.data ?? []).filter((r) => same(r.department, current))
    return { day: mine.filter((r) => r.shift !== 'night').length, night: mine.filter((r) => r.shift === 'night').length }
  }, [list.data, current])
  // Người đã đăng ký ở ca kia trong ngày: chỉ ghi chú (một người được đi cả hai ca, nhưng không đăng ký trùng cùng ca cùng ngày).
  const otherShift = useMemo(() => Object.fromEntries((list.data ?? []).filter((r) => r.shift !== shift).map((r) => [r.employeeId, t('hy.alsoIn', { shift: t(`hy.shift.${r.shift}`) })])), [list.data, shift, t])
  // Danh sách đang soạn bắt đầu từ danh sách đã lưu của bộ phận trong ngày đang chọn.
  useEffect(() => { setPicked(registered) }, [registered])

  const dept_people = (people.data ?? []).filter((p) => same(p.department, current))
  const { user } = useAuth()
  // Người do người khác đăng ký: người duyệt không bỏ được (nhân sự thì bỏ được tất cả)
  const lockedIds = useMemo(() => (me.all ? [] : (list.data ?? []).filter((r) => same(r.department, current) && r.shift === shift && !same(r.registeredBy, user?.userId)).map((r) => r.employeeId)), [me.all, list.data, current, shift, user?.userId])
  const dayLocked = isLocked(me, day)
  // Giờ về (rời Hưng Yên) từng người: bắt đầu từ giờ đã lưu; chỉ ca ngày. Rỗng = đi xe công ty theo lịch.
  const savedLeave = useMemo(() => Object.fromEntries((list.data ?? []).filter((r) => same(r.department, current) && r.shift === shift && r.leaveAt).map((r) => [r.employeeId, r.leaveAt as string])), [list.data, current, shift])
  const [leave, setLeave] = useState<Record<string, string>>({})
  useEffect(() => { setLeave(savedLeave) }, [savedLeave])
  const leaveChanges = useMemo(() => {
    const out: Record<string, string> = {}
    for (const id of picked) if ((leave[id] ?? '') !== (savedLeave[id] ?? '')) out[id] = leave[id] ?? ''
    return out
  }, [leave, savedLeave, picked])
  const dirty = picked.length !== registered.length || picked.some((id) => !registered.includes(id)) || Object.keys(leaveChanges).length > 0
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`hy.err.${code === 'table_missing' ? 'table_missing' : detail}`, { hour: 19, defaultValue: t('usr.err.generic') }) }

  const save = useMutation({
    mutationFn: () => trips.saveList(date, current!, picked, shift, leaveChanges),
    onSuccess: (r) => { msg.success(t('hy.saved', { added: r.added, removed: r.removed })); qc.invalidateQueries({ queryKey: ['trip-list'] }); onSaved(day); onClose() },
    onError: (e) => msg.error(errText(e)),
  })

  const minDate = dayjs(me.today).subtract(me.all ? 30 : 0, 'day')
  return (
    <AppModal open={open} onClose={onClose} size="md" icon={<CarOutlined />} title={t('hy.modalTitle')} subtitle={t('hy.rule')}
      okText={t('hy.saveList', { n: picked.length })} okLoading={save.isPending} okDisabled={!current || !dirty || dayLocked} onOk={() => save.mutate()}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap size={12}>
          <DatePicker value={day} allowClear={false} format="DD/MM/YYYY" onChange={(v) => v && setDay(v)} prefix={<span className="cell-muted">{t('hy.date')}</span>}
            disabledDate={(x) => x.isBefore(minDate, 'day') || x.isAfter(dayjs(me.today).add(60, 'day'), 'day') || isLocked(me, x)} />
          <DeptField departments={departments} value={current} onChange={setDept} loading={people.isLoading} />
        </Space>
        <ShiftField value={shift} onChange={setShift} counts={shiftCounts} />
        <PeoplePicker people={dept_people} picked={picked} onChange={setPicked} loading={people.isLoading || list.isLoading} notes={otherShift} lockedIds={lockedIds} />
        {picked.length > 0 && <LeaveTimesPanel picked={picked} names={Object.fromEntries(dept_people.map((p) => [p.employeeId, p.name]))} shift={shift} day={day} leave={leave} setLeave={setLeave} lockedIds={lockedIds} />}
        {picked.length === 0 && registered.length > 0 && <Alert type="warning" showIcon message={t('hy.clearWarn')} />}
        {registered.length > 0 && dirty && picked.length > 0 && <Alert type="info" showIcon message={t('hy.replaceNote', { n: registered.length })} />}
        {!me.all && <Alert type="info" showIcon message={t('hy.lockNote', { hour: me.lockHour })} />}
        {!me.all && <div className="cell-muted">{t('hy.lateHint')}</div>}
      </Space>
    </AppModal>
  )
}

/** Modal đăng ký bù: quên đăng ký mà người đó vẫn đi (ngày đã qua, tối đa 7 ngày). Người duyệt gửi kèm lý do, nhân sự xác nhận; nhân sự đăng ký bù thì có hiệu lực ngay. */
function LateModal({ open, onClose, me }: { open: boolean; onClose: () => void; me: TripMe }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const yesterday = useMemo(() => dayjs(me.today).subtract(1, 'day'), [me.today])
  const [day, setDay] = useState<Dayjs>(yesterday)
  const [dept, setDept] = useState<string>()
  const [shift, setShift] = useState<TripShift>('day')
  const [picked, setPicked] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [leave, setLeave] = useState<Record<string, string>>({})
  const date = day.format('YYYY-MM-DD')

  useEffect(() => { if (open) { setDay(yesterday); setDept(undefined); setShift('day'); setPicked([]); setReason(''); setLeave({}) } }, [open, yesterday])

  const { people, departments } = useDepartments(me, open)
  const list = useQuery({ queryKey: ['trip-list', date], queryFn: () => trips.list(date), enabled: open, retry: false })
  const current = dept ?? departments[0]
  const already = new Set((list.data ?? []).filter((r) => r.shift === shift).map((r) => r.employeeId.toLowerCase()))   // cùng ca cùng ngày thì không đăng ký bù lại
  const candidates = (people.data ?? []).filter((p) => same(p.department, current) && !already.has(p.employeeId.toLowerCase()))
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`hy.err.${code === 'table_missing' ? 'table_missing' : detail}`, { hour: 19, defaultValue: t('usr.err.generic') }) }

  const submit = useMutation({
    mutationFn: () => trips.submitLate(date, current!, picked, reason, shift, Object.fromEntries(Object.entries(leave).filter(([id]) => picked.includes(id)))),
    onSuccess: (r) => {
      msg.success(t(r.pending ? 'hy.lateSent' : 'hy.lateDone', { n: r.added, skipped: r.skipped }))
      qc.invalidateQueries({ queryKey: ['trip-list'] }); qc.invalidateQueries({ queryKey: ['trip-pending'] }); onClose()
    },
    onError: (e) => msg.error(errText(e)),
  })

  return (
    <AppModal open={open} onClose={onClose} size="md" icon={<HistoryOutlined />} title={t('hy.lateTitle')} subtitle={t(me.all ? 'hy.lateSubAdmin' : 'hy.lateSub')}
      okText={t(me.all ? 'hy.lateDoNow' : 'hy.lateSend', { n: picked.length })} okLoading={submit.isPending} okDisabled={!current || picked.length === 0 || reason.trim().length < 5} onOk={() => submit.mutate()}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap size={12}>
          <DatePicker value={day} allowClear={false} format="DD/MM/YYYY" onChange={(v) => v && setDay(v)} prefix={<span className="cell-muted">{t('hy.date')}</span>}
            disabledDate={(x) => !x.isBefore(dayjs(me.today), 'day') || x.isBefore(dayjs(me.today).subtract(7, 'day'), 'day')} />
          <DeptField departments={departments} value={current} onChange={(v) => { setDept(v); setPicked([]) }} loading={people.isLoading} />
        </Space>
        <ShiftField value={shift} onChange={setShift} />
        <PeoplePicker people={candidates} picked={picked} onChange={setPicked} loading={people.isLoading || list.isLoading} />
        {picked.length > 0 && <LeaveTimesPanel picked={picked} names={Object.fromEntries(candidates.map((p) => [p.employeeId, p.name]))} shift={shift} day={day} leave={leave} setLeave={setLeave} />}
        <div>
          <div className="cell-muted" style={{ marginBottom: 4 }}>{t('hy.reason')}</div>
          <Input.TextArea rows={3} maxLength={300} showCount value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('hy.reasonPh')} />
        </div>
      </Space>
    </AppModal>
  )
}

/** Từ chối đăng ký bù: nhân sự nhập lý do (không bắt buộc), người đăng ký nhận thông báo. */
function RejectModal({ open, onClose, ids, onDone }: { open: boolean; onClose: () => void; ids: number[]; onDone: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])
  const reject = useMutation({
    mutationFn: () => trips.rejectLate(ids, reason),
    onSuccess: (r) => { msg.success(t('hy.rejected', { n: r.count })); onDone(); onClose() },
    onError: () => msg.error(t('usr.err.generic')),
  })
  return (
    <AppModal open={open} onClose={onClose} size="sm" danger icon={<CloseOutlined />} title={t('hy.rejectTitle', { n: ids.length })} okText={t('hy.reject')} okLoading={reject.isPending} onOk={() => reject.mutate()}>
      <div className="cell-muted" style={{ marginBottom: 4 }}>{t('hy.rejectReason')}</div>
      <Input.TextArea rows={3} maxLength={300} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
    </AppModal>
  )
}

/** Đăng ký bù đang chờ: nhân sự chọn dòng rồi xác nhận / từ chối; người đăng ký thấy trạng thái và rút lại được đăng ký của mình. */
function PendingCard({ me }: { me: TripMe }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [sel, setSel] = useState<number[]>([])
  const [rejecting, setRejecting] = useState(false)
  const q = useQuery({ queryKey: ['trip-pending'], queryFn: trips.pending, retry: false, refetchInterval: 60_000 })
  const rows = useMemo(() => q.data ?? [], [q.data])
  const refresh = () => { setSel([]); qc.invalidateQueries({ queryKey: ['trip-pending'] }); qc.invalidateQueries({ queryKey: ['trip-list'] }) }
  const confirm = useMutation({ mutationFn: () => trips.confirmLate(sel), onSuccess: (r) => { msg.success(t('hy.confirmed', { n: r.count })); refresh() }, onError: () => msg.error(t('usr.err.generic')) })
  const cancel = useMutation({ mutationFn: (id: number) => trips.cancelLate(id), onSuccess: refresh, onError: () => msg.error(t('usr.err.generic')) })
  // Chỉ giữ những dòng còn tồn tại trong lựa chọn (sau khi tải lại).
  const valid = sel.filter((id) => rows.some((r) => r.id === id))
  if (rows.length === 0) return null

  const columns: ColumnsType<TripEntry> = [
    { title: t('hy.date'), dataIndex: 'date', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('hy.dept'), dataIndex: 'department', width: 200, render: (v: string | null) => v ?? '' },
    { title: t('hy.shiftCol'), dataIndex: 'shift', width: 100, render: (v: TripShift) => <Tag color={v === 'night' ? 'geekblue' : 'orange'} variant="filled">{t(`hy.shift.${v}`)}</Tag> },
    { title: t('hy.employee'), render: (_: unknown, r) => <span><b>{r.employeeName}</b><span className="cell-muted"> · {r.employeeId}</span></span> },
    { title: t('hy.by'), render: (_: unknown, r) => r.registeredByName ?? r.registeredBy, width: 160 },
    { title: t('hy.reason'), dataIndex: 'reason', render: (v: string | null) => v ?? '' },
    {
      title: '', width: 90, align: 'right',
      render: (_: unknown, r) => (me.all || r.registeredBy === user?.userId) && (
        <Popconfirm title={t('hy.cancelAsk', { name: r.employeeName })} okText={t('hy.cancelDo')} cancelText={t('req.cancel')} onConfirm={() => cancel.mutate(r.id)}>
          <Button size="small" danger loading={cancel.isPending && cancel.variables === r.id}>{t('hy.cancelDo')}</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <Card size="small" style={{ marginBottom: 16 }} title={<Space><Tag color="gold" variant="filled">{rows.length}</Tag>{t(me.all ? 'hy.pendingTitleHr' : 'hy.pendingTitle')}</Space>}
      extra={me.all && (
        <Space>
          <Button type="primary" icon={<CheckOutlined />} disabled={!valid.length} loading={confirm.isPending} onClick={() => confirm.mutate()}>{t('hy.confirmSel', { n: valid.length })}</Button>
          <Button danger icon={<CloseOutlined />} disabled={!valid.length} onClick={() => setRejecting(true)}>{t('hy.rejectSel', { n: valid.length })}</Button>
        </Space>
      )}>
      <DataTable<TripEntry>
        rowKey="id" columns={columns} dataSource={rows} pagination={{ pageSize: 10, showSizeChanger: false }} loading={q.isLoading}
        rowSelection={me.all ? { selectedRowKeys: valid, onChange: (keys) => setSel(keys as number[]) } : undefined} />
      <RejectModal open={rejecting} onClose={() => setRejecting(false)} ids={valid} onDone={refresh} />
    </Card>
  )
}

/**
 * Đăng ký người đi Hưng Yên: mỗi bộ phận nộp MỘT danh sách cho mỗi ngày (mở modal để đăng ký; lưu là thay cả danh sách).
 * Quên đăng ký mà vẫn đi thì đăng ký bù (có nhân sự xác nhận). Trưởng bộ phận / người duyệt lưu cho bộ phận mình phụ trách; nhân sự thấy và lưu cho mọi bộ phận.
 */
export default function HungYenPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [day, setDay] = useState<Dayjs>(dayjs())
  const [modal, setModal] = useState(false)
  const [preset, setPreset] = useState<Preset>(null)
  const [lateModal, setLateModal] = useState(false)
  const date = day.format('YYYY-MM-DD')

  const me = useQuery({ queryKey: ['trip-me'], queryFn: trips.me, retry: false })
  const enabled = !!me.data?.canRegister && me.data.ready
  const list = useQuery({ queryKey: ['trip-list', date], queryFn: () => trips.list(date), enabled, retry: false })
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`hy.err.${code === 'table_missing' ? 'table_missing' : detail}`, { hour: 19, defaultValue: t('usr.err.generic') }) }
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().add(1, 'day'), dayjs().add(1, 'day')])   // mặc định: danh sách ngày mai
  const exporting = useMutation({ mutationFn: () => trips.exportRange(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')), onError: (e) => msg.error(errText(e)) })

  const refreshList = () => qc.invalidateQueries({ queryKey: ['trip-list'] })
  const setLeave = useMutation({ mutationFn: (v: { id: number; time: string | null }) => trips.setLeave(v.id, v.time), onSuccess: refreshList, onError: (e) => msg.error(errText(e)) })
  const removeRow = useMutation({ mutationFn: (id: number) => trips.remove(id), onSuccess: refreshList, onError: (e) => msg.error(errText(e)) })
  const rows = useMemo(() => list.data ?? [], [list.data])
  // Sửa / bỏ được từ hôm nay trở đi (nhân sự: cả 30 ngày trước).
  const canEdit = !!me.data && !day.isBefore(dayjs(me.data.today).subtract(me.data.all ? 30 : 0, 'day'), 'day') && !isLocked(me.data, day)
  // Người duyệt chỉ sửa / bỏ được người do chính mình đăng ký; nhân sự sửa tất cả
  // Giờ về: người duyệt còn sửa được tới 3 ngày sau ngày đi (không bị khóa 19h); nhân sự sửa mọi lúc
  const canEditLeave = (r: TripEntry) => !!me.data && (me.data.all || (same(r.registeredBy, user?.userId) && !dayjs(r.date).isBefore(dayjs(me.data.today).subtract(3, 'day'), 'day')))
  const canTouch = (r: TripEntry) => canEdit && (!!me.data?.all || same(r.registeredBy, user?.userId))
  const byDept = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) { const k = (r.department ?? '—').trim() || '—'; m.set(k, (m.get(k) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const columns: ColumnsType<TripEntry> = [
    { title: t('hy.dept'), dataIndex: 'department', width: 240, render: (v: string | null) => v ?? '' },
    { title: t('hy.shiftCol'), dataIndex: 'shift', width: 110, render: (v: TripShift) => <Tag color={v === 'night' ? 'geekblue' : 'orange'} variant="filled">{t(`hy.shift.${v}`)}</Tag> },
    { title: t('hy.employee'), render: (_: unknown, r) => <Space size={6}><span><b>{r.employeeName}</b><span className="cell-muted"> · {r.employeeId}</span></span>{r.late && <Tag color="gold" variant="filled">{t('hy.lateTag')}</Tag>}</Space> },
    { title: t('hy.by'), render: (_: unknown, r) => r.registeredByName ?? r.registeredBy },
    {
      title: <span title={t('hy.leaveAtHint')}>{t('hy.leaveAt')}</span>, width: 150,
      render: (_: unknown, r) => {
        if (!canEditLeave(r)) return r.leaveAt ?? <span className="cell-muted">{t('hy.leaveBus')}</span>
        return <Select size="small" allowClear showSearch style={{ width: 120 }} placeholder={t('hy.leaveBus')} value={r.leaveAt ?? undefined} loading={setLeave.isPending && setLeave.variables?.id === r.id}
          options={(r.shift === 'night' ? NIGHT_LEAVE_TIMES : LEAVE_TIMES).map((x) => ({ value: x, label: x }))} onChange={(v: string | undefined) => setLeave.mutate({ id: r.id, time: v ?? null })} />
      },
    },
    {
      title: '', width: 110, align: 'right',
      render: (_: unknown, r) => !canTouch(r) ? null : (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} aria-label={t('hy.editRow')} title={t('hy.editRow')} onClick={() => { setPreset({ date: day, dept: r.department ?? undefined, shift: r.shift }); setModal(true) }} />
          <Popconfirm title={t('hy.removeAsk', { name: r.employeeName })} okText={t('hy.remove')} cancelText={t('req.cancel')} onConfirm={() => removeRow.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('hy.remove')} loading={removeRow.isPending && removeRow.variables === r.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const banner = <PageBanner avatar={<Avatar size={56} icon={<CarOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.hungYenTrips')} subtitle={t('nav.hungYenTripsDesc')} />

  if (me.isLoading) return <div className="page wide">{banner}</div>
  if (me.data && !me.data.ready) return <div className="page wide">{banner}<SqlNotReady title={t('hy.notReady')} sql={TRIP_TABLE_SQL} onRetry={() => me.refetch()} loading={me.isFetching} /></div>
  if (!me.data?.canRegister) return <div className="page wide">{banner}<Alert type="info" showIcon message={me.isError ? t('usr.err.generic') : t('hy.noRight')} /></div>

  return (
    <div className="page wide">
      {banner}
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('hy.reportNote')} />
      <PendingCard me={me.data} />
      <StatTiles items={[
        { label: t('hy.tilePeople'), value: rows.length },
        { label: t('hy.tileDepts'), value: byDept.length },
        { label: t('hy.shift.day'), value: rows.filter((r) => r.shift !== 'night').length },
        { label: t('hy.shift.night'), value: rows.filter((r) => r.shift === 'night').length },
      ]} />
      {byDept.length > 0 && <Space wrap style={{ margin: '4px 0 12px' }}>{byDept.map(([d, n]) => <Tag key={d} variant="filled">{d}: {n}</Tag>)}</Space>}
      {me.data.all && <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <b>{t('hy.exportTitle')}</b>
          <DatePicker.RangePicker value={range} allowClear={false} format="DD/MM/YYYY" onChange={(v) => v?.[0] && v[1] && setRange([v[0], v[1]])} />
          <Button icon={<DownloadOutlined />} loading={exporting.isPending} onClick={() => exporting.mutate()}>{t('hy.exportExcel')}</Button>
          <span className="cell-muted">{t('hy.exportHint')}</span>
        </Space>
      </Card>}
      <DataTable<TripEntry>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 25, showSizeChanger: false }}
        locale={{ emptyText: list.isError ? t('usr.err.generic') : t('hy.empty') }}
        toolbar={(
          <Space wrap>
            <DatePicker value={day} allowClear={false} format="DD/MM/YYYY" onChange={(v) => v && setDay(v)} />
            <Button type="primary" icon={<EditOutlined />} onClick={() => { setPreset(null); setModal(true) }}>{t('hy.register')}</Button>
            <Button icon={<HistoryOutlined />} onClick={() => setLateModal(true)}>{t('hy.registerLate')}</Button>
          </Space>
        )}
      />
      <RegisterModal open={modal} onClose={() => setModal(false)} me={me.data} onSaved={setDay} preset={preset} />
      <LateModal open={lateModal} onClose={() => setLateModal(false)} me={me.data} />
    </div>
  )
}
