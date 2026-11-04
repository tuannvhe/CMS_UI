import { useEffect, useState } from 'react'
import { Badge, Button, DatePicker, Divider, InputNumber, Popover, Segmented, Select, Space, Switch, Tag } from 'antd'
import { CloseOutlined, FilterOutlined, SaveOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { EDU_LEVELS, normFactory, type EduLevel, type RecruitApplication } from '../../api/recruit'
import { useToast } from '../../hooks/useToast'

/** Bộ lọc tổng hợp của màn Quản lý CV (ngoài ô tìm). Trạng thái lọc ở máy chủ, các điều kiện khác lọc ngay trên danh sách đã tải. */
export interface RecFilter {
  /** Nhóm trạng thái (khoá trong RECRUIT_FILTERS); trống = tất cả. */
  status?: string
  positions?: string[]; departments?: string[]; factories?: string[]; levels?: string[]; education?: EduLevel[]
  expMin?: number | null; expMax?: number | null; ageMin?: number | null; ageMax?: number | null
  hasCv?: 'yes' | 'no'; recommendation?: string[]; scoreMin?: number | null; from?: string; to?: string
  /** CV đang chờ bộ phận / BGK cho ý kiến (trạng thái "Chờ bộ phận đánh giá"). */
  pendingReview?: boolean
}

const has = (xs?: unknown[]) => !!xs && xs.length > 0
const num = (v: number | null | undefined): v is number => typeof v === 'number' && !Number.isNaN(v)

/** Số điều kiện đang bật (để hiện trên nút "Bộ lọc"). */
export function filterCount(f: RecFilter) {
  return [!!f.status, has(f.positions), has(f.departments), has(f.factories), has(f.levels), has(f.education), num(f.expMin) || num(f.expMax), num(f.ageMin) || num(f.ageMax),
    !!f.hasCv, has(f.recommendation), num(f.scoreMin), !!(f.from || f.to), !!f.pendingReview].filter(Boolean).length
}

export function applyFilter(apps: RecruitApplication[], f: RecFilter, year = dayjs().year()): RecruitApplication[] {
  if (filterCount(f) === 0) return apps
  return apps.filter((a) => {
    if (has(f.positions) && !f.positions!.includes(a.position)) return false
    if (has(f.departments) && !f.departments!.includes(a.department ?? '')) return false
    if (has(f.factories) && !f.factories!.includes(normFactory(a.factory) ?? '')) return false
    if (has(f.levels) && !f.levels!.includes(a.level)) return false
    if (has(f.education) && !(a.education && f.education!.includes(a.education))) return false
    const exp = a.expMonths == null ? null : a.expMonths / 12
    if (num(f.expMin) && (exp == null || exp < f.expMin)) return false
    if (num(f.expMax) && (exp == null || exp > f.expMax)) return false
    const age = a.birthYear == null ? null : year - a.birthYear
    if (num(f.ageMin) && (age == null || age < f.ageMin)) return false
    if (num(f.ageMax) && (age == null || age > f.ageMax)) return false
    if (f.hasCv && (f.hasCv === 'yes') !== a.hasFile) return false
    if (has(f.recommendation) && !(a.recommendation && f.recommendation!.includes(a.recommendation))) return false
    if (num(f.scoreMin) && (a.score == null || a.score < f.scoreMin)) return false
    const d = a.createdAt.slice(0, 10)
    if (f.from && d < f.from) return false
    if (f.to && d > f.to) return false
    if (f.pendingReview && a.status !== 'screening') return false
    return true
  })
}

const keyOf = (userId?: string) => `rec.filter.default.${userId ?? ''}`
/** Bộ lọc mặc định đã lưu của người dùng (theo trình duyệt). */
export function loadDefaultFilter(userId?: string): RecFilter {
  try { return JSON.parse(localStorage.getItem(keyOf(userId)) ?? '{}') as RecFilter } catch { return {} }
}

/** Nút "Bộ lọc" mở bảng gom mọi điều kiện lọc; có lưu làm bộ lọc mặc định (mở màn là tự áp dụng). Các điều kiện đang bật hiện thành thẻ bấm X để bỏ. */
export function RecruitFilterPanel({ apps, value, onChange, userId, cvFacts, scoring, statuses, order, onOrder }: {
  apps: RecruitApplication[]; value: RecFilter; onChange: (f: RecFilter) => void; userId?: string; cvFacts: boolean; scoring: boolean
  /** Các nhóm trạng thái kèm số hồ sơ. */
  statuses: { value: string; label: string; count: number }[]
  /** Thứ tự danh sách (chỉ khi bật đọc CV): theo kinh nghiệm → tuổi hoặc mới nhất. */
  order?: 'exp' | 'new'; onOrder?: (v: 'exp' | 'new') => void
}) {
  const { t } = useTranslation()
  const msg = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RecFilter>(value)
  const [draftOrder, setDraftOrder] = useState(order)
  useEffect(() => { if (open) { setDraft(value); setDraftOrder(order) } }, [open, value, order])
  const apply = (f: RecFilter) => { onChange(f); if (draftOrder && draftOrder !== order) onOrder?.(draftOrder) }
  const opts = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'vi'))
    .map((x) => ({ value: x, label: `${x} (${xs.filter((y) => y === x).length})` }))
  const set = (p: Partial<RecFilter>) => setDraft((d) => ({ ...d, ...p }))
  const n = filterCount(value)
  const saveDefault = () => {
    try { localStorage.setItem(keyOf(userId), JSON.stringify(draft)); msg.success(t('rec.fp.saved')) } catch { msg.error(t('usr.err.generic')) }
    apply(draft)
  }
  const field = (label: string, node: React.ReactNode) => <div className="rfp-f"><div className="rfp-l">{label}</div>{node}</div>
  const panel = (
    <div className="rfp">
      <style>{CSS}</style>
      <div className="rfp-grid">
        {field(t('rec.bar.status'), <Select value={draft.status ?? ''} onChange={(v) => set({ status: v || undefined })}
          options={statuses.map((s) => ({ value: s.value, label: `${s.label} (${s.count})` }))} />)}
        {order && onOrder && field(t('rec.bar.sort'), <Segmented block value={draftOrder} onChange={(v) => setDraftOrder(v as 'exp' | 'new')}
          options={[{ value: 'exp', label: t('rec.cvf.orderExp') }, { value: 'new', label: t('rec.cvf.orderNew') }]} />)}
        {field(t('rec.position'), <Select mode="multiple" allowClear maxTagCount="responsive" value={draft.positions} onChange={(v) => set({ positions: v })} options={opts(apps.map((a) => a.position))} />)}
        {field(t('rec.department'), <Select mode="multiple" allowClear maxTagCount="responsive" value={draft.departments} onChange={(v) => set({ departments: v })} options={opts(apps.map((a) => a.department))} />)}
        {field(t('rec.factory'), <Select mode="multiple" allowClear maxTagCount="responsive" value={draft.factories} onChange={(v) => set({ factories: v })} options={opts(apps.map((a) => normFactory(a.factory)))} />)}
        {field(t('rec.level'), <Select mode="multiple" allowClear value={draft.levels} onChange={(v) => set({ levels: v })} options={[{ value: 'op', label: 'OP' }, { value: 'staff', label: 'Staff+' }]} />)}
        {cvFacts && field(t('rec.cvf.edu'), <Select mode="multiple" allowClear maxTagCount="responsive" value={draft.education} onChange={(v) => set({ education: v })} options={EDU_LEVELS.map((e) => ({ value: e, label: t(`rec.edu.${e}`) }))} />)}
        {cvFacts && field(t('rec.fp.exp'), <Space.Compact block><InputNumber min={0} max={50} placeholder={t('rec.fp.min')} value={draft.expMin} onChange={(v) => set({ expMin: v })} style={{ width: '50%' }} /><InputNumber min={0} max={50} placeholder={t('rec.fp.max')} value={draft.expMax} onChange={(v) => set({ expMax: v })} style={{ width: '50%' }} /></Space.Compact>)}
        {cvFacts && field(t('rec.fp.age'), <Space.Compact block><InputNumber min={15} max={80} placeholder={t('rec.fp.min')} value={draft.ageMin} onChange={(v) => set({ ageMin: v })} style={{ width: '50%' }} /><InputNumber min={15} max={80} placeholder={t('rec.fp.max')} value={draft.ageMax} onChange={(v) => set({ ageMax: v })} style={{ width: '50%' }} /></Space.Compact>)}
        {field(t('rec.cv'), <Select allowClear value={draft.hasCv} onChange={(v) => set({ hasCv: v })} options={[{ value: 'yes', label: t('rec.fp.cvYes') }, { value: 'no', label: t('rec.fp.cvNo') }]} />)}
        {scoring && field(t('rec.fp.recommendation'), <Select mode="multiple" allowClear value={draft.recommendation} onChange={(v) => set({ recommendation: v })} options={['pass', 'consider', 'fail'].map((k) => ({ value: k, label: t(`rec.recm.${k}`) }))} />)}
        {scoring && field(t('rec.fp.scoreMin'), <InputNumber min={0} max={20} step={0.5} style={{ width: '100%' }} value={draft.scoreMin} onChange={(v) => set({ scoreMin: v })} />)}
        {field(t('rec.createdAt'), <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} allowEmpty={[true, true]}
          value={[draft.from ? dayjs(draft.from) : null, draft.to ? dayjs(draft.to) : null]}
          onChange={(r) => set({ from: r?.[0]?.format('YYYY-MM-DD'), to: r?.[1]?.format('YYYY-MM-DD') })} />)}
        {field(t('rec.fp.pendingReview'), <Switch checked={!!draft.pendingReview} onChange={(v) => set({ pendingReview: v })} />)}
      </div>
      <Divider style={{ margin: '12px 0' }} />
      <div className="rfp-actions">
        <Button onClick={() => { setDraft({}); apply({}); setOpen(false) }}>{t('rec.fp.clear')}</Button>
        <Space>
          <Button icon={<SaveOutlined />} onClick={saveDefault}>{t('rec.fp.saveDefault')}</Button>
          <Button type="primary" onClick={() => { apply(draft); setOpen(false) }}>{t('rec.fp.apply')}</Button>
        </Space>
      </div>
    </div>
  )
  // Thẻ điều kiện đang bật, bấm X để bỏ riêng điều kiện đó
  const chips: { k: string; label: string; clear: Partial<RecFilter> }[] = []
  const join = (xs?: string[]) => (xs ?? []).join(', ')
  if (value.status) chips.push({ k: 'st', label: `${t('rec.bar.status')}: ${statuses.find((s) => s.value === value.status)?.label ?? value.status}`, clear: { status: undefined } })
  if (has(value.positions)) chips.push({ k: 'pos', label: `${t('rec.position')}: ${join(value.positions)}`, clear: { positions: undefined } })
  if (has(value.departments)) chips.push({ k: 'dep', label: `${t('rec.department')}: ${join(value.departments)}`, clear: { departments: undefined } })
  if (has(value.factories)) chips.push({ k: 'fac', label: `${t('rec.factory')}: ${join(value.factories)}`, clear: { factories: undefined } })
  if (has(value.levels)) chips.push({ k: 'lv', label: `${t('rec.level')}: ${(value.levels ?? []).map((x) => (x === 'op' ? 'OP' : 'Staff+')).join(', ')}`, clear: { levels: undefined } })
  if (has(value.education)) chips.push({ k: 'edu', label: `${t('rec.cvf.edu')}: ${(value.education ?? []).map((e) => t(`rec.edu.${e}`)).join(', ')}`, clear: { education: undefined } })
  if (num(value.expMin) || num(value.expMax)) chips.push({ k: 'exp', label: `${t('rec.fp.exp')}: ${value.expMin ?? 0} – ${value.expMax ?? '∞'}`, clear: { expMin: undefined, expMax: undefined } })
  if (num(value.ageMin) || num(value.ageMax)) chips.push({ k: 'age', label: `${t('rec.fp.age')}: ${value.ageMin ?? '…'} – ${value.ageMax ?? '…'}`, clear: { ageMin: undefined, ageMax: undefined } })
  if (value.hasCv) chips.push({ k: 'cv', label: t(value.hasCv === 'yes' ? 'rec.fp.cvYes' : 'rec.fp.cvNo'), clear: { hasCv: undefined } })
  if (has(value.recommendation)) chips.push({ k: 'rc', label: `${t('rec.fp.recommendation')}: ${(value.recommendation ?? []).map((k) => t(`rec.recm.${k}`)).join(', ')}`, clear: { recommendation: undefined } })
  if (num(value.scoreMin)) chips.push({ k: 'sc', label: `${t('rec.fp.scoreMin')}: ${value.scoreMin}`, clear: { scoreMin: undefined } })
  if (value.from || value.to) chips.push({ k: 'dt', label: `${t('rec.createdAt')}: ${value.from ? dayjs(value.from).format('DD/MM/YY') : '…'} – ${value.to ? dayjs(value.to).format('DD/MM/YY') : '…'}`, clear: { from: undefined, to: undefined } })
  if (value.pendingReview) chips.push({ k: 'pr', label: t('rec.fp.pendingReview'), clear: { pendingReview: undefined } })
  return (
    <>
      <Popover open={open} onOpenChange={setOpen} trigger="click" placement="bottomLeft" title={t('rec.fp.title')} content={panel} destroyOnHidden>
        <Badge count={n} size="small" offset={[-4, 4]}><Button icon={<FilterOutlined />} type={n ? 'primary' : 'default'} ghost={n > 0}>{t('rec.fp.btn')}</Button></Badge>
      </Popover>
      {chips.map((c) => (
        <Tag key={c.k} closable closeIcon={<CloseOutlined />} onClose={(e) => { e.preventDefault(); onChange({ ...value, ...c.clear }) }} style={{ marginInlineEnd: 0, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</Tag>
      ))}
    </>
  )
}

const CSS = `
.rfp { width: min(720px, calc(100vw - 48px)); }
.rfp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px 14px; }
.rfp-f .ant-select { width: 100%; }
.rfp-l { font-size: 12px; font-weight: 600; color: var(--c-muted); margin-bottom: 4px; }
.rfp-actions { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
`
