import { useMemo, useState } from 'react'
import { Dropdown, Empty, Tooltip } from 'antd'
import { ApartmentOutlined, ClusterOutlined, MoreOutlined, PlusOutlined, RightOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { OrgKind, OrgNode } from '../../api/orgModel'
import { foldText } from '../../utils/search'

const CHILD: Record<OrgKind, OrgKind | null> = { DEPT: 'TEAM', TEAM: 'PART', PART: null }
const ICON: Record<OrgKind, React.ReactNode> = { DEPT: <ApartmentOutlined />, TEAM: <TeamOutlined />, PART: <ClusterOutlined /> }

const CSS = `
.otv { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; box-shadow: var(--shadow-card, var(--shadow-sm)); overflow: hidden; }
.otv-head, .otv-row { display: grid; grid-template-columns: minmax(260px, 1fr) 96px 120px 48px; align-items: center; }
.otv-head { padding: 0 16px; height: 40px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--c-muted); background: var(--c-surface-2); border-bottom: 1px solid var(--c-border); }
.otv-head > :nth-child(n+2) { text-align: center; }
.otv-row { padding: 0 16px; min-height: 54px; border-bottom: 1px solid var(--c-border); transition: background .12s; }
.otv-row:last-child { border-bottom: 0; }
.otv-row:hover { background: var(--c-tint); }
.otv-row.dept { background: var(--c-surface-2); }
.otv-row.dept:hover { background: var(--c-tint); }
.otv-name { display: flex; align-items: center; gap: 10px; min-width: 0; position: relative; }
.otv-chev { width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: var(--c-muted); flex: none; cursor: pointer; transition: background .12s; }
.otv-chev:hover { background: var(--c-tint-strong); color: var(--c-primary); }
.otv-chev svg { font-size: 11px; transition: transform .15s; }
.otv-chev.open svg { transform: rotate(90deg); }
.otv-ico { width: 34px; height: 34px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; flex: none; }
.otv-title { min-width: 0; line-height: 1.25; }
.otv-title b { display: block; font-weight: 600; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.otv-sub { display: flex; align-items: center; gap: 8px; margin-top: 2px; font-size: 12px; color: var(--c-muted); }
.otv-pill { font-size: 11px; font-weight: 600; padding: 0 8px; border-radius: 999px; line-height: 18px; }
.otv-cell { display: flex; justify-content: center; }
.otv-btn { border: 0; background: transparent; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600; color: var(--c-text); transition: background .12s, color .12s; }
.otv-btn:hover { background: var(--c-tint-strong); color: var(--c-primary); }
.otv-btn.zero { color: var(--c-muted); font-weight: 500; }
.otv-btn.line.has { background: var(--c-tint); color: var(--c-primary); }
.otv-btn.line.has:hover { background: var(--c-tint-strong); }
.otv-more { border: 0; background: transparent; width: 30px; height: 30px; border-radius: 8px; color: var(--c-muted); cursor: pointer; opacity: .55; transition: opacity .12s, background .12s; }
.otv-row:hover .otv-more, .otv-more:focus-visible { opacity: 1; }
.otv-more:hover { background: var(--c-tint-strong); color: var(--c-primary); }
.otv-off { opacity: .5; }
.otp { max-height: 560px; overflow: auto; margin: 0 -4px; padding: 0 4px; }
.otp-row { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 8px; border-radius: 8px; cursor: pointer; transition: background .12s; }
.otp-row:hover { background: var(--c-surface-2); }
.otp-row.sel { background: var(--c-tint-strong); box-shadow: inset 3px 0 0 var(--c-primary); }
.otp-row.sel .otp-name { color: var(--c-primary); font-weight: 600; }
.otp-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--c-text); }
.otp-ico { width: 24px; height: 24px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex: none; }
.otp-n { font-size: 11px; font-weight: 600; color: var(--c-primary); background: var(--c-tint); border-radius: 999px; padding: 0 7px; line-height: 18px; }
@media (max-width: 640px) { .otv-head, .otv-row { grid-template-columns: minmax(150px, 1fr) 70px 90px 40px; padding: 0 8px; } }
`

const KIND_STYLE: Record<OrgKind, { fg: string; bg: string }> = {
  DEPT: { fg: '#0F6B3E', bg: 'rgba(15,107,62,.12)' },
  TEAM: { fg: '#2563EB', bg: 'rgba(37,99,235,.12)' },
  PART: { fg: '#C2610C', bg: 'rgba(217,119,6,.14)' },
}

export interface OrgTreeViewProps {
  nodes: OrgNode[]
  lineCounts: Record<string, number>
  search: string
  expandAllSignal: number   // tăng số này để mở tất cả; âm để thu gọn tất cả
  onPeople: (n: OrgNode) => void
  onLines: (n: OrgNode) => void
  onAdd: (kind: OrgKind, parent: OrgNode) => void
  onRename: (n: OrgNode) => void
  onToggle: (n: OrgNode) => void
}

/** Cây tổ chức dạng bảng phân cấp: mặc định thu gọn, mở từng nhánh bằng mũi tên; khi tìm thì tự mở đường tới nút khớp. */
export function OrgTreeView(p: OrgTreeViewProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [lastSignal, setLastSignal] = useState(0)
  const children = useMemo(() => {
    const m = new Map<number | null, OrgNode[]>()
    for (const n of p.nodes) { const k = n.parentId ?? null; m.set(k, [...(m.get(k) ?? []), n]) }
    for (const v of m.values()) v.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return m
  }, [p.nodes])
  if (p.expandAllSignal !== lastSignal) {
    setLastSignal(p.expandAllSignal)
    setOpen(p.expandAllSignal > 0 ? new Set(p.nodes.filter((n) => (children.get(n.nodeId) ?? []).length > 0).map((n) => n.nodeId)) : new Set())
  }
  const needle = foldText(p.search.trim())
  const byId = useMemo(() => new Map(p.nodes.map((n) => [n.nodeId, n])), [p.nodes])
  const { keep, expandForSearch } = useMemo(() => {
    const keep = new Set<number>(), exp = new Set<number>()
    if (needle) for (const n of p.nodes) if (foldText(n.name).includes(needle)) {
      keep.add(n.nodeId)
      for (let c = n.parentId ? byId.get(n.parentId) : undefined; c; c = c.parentId ? byId.get(c.parentId) : undefined) { keep.add(c.nodeId); exp.add(c.nodeId) }
    }
    return { keep, expandForSearch: exp }
  }, [needle, p.nodes, byId])

  const toggleOpen = (id: number) => setOpen((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })

  const row = (n: OrgNode, depth: number): React.ReactNode => {
    const all = children.get(n.nodeId) ?? []
    const kids = all.filter((c) => !needle || keep.has(c.nodeId))
    const hasKids = all.length > 0
    const expanded = needle ? expandForSearch.has(n.nodeId) : open.has(n.nodeId)
    const child = CHILD[n.kind]
    const lines = p.lineCounts[n.nodeId] ?? 0
    const ks = KIND_STYLE[n.kind]
    return (
      <div key={n.nodeId}>
        <div className={`otv-row${n.kind === 'DEPT' ? ' dept' : ''}${n.isActive ? '' : ' otv-off'}`}>
          <div className="otv-name" style={{ paddingLeft: depth * 30 }}>
            <span className={`otv-chev${expanded ? ' open' : ''}`} style={{ visibility: hasKids ? 'visible' : 'hidden' }} onClick={() => toggleOpen(n.nodeId)}><RightOutlined /></span>
            <span className="otv-ico" style={{ color: ks.fg, background: ks.bg }}>{ICON[n.kind]}</span>
            <div className="otv-title" style={{ cursor: hasKids ? 'pointer' : 'default' }} onClick={() => hasKids && toggleOpen(n.nodeId)}>
              <b title={n.name}>{n.name}</b>
              <div className="otv-sub">
                <span className="otv-pill" style={{ color: ks.fg, background: ks.bg }}>{t(`om.kind.${n.kind}`)}</span>
                {hasKids && <span>{t('om.childCount', { n: all.length })}</span>}
                {!n.isActive && <span>· {t('om.inactive')}</span>}
              </div>
            </div>
          </div>
          <div className="otv-cell">
            <Tooltip title={t('om.viewPeople')}>
              <button type="button" className={`otv-btn${n.employees === 0 ? ' zero' : ''}`} onClick={() => p.onPeople(n)}><UserOutlined />{n.employees}</button>
            </Tooltip>
          </div>
          <div className="otv-cell">
            <Tooltip title={t('om.viewLines')}>
              <button type="button" className={`otv-btn line${lines > 0 ? ' has' : ' zero'}`} onClick={() => p.onLines(n)}><SafetyCertificateOutlined />{lines > 0 ? t('om.lineBtn', { n: lines }) : <PlusOutlined />}</button>
            </Tooltip>
          </div>
          <div className="otv-cell">
            <Dropdown trigger={['click']} menu={{ items: [
              ...(child && n.isActive ? [{ key: 'add', icon: <PlusOutlined />, label: t(`om.add.${child}`), onClick: () => p.onAdd(child, n) }] : []),
              { key: 'rename', label: t('om.rename'), onClick: () => p.onRename(n) },
              { key: 'toggle', danger: n.isActive, label: t(n.isActive ? 'om.deactivate' : 'om.activate'), onClick: () => p.onToggle(n) },
            ] }}>
              <button type="button" className="otv-more" aria-label="menu"><MoreOutlined /></button>
            </Dropdown>
          </div>
        </div>
        {expanded && kids.map((c) => row(c, depth + 1))}
      </div>
    )
  }
  const roots = (children.get(null) ?? []).filter((n) => n.kind === 'DEPT' && (!needle || keep.has(n.nodeId)))
  if (roots.length === 0) return <Empty description={t('om.treeEmpty')} />
  return (
    <div className="otv">
      <style>{CSS}</style>
      <div className="otv-head"><span>{t('om.name')}</span><span>{t('om.colPeople')}</span><span>{t('om.colLines')}</span><span /></div>
      {roots.map((n) => row(n, 0))}
    </div>
  )
}

/** Chọn một nút của cây (gọn, mặc định thu gọn, tự mở nhánh chứa nút đang chọn và nhánh khớp khi tìm). */
export function OrgNodePicker({ nodes, selected, counts, search, onSelect }: { nodes: OrgNode[]; selected: number | null; counts: Record<string, number>; search: string; onSelect: (n: OrgNode) => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const byId = useMemo(() => new Map(nodes.map((n) => [n.nodeId, n])), [nodes])
  const children = useMemo(() => {
    const m = new Map<number | null, OrgNode[]>()
    for (const n of nodes) { const k = n.parentId ?? null; m.set(k, [...(m.get(k) ?? []), n]) }
    for (const v of m.values()) v.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return m
  }, [nodes])
  const needle = foldText(search.trim())
  const { keep, auto } = useMemo(() => {
    const keep = new Set<number>(), auto = new Set<number>()
    const up = (n: OrgNode, mark: boolean) => { for (let c = n.parentId ? byId.get(n.parentId) : undefined; c; c = c.parentId ? byId.get(c.parentId) : undefined) { if (mark) keep.add(c.nodeId); auto.add(c.nodeId) } }
    if (needle) for (const n of nodes) if (foldText(n.name).includes(needle)) { keep.add(n.nodeId); up(n, true) }
    const sel = selected ? byId.get(selected) : undefined
    if (sel) up(sel, false)
    return { keep, auto }
  }, [needle, nodes, byId, selected])
  const row = (n: OrgNode, depth: number): React.ReactNode => {
    const all = children.get(n.nodeId) ?? []
    const expanded = open.has(n.nodeId) || auto.has(n.nodeId)
    const ks = KIND_STYLE[n.kind]
    return (
      <div key={n.nodeId}>
        <div className={`otp-row${selected === n.nodeId ? ' sel' : ''}`} style={{ paddingLeft: 8 + depth * 18 }} onClick={() => onSelect(n)}>
          <span className="otv-chev" style={{ visibility: all.length ? 'visible' : 'hidden' }} onClick={(e) => { e.stopPropagation(); setOpen((s) => { const x = new Set(s); if (x.has(n.nodeId)) x.delete(n.nodeId); else x.add(n.nodeId); return x }) }}>
            <RightOutlined style={{ transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'none', fontSize: 11 }} />
          </span>
          <span className="otp-ico" style={{ color: ks.fg, background: ks.bg }}>{ICON[n.kind]}</span>
          <span className="otp-name" title={n.name}>{n.name}</span>
          {counts[n.nodeId] ? <span className="otp-n">{counts[n.nodeId]}</span> : null}
        </div>
        {expanded && all.filter((c) => !needle || keep.has(c.nodeId)).map((c) => row(c, depth + 1))}
      </div>
    )
  }
  return <div className="otp"><style>{CSS}</style>{(children.get(null) ?? []).filter((n) => n.kind === 'DEPT' && (!needle || keep.has(n.nodeId))).map((n) => row(n, 0))}</div>
}
