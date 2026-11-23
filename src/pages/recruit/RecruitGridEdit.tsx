import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Button, DatePicker, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, Tooltip, theme } from 'antd'
import { ClockCircleOutlined, CloseOutlined, EditOutlined, FileSearchOutlined, RobotOutlined, SaveOutlined, SyncOutlined, TableOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { EDU_LEVELS, type RecruitApplication } from '../../api/recruit'
import { recruitGrid, type CvQueueStatus, type GridChanges, type GridField, type GridProfile, type GridValue } from '../../api/recruitGrid'
import { adminError } from '../../api/userAdmin'
import { useToast } from '../../hooks/useToast'
import { foldFilter } from '../../utils/search'

const norm = (v: GridValue | undefined): GridValue => (v === undefined || v === '' ? null : typeof v === 'string' ? v.trim() || null : v)

/** Giá trị gốc (chưa sửa) của một ô: lấy từ danh sách hoặc từ thông tin thêm. */
function original(app: RecruitApplication, p: GridProfile | undefined, f: GridField): GridValue {
  switch (f) {
    case 'gender': case 'birthDate': case 'address': case 'major': case 'languages': case 'availableFrom': return p?.[f] ?? null
    case 'expMonths': return app.expMonths ?? null
    case 'birthYear': return app.birthYear ?? null
    case 'education': return app.education ?? null
    default: return (app[f] as string | null | undefined) ?? null
  }
}

/** Nhóm ô trên một cột bảng (bấm vào cột nào thì mở các ô đó để sửa). */
const GROUPS: Record<string, GridField[]> = { name: ['fullName', 'phone'], pos: ['position', 'department', 'factory'], exp: ['expMonths'], birth: ['birthYear'], edu: ['education'] }
const groupFields = (k: string): GridField[] => GROUPS[k] ?? [k as GridField]

export interface GridEdit {
  editing: boolean
  /** Ô đang mở để sửa khi không bật chế độ sửa cả bảng ("id:nhóm"), ô cần đặt con trỏ ("id:trường"). */
  focus: string | null
  /** Cột k của hồ sơ id đang hiện ô sửa: bật sửa cả bảng, vừa bấm vào, hoặc có ô đã sửa chưa lưu. */
  open: (id: number, k: string) => boolean
  /** Thuộc tính ô bảng: chưa mở thì bấm vào là sửa luôn. */
  cellProps: (id: number, k: string) => HTMLAttributes<HTMLElement>
  start: () => void
  /** Thoát chế độ sửa (đã hỏi xác nhận nếu còn thay đổi chưa lưu). */
  stop: () => void
  dirtyIds: number[]
  value: (app: RecruitApplication, f: GridField) => GridValue
  isDirty: (id: number, f: GridField) => boolean
  set: (app: RecruitApplication, f: GridField, v: GridValue) => void
  save: () => void
  saving: boolean
  profiles: Record<string, GridProfile>
  profileOn: boolean
  cv: CvQueueStatus | undefined
}

/**
 * Chế độ sửa trực tiếp trên bảng Quản lý CV: giữ bản nháp theo hồ sơ (qua nhiều trang / bộ lọc), chỉ gửi ô đã đổi, lưu một lần.
 * Kèm thông tin thêm (giới tính, ngày sinh...) và trạng thái hàng đợi đọc CV bằng AI, hỏi lại máy chủ 3 giây / lần khi có CV đang chờ.
 */
export function useGridEdit(apps: RecruitApplication[], opts: { profile: boolean; ai: boolean }): GridEdit {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, GridChanges>>({})
  const [active, setActive] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  // Esc: đóng ô đang mở (giá trị đã gõ vẫn giữ là bản nháp)
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setActive(null); setFocus(null) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active])

  const ids = useMemo(() => apps.map((a) => a.id).sort((x, y) => x - y), [apps])
  const profilesQ = useQuery({
    queryKey: ['recruit', 'grid', 'profiles', ids.join(',')], queryFn: () => recruitGrid.profiles(ids.slice(0, 500)),
    enabled: opts.profile && ids.length > 0, staleTime: 30_000, retry: false,
  })
  const profiles = useMemo(() => profilesQ.data ?? {}, [profilesQ.data])

  // Trạng thái đọc CV: có CV đang chờ / đang đọc thì hỏi 3 giây / lần, rảnh thì 15 giây / lần (chỉ khi tab trình duyệt đang mở)
  const cvQ = useQuery({
    queryKey: ['recruit-cv-status'], queryFn: recruitGrid.cvStatus, enabled: opts.ai, retry: false,
    refetchInterval: (q) => (q.state.data && (q.state.data.current || q.state.data.waiting.length > 0) ? 3000 : 15000),
  })
  // CV vừa ra khỏi hàng đợi (đọc xong / lỗi): tải lại danh sách để thấy năm sinh, kinh nghiệm, học vấn mới
  const busyRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const d = cvQ.data
    if (!d) return
    const now = new Set<number>([...d.waiting.map((w) => w.id), ...(d.current ? [d.current.id] : [])])
    const finished = [...busyRef.current].some((id) => !now.has(id))
    busyRef.current = now
    if (finished) { qc.invalidateQueries({ queryKey: ['recruit', 'list'] }); qc.invalidateQueries({ queryKey: ['recruit', 'detail'] }) }
  }, [cvQ.data, qc])

  const byId = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps])
  const value = useCallback((app: RecruitApplication, f: GridField) => {
    const d = drafts[app.id]
    return d && f in d ? (d[f] ?? null) : original(app, profiles[String(app.id)], f)
  }, [drafts, profiles])
  const isDirty = useCallback((id: number, f: GridField) => !!drafts[id] && f in drafts[id], [drafts])
  const set = useCallback((app: RecruitApplication, f: GridField, v: GridValue) => {
    const orig = norm(original(app, profiles[String(app.id)], f))
    setDrafts((s) => {
      const row = { ...(s[app.id] ?? {}) }
      if (norm(v) === orig) delete row[f]; else row[f] = norm(v)
      const next = { ...s }
      if (Object.keys(row).length === 0) delete next[app.id]; else next[app.id] = row
      return next
    })
  }, [profiles])
  const dirtyIds = useMemo(() => Object.keys(drafts).map(Number), [drafts])

  // Còn thay đổi chưa lưu: trình duyệt hỏi lại khi đóng / tải lại trang
  useEffect(() => {
    if (dirtyIds.length === 0) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = t('rg.leaveAsk') }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirtyIds.length, t])

  const errText = (reason: string) => t(`rec.err.${reason}`, { defaultValue: t('usr.err.generic') })
  const saveM = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(drafts).map(([id, changes]) => ({ id: Number(id), changes }))
      const saved: number[] = []; const failed: { id: number; reason: string }[] = []
      for (let i = 0; i < rows.length; i += 200) { const r = await recruitGrid.save(rows.slice(i, i + 200)); saved.push(...r.saved); failed.push(...r.failed) }
      return { saved, failed }
    },
    onSuccess: (r) => {
      setDrafts((s) => { const n = { ...s }; for (const id of r.saved) delete n[id]; return n })
      if (r.saved.length > 0) msg.success(t('rg.saved', { n: r.saved.length }))
      if (r.failed.length > 0) {
        Modal.warning({ title: t('rg.someFailed'), content: <ul style={{ paddingLeft: 18 }}>{r.failed.map((f) => <li key={f.id}><b>{byId.get(f.id)?.fullName ?? `#${f.id}`}</b>: {errText(f.reason)}</li>)}</ul> })
      } else { setEditing(false); setActive(null) }
      qc.invalidateQueries({ queryKey: ['recruit'] })
      qc.invalidateQueries({ queryKey: ['ojt-team'] })
    },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(errText(detail || code)) },
  })

  const open = (id: number, k: string) => editing || active === `${id}:${k}` || groupFields(k).some((f) => !!drafts[id] && f in drafts[id])
  const cellProps = (id: number, k: string): HTMLAttributes<HTMLElement> => open(id, k) ? {} : {
    onClick: () => { setActive(`${id}:${k}`); setFocus(`${id}:${groupFields(k)[0]}`) }, style: { cursor: 'text' }, title: t('rg.clickEdit'),
  }
  return {
    editing, focus, open, cellProps,
    start: () => setEditing(true), stop: () => { setDrafts({}); setEditing(false); setActive(null) },
    dirtyIds, value, isDirty, set, save: () => saveM.mutate(), saving: saveM.isPending,
    profiles, profileOn: opts.profile && !profilesQ.isError, cv: cvQ.data,
  }
}

