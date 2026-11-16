import { useState } from 'react'
import { Alert, Button, Input, Popconfirm, Select, Space, Switch, Tabs, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { erpLink, type EmpLinkRow, type CmsEmployee, type ColumnSummary, type ErpVia, type ValueUsage } from '../../api/erpLink'
import { adminError, userAdmin } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { TeamOutlined, DiffOutlined, ScheduleOutlined } from '@ant-design/icons'
import { trData } from '../../utils/dataText'

function ViaTag({ via }: { via: ErpVia }) {
  const { t } = useTranslation()
  if (via === 'none') return <Tag color="warning" variant="filled">{t('erp.viaNone')}</Tag>
  return <Tag color={via === 'manual' ? 'blue' : 'success'} variant="filled">{t(via === 'manual' ? 'erp.viaManual' : 'erp.viaAuto')}</Tag>
}

function EmployeesTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useQuery({ queryKey: ['erp', 'employees', search, page], queryFn: () => erpLink.employees(search, page, 50), placeholderData: (p) => p })
  const columns: ColumnsType<EmpLinkRow> = [
    { title: t('erp.code'), width: 110, render: (_: unknown, r) => <b>{r.cms.employeeId}</b> },
    { title: t('erp.name'), width: 200, render: (_: unknown, r) => r.cms.fullName },
    { title: t('erp.cmsDept'), width: 220, render: (_: unknown, r) => r.cms.department || <span className="cell-muted">—</span> },
    { title: t('erp.erpName'), width: 200, render: (_: unknown, r) => (r.erp ? <div>{r.erp.name}{r.erp.retired && <Tag style={{ marginLeft: 6 }}>{t('erp.retired')}</Tag>}</div> : <span className="cell-muted">—</span>) },
    { title: t('erp.erpDept'), width: 240, render: (_: unknown, r) => (r.erp ? <div>{trData(r.erp.deptName)}<div className="cell-muted">{r.erp.uppDeptName}</div></div> : <span className="cell-muted">—</span>) },
    { title: t('erp.erpUser'), width: 160, render: (_: unknown, r) => r.erp?.userId ?? <span className="cell-muted">—</span> },
    { title: t('erp.status'), width: 190, render: (_: unknown, r) => (
      <Space size={4}><ViaTag via={r.via} />{r.erp && !r.deptMatches && <Tag color="error" variant="filled">{t('erp.deptDiff')}</Tag>}</Space>
    ) },
  ]
  return (
    <>
      <Input.Search allowClear style={{ width: 320, marginBottom: 12 }} placeholder={t('erp.search')} onSearch={(v) => { setSearch(v); setPage(1) }} />
      {q.isError ? <Alert type="error" showIcon title={t('erp.err.load')} /> : (
        <DataTable<EmpLinkRow> rowKey={(r) => r.cms.employeeId} size="small" sticky={false} loading={q.isLoading || q.isFetching} columns={columns} dataSource={q.data?.rows ?? []}
          pagination={{ current: page, pageSize: 50, total: q.data?.total ?? 0, showSizeChanger: false, onChange: setPage }} />
      )}
    </>
  )
}

function CompareTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const q = useQuery({ queryKey: ['erp', 'org'], queryFn: erpLink.orgCompare })
  const [col, setCol] = useState<string>('Team')
  const [onlyMissing, setOnlyMissing] = useState(true)
  const imp = useMutation({
    mutationFn: (f: File) => erpLink.orgImport(f),
    onSuccess: (r) => { msg.success(t('erp.orgImported', { n: r.imported })); if (r.warnings.includes('unitTableMissing')) msg.warning(t('erp.unitTableMissing')); qc.invalidateQueries({ queryKey: ['erp', 'org'] }) },
    onError: (e) => msg.error(t(`erp.orgErr.${adminError(e).detail ?? 'x'}`, { defaultValue: t('erp.err.generic', { detail: adminError(e).detail }) })),
  })
  const d = q.data
  const agreeRow = (field: 'dept' | 'part') => ({ key: field, field, ...Object.fromEntries(['Department', 'Team', 'Part'].map((c) => [c, d?.agree[`${field}=${c}`] ?? 0])) })
  const agreeCols: ColumnsType<ReturnType<typeof agreeRow>> = [
    { title: '', dataIndex: 'field', width: 220, render: (v: string) => <b>{t(v === 'dept' ? 'erp.cmsDeptField' : 'erp.cmsPartField')}</b> },
    ...['Department', 'Team', 'Part'].map((c) => ({
      title: t('erp.excelCol', { c }), dataIndex: c, width: 150, align: 'right' as const,
      render: (v: number) => { const pct = d?.matchedActive ? Math.round((v * 100) / d.matchedActive) : 0; return <span><b>{v}</b> <span className="cell-muted">({pct}%)</span></span> },
    })),
  ]
  const sumCols: ColumnsType<ColumnSummary> = [
    { title: t('erp.excelColumn'), dataIndex: 'column', width: 160, render: (v: string) => <b>{v}</b> },
    { title: t('erp.distinct'), dataIndex: 'distinct', width: 110, align: 'right' },
    { title: t('erp.asDept'), dataIndex: 'asDepartment', width: 200, align: 'right' },
    { title: t('erp.asUnit'), dataIndex: 'asUnit', width: 200, align: 'right' },
    { title: t('erp.missing'), dataIndex: 'missing', width: 140, align: 'right', render: (v: number) => (v > 0 ? <Tag color="warning" variant="filled">{v}</Tag> : 0) },
  ]
  const isMissing = (v: ValueUsage) => !v.inDepartments && !v.inUnits && !v.usedAsDepartment && !v.usedAsPart
  const valueCols: ColumnsType<ValueUsage> = [
    { title: t('erp.value'), dataIndex: 'value', width: 320, render: (v: string) => <b>{v}</b> },
    { title: t('erp.employees'), dataIndex: 'employees', width: 100, align: 'right' },
    { title: t('erp.status'), width: 480, render: (_: unknown, v) => isMissing(v) ? <Tag color="error" variant="filled">{t('erp.notInCms')}</Tag> : (
      <Space size={4} wrap>
        {v.inDepartments && <Tag variant="filled">{t('erp.inDepartments')}</Tag>}
        {v.inUnits && <Tag variant="filled">{t('erp.inUnits')}</Tag>}
        {v.usedAsDepartment && <Tag color="blue" variant="filled">{t('erp.usedAsDept')}</Tag>}
        {v.usedAsPart && <Tag color="blue" variant="filled">{t('erp.usedAsPart')}</Tag>}
      </Space>
    ) },
  ]
  const values = (d?.values ?? []).filter((v) => v.column === col && (!onlyMissing || isMissing(v)))
  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('erp.orgNote')} />
      <Space style={{ marginBottom: 12 }} wrap>
        <Upload accept=".xlsx" showUploadList={false} beforeUpload={(f) => { imp.mutate(f); return false }}>
          <Button type="primary" loading={imp.isPending}>{t('erp.orgUpload')}</Button>
        </Upload>
        <span className="cell-muted">{d?.import.count ? t('erp.orgLast', { n: d.import.count, at: d.import.at ? new Date(d.import.at).toLocaleString() : '', by: d.import.by ?? '' }) : t('erp.orgNone')}</span>
      </Space>
      {q.isError ? <Alert type="error" showIcon title={t('erp.err.load')} /> : d && d.import.count > 0 && (
        <>
          <StatTiles items={[
            { label: t('erp.tileExcel'), value: d.excelEmployees, color: '#667085' },
            { label: t('erp.tileMatched'), value: d.matchedActive, color: '#2E9E4F' },
            { label: t('erp.tileExcelNotCms'), value: d.excelNotInCms, color: d.excelNotInCms ? '#D48806' : '#2E9E4F' },
            { label: t('erp.tileCmsNotExcel'), value: d.cmsActiveNotInExcel, color: d.cmsActiveNotInExcel ? '#D92D20' : '#2E9E4F' },
          ]} />
          <Typography.Title level={5}>{t('erp.agreeTitle', { n: d.matchedActive })}</Typography.Title>
          <DataTable rowKey="key" size="small" sticky={false} columns={agreeCols} dataSource={[agreeRow('dept'), agreeRow('part')]} pagination={false} />
          <Typography.Title level={5} style={{ marginTop: 20 }}>{t('erp.valuesTitle')}</Typography.Title>
          <DataTable<ColumnSummary> rowKey="column" size="small" sticky={false} columns={sumCols} dataSource={d.columns} pagination={false} />
          <Space style={{ margin: '12px 0' }} wrap>
            <Select style={{ width: 200 }} value={col} onChange={setCol} options={['Department', 'Team', 'Part'].map((c) => ({ value: c, label: t('erp.excelCol', { c }) }))} />
            <Switch checked={onlyMissing} onChange={setOnlyMissing} /> <span>{t('erp.onlyMissing')}</span>
          </Space>
          <DataTable<ValueUsage> rowKey={(v) => `${v.column}|${v.value}`} size="small" sticky={false} columns={valueCols} dataSource={values} pagination={{ pageSize: 50, showSizeChanger: false }} locale={{ emptyText: t('erp.nothingMissing') }} />
          {d.cmsActiveNotInExcelSample.length > 0 && (
            <>
              <Typography.Title level={5} style={{ marginTop: 20 }}>{t('erp.cmsNotExcelTitle', { n: d.cmsActiveNotInExcel })}</Typography.Title>
              <DataTable<CmsEmployee> rowKey="employeeId" size="small" sticky={false} dataSource={d.cmsActiveNotInExcelSample} pagination={{ pageSize: 20, showSizeChanger: false }} columns={[
                { title: t('erp.code'), dataIndex: 'employeeId', width: 120, render: (v: string) => <b>{v}</b> },
                { title: t('erp.name'), dataIndex: 'fullName', width: 240 },
                { title: t('erp.cmsDept'), dataIndex: 'department', width: 260 },
                { title: t('erp.unit'), dataIndex: 'partCode', width: 260 },
              ]} />
            </>
          )}
        </>
      )}
    </>
  )
}

function JobsTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const q = useQuery({ queryKey: ['erp', 'job'], queryFn: erpLink.orgAccountJob })
  const groups = useQuery({ queryKey: ['erp', 'job', 'groups'], queryFn: userAdmin.groups })
  const save = useMutation({
    mutationFn: erpLink.saveOrgAccountJob,
    onSuccess: (d) => { msg.success(t('erp.jobSaved')); qc.setQueryData(['erp', 'job'], d) },
    onError: (e) => msg.error(t('erp.err.generic', { detail: adminError(e).detail })),
  })
  const run = useMutation({
    mutationFn: erpLink.runOrgAccountJob,
    onSuccess: (r) => { msg.success(t('erp.jobRan', { e: r.erpNew, r: r.erpResigned, a: r.employeesAdded, c: r.accountsCreated, f: r.failed })); qc.invalidateQueries({ queryKey: ['erp', 'job'] }) },
    onError: (e) => msg.error(t('erp.err.generic', { detail: adminError(e).detail })),
  })
  const d = q.data
  if (!d) return null
  const s = d.settings
  const posMap = s.positionGroups ?? {}
  const update = (patch: Partial<{ enabled: boolean; groupId: string | null; syncEmployees: boolean; positionGroups: Record<string, string> }>) => save.mutate({ ...s, positionGroups: posMap, ...patch })
  const groupOptions = (groups.data ?? []).filter((g) => g.active).map((g) => ({ value: g.groupId, label: g.nameVi || g.name }))
  const setPos = (pos: string, g: string | undefined) => { const m = { ...posMap }; if (g) m[pos] = g; else delete m[pos]; update({ positionGroups: m }) }
  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('erp.jobsNote')} />
      <Space direction="vertical" size={14}>
        <Space><Switch checked={s.syncEmployees} loading={save.isPending} onChange={(v) => update({ syncEmployees: v })} /> <span>{t('erp.jobSync')}</span></Space>
        <Space wrap>
          <Switch checked={s.enabled} loading={save.isPending} disabled={!s.groupId} onChange={(v) => update({ enabled: v })} /> <span>{t('erp.jobAccount')}</span>
          <Select style={{ width: 260 }} placeholder={t('erp.jobGroup')} value={s.groupId ?? undefined} loading={groups.isLoading}
            options={(groups.data ?? []).filter((g) => g.active).map((g) => ({ value: g.groupId, label: g.nameVi || g.name }))} onChange={(v) => update({ groupId: v })} />
        </Space>
        <div>
          <Typography.Text strong>{t('erp.jobPosTitle')}</Typography.Text>
          <DataTable<{ position: string; employees: number }> rowKey="position" size="small" sticky={false} dataSource={d.positions} pagination={false} style={{ marginTop: 8, maxWidth: 560 }} columns={[
            { title: t('erp.jobPosition'), dataIndex: 'position', width: 200 },
            { title: t('erp.jobPosCount'), dataIndex: 'employees', width: 90 },
            { title: t('erp.jobGroup'), key: 'g', render: (_: unknown, r: { position: string }) => <Select allowClear style={{ width: 240 }} placeholder={t('erp.jobPosDefault')} value={posMap[r.position]} options={groupOptions} onChange={(v) => setPos(r.position, v)} /> },
          ]} />
        </div>
        <span>{t('erp.jobPending', { n: d.pending })}{d.sample.length > 0 ? ` (${d.sample.join(', ')}${d.pending > d.sample.length ? ', …' : ''})` : ''}</span>
        <span>{t('erp.jobLast', { at: d.lastRun ? d.lastRun.replace('T', ' ').slice(0, 16) : '-', c: d.lastCreated, f: d.lastFailed })}</span>
        <Popconfirm title={t('erp.jobRunConfirm')} onConfirm={() => run.mutate()} disabled={!s.enabled && !s.syncEmployees}>
          <Button loading={run.isPending} disabled={!s.enabled && !s.syncEmployees}>{t('erp.jobRun')}</Button>
        </Popconfirm>
      </Space>
    </>
  )
}

export default function ErpLinkPage() {
  const { t } = useTranslation()
  const st = useQuery({ queryKey: ['erp', 'status'], queryFn: erpLink.status })
  if (st.data && !st.data.configured) return <Alert type="warning" showIcon title={t('erp.notConfigured')} />
  return (
    <div>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('erp.note')} />
      <Tabs items={[
        { key: 'emp', icon: <TeamOutlined />, label: t('erp.tabEmp'), children: <EmployeesTab /> },
        { key: 'compare', icon: <DiffOutlined />, label: t('erp.tabCompare'), children: <CompareTab /> },
        { key: 'jobs', icon: <ScheduleOutlined />, label: t('erp.tabJobs'), children: <JobsTab /> },
      ]} />
    </div>
  )
}
