import { useMemo, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Alert, AutoComplete, Button, Card, Checkbox, DatePicker, Select, Space, Tag, Tooltip } from 'antd'
import { LockOutlined, PlusOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { MEAL_ORDER_CODES, MEAL_SITES, mealLocked, mealRegister, type MealCode, type MealRegisterMe, type MealSite } from '../../api/meals'
import { useToast } from '../../hooks/useToast'

const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
/** Mặc định (khi chưa cấu hình danh sách): bộ phận sản xuất, nhận biết theo tên. */
export const isProductionName = (dept: string) => /production|sản xuất|san xuat/i.test(dept)
const MAX_RANGE_DAYS = 31
const cellKey = (dept: string, meal: MealCode) => `${dept}\u0001${meal}`

/**
 * Đăng ký suất ăn dạng lưới giống Excel: mỗi dòng một bộ phận, mỗi cột một bữa, chỉ cần gõ số lượng rồi bấm Lưu một lần.
 * Phím mũi tên / Enter di chuyển giữa các ô, dán nhiều ô từ Excel được. Lưu = thêm / sửa / xoá các đăng ký của chính người dùng theo từng ô thay đổi
 * (sau giờ khoá thì thành yêu cầu chờ nhân sự duyệt, như đăng ký lẻ).
 */
export function MealGrid({ me, approver, departments, userId, excluded }: { me: MealRegisterMe; approver: boolean; departments: string[]; userId?: string; excluded?: string[] }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [date, setDate] = useState<Dayjs>(dayjs())
  const [site, setSite] = useState<MealSite>(me.defaultSite)
  const [extra, setExtra] = useState<string[]>([])
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [custom, setCustom] = useState('')
  const [dateTo, setDateTo] = useState<Dayjs | null>(null)   // có = đăng ký cùng số lượng cho cả khoảng ngày date → dateTo
  const [skipSunday, setSkipSunday] = useState(true)
  const [saving, setSaving] = useState(false)
  /** Bộ phận không đăng ký theo khoảng ngày: danh sách do người duyệt cấu hình; chưa cấu hình thì dùng mặc định theo tên (sản xuất). */
  const isProduction = (dept: string) => (excluded && excluded.length ? excluded.some((x) => same(x, dept)) : isProductionName(dept))

  // Bữa sáng của ngày đăng ký D là bữa sáng ngày D+1 (khoá cùng lúc 9h ngày D), nên lấy dữ liệu hai ngày D và D+1.
  const mealDate = (m: MealCode, day: Dayjs = date) => (m === 'breakfast' ? day.add(1, 'day') : day).format('YYYY-MM-DD')
  const rangeMode = !!dateTo && dateTo.isAfter(date, 'day')
  /** Các ngày được đăng ký: một ngày, hoặc cả khoảng (bỏ Chủ nhật nếu tick). */
  const days = useMemo(() => {
    if (!dateTo || !dateTo.isAfter(date, 'day')) return [date]
    const out: Dayjs[] = []
    for (let d = date; !d.isAfter(dateTo, 'day'); d = d.add(1, 'day')) if (!(skipSunday && d.day() === 0)) out.push(d)
    return out
  }, [date, dateTo, skipSunday])
  const d0 = date.format('YYYY-MM-DD')
  const d1 = (dateTo && dateTo.isAfter(date, 'day') ? dateTo : date).add(1, 'day').format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['meal-reg', d0, d1], queryFn: () => mealRegister.list(d0, d1), retry: false })

  /** Đăng ký của chính người dùng (đã tính hoặc chờ duyệt, không tính dòng xin sửa / huỷ). */
  const own = useMemo(() => (q.data ?? []).filter((o) => o.site === site && same(o.registeredBy, userId) && o.replacesId == null && o.status !== 'rejected'), [q.data, site, userId])
  const changeOf = useMemo(() => new Set((q.data ?? []).filter((o) => o.replacesId != null).map((o) => o.replacesId as number)), [q.data])
  const ordersAt = (dept: string, meal: MealCode, day: Dayjs = date) => own.filter((o) => same(o.department, dept) && o.date.slice(0, 10) === mealDate(meal, day) && o.meal === meal)
  const baseOf = (dept: string, meal: MealCode) => ordersAt(dept, meal).reduce((n, o) => n + o.qty, 0)
  /** Ô chỉ sửa được khi có tối đa một đăng ký và chưa có yêu cầu sửa / huỷ đang chờ duyệt. */
  const busyReason = (dept: string, meal: MealCode) => {
    if (rangeMode && isProduction(dept)) return t('mealReg.gridProd')
    const os = ordersAt(dept, meal)
    if (os.length > 1) return t('mealReg.gridMulti')
    if (os.some((o) => changeOf.has(o.id))) return t('mealReg.gridChangePending')
    return null
  }
  const valueOf = (dept: string, meal: MealCode) => edits[cellKey(dept, meal)] ?? baseOf(dept, meal)

  const rows = useMemo(() => {
    const set = new Set<string>()
    if (me.department) set.add(me.department.trim())
    for (const d of extra) set.add(d)
    for (const o of own) set.add((o.department ?? '').trim())
    const first = (me.department ?? '').trim()
    return [...set].sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)))
  }, [me.department, extra, own])

  // Khoảng ngày: mọi ô đã gõ đều được áp cho các ngày (kể cả khi bằng số của ngày đầu); một ngày: chỉ ô khác số đã lưu.
  const changed = Object.entries(edits).filter(([k, v]) => { const [dept, meal] = k.split('\u0001'); if (rangeMode) return !isProduction(dept); return v !== baseOf(dept, meal as MealCode) })
  const reset = () => setEdits({})
  const setCell = (dept: string, meal: MealCode, v: number) => setEdits((e) => ({ ...e, [cellKey(dept, meal)]: v }))
  const total = (meal: MealCode) => rows.reduce((n, d) => n + valueOf(d, meal), 0)

  const focusCell = (r: number, c: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-meal-cell="${r}-${c}"]`)
    if (el) { el.focus(); el.select() }
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); focusCell(r + 1, c) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(r - 1, c) }
    else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) { e.preventDefault(); focusCell(r, c + 1) }
    else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) { e.preventDefault(); focusCell(r, c - 1) }
  }
  /** Dán từ Excel: nhiều ô (tab / xuống dòng) điền lần lượt từ ô đang đứng; ô bị khoá thì bỏ qua. */
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text')
    if (!/[\t\n]/.test(text.trim())) return
    e.preventDefault()
    const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1)
    setEdits((prev) => {
      const next = { ...prev }
      lines.forEach((line, i) => line.split('\t').forEach((v, j) => {
        const dept = rows[r + i]; const meal = MEAL_ORDER_CODES[c + j]
        if (dept === undefined || !meal || busyReason(dept, meal)) return
        const n = Math.max(0, Math.min(2000, Math.round(Number(v.replace(/[^\d.-]/g, '')) || 0)))
        next[cellKey(dept, meal)] = n
      }))
      return next
    })
  }

  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    return t(`mealReg.err.${d?.detail ?? d?.title}`, { defaultValue: t('req.err.generic') })
  }
  const save = async () => {
    setSaving(true)
    let ok = 0, pending = 0, skipped = 0
    try {
      for (const day of days) {
        for (const [k, v] of changed) {
          const [dept, meal] = k.split('\u0001') as [string, MealCode]
          const os = ordersAt(dept, meal, day)
          if (os.length > 1 || os.some((o) => changeOf.has(o.id))) { skipped++; continue }
          if (os.length === 0) {
            if (v > 0) { const r = await mealRegister.add({ date: mealDate(meal, day), meal, site, department: dept || undefined, qty: v }); ok++; if (r.status === 'pending') pending++ }
          } else if (v > 0) {
            if (os[0].qty === v) continue
            const r = await mealRegister.update(os[0].id, { qty: v, department: dept || undefined, note: os[0].note }); ok++; if (r.status === 'pending') pending++
          } else {
            const r = await mealRegister.remove(os[0].id); ok++; if (r.status === 'pending') pending++
          }
        }
      }
      if (pending > 0) message.warning(t('mealReg.gridSavedPending', { n: ok, p: pending })); else message.success(t('mealReg.gridSaved', { n: ok }))
      if (skipped > 0) message.info(t('mealReg.gridSkipped', { n: skipped }))
      setEdits({})
    } catch (e) {
      message.error(errText(e))
    } finally {
      setSaving(false)
      ;['meal-reg', 'meals-pending', 'meals'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
    }
  }

  const addDept = (name: string) => {
    const v = name.trim()
    if (!v) return
    if (!rows.some((d) => same(d, v))) setExtra((x) => [...x, v])
    setCustom('')
  }
  const options = departments.filter((d) => !rows.some((r) => same(r, d))).map((d) => ({ value: d }))
  const lockedAny = MEAL_ORDER_CODES.some((m) => mealLocked(me, mealDate(m), m))

  return (
    <Card title={t('mealReg.gridTitle')} extra={(
      <Space wrap>
        <Button icon={<UndoOutlined />} disabled={!changed.length || saving} onClick={reset}>{t('mealReg.gridDiscard')}</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!changed.length} onClick={save}>{t('mealReg.gridSave', { n: changed.length })}</Button>
      </Space>
    )}>
      <Space wrap size={12} style={{ marginBottom: 12 }}>
        <DatePicker format="DD/MM/YYYY" allowClear={false} value={date} onChange={(v) => { if (v) { setDate(v); if (dateTo && !dateTo.isAfter(v, 'day')) setDateTo(null); reset() } }}
          prefix={<span className="cell-muted">{t('mealReg.gridFrom')}</span>}
          disabledDate={(d) => d.isAfter(dayjs().add(29, 'day'), 'day') || d.isBefore(approver ? dayjs().subtract(30, 'day') : dayjs(), 'day')} />
        <DatePicker format="DD/MM/YYYY" value={dateTo} placeholder={t('mealReg.gridToPh')} onChange={(v) => { setDateTo(v); reset() }}
          prefix={<span className="cell-muted">{t('mealReg.gridTo')}</span>}
          disabledDate={(d) => !d.isAfter(date, 'day') || d.diff(date, 'day') >= MAX_RANGE_DAYS || d.isAfter(dayjs().add(29, 'day'), 'day')} />
        {rangeMode && <Checkbox checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)}>{t('mealReg.gridSkipSunday')}</Checkbox>}
        <Select style={{ width: 160 }} value={site} onChange={(v) => { setSite(v); reset() }} options={MEAL_SITES.map((s) => ({ value: s, label: t(`meal.siteName.${s}`) }))} />
        <AutoComplete style={{ width: 260 }} value={custom} options={options} onChange={setCustom} onSelect={addDept} placeholder={t('mealReg.gridAddDeptPh')}
          filterOption={(input, o) => (o?.value ?? '').toLowerCase().includes(input.toLowerCase())} />
        <Button icon={<PlusOutlined />} disabled={!custom.trim()} onClick={() => addDept(custom)}>{t('mealReg.gridAddDept')}</Button>
      </Space>
      {rangeMode && <Alert style={{ marginBottom: 12 }} type="info" showIcon title={t('mealReg.gridRangeNote', { n: days.length, from: date.format('DD/MM'), to: dateTo!.format('DD/MM') })} />}
      <div className="meal-grid-wrap">
        <table className="meal-grid">
          <thead>
            <tr>
              <th className="mg-dept">{t('meal.dept')}</th>
              {MEAL_ORDER_CODES.map((m) => {
                const locked = mealLocked(me, mealDate(m), m)
                return (
                  <th key={m}>
                    {t(`meal.code.${m}`)}
                    {m === 'breakfast' && <span className="cell-muted"> {date.add(1, 'day').format('DD/MM')}</span>}
                    {locked && <Tooltip title={t(approver ? 'mealReg.lateApprover' : 'mealReg.lateWarn', { time: me.lockTime })}><LockOutlined style={{ marginLeft: 6 }} /></Tooltip>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={MEAL_ORDER_CODES.length + 1} className="mg-empty">{q.isLoading ? '…' : t('mealReg.gridEmpty')}</td></tr>}
            {rows.map((dept, r) => (
              <tr key={dept || '—'}>
                <td className="mg-dept">{dept || '—'}{rangeMode && isProduction(dept) && <Tag className="mg-prod">{t('mealReg.gridProdTag')}</Tag>}</td>
                {MEAL_ORDER_CODES.map((m, c) => {
                  const busy = busyReason(dept, m)
                  const v = valueOf(dept, m)
                  const dirty = edits[cellKey(dept, m)] !== undefined && edits[cellKey(dept, m)] !== baseOf(dept, m)
                  const st = ordersAt(dept, m)[0]?.status
                  return (
                    <td key={m} className={`mg-cell${dirty ? ' dirty' : ''}${busy ? ' busy' : ''}`}>
                      <Tooltip title={busy ?? undefined}>
                        <input data-meal-cell={`${r}-${c}`} type="text" inputMode="numeric" disabled={!!busy || saving} value={v === 0 ? '' : String(v)} placeholder="0"
                          onChange={(e) => setCell(dept, m, Math.max(0, Math.min(2000, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)))}
                          onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => onKey(e, r, c)} onPaste={(e) => onPaste(e, r, c)} />
                      </Tooltip>
                      {!dirty && st === 'pending' && <Tag color="orange" className="mg-tag">{t('mealReg.status.pending')}</Tag>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="mg-dept">{t('mealReg.gridTotal')}</td>
              {MEAL_ORDER_CODES.map((m) => <td key={m} className="mg-total">{total(m)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="cell-muted" style={{ marginTop: 8 }}>{t('mealReg.gridHint')}</div>
      {lockedAny && <Alert style={{ marginTop: 12 }} type={approver ? 'info' : 'warning'} showIcon title={t(approver ? 'mealReg.lateApprover' : 'mealReg.lateWarn', { time: me.lockTime })} />}
    </Card>
  )
}
