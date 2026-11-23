import { useEffect, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Alert, AutoComplete, Avatar, Button, Card, Checkbox, DatePicker, Empty, Input, InputNumber, Popconfirm, Popover, Segmented, Select, Space, Switch, Tabs, Tag, Tooltip, Typography } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import { CarOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, LockOutlined, MoonOutlined, PlusOutlined, SaveOutlined, SunOutlined, UndoOutlined, CaretDownOutlined, CaretRightOutlined, StopOutlined, CopyOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { hyLocked, hyOrders, slotKey, slotsOf, type HyOrder, type HyOrderStatus, type HyOrdersMe, type HySlot } from '../../api/hyOrders'
import { lookups } from '../../api/requests'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { foldText, foldFilter } from '../../utils/search'
import { useDebouncedValue } from '../../hooks/useDebounce'
import { trData } from '../../utils/dataText'

const STATUS_COLOR: Record<HyOrderStatus, string> = { approved: 'green', pending: 'orange', rejected: 'red' }
const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
const counts = (o: HyOrder) => o.status === 'approved' && o.replacesId == null && !o.cancel
/** Tên khung giờ (Sáng 6h15, Chiều 18h, Tăng ca 20h, Ca đêm 18h15, Ca đêm 8h); giờ lạ thì hiện ca + giờ. */
function slotName(t: (k: string, o?: Record<string, unknown>) => string, s: HySlot) {
  return t(`hyo.slotName.${s.shift}_${s.time.replace(':', '')}`, { defaultValue: `${t(`hyo.shift.${s.shift}`)} · ${s.time}` })
}
const cellKey = (dept: string, s: HySlot) => `${dept}\u0001${slotKey(s)}`

function useErrText() {
  const { t } = useTranslation()
  return (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    return t(`hyo.err.${d?.detail ?? d?.title}`, { defaultValue: t('req.err.generic') })
  }
}

/** Nhãn cột: biểu tượng ca + giờ về. */
function SlotTitle({ s }: { s: HySlot }) {
  const { t } = useTranslation()
  return <span style={{ whiteSpace: 'nowrap' }}>{s.shift === 'night' ? <MoonOutlined /> : <SunOutlined />} {slotName(t, s)}</span>
}

/**
 * Lưới đăng ký kiểu Excel: mỗi dòng một bộ phận, mỗi cột một (ca, giờ về), gõ số người rồi bấm Lưu một lần.
 * Chỉ thêm / sửa / xoá đăng ký của chính người dùng; quá giờ khoá thì thành yêu cầu chờ HS duyệt (HS thì không).
 */
function HyGrid({ me, departments, userId }: { me: HyOrdersMe; departments: string[]; userId?: string }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const errText = useErrText()
  const slots = slotsOf(me)
  const [date, setDate] = useState<Dayjs>(dayjs(me.today).add(1, 'day'))
  const [extra, setExtra] = useState<string[]>([])
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [dateTo, setDateTo] = useState<Dayjs | null>(null)   // có = đăng ký cùng số lượng cho cả khoảng ngày date → dateTo (tới hết tháng)
  const [skipSunday, setSkipSunday] = useState(true)
  const excludedQ = useQuery({ queryKey: ['hy-range-excluded'], queryFn: hyOrders.rangeExcluded, retry: false, staleTime: 60_000 })
  const noRangeDept = (dept: string) => (excludedQ.data ?? []).some((x) => same(x, dept))
  const rangeMode = !!dateTo && dateTo.isAfter(date, 'day')
  const days = useMemo(() => {
    if (!dateTo || !dateTo.isAfter(date, 'day')) return [date]
    const out: Dayjs[] = []
    for (let x = date; !x.isAfter(dateTo, 'day'); x = x.add(1, 'day')) if (!(skipSunday && x.day() === 0)) out.push(x)
    return out
  }, [date, dateTo, skipSunday])
  const d = date.format('YYYY-MM-DD')
  const dEnd = (rangeMode ? dateTo! : date).format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['hy-orders', d, dEnd], queryFn: () => hyOrders.list(d, dEnd), retry: false })
  const own = useMemo(() => (q.data ?? []).filter((o) => same(o.registeredBy, userId) && o.replacesId == null && o.status !== 'rejected'), [q.data, userId])
  const changeOf = useMemo(() => new Set((q.data ?? []).filter((o) => o.replacesId != null).map((o) => o.replacesId as number)), [q.data])
  const ordersAt = (dept: string, s: HySlot, day: Dayjs = date) => own.filter((o) => same(o.department, dept) && o.date.slice(0, 10) === day.format('YYYY-MM-DD') && o.shift === s.shift && o.leaveAt === s.time)
  const baseOf = (dept: string, s: HySlot) => ordersAt(dept, s).reduce((n, o) => n + o.qty, 0)
  const valueOf = (dept: string, s: HySlot) => edits[cellKey(dept, s)] ?? baseOf(dept, s)
  const busyReason = (dept: string, s: HySlot) => {
    if (rangeMode && noRangeDept(dept)) return t('mealReg.gridProd')
    const os = ordersAt(dept, s)
    if (os.length > 1) return t('mealReg.gridMulti')
    if (os.some((o) => changeOf.has(o.id))) return t('mealReg.gridChangePending')
    return null
  }
  const rows = useMemo(() => {
    const set = new Set<string>()
    if (me.department) set.add(me.department.trim())
    for (const x of extra) set.add(x)
    for (const o of own) set.add((o.department ?? '').trim())
    const first = (me.department ?? '').trim()
    return [...set].sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)))
  }, [me.department, extra, own])
  const changed = Object.entries(edits).filter(([k, v]) => { const [dept, sk] = k.split('\u0001'); const s = slots.find((x) => slotKey(x) === sk)!; if (rangeMode) return !noRangeDept(dept); return v !== baseOf(dept, s) })
  const locked = hyLocked(me, d)

  const focusCell = (r: number, c: number) => { const el = document.querySelector<HTMLInputElement>(`[data-hy-cell="${r}-${c}"]`); if (el) { el.focus(); el.select() } }
  const onKey = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); focusCell(r + 1, c) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(r - 1, c) }
    else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) { e.preventDefault(); focusCell(r, c + 1) }
    else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) { e.preventDefault(); focusCell(r, c - 1) }
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text')
    if (!/[\t\n]/.test(text.trim())) return
    e.preventDefault()
    setEdits((prev) => {
      const next = { ...prev }
      text.replace(/\r/g, '').split('\n').forEach((line, i) => line.split('\t').forEach((v, j) => {
        const dept = rows[r + i]; const s = slots[c + j]
        if (dept === undefined || !s || busyReason(dept, s)) return
        next[cellKey(dept, s)] = Math.max(0, Math.min(500, Math.round(Number(v.replace(/[^\d.-]/g, '')) || 0)))
      }))
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    let ok = 0, pending = 0
    try {
      for (const day of days) for (const [k, v] of changed) {
        const [dept, sk] = k.split('\u0001')
        const s = slots.find((x) => slotKey(x) === sk)!
        const os = ordersAt(dept, s, day)
        if (os.length > 1 || os.some((o) => changeOf.has(o.id))) continue
        if (os.length === 0) { if (v > 0) { const r = await hyOrders.add({ date: day.format('YYYY-MM-DD'), shift: s.shift, leaveAt: s.time, department: dept || undefined, qty: v }); ok++; if (r.status === 'pending') pending++ } }
        else if (v > 0) { if (os[0].qty === v) continue; const r = await hyOrders.update(os[0].id, { qty: v, leaveAt: s.time, note: os[0].note, department: dept || undefined }); ok++; if (r.status === 'pending') pending++ }
        else { const r = await hyOrders.remove(os[0].id); ok++; if (r.status === 'pending') pending++ }
      }
      if (pending > 0) message.warning(t('mealReg.gridSavedPending', { n: ok, p: pending })); else message.success(t('mealReg.gridSaved', { n: ok }))
      setEdits({})
    } catch (e) { message.error(errText(e)) } finally {
      setSaving(false)
      ;['hy-orders', 'hy-orders-pending'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
    }
  }
  const addDept = (name: string) => { const v = name.trim(); if (v && !rows.some((x) => same(x, v))) setExtra((x) => [...x, v]); setCustom('') }
  const total = (s: HySlot) => rows.reduce((n, dept) => n + valueOf(dept, s), 0)

  return (
    <Card title={t('hyo.gridTitle')} extra={(
      <Space wrap>
        <Button icon={<UndoOutlined />} disabled={!changed.length || saving} onClick={() => setEdits({})}>{t('mealReg.gridDiscard')}</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!changed.length} onClick={save}>{t('mealReg.gridSave', { n: changed.length })}</Button>
      </Space>
    )}>
      <Space wrap size={12} style={{ marginBottom: 12 }}>
        <DatePicker format="DD/MM/YYYY" allowClear={false} value={date} onChange={(v) => { if (v) { setDate(v); if (dateTo && !dateTo.isAfter(v, 'day')) setDateTo(null); setEdits({}) } }}
          prefix={<span className="cell-muted">{t('mealReg.gridFrom')}</span>}
          disabledDate={(x) => x.isAfter(dayjs(me.today).add(30, 'day'), 'day') || x.isBefore(dayjs(me.today).subtract(me.manager ? 30 : 0, 'day'), 'day')} />
        <DatePicker format="DD/MM/YYYY" value={dateTo} placeholder={t('mealReg.gridToPh')} onChange={(v) => { setDateTo(v); setEdits({}) }} prefix={<span className="cell-muted">{t('mealReg.gridTo')}</span>}
          disabledDate={(x) => !x.isAfter(date, 'day') || x.diff(date, 'day') >= 31 || x.isAfter(dayjs(me.today).endOf('month'), 'day')} />
        {rangeMode && <Checkbox checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)}>{t('mealReg.gridSkipSunday')}</Checkbox>}
        <AutoComplete style={{ width: 260 }} value={custom} onChange={setCustom} onSelect={addDept} placeholder={t('mealReg.gridAddDeptPh')}
          options={departments.filter((x) => !rows.some((r) => same(r, x))).map((x) => ({ value: x }))}
          filterOption={foldFilter('value')} />
        <Button icon={<PlusOutlined />} disabled={!custom.trim()} onClick={() => addDept(custom)}>{t('mealReg.gridAddDept')}</Button>
        {locked && <Tag icon={<LockOutlined />} color={me.manager ? 'blue' : 'orange'}>{t(me.manager ? 'hyo.lockedManager' : 'hyo.locked', { hour: me.lockHour })}</Tag>}
      </Space>
      {rangeMode && <Alert style={{ marginBottom: 12 }} type="info" showIcon title={t('mealReg.gridRangeNote', { n: days.length, from: date.format('DD/MM'), to: dateTo!.format('DD/MM') })} />}
      <div className="meal-grid-wrap">
        <table className="meal-grid">
          <thead>
            <tr><th className="mg-dept">{t('meal.dept')}</th>{slots.map((s) => <th key={slotKey(s)}><SlotTitle s={s} /></th>)}<th>{t('meal.total')}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={slots.length + 2} className="mg-empty">{q.isLoading ? '…' : t('mealReg.gridEmpty')}</td></tr>}
            {rows.map((dept, r) => (
              <tr key={dept || '—'}>
                <td className="mg-dept">{dept || '—'}</td>
                {slots.map((s, c) => {
                  const busy = busyReason(dept, s)
                  const v = valueOf(dept, s)
                  const dirty = edits[cellKey(dept, s)] !== undefined && edits[cellKey(dept, s)] !== baseOf(dept, s)
                  const st = ordersAt(dept, s)[0]?.status
                  return (
                    <td key={slotKey(s)} className={`mg-cell${dirty ? ' dirty' : ''}${busy ? ' busy' : ''}`}>
                      <Tooltip title={busy ?? undefined}>
                        <input data-hy-cell={`${r}-${c}`} type="text" inputMode="numeric" disabled={!!busy || saving} value={v === 0 ? '' : String(v)} placeholder="0"
                          onChange={(e) => setEdits((x) => ({ ...x, [cellKey(dept, s)]: Math.max(0, Math.min(500, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)) }))}
                          onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => onKey(e, r, c)} onPaste={(e) => onPaste(e, r, c)} />
                      </Tooltip>
                      {!dirty && st === 'pending' && <Tag color="orange" className="mg-tag">{t('mealReg.status.pending')}</Tag>}
                    </td>
                  )
                })}
                <td className="mg-total">{slots.reduce((n, s) => n + valueOf(dept, s), 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td className="mg-dept">{t('mealReg.gridTotal')}</td>{slots.map((s) => <td key={slotKey(s)} className="mg-total">{total(s)}</td>)}<td className="mg-total">{slots.reduce((n, s) => n + total(s), 0)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="cell-muted" style={{ marginTop: 8 }}>{t('hyo.gridHint')}</div>
    </Card>
  )
}

/**
 * Bảng tổng hợp một ngày (như bảng gửi tổng vụ): dòng = khung giờ, cột = bộ phận có đăng ký, tổng tự cộng, cột xe.
 * Số người = đăng ký đã tính (đã duyệt). HS / quản trị nhập xe; người khác chỉ xem.
 * Cột bộ phận lấy từ chính dữ liệu đăng ký và xếp theo HyOrders:DepartmentOrder, nên đổi sang node ERP chỉ cần đổi tên bộ phận / danh sách này.
 */
function HySummary({ me }: { me: HyOrdersMe }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const errText = useErrText()
  const slots = slotsOf(me)
  const [date, setDate] = useState<Dayjs>(dayjs(me.today).add(1, 'day'))
  const d = date.format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['hy-orders', d, d], queryFn: () => hyOrders.list(d, d), retry: false })
  const vq = useQuery({ queryKey: ['hy-vehicles', d], queryFn: () => hyOrders.vehicles(d), retry: false })
  const [draft, setDraft] = useState<Record<string, string>>({})
  useEffect(() => setDraft({}), [d])
  const orders = q.data ?? []
  const counted = orders.filter(counts)
  const pendingOf = (dept: string, s: HySlot) => orders.filter((o) => o.status === 'pending' && o.replacesId == null && !o.cancel && same(o.department || '—', dept) && o.shift === s.shift && o.leaveAt === s.time).reduce((n, o) => n + o.qty, 0)
  const depts = useMemo(() => {
    const names = new Map<string, string>()
    for (const o of orders) if (o.status !== 'rejected' && o.replacesId == null && !o.cancel) { const n = (o.department ?? '').trim() || '—'; names.set(n.toLowerCase(), names.get(n.toLowerCase()) ?? n) }
    const order = me.departmentOrder.map((x) => x.trim().toLowerCase())
    const rank = (n: string) => { const i = order.indexOf(n.toLowerCase()); return i < 0 ? order.length : i }
    return [...names.values()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  }, [orders, me.departmentOrder])
  const qtyAt = (dept: string, s: HySlot) => counted.filter((o) => same(o.department || '—', dept) && o.shift === s.shift && o.leaveAt === s.time).reduce((n, o) => n + o.qty, 0)
  const slotTotal = (s: HySlot) => depts.reduce((n, x) => n + qtyAt(x, s), 0)
  const vehicleOf = (s: HySlot) => (vq.data ?? []).find((v) => v.shift === s.shift && v.leaveAt === s.time)?.text ?? ''
  const save = useMutation({
    mutationFn: (v: { s: HySlot; text: string }) => hyOrders.setVehicle({ date: d, shift: v.s.shift, leaveAt: v.s.time, text: v.text }),
    onSuccess: () => { message.success(t('mealReg.saved')); qc.invalidateQueries({ queryKey: ['hy-vehicles'] }) },
    onError: (e) => message.error(errText(e)),
  })
  const commit = (s: HySlot) => {
    const k = slotKey(s)
    const text = (draft[k] ?? vehicleOf(s)).trim()
    if (draft[k] === undefined || text === vehicleOf(s)) return
    save.mutate({ s, text })
  }
  const copy = async () => {
    const rows = [['', ...depts, t('meal.total'), t('hyo.vehicle')], ...slots.map((s) => [slotName(t, s), ...depts.map((x) => String(qtyAt(x, s) || '')), String(slotTotal(s)), vehicleOf(s)])]
    try { await navigator.clipboard.writeText(rows.map((r) => r.join('\t')).join('\n')); message.success(t('hyo.copied')) } catch { message.error(t('req.err.generic')) }
  }
  const manager = me.manager
  return (
    <Card style={{ marginTop: 16 }} title={t('hyo.sumTitle')} extra={<Button icon={<CopyOutlined />} onClick={copy} disabled={depts.length === 0}>{t('hyo.copy')}</Button>}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<LeftOutlined />} onClick={() => setDate(date.subtract(1, 'day'))} />
        <DatePicker format="DD/MM/YYYY" allowClear={false} value={date} onChange={(v) => v && setDate(v)} />
        <Button icon={<RightOutlined />} onClick={() => setDate(date.add(1, 'day'))} />
      </Space>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{date.format('D/M/YYYY')}</div>
      {q.isLoading ? <Card loading size="small" /> : depts.length === 0 ? <Empty description={t('hyo.sumEmpty')} /> : (
        <div className="meal-grid-wrap">
          <table className="meal-grid">
            <thead><tr><th className="mg-dept">{t('hyo.slot')}</th>{depts.map((x) => <th key={x}>{x}</th>)}<th>{t('meal.total')}</th><th style={{ minWidth: 160 }}>{t('hyo.vehicle')}</th></tr></thead>
            <tbody>
              {slots.map((s) => (
                <tr key={slotKey(s)}>
                  <td className="mg-dept"><SlotTitle s={s} /></td>
                  {depts.map((x) => {
                    const n = qtyAt(x, s), p = pendingOf(x, s)
                    return <td key={x} style={{ textAlign: 'center', padding: '6px 10px' }}>{n || ''}{p > 0 && <Tooltip title={t('mealReg.pendingN', { n: p })}><Tag color="orange" style={{ marginLeft: 4 }}>+{p}</Tag></Tooltip>}</td>
                  })}
                  <td className="mg-total">{slotTotal(s)}</td>
                  <td style={{ background: 'rgba(132, 204, 22, 0.22)', padding: manager ? 0 : '6px 10px' }}>
                    {manager
                      ? <input style={{ width: '100%', border: 0, background: 'transparent', padding: '6px 10px', font: 'inherit' }} maxLength={100} disabled={save.isPending} value={draft[slotKey(s)] ?? vehicleOf(s)}
                          placeholder={t('hyo.vehiclePh')} onChange={(e) => setDraft((x) => ({ ...x, [slotKey(s)]: e.target.value }))} onBlur={() => commit(s)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                      : vehicleOf(s)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="cell-muted" style={{ marginTop: 8 }}>{t(manager ? 'hyo.sumHintManager' : 'hyo.sumHint')}</div>
    </Card>
  )
}

/** Tab cấu hình (bộ phận quản lý): bộ phận CHỈ đăng ký từng ngày, thêm tay như màn suất ăn. Mặc định mọi bộ phận đăng ký được theo khoảng ngày (tới hết tháng). */
function HyRangeRules({ departments }: { departments: string[] }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['hy-range-excluded'], queryFn: hyOrders.rangeExcluded, retry: false })
  const saved = useMemo(() => q.data ?? [], [q.data])
  const [val, setVal] = useState<string[]>([])
  useEffect(() => { setVal(saved) }, [saved])
  const dirty = val.length !== saved.length || val.some((v) => !saved.includes(v))
  const save = useMutation({ mutationFn: () => hyOrders.setRangeExcluded(val), onSuccess: () => { message.success(t('mealReg.rulesSaved')); qc.invalidateQueries({ queryKey: ['hy-range-excluded'] }) }, onError: () => message.error(t('req.err.generic')) })
  return (
    <Card title={t('hy.rangeRulesTitle')} extra={<Button type="primary" icon={<SaveOutlined />} loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>{t('hy.rangeRulesSave')}</Button>}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert type="info" showIcon title={t('hy.rangeRulesHint')} />
        <Select mode="tags" style={{ width: '100%' }} value={val} onChange={(v) => setVal(v.map((x) => x.trim()).filter(Boolean))} placeholder={t('mealReg.rulesPh')}
          options={departments.map((d) => ({ value: d, label: d }))} tokenSeparators={[';']} maxTagTextLength={60} />
        {val.length > 0 && <Space wrap>{val.map((d) => <Tag key={d}>{d}</Tag>)}</Space>}
      </Space>
    </Card>
  )
}

interface Line { key: string; day: string; dept: string; cells: Record<string, HyOrder[]> }

/** Đăng ký số lượng người đi Hưng Yên theo bộ phận để xếp xe (giống đăng ký suất ăn). */
export default function HyOrdersPage() {
  const { t, i18n } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const errText = useErrText()
  const { user } = useAuth()
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const [daysShown, setDaysShown] = useState(7)
  const [tab, setTab] = useState('register')
  const me = useQuery({ queryKey: ['hy-orders-me'], queryFn: hyOrders.me, retry: false })
  const can = !!me.data?.canRegister
  const manager = !!me.data?.manager
  const depts = useQuery({ queryKey: ['lookup-departments'], queryFn: lookups.departments, enabled: can, staleTime: 600_000 })
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs().add(1, 'day')])
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const list = useQuery({ queryKey: ['hy-orders', from, to], queryFn: () => hyOrders.list(from, to), enabled: can, retry: false })
  const pending = useQuery({ queryKey: ['hy-orders-pending'], queryFn: hyOrders.pending, enabled: manager, retry: false })
  const [status, setStatus] = useState<'active' | HyOrderStatus>('active')
  const [search, setSearch] = useState('')
  const dSearch = useDebouncedValue(search)   // gõ xong mới lọc, không lọc lại sau mỗi phím
  const [onlyMine, setOnlyMine] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [rejecting, setRejecting] = useState<number[]>()
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState<HyOrder>()
  const [eQty, setEQty] = useState(1)
  const [eLeave, setELeave] = useState('')
  const [eNote, setENote] = useState('')

  const refresh = () => ['hy-orders', 'hy-orders-pending'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
  const update = useMutation({
    mutationFn: () => hyOrders.update(editing!.id, { qty: eQty, leaveAt: eLeave, note: eNote.trim() || null }),
    onSuccess: (r) => { if (r.status === 'pending' && editing?.status === 'approved') message.warning(t('mealReg.savedPending')); else message.success(t('mealReg.saved')); setEditing(undefined); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => hyOrders.remove(id),
    onSuccess: (r) => { if (r.status === 'pending') message.warning(t('mealReg.deletedPending')); else message.success(t('mealReg.deleted')); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const decide = useMutation({
    mutationFn: (v: { ids: number[]; approve: boolean; reason?: string }) => hyOrders.decide(v.ids, v.approve, v.reason),
    onSuccess: (r) => { message.success(t('meal.decided', { n: r.done })); setPicked([]); setRejecting(undefined); setReason(''); refresh() },
    onError: (e) => message.error(errText(e)),
  })

  const banner = <PageBanner avatar={<Avatar size={56} icon={<CarOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.hyOrders')} subtitle={t('nav.hyOrdersDesc')} />
  if (me.isLoading) return <div className="page" />
  if (!can || !me.data) return <div className="page">{banner}<Alert type="info" showIcon title={t('hyo.noAccess')} /></div>
  if (list.isError && axios.isAxiosError(list.error) && list.error.response?.status === 503) return <div className="page">{banner}<Alert type="warning" showIcon title={t('hyo.tableMissing')} /></div>

  const m = me.data
  const slots = slotsOf(m)
  const mine = (o: HyOrder) => same(o.registeredBy, user?.userId)
  const asRequest = (o: HyOrder) => !manager && o.status === 'approved' && o.replacesId == null && hyLocked(m, o.date)
  const canEdit = (o: HyOrder) => !o.cancel && (manager || (mine(o) && o.status !== 'rejected'))
  const canDelete = (o: HyOrder) => manager || (mine(o) && (o.status !== 'rejected' || o.replacesId == null))
  const rows = list.data ?? []
  const q = foldText(dSearch.trim())
  const shown = rows.filter((o) => (status === 'active' ? o.status !== 'rejected' : o.status === status)
    && (!q || foldText(o.department ?? '').includes(q) || foldText(o.registeredByName ?? o.registeredBy).includes(q))
    && (!onlyMine || mine(o)))
  const qty = (l: HyOrder[]) => l.filter(counts).reduce((n, o) => n + o.qty, 0)
  const lines: Line[] = (() => {
    const map = new Map<string, Line>()
    for (const o of shown) {
      const dept = (o.department ?? '').trim() || '—'
      const key = `${o.date.slice(0, 10)}\u0001${dept.toLowerCase()}`
      let l = map.get(key)
      if (!l) { l = { key, day: o.date.slice(0, 10), dept, cells: {} }; map.set(key, l) }
      const k = `${o.shift}|${o.leaveAt}`
      ;(l.cells[k] ??= []).push(o)
    }
    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day) || a.dept.localeCompare(b.dept))
  })()
  const statusTag = (o: HyOrder) => (
    <Space size={4} wrap>
      <Tooltip title={o.rejectReason ? t('mealReg.reason', { r: o.rejectReason }) : undefined}><Tag color={STATUS_COLOR[o.status]}>{t(`mealReg.status.${o.status}`)}</Tag></Tooltip>
      {o.replacesId != null && <Tag color={o.cancel ? 'red' : 'blue'}>{t(o.cancel ? 'mealReg.kindCancel' : 'mealReg.kindEdit', { id: o.replacesId })}</Tag>}
      {o.late && o.replacesId == null && <Tag>{t('mealReg.late')}</Tag>}
    </Space>
  )
  const openEdit = (o: HyOrder) => { setEQty(o.qty); setELeave(o.leaveAt); setENote(o.note ?? ''); setEditing(o) }
  const cell = (l: Line, s: HySlot) => {
    const list = l.cells[slotKey(s)] ?? []
    if (list.length === 0) return <span className="cell-muted">·</span>
    const n = qty(list)
    const pend = list.filter((o) => o.status === 'pending').length
    return (
      <Popover trigger="click" title={`${slotName(t, s)} · ${l.dept}`} content={(
        <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
          {list.map((o) => (
            <div key={o.id} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <b style={o.cancel ? { textDecoration: 'line-through' } : undefined}>{o.qty}</b> <span className="cell-muted">· {o.registeredByName || o.registeredBy} · {dayjs(o.createdAt).format('HH:mm DD/MM')}</span>
                <div>{statusTag(o)}</div>
                {o.note && <div className="cell-muted" style={{ fontSize: 12 }}>{o.note}</div>}
              </div>
              <Space size={4}>
                {canEdit(o) && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(o)} />}
                {canDelete(o) && (
                  <Popconfirm title={t(asRequest(o) ? 'mealReg.cancelAsk' : 'mealReg.deleteAsk')} okText={t(asRequest(o) ? 'mealReg.cancelOk' : 'req.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(o.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}>
        <button type="button" className="mb-cell"><b>{n}</b>{pend > 0 && <Tag color="orange" className="mb-tag">{t('mealReg.pendingN', { n: pend })}</Tag>}</button>
      </Popover>
    )
  }
  const sumSlot = (s: HySlot) => qty(shown.filter((o) => o.shift === s.shift && o.leaveAt === s.time))
  const dayTotal = qty(shown.filter((o) => o.shift === 'day'))
  const nightTotal = qty(shown.filter((o) => o.shift === 'night'))

  const SLOT_COLOR = (sl: HySlot) => (sl.shift === 'night' ? '#6D5BD0' : '#F59E0B')
  const heatMax = Object.fromEntries(slots.map((sl) => [slotKey(sl), Math.max(0, ...lines.map((l) => qty(l.cells[slotKey(sl)] ?? [])))])) as Record<string, number>
  const todayStr = dayjs(m.today).format('YYYY-MM-DD')
  /** Bảng theo ngày giống màn suất ăn: dải ngày có tổng từng khung giờ, dòng bộ phận, ô tô đậm theo số người, dòng tổng cuối bảng. */
  const HyBoard = () => {
    const groups = new Map<string, Line[]>()
    for (const l of lines) { const a = groups.get(l.day); if (a) a.push(l); else groups.set(l.day, [l]) }
    const dayList = [...groups.keys()]
    const limit = daysShown
    const cols = `minmax(200px,1.8fr) repeat(${slots.length}, minmax(110px,1fr)) 84px`
    const style = { ['--mb2-cols' as string]: cols } as React.CSSProperties
    return (
      <div className="mb2-wrap">
        <div className="mb2" style={{ ...style, minWidth: 200 + slots.length * 110 + 84 }}>
          <div className="mb2-row mb2-head" style={style}>
            <div>{t('meal.dept')}</div>
            {slots.map((sl) => <div key={slotKey(sl)} className="mb2-num"><i className="mb-dot" style={{ background: SLOT_COLOR(sl) }} /><SlotTitle s={sl} /></div>)}
            <div className="mb2-num">{t('meal.total')}</div>
          </div>
          {dayList.slice(0, limit).map((d) => {
            const ls = groups.get(d)!
            const isF = folded.has(d)
            const dayOrders = ls.flatMap((l) => Object.values(l.cells).flat())
            const dayPend = dayOrders.filter((o) => o.status === 'pending').length
            return (
              <div key={d} className="mb2-day">
                <button type="button" className={`mb2-row mb2-dayhead${d === todayStr ? ' today' : ''}`} style={style} aria-expanded={!isF}
                  onClick={() => setFolded((f) => { const n = new Set(f); if (n.has(d)) n.delete(d); else n.add(d); return n })}>
                  <div className="mb2-dayname">
                    {isF ? <CaretRightOutlined /> : <CaretDownOutlined />}
                    <b>{dayjs(d).format('DD/MM')}</b><span>{new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'long' })}</span>
                    {d === todayStr && <Tag color="green" className="mb-tag">{t('mealReg.today')}</Tag>}
                    <small>{t('mealReg.deptN', { n: ls.length })}</small>
                    {dayPend > 0 && <Tag color="orange" className="mb-tag">{t('mealReg.pendingN', { n: dayPend })}</Tag>}
                  </div>
                  {slots.map((sl) => { const v = qty(dayOrders.filter((o) => o.shift === sl.shift && o.leaveAt === sl.time)); return <div key={slotKey(sl)} className="mb2-num">{v > 0 ? v : <span className="cell-muted">·</span>}</div> })}
                  <div className="mb2-num mb2-tot">{qty(dayOrders)}</div>
                </button>
                {!isF && ls.map((l) => (
                  <div key={l.key} className="mb2-row mb2-line" style={style}>
                    <div className="mb2-dept" title={l.dept}>{trData(l.dept)}</div>
                    {slots.map((sl) => {
                      const n = qty(l.cells[slotKey(sl)] ?? [])
                      return <div key={slotKey(sl)} className="mb2-num mb2-c" style={n > 0 ? { background: `color-mix(in srgb, var(--c-primary) ${Math.round(5 + 17 * (heatMax[slotKey(sl)] > 0 ? n / heatMax[slotKey(sl)] : 0))}%, transparent)` } : undefined}>{cell(l, sl)}</div>
                    })}
                    <div className="mb2-num mb2-tot">{qty(Object.values(l.cells).flat())}</div>
                  </div>
                ))}
              </div>
            )
          })}
          <div className="mb2-row mb2-foot" style={style}>
            <div>{t('mealReg.sumRow')}</div>
            {slots.map((sl) => <div key={slotKey(sl)} className="mb2-num">{sumSlot(sl)}</div>)}
            <div className="mb2-num mb2-tot">{dayTotal + nightTotal}</div>
          </div>
        </div>
        {dayList.length > limit && <div className="mb2-more"><Button size="small" onClick={() => setDaysShown(limit + 7)}>{t('mealReg.moreDays', { n: dayList.length - limit })}</Button></div>}
      </div>
    )
  }

  const registerTab = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('hyo.note', { hour: m.lockHour })} />
      <HyGrid me={m} departments={depts.data ?? []} userId={user?.userId} />
      {m.manager && <HySummary me={m} />}

      {manager && (pending.data?.length ?? 0) > 0 && (
        <Card size="small" style={{ marginTop: 16, borderColor: '#F59E0B' }}
          title={<span>{t('meal.pendingTitle')} <Tag color="orange">{pending.data?.length}</Tag></span>}
          extra={(
            <Space size={6}>
              <Button size="small" type="primary" icon={<CheckOutlined />} disabled={!picked.length} loading={decide.isPending && decide.variables?.approve} onClick={() => decide.mutate({ ids: picked, approve: true })}>{t('meal.approveSel', { n: picked.length })}</Button>
              <Button size="small" danger icon={<CloseOutlined />} disabled={!picked.length} onClick={() => setRejecting(picked)}>{t('meal.rejectSel', { n: picked.length })}</Button>
            </Space>
          )}>
          <Table<HyOrder> size="small" rowKey="id" pagination={false} dataSource={pending.data} scroll={{ x: 'max-content' }} rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]) }}
            columns={[
              { title: t('hyo.date'), dataIndex: 'date', render: (v: string) => dayjs(v).format('DD/MM') },
              { title: t('meal.dept'), dataIndex: 'department' },
              { title: t('hyo.slot'), render: (_: unknown, o) => <SlotTitle s={{ shift: o.shift, time: o.leaveAt }} /> },
              { title: t('hyo.qty'), dataIndex: 'qty', align: 'right' },
              { title: t('meal.registeredBy'), render: (_: unknown, o) => o.registeredByName || o.registeredBy },
              { title: '', render: (_: unknown, o) => statusTag(o) },
              { title: '', width: 90, render: (_: unknown, o) => (
                <Space size={4}>
                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => decide.mutate({ ids: [o.id], approve: true })} />
                  <Button size="small" danger icon={<CloseOutlined />} onClick={() => setRejecting([o.id])} />
                </Space>
              ) },
            ]} />
        </Card>
      )}

      <Card style={{ marginTop: 16 }} title={<Typography.Title level={5} style={{ margin: 0 }}>{t('hyo.listTitle')}</Typography.Title>}
        extra={<DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} disabledDate={(x, info) => !!info?.from && Math.abs(x.diff(info.from, 'day')) > 92} />}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Segmented value={status} onChange={(v) => setStatus(v as 'active' | HyOrderStatus)} options={[
            { value: 'active', label: t('mealReg.fActive') }, { value: 'approved', label: t('mealReg.status.approved') },
            { value: 'pending', label: t('mealReg.status.pending') }, { value: 'rejected', label: t('mealReg.status.rejected') },
          ]} />
          <Input.Search allowClear placeholder={t('mealReg.fSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
          <Space size={6}><Switch size="small" checked={onlyMine} onChange={setOnlyMine} /><span>{t('mealReg.fMine')}</span></Space>
        </Space>
        <StatTiles items={[
          { label: t('hyo.sTotal'), value: dayTotal + nightTotal, color: '#0F172A' },
          { label: t('hyo.shift.day'), value: dayTotal, color: '#F59E0B' },
          { label: t('hyo.shift.night'), value: nightTotal, color: '#4F46E5' },
          ...slots.map((s) => ({ label: slotName(t, s), value: sumSlot(s) })),
          { label: t('mealReg.sPending'), value: shown.filter((o) => o.status === 'pending').length, color: shown.some((o) => o.status === 'pending') ? '#D97706' : undefined },
        ]} />
        {list.isLoading ? <Card loading size="small" /> : lines.length === 0 ? <Empty description={t('hyo.empty')} /> : <HyBoard />}
      </Card>
    </>
  )

  return (
    <div className="page wide">
      {banner}
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'register', icon: <EditOutlined />, label: t('hy.tabRegister'), children: registerTab },
        ...(manager ? [{ key: 'rules', icon: <StopOutlined />, label: t('hy.tabRules'), children: <HyRangeRules departments={depts.data ?? []} /> }] : []),
      ]} />

      <AppModal open={!!rejecting} onClose={() => setRejecting(undefined)} size="sm" icon={<CloseOutlined />} title={t('meal.rejectSel', { n: rejecting?.length ?? 0 })}
        onOk={() => rejecting && decide.mutate({ ids: rejecting, approve: false, reason: reason.trim() || undefined })} okText={t('meal.reject')} okLoading={decide.isPending}>
        <Input.TextArea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('meal.rejectReason')} />
      </AppModal>

      <AppModal open={!!editing} onClose={() => setEditing(undefined)} size="sm" icon={<EditOutlined />} title={t('hyo.editTitle')}
        subtitle={editing ? `${editing.department ?? ''} · ${dayjs(editing.date).format('DD/MM/YYYY')} · ${t(`hyo.shift.${editing.shift}`)}` : ''}
        onOk={() => update.mutate()} okText={t('meal.addOk')} okLoading={update.isPending}>
        {editing && asRequest(editing) && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('hyo.editLate', { hour: m.lockHour })} />}
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <div><div className="cell-muted">{t('hyo.qty')}</div><InputNumber min={1} max={500} precision={0} value={eQty} onChange={(v) => setEQty(Number(v) || 1)} style={{ width: '100%' }} /></div>
          <div><div className="cell-muted">{t('hyo.slot')}</div>
            <Select style={{ width: '100%' }} value={eLeave} onChange={setELeave} options={(editing?.shift === 'night' ? m.nightTimes : m.dayTimes).map((x) => ({ value: x, label: slotName(t, { shift: editing?.shift ?? 'day', time: x }) }))} /></div>
          <div><div className="cell-muted">{t('meal.noteCol')}</div><Input maxLength={300} value={eNote} onChange={(e) => setENote(e.target.value)} /></div>
        </Space>
      </AppModal>
    </div>
  )
}
