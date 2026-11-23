import { useMemo, useState } from 'react'
import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, FileExcelOutlined, LockOutlined, PlusOutlined, RollbackOutlined, UnlockOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { useToast } from '../../hooks/useToast'
import {
  kpi, type KpiAssignment, type KpiCategory, type KpiFrequency, type KpiIndicator, type KpiIndicatorBody, type KpiPeriod, type KpiSourceKind, type KpiValueType,
} from '../../api/kpi'
import { KPI_CSS } from './kpiUi'
import { STATUS_COLOR } from './kpiCalc'
import { CatLabel, KpiImportModal, KpiState, NameCell, PeriodSelect, PeriodStatusTag, ReasonModal, SheetStatusTag, SiteSelect, KpiHead } from './KpiParts'
import { invalidateKpi, kpiErrText, pickName, useDebounced, usePeriods } from './kpiShared'
import { foldFilter, foldText } from '../../utils/search'
import { trData } from '../../utils/dataText'

const CATS: KpiCategory[] = ['Q', 'C', 'D', 'S', 'P']
const VTS: KpiValueType[] = ['number', 'rating', 'yesno']
const SKS: KpiSourceKind[] = ['manual', 'excel']
const FRS: KpiFrequency[] = ['monthly', 'quarterly', 'yearly']
const dmy = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')
const ymd = (d: Dayjs | null | undefined) => (d ? d.format('YYYY-MM-DD') : undefined)
const TABS = ['lib', 'period', 'assign'] as const
type TabKey = (typeof TABS)[number]

/** HR (kpiAdmin): thư viện chỉ tiêu, kỳ KPI (đóng / khoá / mở lại), giao KPI cho phòng ban (sao chép kỳ trước, nhập thực tế hàng loạt). */
export default function KpiSetupPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab: TabKey = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as TabKey) : 'lib'
  const ready = useQuery({ queryKey: ['kpi-ready'], queryFn: kpi.ready })
  return (
    <div className="page wide kpi-page">
      <style>{KPI_CSS}</style>
      <KpiHead page="kpiAdmin" />
      <KpiState loading={ready.isLoading} error={ready.error} onRetry={() => ready.refetch()}>
        {ready.data === false
          ? <Alert type="warning" showIcon message={t('kpi.notReady')} action={<Button size="small" onClick={() => ready.refetch()}>{t('kpi.retry')}</Button>} />
          : (
            <div className="kpi-card">
              <Tabs activeKey={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} destroyOnHidden items={[
                { key: 'lib', label: t('kpi.lib.title'), children: <LibraryTab /> },
                { key: 'period', label: t('kpi.period.title'), children: <PeriodsTab /> },
                { key: 'assign', label: t('kpi.assign.title'), children: <AssignTab /> },
              ]} />
            </div>
          )}
      </KpiState>
    </div>
  )
}

/* ───────────── Thư viện chỉ tiêu ───────────── */

type IndForm = Omit<KpiIndicatorBody, 'lowerBetter'> & { lowerBetter?: boolean }

function LibraryTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['kpi-indicators-all'], queryFn: kpi.allIndicators })
  const [text, setText] = useState('')
  const search = useDebounced(foldText(text.trim()))
  const [cat, setCat] = useState<string>('')
  const [showOff, setShowOff] = useState(false)
  const [editing, setEditing] = useState<KpiIndicator | 'new' | null>(null)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['kpi-indicators-all'] }); qc.invalidateQueries({ queryKey: ['kpi-indicators'] }) }
  const active = useMutation({
    mutationFn: (x: { id: number; active: boolean }) => kpi.setIndicatorActive(x.id, x.active),
    onSuccess: (_, x) => { toast.success(t(x.active ? 'kpi.lib.activeOn' : 'kpi.lib.activeOff')); refresh() },
    onError: (e) => toast.error(kpiErrText(t, e)),
  })
  const rows = (q.data ?? []).filter((x) => (showOff || x.active) && (!cat || x.category === cat)
    && (!search || foldText(x.code).includes(search) || [x.name.vi, x.name.en, x.name.ko].some((n) => foldText(n).includes(search))))

  const cols: ColumnsType<KpiIndicator> = [
    { title: t('kpi.lib.name'), key: 'n', sorter: (a, b) => a.code.localeCompare(b.code), render: (_, r) => <NameCell ind={r} /> },
    { title: t('kpi.col.unit'), dataIndex: 'unit', width: 80 },
    { title: t('kpi.col.direction'), dataIndex: 'lowerBetter', width: 160, render: (v: boolean, r) => (r.valueType === 'yesno' ? t(`kpi.lib.vt.${r.valueType}`) : v ? t('kpi.lower') : t('kpi.higher')) },
    { title: t('kpi.lib.frequency'), dataIndex: 'frequency', width: 110, render: (v: KpiFrequency) => t(`kpi.lib.fr.${v}`) },
    { title: t('kpi.lib.sourceKind'), dataIndex: 'sourceKind', width: 100, render: (v: KpiSourceKind) => t(`kpi.lib.sk.${v}`) },
    { title: t('kpi.lib.active'), dataIndex: 'active', width: 90, render: (v: boolean, r) => <Switch size="small" checked={v} loading={active.isPending && active.variables?.id === r.id} onChange={(c) => active.mutate({ id: r.id, active: c })} /> },
    { title: '', key: 'a', width: 110, render: (_, r) => <Space>{r.used && <Tooltip title={t('kpi.lib.usedHint')}><Tag>{t('kpi.lib.used')}</Tag></Tooltip>}<Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)} aria-label={t('kpi.edit')} /></Space> },
  ]

  return (
    <>
      <div className="kpi-bar">
        <Input.Search allowClear style={{ width: 260 }} placeholder={t('kpi.lib.search')} value={text} onChange={(e) => setText(e.target.value)} />
        <Select style={{ width: 160 }} value={cat} onChange={setCat} options={[{ value: '', label: t('kpi.lib.allCats') }, ...CATS.map((c) => ({ value: c, label: <CatLabel cat={c} /> }))]} />
        <Space><Switch size="small" checked={showOff} onChange={setShowOff} />{t('kpi.lib.showInactive')}</Space>
        <Button style={{ marginLeft: 'auto' }} type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>{t('kpi.lib.add')}</Button>
      </div>
      <KpiState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
        <Table<KpiIndicator> size="small" rowKey="id" columns={cols} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 900 }} locale={{ emptyText: t('kpi.lib.empty') }} rowClassName={(r) => (r.active ? '' : 'kpi-off')} />
      </KpiState>
      {editing && <IndicatorModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
      <style>{'.kpi-off td { opacity: .55 }'}</style>
    </>
  )
}

