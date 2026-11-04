import { useMemo, useState } from 'react'
import { Button, DatePicker, Dropdown, Form, Input, InputNumber, Popover, Space, TreeSelect } from 'antd'
import { ColumnHeightOutlined, VerticalAlignMiddleOutlined, FolderOpenOutlined, FolderOutlined, InboxOutlined, MoreOutlined, PlusOutlined, RightOutlined, CalendarOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { recruit, type BatchInput, type RecruitBatch } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

/** Nút đặc biệt của cây: tất cả hồ sơ / hồ sơ chưa xếp vào đợt nào. */
type TreeOpt = { value: number; title: string; children: TreeOpt[] }
export const ALL_NODE = 0
export const NONE_NODE = -1

/** Id của nút và toàn bộ con cháu (để lọc danh sách khi chọn một đợt). */
export function subtreeIds(batches: RecruitBatch[], id: number): Set<number> {
  const out = new Set<number>([id])
  for (let grew = true; grew;) {
    grew = false
    for (const b of batches) if (b.parentId != null && out.has(b.parentId) && !out.has(b.id)) { out.add(b.id); grew = true }
  }
  return out
}

/** Đợt xếp theo Năm → Tháng của ngày bắt đầu (chưa nhập thì theo ngày tạo). Nút năm / tháng là nút ảo có id âm: -(năm*100) và -(năm*100 + tháng). */
export const batchMonth = (b: RecruitBatch) => dayjs(b.fromDate ?? b.createdAt)
export const yearNode = (y: number) => -(y * 100)
export const monthNode = (y: number, m: number) => -(y * 100 + m)
const isGroupNode = (node: number) => node <= -10000

/** Tên đợt hiển thị trên cây: "Tên đợt · Vị trí". */
export const batchLabel = (b: RecruitBatch) => (b.parentId == null && b.position && !b.name.toLowerCase().includes(b.position.toLowerCase()) ? `${b.name} · ${b.position}` : b.name)

/** Id các đợt (và thư mục con) thuộc một nút: nút thật, hoặc nút năm / tháng. */
export function nodeIds(batches: RecruitBatch[], node: number): Set<number> {
  if (!isGroupNode(node)) return subtreeIds(batches, node)
  const k = -node, y = Math.floor(k / 100), m = k % 100
  const out = new Set<number>()
  for (const b of batches) {
    if (b.parentId != null) continue
    const d = batchMonth(b)
    if (d.year() === y && (m === 0 || d.month() + 1 === m)) subtreeIds(batches, b.id).forEach((x) => out.add(x))
  }
  return out
}

/** Lọc hồ sơ theo nút đang chọn trên cây. */
export function inNode<T extends { batchId?: number | null }>(apps: T[], batches: RecruitBatch[], node: number): T[] {
  if (node === ALL_NODE) return apps
  if (node === NONE_NODE) return apps.filter((a) => a.batchId == null)
  const ids = nodeIds(batches, node)
  return apps.filter((a) => a.batchId != null && ids.has(a.batchId))
}

/** Cây chọn đợt cho TreeSelect: Năm → Tháng → Đợt · Vị trí → thư mục; nút năm / tháng chỉ để mở, không chọn được. */
export function batchTreeData(batches: RecruitBatch[], t: (k: string, o?: Record<string, unknown>) => string, onlyOpen = false) {
  type N = { value: number; title: string; selectable?: boolean; children: N[] }
  const ok = (b: RecruitBatch) => !onlyOpen || b.status === 'open'
  const kids = (pid: number): N[] => batches.filter((b) => b.parentId === pid && ok(b)).sort((a, b) => a.name.localeCompare(b.name, 'vi')).map((b) => ({ value: b.id, title: b.name, children: kids(b.id) }))
  const years = new Map<number, Map<number, RecruitBatch[]>>()
  for (const b of batches.filter((x) => x.parentId == null && ok(x))) {
    const d = batchMonth(b), y = d.year(), m = d.month() + 1
    if (!years.has(y)) years.set(y, new Map())
    const ms = years.get(y)!
    ms.set(m, [...(ms.get(m) ?? []), b])
  }
  return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([y, ms]): N => ({
    value: yearNode(y), title: String(y), selectable: false,
    children: [...ms.entries()].sort((a, b) => b[0] - a[0]).map(([m, bs]): N => ({
      value: monthNode(y, m), title: t('rec.bt.month', { m }), selectable: false,
      children: bs.sort((a, b) => b.id - a.id).map((b) => ({ value: b.id, title: batchLabel(b), children: kids(b.id) })),
    })),
  }))
}

