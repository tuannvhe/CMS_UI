import { invalidateOrgData } from '../../api/cache'
import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Collapse, Input, Popconfirm, Segmented, Select, Space, Switch, Tabs, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ApartmentOutlined, InfoCircleOutlined, PlusOutlined, ReloadOutlined, RightOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { coverage, type CoverageEmployee } from '../../api/lines'
import { org, ORG_TABLE_SQL, type DepartmentNode, type UnitNode } from '../../api/org'
import { adminError } from '../../api/userAdmin'
import { AddDepartmentModal, AddUnitModal, NextStepModal } from '../../components/OrgModals'
import type { DepartmentInfo } from '../../api/departments'
import { AppModal } from '../../components/AppModal'
import { ApproverLineModal } from '../../components/ApproverLineModal'
import { EvaluatorLineModal } from '../../components/EvaluatorLineModal'
import { MiniTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { CleanupPanel } from '../system/DataCleanupPage'

type Tone = 'ok' | 'warn' | 'bad' | 'muted'
const STATUS_TONE: Record<UnitNode['status'], Tone> = { ok: 'ok', no_line: 'bad', gap: 'warn', invalid: 'warn' }

/** Nhãn nhỏ có màu theo mức độ: xanh = ổn, vàng = cần chú ý, đỏ = thiếu, xám = trung tính. */
function Chip({ tone = 'muted', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`org-chip ${tone}`}>{children}</span>
}

/** Chưa tạo bảng Tbl_OrgUnits: hướng dẫn chạy script một lần. */
function NotReady({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  const { t } = useTranslation()
  const msg = useToast()
  return (
    <Card title={t('org.notReadyTitle')}>
      <Typography.Paragraph>{t('org.notReadyText')}</Typography.Paragraph>
      <pre className="org-sql">{ORG_TABLE_SQL}</pre>
      <Space>
        <Button onClick={() => navigator.clipboard?.writeText(ORG_TABLE_SQL).then(() => msg.success(t('org.copied')))}>{t('org.copy')}</Button>
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={onRetry}>{t('org.recheck')}</Button>
      </Space>
    </Card>
  )
}

/**
 * Cơ cấu tổ chức: bộ phận → phòng ban. Mỗi phòng ban có line duyệt và line đánh giá riêng; phòng ban không có line duyệt riêng thì dùng line của bộ phận.
 * Mỗi bộ phận là một thẻ gập lại được; phần đầu thẻ đã đủ để thấy chỗ thiếu, mở ra mới thấy từng phòng ban.
 */
export default function OrgStructurePage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todo' | 'all'>('todo')
  const [open, setOpen] = useState<string[]>([])
  const [addDep, setAddDep] = useState(false)
  const [addUnit, setAddUnit] = useState<{ open: boolean; department?: string }>({ open: false })
  const [next, setNext] = useState<DepartmentInfo | null>(null)
  const [people, setPeople] = useState<{ department: string; part: string } | null>(null)
  const [target, setTarget] = useState<Record<string, string | undefined>>({})
  const [lineOf, setLineOf] = useState<{ name: string; kind: 'department' | 'unit' } | null>(null)
  const [evalOf, setEvalOf] = useState<string | null>(null)

  const q = useQuery({ queryKey: ['org'], queryFn: org.overview, retry: false })
  const list = useQuery({ queryKey: ['coverage', 'employees', people], queryFn: () => coverage.employees(people!.department, people!.part), enabled: !!people })
  const refresh = () => invalidateOrgData(qc)

  const toggle = useMutation({
    mutationFn: (u: UnitNode) => org.toggleUnit(u.id),
    onSuccess: () => { msg.success(t('usr.saved')); refresh() },
    onError: (e) => msg.error(adminError(e).detail === 'has_employees' ? t('org.err.has_employees') : t('usr.err.generic')),
  })
  const assign = useMutation({
    mutationFn: (v: { name: string; department: string }) => org.assignUnit(v),
    onSuccess: (r) => { msg.success(t('org.assigned', { n: r.employees })); refresh() },
    onError: (e) => { const { detail } = adminError(e); msg.error(t(`org.err.${detail}`, { defaultValue: t('usr.err.generic') })) },
  })

  const o = q.data
  const bulkAssign = useMutation({
    mutationFn: async (items: { name: string; department: string }[]) => { let employees = 0; for (const it of items) employees += (await org.assignUnit(it)).employees; return { units: items.length, employees } },
    onSuccess: (r) => { msg.success(t('org.bulkDone', { units: r.units, n: r.employees })); refresh() },
    onError: (e) => { const { detail } = adminError(e); msg.error(t(`org.err.${detail}`, { defaultValue: t('usr.err.generic') })); refresh() },
  })
  // Gợi ý = bộ phận có nhiều nhân viên đang dùng phòng ban đó nhất. Chỉ gộp những phòng ban có gợi ý và đổi bộ phận so với hiện tại.
  const suggestions = (o?.orphans ?? []).filter((r) => r.suggestedDepartment && r.suggestedDepartment.toLowerCase() !== (r.currentDepartment ?? '').toLowerCase()).map((r) => ({ name: r.name, department: r.suggestedDepartment as string, employees: r.employees }))
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    const needs = (u: UnitNode) => u.status !== 'ok' || !u.active
    return (o?.departments ?? []).filter((d) => d.active).map((d) => ({
      ...d,
      units: d.units.filter((u) => (filter === 'all' || needs(u)) && (!s || d.name.toLowerCase().includes(s) || u.name.toLowerCase().includes(s))),
      total: d.units.length,
    })).filter((d) => (!s || d.name.toLowerCase().includes(s) || d.units.length > 0) && (filter === 'all' ? true : d.units.length > 0 || d.unassigned > 0 || d.approverLines === 0))
  }, [o, search, filter])

  const goApprover = (name: string, kind: 'department' | 'unit' = 'unit') => setLineOf({ name, kind })
  const goEvaluator = (name: string) => setEvalOf(name)   // sửa line đánh giá ngay trong hộp thoại, không sang màn Line đánh giá

  const personColumns: ColumnsType<CoverageEmployee> = [
    { title: t('org.colEmp'), dataIndex: 'employeeId', width: 110 },
    { title: t('org.colName'), dataIndex: 'fullName', ellipsis: true },
    { title: t('org.colPosition'), dataIndex: 'position', width: 130, render: (v: string) => v || '-' },
    { title: t('cov.level'), dataIndex: 'level', width: 90, render: (v: number | null) => (v === null ? <Chip>{t('cov.noLevel')}</Chip> : v) },
    { title: t('cov.evaluators'), dataIndex: 'evaluators', width: 120, render: (v: number) => (v > 0 ? <Chip tone="ok">{v}</Chip> : <Chip tone="bad">{t('cov.none')}</Chip>) },
  ]

  const unitRow = (dep: DepartmentNode, u: UnitNode) => (
    <div key={u.id} className={`org-unit${u.active ? '' : ' off'}`}>
      <div className="ou-name">
        <b>{u.name}</b>
        {!u.active && <Chip>{t('org.off')}</Chip>}
      </div>
      <div className="ou-num" title={t('cov.employees')}>{u.employees}<span>{t('cov.employees')}</span></div>
      <div className="ou-num" title={t('cov.uncovered')}>{u.uncovered > 0 ? <Chip tone="bad">{u.uncovered}</Chip> : <Chip tone="ok">0</Chip>}<span>{t('cov.uncovered')}</span></div>
      <div className="ou-line">
        {u.approverLines > 0 ? <Chip tone="ok">{t('dep.approversN', { n: u.approverLines })}</Chip> : <Chip>{t('org.usesDepartmentLine')}</Chip>}
        <Button size="small" type="link" onClick={() => goApprover(u.name)}>{u.approverLines > 0 ? t('org.open') : t('org.createOwn')}</Button>
      </div>
      <div className="ou-line">
        {u.rounds.length ? u.rounds.map((r) => <Chip key={r} tone="ok">{t('line.roundN', { n: r })}</Chip>) : <Chip tone="bad">{t('cov.st.no_line')}</Chip>}
        {u.invalidEvaluators > 0 && <Chip tone="warn">{t('cov.invalidN', { n: u.invalidEvaluators })}</Chip>}
        <Button size="small" type="link" onClick={() => goEvaluator(u.name)}>{u.rounds.length ? t('org.open') : t('cov.createLine')}</Button>
      </div>
      <div className="ou-status"><Chip tone={STATUS_TONE[u.status]}>{t(`cov.st.${u.status}`)}</Chip></div>
      <div className="ou-act">
        <Tooltip title={t('cov.viewPeople')}><Button size="small" type="text" icon={<TeamOutlined />} onClick={() => setPeople({ department: dep.name, part: u.name })} /></Tooltip>
        <Popconfirm title={t(u.active ? 'org.offAsk' : 'org.onAsk', { name: u.name })} okText="OK" cancelText={t('req.cancel')} onConfirm={() => toggle.mutate(u)} disabled={u.active && u.employees > 0}>
          <Switch size="small" checked={u.active} disabled={u.active && u.employees > 0} loading={toggle.isPending && toggle.variables?.id === u.id} />
        </Popconfirm>
      </div>
    </div>
  )

  const departmentItems = rows.map((d) => ({
    key: d.name,
    label: (
      <div className="org-dep-head">
        <div className="od-title"><ApartmentOutlined /><b>{d.name}</b></div>
        <div className="od-chips">
          <Chip>{d.employees} {t('cov.employees')}</Chip>
          <Chip>{filter === 'todo' && d.units.length < d.total ? `${d.units.length}/${d.total}` : d.total} {t('org.unitsN')}</Chip>
          {d.unassigned > 0 && <Chip tone="bad">{d.unassigned} {t('org.unassigned')}</Chip>}
          {d.approverLines > 0 ? <Chip tone="ok">{t('dep.approversN', { n: d.approverLines })}</Chip> : <Chip tone="warn">{t('dep.noApproverLine')}</Chip>}
        </div>
      </div>
    ),
    extra: (
      <Space size={4} onClick={(e) => e.stopPropagation()}>
        <Button size="small" type="link" onClick={() => goApprover(d.name, 'department')}>{d.approverLines > 0 ? t('org.approverLine') : t('dep.createApproverLine')}</Button>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setAddUnit({ open: true, department: d.name })}>{t('org.addUnit')}</Button>
      </Space>
    ),
    children: d.units.length ? (
      <div className="org-units">
        <div className="org-unit head">
          <div>{t('org.unit')}</div><div className="r">{t('cov.employees')}</div><div className="r">{t('cov.uncovered')}</div>
          <div>{t('org.approverLine')}</div><div>{t('org.evaluatorLine')}</div><div>{t('cov.status')}</div><div />
        </div>
        {d.units.map((u) => unitRow(d, u))}
        {d.units.length < d.total && <div className="org-hidden">{t('org.hiddenOk', { n: d.total - d.units.length })} <Button size="small" type="link" onClick={() => setFilter('all')}>{t('org.showAll')}</Button></div>}
      </div>
    ) : <Typography.Text type="secondary">{d.total ? t('cov.allGood') : t('org.noUnits')}{d.total > 0 && <Button size="small" type="link" onClick={() => setFilter('all')}>{t('org.showAll')}</Button>}</Typography.Text>,
  }))

  const orphanItems = (o?.orphans.length ?? 0) > 0 ? [{
    key: 'orphans',
    label: <span className="org-orphan-head"><WarningOutlined /> <b>{t('org.orphansTitle', { n: o!.orphans.length })}</b><span>{t('org.orphansHint')}</span></span>,
    children: (
      <div className="org-orphans">
        {suggestions.length > 0 && (
          <Alert type="info" showIcon style={{ marginBottom: 8 }} title={t('org.suggestBulk', { n: suggestions.length })}
            action={(
              <Popconfirm title={t('org.suggestBulkAsk', { n: suggestions.length, e: suggestions.reduce((a, x) => a + x.employees, 0) })} okText={t('org.assign')} cancelText={t('req.cancel')} onConfirm={() => bulkAssign.mutate(suggestions)}>
                <Button size="small" type="primary" loading={bulkAssign.isPending}>{t('org.suggestApplyAll')}</Button>
              </Popconfirm>
            )} />
        )}
        {o!.orphans.map((r) => {
          const value = target[r.name] ?? r.suggestedDepartment ?? undefined
          return (
            <div key={r.name} className="org-orphan">
              <div className="oo-main"><b>{r.name}</b><span>{t(`org.kind.${r.kind}`, { dep: r.currentDepartment ?? '' })}</span>
                {r.breakdown.length > 0 && <span className="oo-why">{t('org.suggestWhy')}: {r.breakdown.map((b) => `${b.department} (${b.employees})`).join(' · ')}</span>}
              </div>
              <Chip tone="warn">{r.employees} {t('cov.employees')}</Chip>
              <RightOutlined className="oo-arrow" />
              <Select showSearch size="small" style={{ width: 240 }} placeholder={t('org.pickDepartment')} optionFilterProp="label" value={value}
                onChange={(v) => setTarget((m) => ({ ...m, [r.name]: v }))} options={o!.departments.filter((d) => d.active).map((d) => ({ value: d.name, label: d.name }))} />
              <Popconfirm title={t('org.assignAsk', { name: r.name, dep: value ?? '', n: r.employees })} okText={t('org.assign')} cancelText={t('req.cancel')} disabled={!value} onConfirm={() => assign.mutate({ name: r.name, department: value! })}>
                <Button size="small" type="primary" disabled={!value} loading={assign.isPending && assign.variables?.name === r.name}>{t('org.assign')}</Button>
              </Popconfirm>
            </div>
          )
        })}
      </div>
    ),
  }] : []

  const structure = (
    <>
      {o && (
        <StatTiles items={[
          { label: t('org.tileUnits'), value: o.unitsTotal },
          { label: t('org.tileNoApprover'), value: o.unitsWithoutApprover, color: 'var(--c-muted)' },
          { label: t('org.tileNoEvaluator'), value: o.unitsWithoutEvaluator, color: o.unitsWithoutEvaluator ? '#D92D20' : undefined },
          { label: t('org.tileUnassigned'), value: o.employeesWithoutUnit, color: o.employeesWithoutUnit ? '#D48806' : undefined },
        ]} />
      )}
      {orphanItems.length > 0 && <Collapse className="org-orphan-box" items={orphanItems} />}
      <div className="org-toolbar">
        <Input.Search allowClear style={{ width: 280 }} placeholder={t('cov.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Segmented value={filter} onChange={(v) => setFilter(v as 'todo' | 'all')} options={[{ value: 'todo', label: t('cov.onlyTodo') }, { value: 'all', label: t('org.all') }]} />
        <Button type="text" onClick={() => setOpen(open.length ? [] : rows.map((r) => r.name))}>{open.length ? t('org.collapseAll') : t('org.expandAll')}</Button>
        <span className="spacer" />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddDep(true)}>{t('org.addDepartment')}</Button>
      </div>
      <div className="org-hint"><InfoCircleOutlined /> {t('org.note')}</div>
      {departmentItems.length
        ? <Collapse className="org-deps" activeKey={open} onChange={(k) => setOpen(Array.isArray(k) ? k : [k])} items={departmentItems} />
        : <Card><Typography.Text type="secondary">{q.isFetching ? '…' : t('cov.allGood')}</Typography.Text></Card>}
    </>
  )

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<ApartmentOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.orgStructure')} subtitle={t('nav.orgStructureDesc')} />
      <Tabs items={[
        {
          key: 'structure', label: t('org.tabStructure'),
          children: q.isError ? <Alert type="error" showIcon title={t('usr.err.generic')} /> : o && !o.ready ? <NotReady onRetry={() => q.refetch()} loading={q.isFetching} /> : structure,
        },
        { key: 'cleanup', label: t('org.tabCleanup'), children: <CleanupPanel /> },
      ]} />

      <ApproverLineModal name={lineOf?.name ?? null} kind={lineOf?.kind ?? 'unit'} onClose={() => setLineOf(null)} onChanged={refresh} />
      <EvaluatorLineModal name={evalOf} onClose={() => setEvalOf(null)} onChanged={refresh} />
      <AddDepartmentModal open={addDep} onClose={() => setAddDep(false)} onAdded={(d) => { setAddDep(false); setNext(d); refresh() }} />
      <AddUnitModal open={addUnit.open} department={addUnit.department} onClose={() => setAddUnit({ open: false })} onAdded={() => { setAddUnit({ open: false }); refresh() }} />
      <NextStepModal department={next} onClose={() => setNext(null)} />
      <AppModal open={!!people} onClose={() => setPeople(null)} size="lg" icon={<TeamOutlined />} title={t('cov.peopleTitle')} subtitle={people ? `${people.department} · ${people.part}` : undefined}>
        <MiniTable<CoverageEmployee> rowKey="employeeId" size="small" loading={list.isFetching} columns={personColumns} dataSource={list.data ?? []} pagination={{ pageSize: 20, showSizeChanger: false }} />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>{t('cov.levelHint')}</Typography.Paragraph>
      </AppModal>
    </div>
  )
}