/** Nút trên thanh thao tác: bật chế độ sửa; đang sửa thì hiện số hồ sơ đã sửa + Lưu một lần + Thoát. */
export function GridEditBar({ g }: { g: GridEdit }) {
  const { t } = useTranslation()
  if (!g.editing && g.dirtyIds.length === 0) return <Tooltip title={t('rg.editHint')}><Button icon={<TableOutlined />} onClick={g.start}>{t('rg.edit')}</Button></Tooltip>
  const n = g.dirtyIds.length
  return (
    <Space size={6} wrap>
      <Tag color="gold" icon={<EditOutlined />} style={{ margin: 0 }}>{g.editing ? `${t('rg.editing')} · ` : ''}{n > 0 ? t('rg.dirty', { n }) : t('rg.none')}</Tag>
      <Button type="primary" icon={<SaveOutlined />} disabled={n === 0} loading={g.saving} onClick={g.save}>{t('rg.save', { n })}</Button>
      {n > 0
        ? <Popconfirm title={t('rg.discardAsk', { n })} okText={t('rg.discard')} okButtonProps={{ danger: true }} onConfirm={g.stop}><Button icon={<CloseOutlined />}>{t('rg.cancel')}</Button></Popconfirm>
        : <Button icon={<CloseOutlined />} onClick={g.stop}>{t('rg.cancel')}</Button>}
    </Space>
  )
}