// Kiểu giống bộ chọn nút của Cơ cấu tổ chức (OrgTreeView), đặt riêng ở đây để không phụ thuộc màn kia đã mở hay chưa
const CSS = `
.rbt { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; padding: 10px; position: sticky; top: 12px; }
.rbt-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 4px 8px; border-bottom: 1px solid var(--c-border); margin-bottom: 6px; }
.rbt .otp { max-height: calc(100vh - 260px); overflow: auto; }
.rbt .otp-row { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 6px; border-radius: 8px; cursor: pointer; transition: background .12s; }
.rbt .otp-row:hover { background: var(--c-surface-2); }
.rbt .otp-row.sel { background: var(--c-tint-strong); box-shadow: inset 3px 0 0 var(--c-primary); }
.rbt .otp-row.sel .otp-name { color: var(--c-primary); font-weight: 600; }
.rbt .otp-row.rbt-off { opacity: .55; }
.rbt .otp-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--c-text); }
.rbt .rbt-hc { color: var(--c-muted); font-size: 12px; font-weight: 400; }
.rbt .otp-ico { width: 24px; height: 24px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex: none; }
.rbt .otp-n { font-size: 11px; font-weight: 600; color: var(--c-primary); background: var(--c-tint); border-radius: 999px; padding: 0 7px; line-height: 18px; }
.rbt .otv-chev { width: 20px; height: 20px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: var(--c-muted); flex: none; cursor: pointer; }
.rbt .otv-chev:hover { background: var(--c-tint-strong); color: var(--c-primary); }
.rbt .rbt-more { border: 0; background: transparent; width: 26px; height: 26px; border-radius: 8px; color: var(--c-muted); cursor: pointer; opacity: 0; flex: none; }
.rbt .otp-row:hover .rbt-more, .rbt .otp-row.sel .rbt-more, .rbt .rbt-more:focus-visible { opacity: 1; }
.rbt .rbt-more:hover { background: var(--c-tint-strong); color: var(--c-primary); }
.rec-split { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 1100px) { .rec-split { grid-template-columns: 1fr; } .rbt { position: static; } .rbt .otp { max-height: 320px; } }
`

const ROOT = { fg: '#0F6B3E', bg: 'rgba(15,107,62,.12)' }
const KID = { fg: '#C2610C', bg: 'rgba(217,119,6,.14)' }

/**
 * Cây đợt tuyển dụng bên trái màn Quản lý CV (giống sơ đồ Dept / Team / Part): gốc là đợt, bên trong là thư mục con.
 * Số bên phải là tổng hồ sơ của nút và các thư mục con. Bấm nút để lọc danh sách; menu "…" để thêm thư mục con, sửa, đóng / mở lại.
 */
