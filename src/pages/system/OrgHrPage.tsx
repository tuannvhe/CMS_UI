import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Tag, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SyncOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { adminError } from '../../api/userAdmin'
import { orgModel, type OrgEmployee, type OrgErpPreview } from '../../api/orgModel'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { OrgJobsPanel } from './OrgJobsPanel'
import { useToast } from '../../hooks/useToast'

const PAGE_SIZE = 50

function PlacementModal({ emp, onClose }: { emp: OrgEmployee | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [form] = Form.useForm<{ teamId: number | null; partId: number | null; isOp: boolean; position: string }>()
  const nodes = useQuery({ queryKey: ['orgModel', 'nodes'], queryFn: orgModel.nodes, enabled: !!emp })
  const teamId = Form.useWatch('teamId', form)
  const isOp = Form.useWatch('isOp', form)
  const all = nodes.data ?? []
  const deptName = (id: number | null) => all.find((n) => n.nodeId === id)?.name
  const teams = all.filter((n) => n.kind === 'TEAM' && n.isActive).map((n) => ({ value: n.nodeId, label: `${n.name}${deptName(n.parentId) ? ` — ${deptName(n.parentId)}` : ''}` }))
  const parts = all.filter((n) => n.kind === 'PART' && n.isActive && n.parentId === teamId).map((n) => ({ value: n.nodeId, label: n.name }))
  const save = useMutation({
    mutationFn: (v: { teamId: number | null; partId: number | null; isOp: boolean; position: string }) =>
      orgModel.setPlacement(emp!.employeeId, { teamId: v.teamId ?? null, partId: v.isOp ? v.partId ?? null : null, isOp: v.isOp, position: v.position?.trim() || null }),
    onSuccess: () => { msg.success(t('om.saved')); qc.invalidateQueries({ queryKey: ['orgModel'] }); onClose() },
    onError: (e) => { const a = adminError(e); msg.error(t(`om.err.${a.detail || 'generic'}`, { defaultValue: t('om.err.generic') })) },
  })
  return (
    <Modal open={!!emp} title={emp ? `${emp.employeeId} — ${emp.fullName}` : ''} okText={t('om.save')} cancelText={t('om.cancel')} confirmLoading={save.isPending}
      onCancel={onClose} onOk={() => form.validateFields().then((v) => save.mutate(v))} destroyOnHidden afterOpenChange={(o) => {
        if (o && emp) form.setFieldsValue({ teamId: emp.teamId, partId: emp.partId, isOp: emp.isOp, position: emp.position })
      }}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('om.placementNote')} />
      <Form form={form} layout="vertical">
        <Form.Item name="teamId" label={t('om.team')}>
          <Select allowClear showSearch optionFilterProp="label" options={teams} loading={nodes.isLoading} onChange={() => form.setFieldValue('partId', null)} />
        </Form.Item>
        <Form.Item name="position" label={t('om.position')}><Input maxLength={100} /></Form.Item>
        <Form.Item name="isOp" label={t('om.isOp')} valuePropName="checked"><Switch /></Form.Item>
        {isOp && (
          <Form.Item name="partId" label={t('om.part')}>
            <Select allowClear showSearch optionFilterProp="label" options={parts} disabled={!teamId} placeholder={teamId ? undefined : t('om.pickTeamFirst')} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

function SyncPanel() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [prev, setPrev] = useState<OrgErpPreview | null>(null)
  const errText = (e: unknown) => {
    const a = adminError(e)
    if (a.code === 'erp_not_configured') return t('om.err.erpNotConfigured')
    if (a.code === 'table_missing') return t('om.err.tableMissing')
    return t('om.err.generic')
  }
  const preview = useMutation({ mutationFn: orgModel.erpPreview, onSuccess: setPrev, onError: (e) => msg.error(errText(e)) })
  const sync = useMutation({
    mutationFn: orgModel.erpSync,
    onSuccess: (r) => { msg.success(t('om.syncDone', { n: r.new, r: r.resigned, x: r.newNodes })); setPrev(null); qc.invalidateQueries({ queryKey: ['orgModel'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  return (
    <Space direction="vertical" size={10} style={{ marginBottom: 14, width: '100%' }}>
      <Space wrap>
        <Button icon={<SyncOutlined />} loading={preview.isPending} onClick={() => preview.mutate()}>{t('om.erpPreview')}</Button>
        <Popconfirm title={t('om.syncConfirm')} okText={t('om.syncRun')} cancelText={t('om.cancel')} onConfirm={() => sync.mutate()}>
          <Button type="primary" loading={sync.isPending}>{t('om.syncRun')}</Button>
        </Popconfirm>
      </Space>
      {prev && (
        <Alert type={prev.configured ? 'info' : 'warning'} showIcon closable onClose={() => setPrev(null)}
          title={prev.configured ? t('om.previewResult', { e: prev.erpEmployees, n: prev.newCount, r: prev.resignCount }) : t('om.err.erpNotConfigured')}
          description={prev.configured && (prev.newSample.length > 0 || prev.resignSample.length > 0) ? (
            <div>
              {prev.newSample.length > 0 && <div>{t('om.sampleNew')}: {prev.newSample.join(', ')}{prev.newCount > prev.newSample.length ? ', …' : ''}</div>}
              {prev.resignSample.length > 0 && <div>{t('om.sampleResign')}: {prev.resignSample.join(', ')}{prev.resignCount > prev.resignSample.length ? ', …' : ''}</div>}
            </div>
          ) : undefined} />
      )}
    </Space>
  )
}

function EmployeesTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [search, setSearch] = useState('')
  const [deptId, setDeptId] = useState<number | undefined>()
  const [teamId, setTeamId] = useState<number | undefined>()
  const [partId, setPartId] = useState<number | undefined>()
  const [status, setStatus] = useState('active')
  const [source, setSource] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState<OrgEmployee | null>(null)
  const nodes = useQuery({ queryKey: ['orgModel', 'nodes'], queryFn: orgModel.nodes })
  const q = useQuery({
    queryKey: ['orgModel', 'employees', search, deptId, teamId, partId, status, source, page],
    queryFn: () => orgModel.employees({ search, deptId, teamId, partId, status, source, page, pageSize: PAGE_SIZE }),
    placeholderData: (p) => p,
  })
  const toggle = useMutation({
    mutationFn: (e: OrgEmployee) => orgModel.setActive(e.employeeId, !e.isActive),
    onSuccess: () => { msg.success(t('om.saved')); qc.invalidateQueries({ queryKey: ['orgModel'] }) },
    onError: () => msg.error(t('om.err.generic')),
  })
  const all = nodes.data ?? []
  const opts = (kind: string, parent?: number) => all.filter((n) => n.kind === kind && (parent === undefined || n.parentId === parent)).map((n) => ({ value: n.nodeId, label: n.name }))
  const reset = () => setPage(1)
  const columns: ColumnsType<OrgEmployee> = useMemo(() => [
    { title: t('om.code'), dataIndex: 'employeeId', width: 110, render: (v: string) => <b>{v}</b> },
    { title: t('om.fullName'), dataIndex: 'fullName', width: 200 },
    { title: t('om.dept'), dataIndex: 'dept', width: 180, render: (v: string | null) => v ?? <span className="cell-muted">—</span> },
    { title: t('om.team'), dataIndex: 'team', width: 180, render: (v: string | null) => v ?? <Tag color="warning" variant="filled">{t('om.noTeam')}</Tag> },
    { title: t('om.part'), dataIndex: 'part', width: 150, render: (v: string | null) => v ?? <span className="cell-muted">—</span> },
    { title: t('om.position'), dataIndex: 'position', width: 120, render: (v: string, r) => <span>{v || '—'}{r.isOp && <Tag style={{ marginLeft: 6 }} color="blue" variant="filled">OP</Tag>}</span> },
    { title: t('om.source'), dataIndex: 'source', width: 90, render: (v: string) => <Tag variant="filled">{v}</Tag> },
    { title: t('om.status'), dataIndex: 'isActive', width: 110, render: (v: boolean) => <Tag color={v ? 'success' : 'default'} variant="filled">{t(v ? 'om.working' : 'om.left')}</Tag> },
    { title: '', key: 'a', width: 200, fixed: 'right', render: (_: unknown, r) => (
      <Space size={0}>
        <Button type="link" size="small" onClick={() => setEdit(r)}>{t('om.editPlacement')}</Button>
        <Popconfirm title={t(r.isActive ? 'om.resignConfirm' : 'om.rehireConfirm', { name: r.fullName })} onConfirm={() => toggle.mutate(r)}>
          <Button type="link" size="small" danger={r.isActive}>{t(r.isActive ? 'om.resign' : 'om.rehire')}</Button>
        </Popconfirm>
      </Space>
    ) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t])
  return (
    <>
      <DataTable<OrgEmployee> rowKey="employeeId" size="small" sticky={false} loading={q.isLoading || q.isFetching} columns={columns} dataSource={q.data?.rows ?? []}
        toolbar={(
          <Space wrap>
            <Input.Search allowClear style={{ width: 240 }} placeholder={t('om.search')} onSearch={(v) => { setSearch(v); reset() }} />
            <Select allowClear style={{ width: 180 }} placeholder={t('om.dept')} options={opts('DEPT')} value={deptId} onChange={(v) => { setDeptId(v); setTeamId(undefined); setPartId(undefined); reset() }} showSearch optionFilterProp="label" />
            <Select allowClear style={{ width: 200 }} placeholder={t('om.team')} options={opts('TEAM', deptId)} value={teamId} onChange={(v) => { setTeamId(v); setPartId(undefined); reset() }} showSearch optionFilterProp="label" />
            <Select allowClear style={{ width: 160 }} placeholder={t('om.part')} options={opts('PART', teamId)} value={partId} disabled={!teamId} onChange={(v) => { setPartId(v); reset() }} showSearch optionFilterProp="label" />
            <Select style={{ width: 140 }} value={status} onChange={(v) => { setStatus(v); reset() }}
              options={[{ value: 'active', label: t('om.working') }, { value: 'left', label: t('om.left') }, { value: 'noteam', label: t('om.noTeam') }, { value: 'all', label: t('om.all') }]} />
            <Select allowClear style={{ width: 120 }} placeholder={t('om.source')} value={source} onChange={(v) => { setSource(v); reset() }} options={[{ value: 'ERP', label: 'ERP' }, { value: 'EXCEL', label: 'EXCEL' }]} />
          </Space>
        )}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: q.data?.total ?? 0, showSizeChanger: false, onChange: setPage }} />
      <PlacementModal emp={edit} onClose={() => setEdit(null)} />
    </>
  )
}

function LogTab() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['orgModel', 'log'], queryFn: () => orgModel.log(200) })
  return (
    <DataTable<{ at: string; action: string; employeeId: string; detail: string }> rowKey={(r) => `${r.at}-${r.action}-${r.employeeId}-${r.detail}`} size="small" sticky={false} loading={q.isLoading}
      dataSource={q.data ?? []} pagination={{ pageSize: 50, showSizeChanger: false }} columns={[
        { title: t('om.logAt'), dataIndex: 'at', width: 160, render: (v: string) => v.replace('T', ' ').slice(0, 16) },
        { title: t('om.logAction'), dataIndex: 'action', width: 160, render: (v: string) => <Tag variant="filled">{v}</Tag> },
        { title: t('om.code'), dataIndex: 'employeeId', width: 110 },
        { title: t('om.logDetail'), dataIndex: 'detail' },
      ]} />
  )
}

export default function OrgHrPage() {
  const { t } = useTranslation()
  const ready = useQuery({ queryKey: ['orgModel', 'status'], queryFn: orgModel.status })
  const stats = useQuery({ queryKey: ['orgModel', 'stats'], queryFn: orgModel.stats, enabled: ready.data?.ready === true })
  const s = stats.data
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<TeamOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.orgHr')} subtitle={t('nav.orgHrDesc')} />
      {ready.data && !ready.data.ready ? <Alert type="warning" showIcon title={t('om.err.tableMissing')} /> : (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('om.hrNote')} />
          {s && <StatTiles items={[
            { label: t('om.tileTotal'), value: s.total, color: '#667085' },
            { label: t('om.tileActive'), value: s.active, color: '#2E9E4F' },
            { label: t('om.tileLeft'), value: s.left, color: '#98A2B3' },
            { label: t('om.tileOp'), value: s.op, color: '#1677ff' },
            { label: t('om.tileNoTeam'), value: s.noTeam, color: '#F79009' },
            { label: t('om.tileErp'), value: s.fromErp, color: '#7A5AF8' },
          ]} />}
          {s && <p className="cell-muted">{t('om.lastSync', { at: s.lastSync ? s.lastSync.replace('T', ' ').slice(0, 16) : '—' })}</p>}
          <SyncPanel />
          <Tabs items={[
            { key: 'emp', label: t('om.tabEmp'), children: <EmployeesTab /> },
            { key: 'jobs', label: t('om.tabJobs'), children: <OrgJobsPanel /> },
            { key: 'log', label: t('om.tabLog'), children: <LogTab /> },
          ]} />
        </>
      )}
    </div>
  )
}