type Kind = 'text' | 'textarea' | 'number' | 'years' | 'date' | 'select'

/** Ô sửa trên bảng: chữ / số lưu khi rời ô hoặc Enter (không vẽ lại cả bảng mỗi lần gõ), chọn / ngày lưu ngay. Ô đã sửa có nền vàng. */
export function GridCell({ g, app, field, kind = 'text', options, width, placeholder, min, max }: {
  g: GridEdit; app: RecruitApplication; field: GridField; kind?: Kind; options?: { value: string; label: ReactNode }[]; width?: number | string; placeholder?: string; min?: number; max?: number
}) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const v = g.value(app, field)
  const dirty = g.isDirty(app.id, field)
  const style = { width: width ?? '100%', ...(dirty ? { background: token.colorWarningBg, borderColor: token.colorWarningBorder } : {}) }
  const title = dirty ? t('rg.changedHint') : undefined
  const commit = (x: GridValue) => g.set(app, field, x)
  const autoFocus = g.focus === `${app.id}:${field}`
  if (kind === 'select') {
    return <Select size="small" allowClear showSearch filterOption={foldFilter('label')} style={style} title={title} value={(v as string | null) ?? undefined} options={options} placeholder={placeholder} autoFocus={autoFocus} defaultOpen={autoFocus}
      onChange={(x) => commit((x as string | undefined) ?? null)} popupMatchSelectWidth={false} />
  }
  if (kind === 'date') {
    return <DatePicker size="small" format="DD/MM/YYYY" autoFocus={autoFocus} style={style} title={title} value={v ? dayjs(String(v)) : null} onChange={(d) => commit(d ? d.format('YYYY-MM-DD') : null)} />
  }
  if (kind === 'number' || kind === 'years') return <NumberCell key={`${app.id}-${field}-${String(v)}`} v={v as number | null} years={kind === 'years'} style={style} title={title} min={min} max={max} autoFocus={autoFocus} onCommit={commit} />
  return <TextCell key={`${app.id}-${field}-${String(v)}`} v={(v as string | null) ?? ''} area={kind === 'textarea'} style={style} title={title} placeholder={placeholder} autoFocus={autoFocus} onCommit={commit} />
}

function TextCell({ v, area, style, title, placeholder, autoFocus, onCommit }: { v: string; area: boolean; style: CSSProperties; title?: string; placeholder?: string; autoFocus?: boolean; onCommit: (x: GridValue) => void }) {
  const [s, setS] = useState(v)
  const done = () => { if (s !== v) onCommit(s) }
  return area
    ? <Input.TextArea size="small" autoFocus={autoFocus} autoSize={{ minRows: 1, maxRows: 4 }} style={style} title={title} placeholder={placeholder} value={s} onChange={(e) => setS(e.target.value)} onBlur={done} />
    : <Input size="small" autoFocus={autoFocus} style={style} title={title} placeholder={placeholder} value={s} onChange={(e) => setS(e.target.value)} onBlur={done} onPressEnter={done} />
}