export function BatchTree({ batches, total, unassigned, selected, onSelect }: { batches: RecruitBatch[]; total: number; unassigned: number; selected: number; onSelect: (id: number) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<{ batch?: RecruitBatch; parentId: number | null } | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const children = useMemo(() => {
    const m = new Map<number | null, RecruitBatch[]>()
    for (const b of batches) { const k = b.parentId ?? null; m.set(k, [...(m.get(k) ?? []), b]) }
    for (const v of m.values()) v.sort((a, b) => (a.parentId == null ? b.id - a.id : a.name.localeCompare(b.name, 'vi')))   // đợt mới nhất lên đầu, thư mục theo tên
    return m
  }, [batches])
  const sum = useMemo(() => {
    const memo = new Map<number, number>()
    const f = (b: RecruitBatch): number => { if (memo.has(b.id)) return memo.get(b.id)!; const n = b.applications + (children.get(b.id) ?? []).reduce((s, c) => s + f(c), 0); memo.set(b.id, n); return n }
    batches.forEach(f)
    return memo
  }, [batches, children])
  // Tự mở nhánh chứa nút đang chọn
  const auto = useMemo(() => {
    const s = new Set<number>()
    const byId = new Map(batches.map((b) => [b.id, b]))
    for (let c = byId.get(selected)?.parentId; c != null; c = byId.get(c)?.parentId) s.add(c)
    return s
  }, [batches, selected])
  const closedCount = batches.filter((b) => b.status === 'closed').length
  // Nút năm / tháng mặc định mở; bấm mũi tên để thu gọn
  const [folded, setFolded] = useState<Set<number>>(() => { try { return new Set<number>(JSON.parse(localStorage.getItem('rec.bt.folded') ?? '[]')) } catch { return new Set() } })
  const saveFolded = (x: Set<number>) => { try { localStorage.setItem('rec.bt.folded', JSON.stringify([...x])) } catch { /* bỏ qua */ } return x }
  const fold = (id: number) => setFolded((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return saveFolded(x) })
  // Thu gọn / mở rộng toàn bộ cây (năm, tháng và thư mục con)
  const groupIds = useMemo(() => {
    const ids: number[] = []
    for (const b of batches) { if (b.parentId != null) continue; const d = batchMonth(b); ids.push(yearNode(d.year()), monthNode(d.year(), d.month() + 1)) }
    return [...new Set(ids)]
  }, [batches])
  const anyOpen = groupIds.some((g) => !folded.has(g)) || open.size > 0
  const toggleAll = () => {
    if (anyOpen) { setFolded(saveFolded(new Set(groupIds))); setOpen(new Set()) }
    else { setFolded(saveFolded(new Set())); setOpen(new Set(batches.filter((b) => batches.some((c) => c.parentId === b.id)).map((b) => b.id))) }
  }

  const row = (b: RecruitBatch, depth: number): React.ReactNode => {
    const kids = (children.get(b.id) ?? []).filter((c) => showClosed || c.status === 'open')
    const expanded = open.has(b.id) || auto.has(b.id)
    const ks = b.parentId == null ? ROOT : KID
    return (
      <div key={b.id}>
        <div className={`otp-row${selected === b.id ? ' sel' : ''}${b.status === 'closed' ? ' rbt-off' : ''}`} style={{ paddingLeft: 6 + depth * 18 }} onClick={() => onSelect(b.id)}>
          <span className="otv-chev" style={{ visibility: kids.length ? 'visible' : 'hidden' }} onClick={(e) => { e.stopPropagation(); setOpen((s) => { const x = new Set(s); if (x.has(b.id)) x.delete(b.id); else x.add(b.id); return x }) }}>
            <RightOutlined style={{ transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'none', fontSize: 11 }} />
          </span>
          <span className="otp-ico" style={{ color: ks.fg, background: ks.bg }}>{b.parentId == null ? <CalendarOutlined /> : expanded ? <FolderOpenOutlined /> : <FolderOutlined />}</span>
          <span className="otp-name" title={[b.name, b.position, b.department].filter(Boolean).join(' · ')}>{batchLabel(b)}{b.headcount ? <span className="rbt-hc"> · {t('rec.bt.need', { n: b.headcount })}</span> : null}</span>
          {sum.get(b.id) ? <span className="otp-n">{sum.get(b.id)}</span> : null}
          <Dropdown trigger={['click']} menu={{ items: [
            ...(b.status === 'open' ? [{ key: 'add', icon: <PlusOutlined />, label: t('rec.bt.addFolder'), onClick: () => setEditing({ parentId: b.id }) }] : []),
            { key: 'edit', label: t('rec.bt.edit'), onClick: () => setEditing({ batch: b, parentId: b.parentId }) },
          ] }}>
            <button type="button" className="otv-more rbt-more" aria-label="menu" onClick={(e) => e.stopPropagation()}><MoreOutlined /></button>
          </Dropdown>
        </div>
        {expanded && kids.map((c) => row(c, depth + 1))}
      </div>
    )
  }

  const roots = (children.get(null) ?? []).filter((b) => showClosed || b.status === 'open')
  const groups = useMemo(() => {
    const years = new Map<number, Map<number, RecruitBatch[]>>()
    for (const b of roots) {
      const d = batchMonth(b), y = d.year(), m = d.month() + 1
      if (!years.has(y)) years.set(y, new Map())
      const ms = years.get(y)!
      ms.set(m, [...(ms.get(m) ?? []), b])
    }
    return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([y, ms]) => ({ y, months: [...ms.entries()].sort((a, b) => b[0] - a[0]).map(([m, bs]) => ({ m, bs })) }))
  }, [roots])
  const groupRow = (id: number, label: string, n: number, depth: number, kids: boolean) => (
    <div key={id} className={`otp-row${selected === id ? ' sel' : ''}`} style={{ paddingLeft: 6 + depth * 18 }} onClick={() => onSelect(id)}>
      <span className="otv-chev" style={{ visibility: kids ? 'visible' : 'hidden' }} onClick={(e) => { e.stopPropagation(); fold(id) }}>
        <RightOutlined style={{ transition: 'transform .15s', transform: folded.has(id) ? 'none' : 'rotate(90deg)', fontSize: 11 }} />
      </span>
      <span className="otp-ico" style={{ color: '#2F6FB0', background: 'rgba(47,111,176,.12)' }}><CalendarOutlined /></span>
      <span className="otp-name"><b>{label}</b></span>{n ? <span className="otp-n">{n}</span> : null}
    </div>
  )
  return (
    <div className="rbt">
      <style>{CSS}</style>
      <div className="rbt-head">
        <b>{t('rec.bt.title')}</b>
        <Space size={4}>
          <Button size="small" type="text" title={t(anyOpen ? 'rec.bt.collapseAll' : 'rec.bt.expandAll')} aria-label={t(anyOpen ? 'rec.bt.collapseAll' : 'rec.bt.expandAll')} icon={anyOpen ? <VerticalAlignMiddleOutlined /> : <ColumnHeightOutlined />} onClick={toggleAll} />
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ parentId: null })}>{t('rec.bt.addBatch')}</Button>
        </Space>
      </div>
      <div className="otp">
        <div className={`otp-row${selected === ALL_NODE ? ' sel' : ''}`} onClick={() => onSelect(ALL_NODE)}>
          <span className="otp-ico" style={{ color: '#475467', background: 'rgba(71,84,103,.12)' }}><InboxOutlined /></span>
          <span className="otp-name">{t('rec.bt.all')}</span>{total ? <span className="otp-n">{total}</span> : null}
        </div>
        {groups.map(({ y, months }) => (
          <div key={y}>
            {groupRow(yearNode(y), String(y), months.reduce((s, x) => s + x.bs.reduce((a, b) => a + (sum.get(b.id) ?? 0), 0), 0), 0, true)}
            {!folded.has(yearNode(y)) && months.map(({ m, bs }) => (
              <div key={m}>
                {groupRow(monthNode(y, m), t('rec.bt.month', { m }), bs.reduce((a, b) => a + (sum.get(b.id) ?? 0), 0), 1, true)}
                {!folded.has(monthNode(y, m)) && bs.sort((a, b) => b.id - a.id).map((b) => row(b, 2))}
              </div>
            ))}
          </div>
        ))}
        <div className={`otp-row${selected === NONE_NODE ? ' sel' : ''}`} onClick={() => onSelect(NONE_NODE)}>
          <span className="otp-ico" style={{ color: '#98A2B3', background: 'rgba(152,162,179,.14)' }}><FolderOutlined /></span>
          <span className="otp-name">{t('rec.bt.none')}</span>{unassigned ? <span className="otp-n">{unassigned}</span> : null}
        </div>
      </div>
      {closedCount > 0 && <Button type="link" size="small" onClick={() => setShowClosed((v) => !v)}>{t(showClosed ? 'rec.bt.hideClosed' : 'rec.bt.showClosed', { n: closedCount })}</Button>}
      {editing && <BatchEditModal batches={batches} batch={editing.batch} parentId={editing.parentId} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); if (id) onSelect(id) }} />}
    </div>
  )
}

