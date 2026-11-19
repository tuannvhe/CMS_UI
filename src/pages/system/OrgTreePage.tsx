import { useCallback, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Dropdown, Empty, Form, Input, Modal, Space, Switch, Tabs } from 'antd'
import { ApartmentOutlined, ClusterOutlined, MoreOutlined, PlusOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminError } from '../../api/userAdmin'
import { orgLines, orgModel, type OrgKind, type OrgNode } from '../../api/orgModel'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { LineCard } from './OrgLineCards'
import { OrgNodePeopleTable } from './OrgNodePeopleModal'
import { OrgNodePicker } from './OrgTreeView'
import { SearchBox } from '../../components/SearchBox'

const CHILD: Record<OrgKind, OrgKind | null> = { DEPT: 'TEAM', TEAM: 'PART', PART: null }
const KIND: Record<OrgKind, { fg: string; bg: string; icon: React.ReactNode }> = {
  DEPT: { fg: '#0F6B3E', bg: 'rgba(15,107,62,.12)', icon: <ApartmentOutlined /> },
  TEAM: { fg: '#2563EB', bg: 'rgba(37,99,235,.12)', icon: <TeamOutlined /> },
  PART: { fg: '#C2610C', bg: 'rgba(217,119,6,.14)', icon: <ClusterOutlined /> },
}

const CSS = `
.ot-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 16px; align-items: start; }
.ot-side, .ot-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; box-shadow: var(--shadow-sm); }
.ot-side { padding: 14px; position: sticky; top: 12px; }
.ot-hero { padding: 20px 22px; display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.ot-hero-ico { width: 52px; height: 52px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; flex: none; }
.ot-crumb { font-size: 12px; color: var(--c-muted); }
.ot-title { margin: 2px 0 0; font-size: 22px; font-weight: 700; color: var(--c-text); line-height: 1.25; }
.ot-stats { display: flex; gap: 12px; flex-wrap: wrap; padding: 0 22px 20px; }
.ot-stat { flex: 1 1 140px; min-width: 130px; border: 1px solid var(--c-border); border-radius: 12px; padding: 10px 14px; background: var(--c-surface-2); }
.ot-stat b { display: block; font-size: 22px; line-height: 1.2; color: var(--c-text); }
.ot-stat span { font-size: 12px; color: var(--c-muted); }
.ot-body { padding: 4px 22px 22px; }
.ot-children { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.ot-child { text-align: left; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: 12px; padding: 12px 14px; cursor: pointer; display: flex; gap: 12px; align-items: center; transition: border-color .12s, box-shadow .12s, transform .12s; font: inherit; }
.ot-child:hover { border-color: var(--c-primary); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.ot-child .ico { width: 38px; height: 38px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 17px; flex: none; }
.ot-child b { display: block; color: var(--c-text); font-weight: 600; }
.ot-child small { color: var(--c-muted); }
.ot-empty { border: 1px dashed var(--c-border); border-radius: 14px; padding: 60px 20px; background: var(--c-surface); }
@media (max-width: 900px) { .ot-grid { grid-template-columns: minmax(0, 1fr); } .ot-side { position: static; } }
`

type Editing = { mode: 'add'; kind: OrgKind; parent: OrgNode | null } | { mode: 'edit'; node: OrgNode }