function IndicatorModal({ item, onClose, onSaved }: { item: KpiIndicator | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [form] = Form.useForm<IndForm>()
  const vt = Form.useWatch('valueType', form)
  const init: Partial<IndForm> = item
    ? { code: item.code, nameVi: item.name.vi, nameEn: item.name.en, nameKo: item.name.ko, unit: item.unit, category: item.category, lowerBetter: item.lowerBetter,
        valueType: item.valueType, formula: item.formula, source: item.source, sourceKind: item.sourceKind, frequency: item.frequency }
    : { category: 'Q', valueType: 'number', sourceKind: 'manual', frequency: 'monthly', lowerBetter: false, unit: '%' }
  const save = useMutation({
    mutationFn: (v: IndForm) => {
      const b: KpiIndicatorBody = { ...v, code: v.code.trim(), nameVi: v.nameVi.trim(), nameEn: v.nameEn?.trim() || null, nameKo: v.nameKo?.trim() || null,
        unit: v.unit.trim(), lowerBetter: v.valueType === 'yesno' ? false : !!v.lowerBetter, formula: v.formula?.trim() || null, source: v.source?.trim() || null }
      return item ? kpi.updateIndicator(item.id, b) : kpi.createIndicator(b)
    },
    onSuccess: () => { toast.success(t('kpi.lib.saved')); onSaved() },
    onError: (e) => toast.error(kpiErrText(t, e)),
  })
  const req = { required: true, whitespace: true, message: t('kpi.required') }
  return (
    <Modal open title={item ? t('kpi.lib.edit') : t('kpi.lib.add')} onCancel={onClose} onOk={() => form.submit()} confirmLoading={save.isPending} okText={t('kpi.save')} cancelText={t('kpi.cancel')} width={680} destroyOnHidden centered>
      <Form form={form} layout="vertical" initialValues={init} onFinish={(v) => save.mutate(v)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0 12px' }}>
          <Form.Item name="code" label={t('kpi.lib.code')} rules={[req, { max: 30, message: t('kpi.err.code') }, { pattern: /^[A-Za-z0-9._-]+$/, message: t('kpi.err.code') }]} extra={item?.used ? t('kpi.lib.codeLocked') : undefined}>
            <Input disabled={!!item?.used} maxLength={30} />
          </Form.Item>
          <Form.Item name="category" label={t('kpi.det.group')} rules={[{ required: true, message: t('kpi.required') }]}><Select options={CATS.map((c) => ({ value: c, label: <CatLabel cat={c} /> }))} /></Form.Item>
          <Form.Item name="unit" label={t('kpi.col.unit')} rules={[req, { max: 20, message: t('kpi.err.unit') }]}><Input maxLength={20} /></Form.Item>
        </div>
        <Form.Item name="nameVi" label={t('kpi.lib.nameVi')} rules={[req]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="nameEn" label={t('kpi.lib.nameEn')}><Input maxLength={200} /></Form.Item>
        <Form.Item name="nameKo" label={t('kpi.lib.nameKo')}><Input maxLength={200} /></Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0 12px' }}>
          <Form.Item name="valueType" label={t('kpi.lib.valueType')} rules={[{ required: true, message: t('kpi.required') }]}><Select options={VTS.map((v) => ({ value: v, label: t(`kpi.lib.vt.${v}`) }))} /></Form.Item>
          <Form.Item name="lowerBetter" label={t('kpi.col.direction')} valuePropName="checked"><Switch disabled={vt === 'yesno'} checkedChildren={t('kpi.lower')} unCheckedChildren={t('kpi.higher')} /></Form.Item>
          <Form.Item name="frequency" label={t('kpi.lib.frequency')} rules={[{ required: true, message: t('kpi.required') }]}><Select options={FRS.map((v) => ({ value: v, label: t(`kpi.lib.fr.${v}`) }))} /></Form.Item>
          <Form.Item name="sourceKind" label={t('kpi.lib.sourceKind')} rules={[{ required: true, message: t('kpi.required') }]}><Select options={SKS.map((v) => ({ value: v, label: t(`kpi.lib.sk.${v}`) }))} /></Form.Item>
        </div>
        <Form.Item name="formula" label={t('kpi.det.formula')} extra={t('kpi.lib.viOnly')}><Input.TextArea rows={2} maxLength={500} /></Form.Item>
        <Form.Item name="source" label={t('kpi.det.source')} extra={t('kpi.lib.viOnly')}><Input maxLength={200} /></Form.Item>
      </Form>
    </Modal>
  )
}

/* ───────────── Kỳ KPI ───────────── */

function PeriodsTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const { modal } = App.useApp()
  const periods = usePeriods()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<KpiPeriod | null>(null)
  const [reopening, setReopening] = useState<KpiPeriod | null>(null)
  const onError = (e: unknown) => toast.error(kpiErrText(t, e))
  const after = (msg: string) => { toast.success(msg); invalidateKpi(qc) }

  const closing = useMutation({ mutationFn: (p: KpiPeriod) => kpi.closing(p.id), onSuccess: (r) => after(t('kpi.period.closingDone', { code: r.period.code, n: r.unapproved.length })), onError })
  const lock = useMutation({
    mutationFn: (x: { p: KpiPeriod; force: boolean }) => kpi.lock(x.p.id, x.force),
    onSuccess: (r, x) => {
      if (r.done) { after(t('kpi.period.lockDone', { code: r.period.code })); return }
      // Còn phiếu chưa duyệt: hỏi xác nhận kèm danh sách rồi khoá với force=true
      modal.confirm({
        title: t('kpi.period.lockUnapproved', { code: x.p.code, n: r.unapproved.length }),
        content: <ul style={{ maxHeight: 240, overflowY: 'auto', paddingLeft: 18, margin: '8px 0 0' }}>{r.unapproved.map((u) => <li key={u}>{u}</li>)}</ul>,
        okText: t('kpi.period.lockForce'), okButtonProps: { danger: true }, cancelText: t('kpi.cancel'),
        onOk: () => lock.mutateAsync({ p: x.p, force: true }),
      })
    },
    onError,
  })
  const reopen = useMutation({ mutationFn: (x: { p: KpiPeriod; reason: string }) => kpi.reopenPeriod(x.p.id, x.reason), onSuccess: (r) => { setReopening(null); after(t('kpi.period.reopenDone', { code: r.period.code })) }, onError })

  const cols: ColumnsType<KpiPeriod> = [
    { title: t('kpi.period.code'), dataIndex: 'code', width: 100, render: (v: string) => <b>{v}</b> },
    { title: t('kpi.col.status'), dataIndex: 'status', width: 110, render: (v: KpiPeriod['status']) => <PeriodStatusTag status={v} /> },
    { title: t('kpi.period.start'), dataIndex: 'start', width: 110, render: dmy },
    { title: t('kpi.period.end'), dataIndex: 'end', width: 110, render: dmy },
    { title: t('kpi.period.submitDue'), dataIndex: 'submitDue', width: 120, render: dmy },
    { title: t('kpi.period.locked'), key: 'lk', width: 190, render: (_, r) => (r.lockedAt ? `${dmy(r.lockedAt)} · ${r.lockedBy ?? ''}` : '—') },
    { title: '', key: 'a', render: (_, r) => (
      <Space wrap size={4}>
        {r.status !== 'locked' && <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>{t('kpi.period.editDates')}</Button>}
        {r.status === 'open' && (
          <Button size="small" loading={closing.isPending && closing.variables?.id === r.id}
            onClick={() => modal.confirm({ title: t('kpi.period.closingConfirm', { code: r.code }), content: t('kpi.period.closingHint'), okText: t('kpi.period.closing'), cancelText: t('kpi.cancel'), onOk: () => closing.mutateAsync(r) })}>
            {t('kpi.period.closing')}
          </Button>
        )}
        {r.status !== 'locked' && (
          <Button size="small" danger icon={<LockOutlined />} loading={lock.isPending && lock.variables?.p.id === r.id}
            onClick={() => modal.confirm({ title: t('kpi.period.lockConfirm', { code: r.code }), content: t('kpi.period.lockHint'), okText: t('kpi.period.lock'), okButtonProps: { danger: true }, cancelText: t('kpi.cancel'), onOk: () => lock.mutateAsync({ p: r, force: false }) })}>
            {t('kpi.period.lock')}
          </Button>
        )}
        {r.status !== 'open' && <Button size="small" icon={<UnlockOutlined />} onClick={() => setReopening(r)}>{t('kpi.period.reopen')}</Button>}
      </Space>
    ) },
  ]

  return (
    <>
      <div className="kpi-bar">
        <span style={{ color: 'var(--c-muted)', fontSize: 13 }}>{t('kpi.period.flowHint')}</span>
        <Button style={{ marginLeft: 'auto' }} type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>{t('kpi.period.create')}</Button>
      </div>
      <KpiState loading={periods.isLoading} error={periods.error} onRetry={() => periods.refetch()}>
        <Table<KpiPeriod> size="small" rowKey="id" columns={cols} dataSource={periods.data ?? []} pagination={{ pageSize: 12, hideOnSinglePage: true }} scroll={{ x: 1100 }} locale={{ emptyText: t('kpi.period.none') }} />
      </KpiState>
      {(creating || editing) && <PeriodModal period={editing} onClose={() => { setCreating(false); setEditing(null) }} onSaved={(msg) => { setCreating(false); setEditing(null); after(msg) }} />}
      {reopening && <ReasonModal open title={`${t('kpi.period.reopen')} ${reopening.code}`} label={t('kpi.period.reopenReason')} okText={t('kpi.period.reopen')}
        loading={reopen.isPending} onOk={(reason) => reopen.mutate({ p: reopening, reason })} onCancel={() => setReopening(null)} />}
    </>
  )
}

type PeriodForm = { month?: Dayjs; start?: Dayjs; end?: Dayjs; submitDue?: Dayjs }

function PeriodModal({ period, onClose, onSaved }: { period: KpiPeriod | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [form] = Form.useForm<PeriodForm>()
  const init: PeriodForm = period ? { start: dayjs(period.start), end: dayjs(period.end), submitDue: period.submitDue ? dayjs(period.submitDue) : undefined } : { month: dayjs().startOf('month') }
  const save = useMutation({
    mutationFn: (v: PeriodForm) => (period
      ? kpi.updatePeriod(period.id, { start: ymd(v.start), end: ymd(v.end), submitDue: ymd(v.submitDue) })
      : kpi.createPeriod({ code: (v.month ?? dayjs()).format('YYYY-MM'), start: ymd(v.start), end: ymd(v.end), submitDue: ymd(v.submitDue) })),
    onSuccess: (p) => onSaved(t(period ? 'kpi.period.saved' : 'kpi.period.created', { code: p.code })),
    onError: (e) => toast.error(kpiErrText(t, e)),
  })
  return (
    <Modal open title={period ? `${t('kpi.period.editDates')} ${period.code}` : t('kpi.period.create')} onCancel={onClose} onOk={() => form.submit()} confirmLoading={save.isPending}
      okText={t('kpi.save')} cancelText={t('kpi.cancel')} destroyOnHidden centered width={460}>
      <Form form={form} layout="vertical" initialValues={init} onFinish={(v) => save.mutate(v)}>
        {!period && (
          <Form.Item name="month" label={t('kpi.period.month')} rules={[{ required: true, message: t('kpi.required') }]} extra={t('kpi.period.monthOnly')}>
            <DatePicker picker="month" format="YYYY-MM" style={{ width: '100%' }} />
          </Form.Item>
        )}
        <Form.Item name="start" label={t('kpi.period.start')} extra={!period ? t('kpi.period.autoHint') : undefined}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="end" label={t('kpi.period.end')}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="submitDue" label={t('kpi.period.submitDue')}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  )
}

/* ───────────── Giao KPI ───────────── */

function AssignTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const periods = usePeriods()
  const [periodPick, setPeriodPick] = useState<number | undefined>()
  const period = periods.data?.find((p) => p.id === periodPick) ?? periods.data?.find((p) => p.status === 'open') ?? periods.data?.[0]
  const [site, setSite] = useState('')
  const [text, setText] = useState('')
  const search = useDebounced(foldText(text.trim()))
  const [editing, setEditing] = useState<KpiAssignment | null>(null)
  const [copying, setCopying] = useState(false)
  const [importing, setImporting] = useState(false)
  const [reopening, setReopening] = useState<KpiAssignment | null>(null)
  const q = useQuery({ queryKey: ['kpi-assignments', period?.id], queryFn: () => kpi.assignments((period as KpiPeriod).id), enabled: !!period })
  const rows = (q.data ?? []).filter((r) => (!site || r.unit.site === site)
    && (!search || foldText(r.unit.name).includes(search) || foldText(r.unit.department).includes(search)))
  const assigned = (q.data ?? []).filter((r) => r.sheetId).length
  const reopen = useMutation({
    mutationFn: (x: { id: number; reason: string }) => kpi.reopenSheet(x.id, x.reason),
    onSuccess: () => { setReopening(null); toast.success(t('kpi.assign.reopened')); invalidateKpi(qc) },
    onError: (e) => toast.error(kpiErrText(t, e)),
  })
  const isOpen = period?.status === 'open'

  const cols: ColumnsType<KpiAssignment> = [
    { title: t('kpi.col.dept'), key: 'u', sorter: (a, b) => a.unit.name.localeCompare(b.unit.name), render: (_, r) => (
      <span><b>{r.unit.name}</b>{!r.unit.active && <Tag style={{ marginLeft: 6 }}>{t('kpi.assign.inactiveUnit')}</Tag>}<br /><small style={{ color: 'var(--c-muted)' }}>{trData(r.unit.department)}{r.unit.site ? ` · ${r.unit.site}` : ''}</small></span>
    ) },
    { title: t('kpi.col.status'), dataIndex: 'status', width: 130, render: (v: KpiAssignment['status']) => <SheetStatusTag status={v} /> },
    { title: t('kpi.col.count'), dataIndex: 'itemCount', width: 100, align: 'right' },
    { title: t('kpi.weightSum'), dataIndex: 'weightSum', width: 110, align: 'right', render: (v: number, r) => (r.sheetId ? <b style={{ color: Math.abs(v - 100) <= 0.01 ? STATUS_COLOR.ok : STATUS_COLOR.low }}>{v}%</b> : '—') },
    { title: t('kpi.sheet.owners'), key: 'o', render: (_, r) => r.owners.map((o) => o.name).join(', ') || '—' },
    { title: '', key: 'a', width: 250, render: (_, r) => {
      const editable = isOpen && (!r.status || r.status === 'draft' || r.status === 'rejected')
      return (
        <Space wrap size={4}>
          <Tooltip title={!editable ? t(isOpen ? 'kpi.assign.lockedSheet' : 'kpi.assign.periodNotOpen') : undefined}>
            <Button size="small" type={r.sheetId ? 'default' : 'primary'} icon={r.sheetId ? <EditOutlined /> : <PlusOutlined />} disabled={!editable} onClick={() => setEditing(r)}>
              {r.sheetId ? t('kpi.edit') : t('kpi.assign.create')}
            </Button>
          </Tooltip>
          {r.sheetId && <Tooltip title={t('kpi.assign.view')}><Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/kpi/departments?sheet=${r.sheetId}`)} aria-label={t('kpi.assign.view')} /></Tooltip>}
          {r.sheetId && r.status === 'approved' && period?.status !== 'locked' && <Button size="small" icon={<RollbackOutlined />} onClick={() => setReopening(r)}>{t('kpi.assign.reopenSheet')}</Button>}
        </Space>
      )
    } },
  ]

  return (
    <>
      <div className="kpi-bar">
        <label>{t('kpi.period.label')}</label>
        <PeriodSelect periods={periods.data} loading={periods.isLoading} value={period?.id} onChange={setPeriodPick} />
        <label>{t('kpi.site.label')}</label>
        <SiteSelect value={site} onChange={setSite} />
        <Input.Search allowClear style={{ width: 220 }} placeholder={t('kpi.assign.search')} value={text} onChange={(e) => setText(e.target.value)} />
        <Space wrap style={{ marginLeft: 'auto' }}>
          <Button icon={<CopyOutlined />} disabled={!isOpen} onClick={() => setCopying(true)}>{t('kpi.assign.copy')}</Button>
          <Button icon={<FileExcelOutlined />} disabled={!period || period.status === 'locked'} onClick={() => setImporting(true)}>{t('kpi.import.bulk')}</Button>
        </Space>
      </div>
      {period && !isOpen && <Alert style={{ marginBottom: 12 }} type="info" showIcon message={t('kpi.assign.periodNotOpen')} />}
      <KpiState loading={periods.isLoading || q.isLoading} error={periods.error ?? q.error} onRetry={() => q.refetch()} empty={!period} emptyText={t('kpi.period.none')}>
        <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 6 }}>{t('kpi.assign.summary', { n: assigned, total: q.data?.length ?? 0 })}</div>
        <Table<KpiAssignment> size="small" rowKey={(r) => r.unit.id} columns={cols} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 1000 }} locale={{ emptyText: t('kpi.noData') }} />
      </KpiState>
      {editing && period && <AssignModal period={period} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidateKpi(qc) }} />}
      {copying && period && <CopyModal period={period} periods={periods.data ?? []} units={q.data ?? []} onClose={() => setCopying(false)} onDone={() => invalidateKpi(qc)} />}
      {period && <KpiImportModal open={importing} onClose={() => setImporting(false)} title={`${t('kpi.import.bulk')} · ${period.code}`}
        onTemplate={() => kpi.periodTemplate(period.id)} run={(f, dry) => kpi.importPeriod(period.id, f, dry)} onApplied={() => invalidateKpi(qc)} />}
      {reopening?.sheetId && <ReasonModal open title={`${t('kpi.assign.reopenSheet')} · ${reopening.unit.name}`} label={t('kpi.assign.reopenReason')} okText={t('kpi.assign.reopenSheet')}
        loading={reopen.isPending} onOk={(reason) => reopen.mutate({ id: reopening.sheetId as number, reason })} onCancel={() => setReopening(null)} />}
    </>
  )
}

type Line = { key: number; indicatorId?: number; weight: number | null; target: number | null }
let lineSeq = 0

function AssignModal({ period, row, onClose, onSaved }: { period: KpiPeriod; row: KpiAssignment; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const lib = useQuery({ queryKey: ['kpi-indicators-all'], queryFn: kpi.allIndicators })
  const current = useQuery({ queryKey: ['kpi-targets', period.id, row.unit.id], queryFn: () => kpi.targets(period.id, row.unit.id), enabled: !!row.sheetId })
  const suggest = useQuery({ queryKey: ['kpi-owner-suggest', row.unit.id], queryFn: () => kpi.suggestOwners(row.unit.id) })
  const [owners, setOwners] = useState<string[] | null>(null)
  const [lines, setLines] = useState<Line[] | null>(null)
  const ownersV = owners ?? row.owners.map((o) => o.id)
  // Chưa sửa: lấy theo phiếu đang giao (khoá dòng âm, cố định theo chỉ tiêu); dòng thêm mới có khoá dương tăng dần
  const linesV: Line[] = lines ?? (current.data?.items ?? []).slice().sort((a, b) => a.sort - b.sort).map((i) => ({ key: -i.indicator.id, indicatorId: i.indicator.id, weight: i.weight, target: i.target }))
  const set = (key: number, patch: Partial<Line>) => setLines(linesV.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const byId = useMemo(() => new Map((lib.data ?? []).map((i) => [i.id, i])), [lib.data])
  const sum = Math.round(linesV.reduce((s, l) => s + (l.weight ?? 0), 0) * 100) / 100
  const sumOk = Math.abs(sum - 100) <= 0.01
  const dup = new Set(linesV.map((l) => l.indicatorId).filter((id, i, a) => id != null && a.indexOf(id) !== i))
  const incomplete = linesV.some((l) => l.indicatorId == null || l.weight == null || l.weight <= 0 || l.target == null)
  const ownerOpts = [
    ...(suggest.data ?? []).map((p) => ({ value: p.id, label: `${p.isLeader ? '★ ' : ''}${p.name}${p.position ? ` · ${p.position}` : ''} (${p.id})` })),
    ...row.owners.filter((o) => !suggest.data?.some((p) => p.id === o.id)).map((o) => ({ value: o.id, label: `${o.name}${o.position ? ` · ${o.position}` : ''} (${o.id})` })),
  ]
  const save = useMutation({
    mutationFn: () => kpi.saveAssignment({
      periodId: period.id, unitId: row.unit.id, ownerIds: ownersV,
      items: linesV.map((l, i) => ({ indicatorId: l.indicatorId as number, weight: l.weight as number, target: l.target as number, sort: i + 1 })),
    }),
    onSuccess: () => { toast.success(t('kpi.assign.saved')); onSaved() },
    onError: (e) => toast.error(kpiErrText(t, e)),
  })
  const loading = lib.isLoading || (!!row.sheetId && current.isLoading)

  const cols: ColumnsType<Line> = [
    { title: '#', key: 'i', width: 40, render: (_, __, i) => i + 1 },
    { title: t('kpi.col.kpi'), key: 'ind', render: (_, l) => (
      <Select style={{ width: '100%', minWidth: 240 }} showSearch filterOption={foldFilter('label')} value={l.indicatorId} status={l.indicatorId != null && dup.has(l.indicatorId) ? 'error' : undefined}
        placeholder={t('kpi.assign.pickIndicator')}
        onChange={(v) => set(l.key, { indicatorId: v, ...(byId.get(v)?.valueType === 'yesno' ? { target: 1 } : {}) })}
        options={(lib.data ?? []).filter((x) => x.active || x.id === l.indicatorId).map((x) => ({ value: x.id, label: `${x.code} · ${pickName(x.name, i18n.language)}`, disabled: !x.active }))} />
    ) },
    { title: t('kpi.col.unit'), key: 'u', width: 70, render: (_, l) => (l.indicatorId ? byId.get(l.indicatorId)?.unit : '') },
    { title: t('kpi.col.weight'), key: 'w', width: 130, render: (_, l) => <InputNumber style={{ width: 120 }} min={0} max={100} step={5} value={l.weight} onChange={(v) => set(l.key, { weight: typeof v === 'number' ? v : null })} addonAfter="%" /> },
    { title: t('kpi.col.target'), key: 'tg', width: 160, render: (_, l) => {
      const ind = l.indicatorId ? byId.get(l.indicatorId) : undefined
      if (ind?.valueType === 'yesno') return <span>{t('kpi.sheet.yes')}</span>
      return <InputNumber style={{ width: 150 }} min={0} value={l.target} onChange={(v) => set(l.key, { target: typeof v === 'number' ? v : null })} addonBefore={ind ? (ind.lowerBetter ? '≤' : '≥') : undefined} />
    } },
    { title: '', key: 'x', width: 44, render: (_, l) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLines(linesV.filter((x) => x.key !== l.key))} aria-label={t('kpi.assign.remove')} /> },
  ]

  return (
    <Modal open title={`${t('kpi.assign.title')} · ${row.unit.name} · ${period.code}`} onCancel={onClose} width={900} destroyOnHidden centered
      okText={t('kpi.save')} cancelText={t('kpi.cancel')} confirmLoading={save.isPending} onOk={() => save.mutate()}
      okButtonProps={{ disabled: loading || linesV.length === 0 || !sumOk || dup.size > 0 || incomplete }}>
      <KpiState loading={loading} error={lib.error ?? current.error} onRetry={() => { lib.refetch(); current.refetch() }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>{t('kpi.sheet.owners')}</div>
        <Select mode="multiple" style={{ width: '100%' }} value={ownersV} onChange={setOwners} loading={suggest.isLoading} optionFilterProp="label"
          placeholder={t('kpi.assign.ownersPh')} options={ownerOpts} notFoundContent={t('kpi.assign.noSuggest')} />
        <div style={{ fontSize: 12, color: 'var(--c-muted)', margin: '4px 0 14px' }}>{t('kpi.assign.ownersHint')}</div>
        <Table<Line> size="small" rowKey="key" columns={cols} dataSource={linesV} pagination={false} scroll={{ x: 700, y: 360 }} locale={{ emptyText: t('kpi.sheet.noItems') }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <Button icon={<PlusOutlined />} onClick={() => setLines([...linesV, { key: ++lineSeq, weight: null, target: null }])}>{t('kpi.assign.addRow')}</Button>
          <span>{t('kpi.weightSum')}: <b style={{ color: sumOk ? STATUS_COLOR.ok : STATUS_COLOR.low }}>{sum}%</b></span>
          {!sumOk && linesV.length > 0 && <span style={{ color: STATUS_COLOR.low, fontSize: 12 }}>{t('kpi.err.weight_sum')}</span>}
          {dup.size > 0 && <span style={{ color: STATUS_COLOR.low, fontSize: 12 }}>{t('kpi.err.duplicate_indicator')}</span>}
          {incomplete && <span style={{ color: STATUS_COLOR.near, fontSize: 12 }}>{t('kpi.assign.incomplete')}</span>}
        </div>
      </KpiState>
    </Modal>
  )
}

function CopyModal({ period, periods, units, onClose, onDone }: { period: KpiPeriod; periods: KpiPeriod[]; units: KpiAssignment[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const others = periods.filter((p) => p.id !== period.id)
  const [from, setFrom] = useState<number | undefined>(others.find((p) => p.start < period.start)?.id ?? others[0]?.id)
  const [unitIds, setUnitIds] = useState<number[]>([])
  const nameOf = (id: number) => units.find((u) => u.unit.id === id)?.unit.name ?? String(id)
  const copy = useMutation({
    mutationFn: () => kpi.copyFrom(period.id, from as number, unitIds),
    onSuccess: (r) => { toast.success(t('kpi.assign.copyDone', { created: r.created, skipped: r.skipped.length })); onDone() },
    onError: (e) => toast.error(kpiErrText(t, e)),
  })
  const res = copy.data
  return (
    <Modal open title={`${t('kpi.assign.copy')} → ${period.code}`} onCancel={onClose} destroyOnHidden centered width={560}
      footer={<Space><Button onClick={onClose}>{t('kpi.close')}</Button>{!res && <Button type="primary" loading={copy.isPending} disabled={!from} onClick={() => copy.mutate()}>{t('kpi.assign.copyRun')}</Button>}</Space>}>
      {!res ? (
        <>
          <div style={{ marginBottom: 6 }}>{t('kpi.assign.copyFrom')}</div>
          <PeriodSelect periods={others} value={from} onChange={setFrom} style={{ width: '100%' }} />
          <div style={{ margin: '14px 0 6px' }}>{t('kpi.assign.copyUnits')}</div>
          <Select mode="multiple" allowClear style={{ width: '100%' }} value={unitIds} onChange={setUnitIds} optionFilterProp="label" placeholder={t('kpi.assign.copyAll')}
            options={units.map((u) => ({ value: u.unit.id, label: u.unit.name }))} />
          <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 8 }}>{t('kpi.assign.copyHint')}</div>
        </>
      ) : (
        <>
          <Alert type={res.skipped.length ? 'warning' : 'success'} showIcon message={t('kpi.assign.copyDone', { created: res.created, skipped: res.skipped.length })} />
          {res.skipped.length > 0 && (
            <Table style={{ marginTop: 12 }} size="small" rowKey="unitId" pagination={false} scroll={{ y: 260 }} dataSource={res.skipped}
              columns={[
                { title: t('kpi.col.dept'), key: 'u', render: (_: unknown, r) => nameOf(r.unitId) },
                { title: t('kpi.import.reason'), dataIndex: 'reason', render: (v: string) => t(`kpi.assign.skip.${v}`, { defaultValue: t(`kpi.err.${v}`, { defaultValue: v }) }) },
              ]} />
          )}
        </>
      )}
    </Modal>
  )
}