/** Ô số; years = hiện theo năm (bước 0,5) nhưng lưu theo tháng. */
function NumberCell({ v, years, style, title, min, max, autoFocus, onCommit }: { v: number | null; years: boolean; style: CSSProperties; title?: string; min?: number; max?: number; autoFocus?: boolean; onCommit: (x: GridValue) => void }) {
  const shown = v == null ? null : years ? Math.round(v / 6) / 2 : v
  const [s, setS] = useState<number | null>(shown)
  const done = () => { if (s !== shown) onCommit(s == null ? null : years ? Math.round(s * 12) : Math.round(s)) }
  return <InputNumber size="small" autoFocus={autoFocus} style={style} title={title} min={min} max={max} step={years ? 0.5 : 1} value={s} onChange={(x) => setS(x == null ? null : Number(x))} onBlur={done} onPressEnter={done} />
}

export const eduOptions = (t: TFunction) => EDU_LEVELS.map((v) => ({ value: v, label: t(`rec.edu.${v}`) }))
export const genderOptions = (t: TFunction) => (['male', 'female', 'other'] as const).map((v) => ({ value: v, label: t(`rec.pf.g.${v}`) }))

/** Ô "Đọc CV": thông tin đang lấy từ đâu (quy tắc / AI / HR) và hồ sơ có đang chờ / đang được AI đọc không, cập nhật trực tiếp. */
export function CvReadCell({ app, cv, ai }: { app: RecruitApplication; cv?: CvQueueStatus; ai: boolean }) {
  const { t, i18n } = useTranslation()
  if (!app.hasFile) return <span className="cell-muted">{t('rg.cv.none')}</span>
  const at = (s: string) => new Date(s).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const cur = cv?.current?.id === app.id ? cv.current : null
  if (cur) {
    const text = cur.step === 'read' ? t('rg.cv.reading', { s: cur.seconds }) : cur.step === 'prepare' ? t('rg.cv.preparing') : t('rg.cv.translatingKo')
    return <Tooltip title={cur.step === 'read' ? t('rg.cv.tipReading') : t('rg.cv.tipPreparing')}><Tag color="processing" icon={<SyncOutlined spin />}>{text}</Tag></Tooltip>
  }
  const reads = (cv?.waiting ?? []).filter((w) => w.step === 'read')
  const pos = reads.findIndex((w) => w.id === app.id)
  if (pos >= 0) return <Tooltip title={t('rg.cv.tipQueued')}><Tag color="warning" icon={<ClockCircleOutlined />}>{t('rg.cv.queued', { n: pos + 1 })}</Tag></Tooltip>
  const ko = (cv?.waiting ?? []).some((w) => w.step === 'ko' && w.id === app.id)
  const last = cv?.recent[String(app.id)]
  const src = app.factsSource
  const main = src === 'ai' ? <Tooltip title={t('rg.cv.tipAi') + (last ? ` · ${t('rg.cv.tipAt', { t: at(last.at) })}` : '')}><Tag color="purple" icon={<RobotOutlined />}>{t('rg.cv.ai')}</Tag></Tooltip>
    : src === 'hr' ? <Tooltip title={t('rg.cv.tipHr')}><Tag icon={<EditOutlined />}>{t('rg.cv.hr')}</Tag></Tooltip>
    : src === 'auto' ? <Tooltip title={t('rg.cv.tipAuto')}><Tag color="blue" icon={<FileSearchOutlined />}>{t('rg.cv.auto')}</Tag></Tooltip>
    : <Tooltip title={t('rg.cv.tipNotRead')}><Tag>{t('rg.cv.notRead')}</Tag></Tooltip>
  return (
    <span>
      {main}
      {ai && src !== 'ai' && src !== 'hr' && last && last.result !== 'ai' && <Tooltip title={`${t('rg.cv.tipSkip')} · ${t('rg.cv.tipAt', { t: at(last.at) })}`}><div className="cell-muted" style={{ color: 'var(--ant-color-warning, #d48806)' }}>{last.result === 'error' ? t('rg.cv.aiError') : t('rg.cv.aiSkip')}</div></Tooltip>}
      {ko && <div className="cell-muted">{t('rg.cv.queuedKo')}</div>}
    </span>
  )
}

/** Dấu "trực tiếp" cạnh tiêu đề cột Đọc CV khi đang có CV chờ / đang đọc. */
export function CvLiveTitle({ cv }: { cv?: CvQueueStatus }) {
  const { t } = useTranslation()
  const busy = !!cv && (!!cv.current || cv.waiting.length > 0)
  return <span>{t('rg.cv.col')}{busy && <Tooltip title={t('rg.cv.live')}> <SyncOutlined spin style={{ fontSize: 11 }} /></Tooltip>}</span>
}