export default function OrgTreePage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [params, setParams] = useSearchParams()
  const selected = Number(params.get('node')) || null
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [form] = Form.useForm<{ name: string }>()
  const q = useQuery({ queryKey: ['orgModel', 'nodes'], queryFn: orgModel.nodes })
  const lineQ = useQuery({ queryKey: ['orgModel', 'lineCounts'], queryFn: orgLines.counts })
  const nodes = useMemo(() => q.data ?? [], [q.data])
  const visible = useMemo(() => nodes.filter((n) => showInactive || n.isActive), [nodes, showInactive])
  const byId = useMemo(() => new Map(nodes.map((n) => [n.nodeId, n])), [nodes])
  const node = selected ? byId.get(selected) ?? null : null
  const empCounts = useMemo(() => Object.fromEntries(visible.map((n) => [n.nodeId, n.employees])), [visible])
  const kids = useMemo(() => (node ? visible.filter((n) => n.parentId === node.nodeId).sort((a, b) => a.name.localeCompare(b.name, 'vi')) : []), [node, visible])
  const lineCount = lineQ.data?.counts?.[node?.nodeId ?? -1] ?? 0
  const linesQ = useQuery({ queryKey: ['orgModel', 'lines', selected], queryFn: () => orgLines.list(selected!), enabled: !!node })

  const errText = (e: unknown) => {
    const a = adminError(e)
    if (a.code === 'table_missing') return t('om.err.tableMissing')
    if (a.code === 'conflict') return t(`om.err.${a.detail || 'conflict'}`, { defaultValue: t('om.err.conflict') })
    return t(`om.err.${a.detail || 'generic'}`, { defaultValue: t('om.err.generic') })
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['orgModel'] })
  const save = useMutation({
    mutationFn: async (name: string) => {
      if (!editing) return
      if (editing.mode === 'add') await orgModel.addNode({ kind: editing.kind, name, parentId: editing.parent?.nodeId ?? null })
      else await orgModel.updateNode(editing.node.nodeId, { name, isActive: editing.node.isActive })
    },
    onSuccess: () => { msg.success(t('om.saved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (n: OrgNode) => orgModel.updateNode(n.nodeId, { name: n.name, isActive: !n.isActive }),
    onSuccess: () => { msg.success(t('om.saved')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const openEdit = useCallback((e: Editing) => { setEditing(e); form.setFieldsValue({ name: e.mode === 'edit' ? e.node.name : '' }) }, [form])
  const go = (n: OrgNode) => setParams({ node: String(n.nodeId) })
  const pathOf = (n: OrgNode) => { const names: string[] = []; for (let c: OrgNode | undefined = n; c; c = c.parentId ? byId.get(c.parentId) : undefined) names.unshift(c.name); return names }

  const title = editing ? (editing.mode === 'add' ? t(`om.add.${editing.kind}`) : t('om.rename')) : ''
  const parentName = editing?.mode === 'add' ? editing.parent?.name : undefined
  const child = node ? CHILD[node.kind] : null
  const ks = node ? KIND[node.kind] : null

  return (
    <div className="page wide">
      <style>{CSS}</style>
      <PageBanner avatar={<Avatar size={56} icon={<ApartmentOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.orgTree')} subtitle={t('nav.orgTreeDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 14 }} title={t('om.treeNote')} />
      {q.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={t('om.err.load')} />}
      <div className="ot-grid">
        <aside className="ot-side">
          <Button type="primary" block icon={<PlusOutlined />} onClick={() => openEdit({ mode: 'add', kind: 'DEPT', parent: null })}>{t('om.add.DEPT')}</Button>
          <SearchBox allowClear style={{ margin: '10px 0' }} placeholder={t('om.searchNode')} onSearch={setSearch} />
          <Space style={{ marginBottom: 8 }}><Switch size="small" checked={showInactive} onChange={setShowInactive} /><span className="cell-muted">{t('om.showInactive')}</span></Space>
          {visible.length === 0 && !q.isLoading ? <Empty description={t('om.treeEmpty')} /> : <OrgNodePicker nodes={visible} selected={selected} counts={empCounts} search={search} onSelect={go} />}
        </aside>
        <main>
          {!node || !ks ? (
            <div className="ot-empty"><Empty description={t('om.pickNode')} /></div>
          ) : (
            <div className="ot-card">
              <div className="ot-hero">
                <span className="ot-hero-ico" style={{ color: ks.fg, background: ks.bg }}>{ks.icon}</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="ot-crumb">{pathOf(node).slice(0, -1).join(' › ') || t(`om.kind.${node.kind}`)}</div>
                  <h2 className="ot-title">{node.name}{!node.isActive && <span className="ot-crumb"> · {t('om.inactive')}</span>}</h2>
                </div>
                <Space wrap>
                  {child && node.isActive && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit({ mode: 'add', kind: child, parent: node })}>{t(`om.add.${child}`)}</Button>}
                  <Dropdown trigger={['click']} menu={{ items: [
                    { key: 'rename', label: t('om.rename'), onClick: () => openEdit({ mode: 'edit', node }) },
                    { key: 'toggle', danger: node.isActive, label: t(node.isActive ? 'om.deactivate' : 'om.activate'), onClick: () => toggle.mutate(node) },
                  ] }}><Button icon={<MoreOutlined />} /></Dropdown>
                </Space>
              </div>
              <div className="ot-stats">
                <div className="ot-stat"><b>{node.employees}</b><span>{t('om.statPeople')}</span></div>
                <div className="ot-stat"><b>{kids.length}</b><span>{t('om.statChildren')}</span></div>
                <div className="ot-stat"><b>{lineCount}</b><span>{t('om.statLines')}</span></div>
              </div>
              <div className="ot-body">
                <Tabs items={[
                  { key: 'people', label: <span><UserOutlined /> {t('om.tabPeople')}</span>, children: <OrgNodePeopleTable key={node.nodeId} node={node} /> },
                  ...(child ? [{ key: 'kids', label: <span>{KIND[child].icon} {t('om.tabChildren', { kind: t(`om.kind.${child}`) })}</span>, children: kids.length === 0 ? <Empty description={t('om.noChildren')} /> : (
                    <div className="ot-children">
                      {kids.map((k) => (
                        <button key={k.nodeId} type="button" className="ot-child" onClick={() => go(k)} style={{ opacity: k.isActive ? 1 : 0.55 }}>
                          <span className="ico" style={{ color: KIND[k.kind].fg, background: KIND[k.kind].bg }}>{KIND[k.kind].icon}</span>
                          <span><b>{k.name}</b><small>{t('om.empCount', { n: k.employees })}</small></span>
                        </button>
                      ))}
                    </div>
                  ) }] : []),
                  { key: 'lines', label: <span><SafetyCertificateOutlined /> {t('om.tabLines')}</span>, children: lineQ.data && !lineQ.data.ready ? <Alert type="warning" showIcon title={t('om.err.lineTableMissing')} /> : (
                    <>
                      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('om.lineNote')} />
                      <LineCard kind="APPROVAL" node={node} lines={linesQ.data ?? []} nodeName={(id) => byId.get(id)?.name ?? ''} />
                      <LineCard kind="EVALUATION" node={node} lines={linesQ.data ?? []} nodeName={(id) => byId.get(id)?.name ?? ''} />
                    </>
                  ) },
                ]} />
              </div>
            </div>
          )}
        </main>
      </div>
      <Modal open={!!editing} title={title} okText={t('om.save')} cancelText={t('om.cancel')} confirmLoading={save.isPending} onCancel={() => setEditing(null)}
        onOk={() => form.validateFields().then((v) => save.mutate(v.name.trim()))} destroyOnHidden>
        {parentName && <p className="cell-muted">{t('om.under', { name: parentName })}</p>}
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('om.name')} rules={[{ required: true, whitespace: true, message: t('om.nameRequired') }, { max: 100 }]}>
            <Input autoFocus maxLength={100} onPressEnter={() => form.submit()} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