interface EditValues { name: string; department?: string; position?: string; headcount?: number | null; range?: [Dayjs | null, Dayjs | null] | null; parentId?: number | null }

/** Thêm / sửa một đợt hoặc thư mục con; với nút đã có thì đổi được nút cha và đóng / mở lại. */
function BatchEditModal({ batches, batch, parentId, onClose, onSaved }: { batches: RecruitBatch[]; batch?: RecruitBatch; parentId: number | null; onClose: () => void; onSaved: (id?: number) => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [form] = Form.useForm<EditValues>()
  const isRoot = (batch ? batch.parentId : parentId) == null
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const toInput = (v: EditValues, closed?: boolean): BatchInput => ({
    parentId: v.parentId ?? (batch ? batch.parentId : parentId), name: v.name, department: v.department || null, position: v.position || null, headcount: v.headcount ?? null,
    fromDate: v.range?.[0]?.format('YYYY-MM-DD') ?? null, toDate: v.range?.[1]?.format('YYYY-MM-DD') ?? null, closed,
  })
  const save = useMutation({
    mutationFn: async (x: { v: EditValues; closed?: boolean }) => batch ? (await recruit.updateBatch(batch.id, toInput(x.v, x.closed ?? batch.status === 'closed')), undefined) : await recruit.createBatch(toInput(x.v)),
    onSuccess: (id) => { msg.success(t('usr.saved')); qc.invalidateQueries({ queryKey: ['recruit'] }); onSaved(id) },
    onError: (e) => msg.error(errText(e)),
  })
  // Nút cha chọn được: mọi nút đang mở, trừ chính nó và con cháu
  const banned = batch ? subtreeIds(batches, batch.id) : new Set<number>()
  const parentTree = useMemo(() => {
    const mk = (pid: number | null): TreeOpt[] =>
      batches.filter((b) => (b.parentId ?? null) === pid && b.status === 'open' && !banned.has(b.id)).map((b) => ({ value: b.id, title: b.name, children: mk(b.id) }))
    return mk(null)
  }, [batches, batch])   // eslint-disable-line react-hooks/exhaustive-deps
  const parent = batches.find((b) => b.id === (batch ? batch.parentId : parentId))
  return (
    <AppModal open onClose={onClose} size="sm" icon={isRoot ? <CalendarOutlined /> : <FolderOutlined />}
      title={batch ? t('rec.bt.editTitle') : t(isRoot ? 'rec.bt.addBatch' : 'rec.bt.addFolder')} subtitle={parent ? parent.name : undefined}
      okLoading={save.isPending} onOk={() => form.validateFields().then((v) => save.mutate({ v }))}
      extra={batch ? <Button danger={batch.status === 'open'} onClick={() => form.validateFields().then((v) => save.mutate({ v, closed: batch.status === 'open' }))}>{t(batch.status === 'open' ? 'rec.bt.close' : 'rec.bt.reopen')}</Button> : undefined}>
      <Form form={form} layout="vertical" initialValues={batch ? {
        name: batch.name, department: batch.department ?? undefined, position: batch.position ?? undefined, headcount: batch.headcount, parentId: batch.parentId,
        range: batch.fromDate || batch.toDate ? [batch.fromDate ? dayjs(batch.fromDate) : null, batch.toDate ? dayjs(batch.toDate) : null] : null,
      } : undefined}>
        <Form.Item name="name" label={t(isRoot ? 'rec.bt.batchName' : 'rec.bt.folderName')} rules={[{ required: true, whitespace: true, max: 150 }]}><Input autoFocus placeholder={t(isRoot ? 'rec.bt.batchPh' : 'rec.bt.folderPh')} /></Form.Item>
        <Space wrap style={{ width: '100%' }} size={12}>
          <Form.Item name="position" label={t('rec.position')} rules={[{ max: 150 }]} style={{ minWidth: 200 }}><Input /></Form.Item>
          <Form.Item name="department" label={t('rec.department')} rules={[{ max: 100 }]} style={{ minWidth: 160 }}><Input /></Form.Item>
          <Form.Item name="headcount" label={t('rec.bt.headcount')}><InputNumber min={1} max={10000} style={{ width: 120 }} /></Form.Item>
        </Space>
        {isRoot && <Form.Item name="range" label={t('rec.bt.range')}><DatePicker.RangePicker allowEmpty={[true, true]} format="DD/MM/YYYY" /></Form.Item>}
        {batch && batch.parentId != null && (
          <Form.Item name="parentId" label={t('rec.bt.parent')}><TreeSelect treeData={parentTree} treeDefaultExpandAll showSearch treeNodeFilterProp="title" /></Form.Item>
        )}
      </Form>
    </AppModal>
  )
}

/** Nút "Chuyển thư mục" trên thanh hồ sơ đã chọn: chọn đợt / thư mục đích (hoặc bỏ khỏi thư mục). */
export function MoveToBatchButton({ ids, batches, onDone }: { ids: number[]; batches: RecruitBatch[]; onDone: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<number | null>(null)
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const move = useMutation({
    mutationFn: () => recruit.moveToBatch(ids, target === NONE_NODE ? null : target),
    onSuccess: (n) => { msg.success(t('rec.bt.moved', { n })); setOpen(false); setTarget(null); qc.invalidateQueries({ queryKey: ['recruit'] }); onDone() },
    onError: (e) => msg.error(errText(e)),
  })
  const tree = useMemo(() => [...batchTreeData(batches, t, true), { value: NONE_NODE, title: t('rec.bt.none'), children: [] }], [batches, t])
  if (ids.length === 0) return null
  return (
    <Popover open={open} onOpenChange={setOpen} trigger="click" title={t('rec.bt.moveTitle', { n: ids.length })} content={(
      <Space direction="vertical" style={{ width: 300 }}>
        <TreeSelect style={{ width: '100%' }} treeData={tree} value={target ?? undefined} onChange={(v) => setTarget(v)} treeDefaultExpandAll showSearch treeNodeFilterProp="title" placeholder={t('rec.bt.pickTarget')} />
        <Button type="primary" block disabled={target === null} loading={move.isPending} onClick={() => move.mutate()}>{t('rec.bt.moveGo')}</Button>
      </Space>
    )}>
      <Button icon={<FolderOpenOutlined />}>{t('rec.bt.move', { n: ids.length })}</Button>
    </Popover>
  )
}
