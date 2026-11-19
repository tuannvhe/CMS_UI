import { useState } from 'react'
import { Alert, Badge, Button, Input, InputNumber, Popconfirm, Select, Space, Table, Tabs, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, FileExcelOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { useToast } from '../../hooks/useToast'
import { kpi, type KpiItem, type KpiLog, type KpiSheetDetail, type KpiSheetRow } from '../../api/kpi'
import { KPI_CSS, ScoreCell, ScoreRing } from './kpiUi'
import { achieve, STATUS_TEXT, weightedScore } from './kpiCalc'
import { KpiImportModal, NameCell, KpiState, PeriodSelect, ReasonModal, SheetStatusTag, KpiHead } from './KpiParts'
import { errInfo, fmtNum, invalidateKpi, kpiErrText, usePeriods } from './kpiShared'
import { trData } from '../../utils/dataText'

const dt = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—')

/** Nhập / nộp / duyệt KPI phòng ban: phiếu của tôi, phiếu chờ tôi duyệt; mở một phiếu để nhập thực tế, nhập Excel, nộp, duyệt hoặc từ chối. */
export default function KpiEntryPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const sheetId = Number(params.get('sheet')) || undefined
  const periods = usePeriods()
  const [periodId, setPeriodId] = useState<number | undefined>()
  const [tab, setTab] = useState<'mine' | 'toApprove'>('mine')
  const inbox = useQuery({ queryKey: ['kpi-inbox', periodId ?? null], queryFn: () => kpi.inbox(periodId), enabled: !sheetId })
  const open = (id: number | undefined) => setParams(id ? { sheet: String(id) } : {})

  const cols: ColumnsType<KpiSheetRow> = [
    { title: t('kpi.col.dept'), dataIndex: 'unitName', render: (v: string, r) => <a onClick={() => open(r.id)}><b>{v}</b>{r.site ? <small style={{ color: 'var(--c-muted)' }}> · {r.site}</small> : null}</a> },
    { title: t('kpi.period.label'), dataIndex: 'periodCode', width: 100 },
    { title: t('kpi.col.status'), dataIndex: 'status', width: 130, render: (v: KpiSheetRow['status']) => <SheetStatusTag status={v} /> },
    { title: t('kpi.col.score'), dataIndex: 'score', width: 100, align: 'right', render: (v: number | null) => (v == null ? '—' : `${v}%`) },
    { title: t('kpi.sheet.owners'), key: 'o', render: (_, r) => r.owners.map((o) => o.name).join(', ') || '—' },
    { title: t('kpi.sheet.submittedAt'), dataIndex: 'submittedAt', width: 150, render: (v: string | null) => dt(v) },
  ]
  const table = (rows: KpiSheetRow[] | undefined, empty: string) => (
    <KpiState loading={inbox.isLoading} error={inbox.error} onRetry={() => inbox.refetch()}>
      <Table<KpiSheetRow> size="small" rowKey="id" columns={cols} dataSource={rows ?? []} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 800 }}
        locale={{ emptyText: empty }} onRow={(r) => ({ onDoubleClick: () => open(r.id) })} />
    </KpiState>
  )

  return (
    <div className="page wide kpi-page">
      <style>{KPI_CSS}</style>
      <KpiHead page="kpiEntry" />
      {sheetId ? <SheetEditor id={sheetId} onBack={() => open(undefined)} /> : (
        <>
          <div className="kpi-bar">
            <label>{t('kpi.period.label')}</label>
            <PeriodSelect periods={periods.data} loading={periods.isLoading} value={periodId} onChange={setPeriodId} allowClear placeholder={t('kpi.period.allOpen')} />
          </div>
          <div className="kpi-card">
            <Tabs activeKey={tab} onChange={(k) => setTab(k as 'mine' | 'toApprove')} items={[
              { key: 'mine', label: <span>{t('kpi.sheet.mine')} <Badge count={inbox.data?.mine.filter((x) => x.status === 'draft' || x.status === 'rejected').length ?? 0} size="small" /></span>,
                children: table(inbox.data?.mine, t('kpi.sheet.mineEmpty')) },
              { key: 'toApprove', label: <span>{t('kpi.sheet.toApprove')} <Badge count={inbox.data?.toApprove.length ?? 0} size="small" /></span>,
                children: table(inbox.data?.toApprove, t('kpi.sheet.toApproveEmpty')) },
            ]} />
          </div>
        </>
      )}
    </div>
  )
}

type Vals = Record<number, { actual: number | null; note: string }>
const valsOf = (d: KpiSheetDetail): Vals => Object.fromEntries(d.items.map((i) => [i.id, { actual: i.actual, note: i.note ?? '' }]))

function SheetEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['kpi-sheet', id], queryFn: () => kpi.sheet(id) })
  const d = q.data
  const [draft, setDraft] = useState<{ rv: string; vals: Vals } | null>(null)
  const [modal, setModal] = useState<'approve' | 'reject' | 'import' | null>(null)
  const server = d ? valsOf(d) : {}
  const vals: Vals = d && draft?.rv === d.sheet.rowVersion ? draft.vals : server
  const changed = d ? d.items.filter((i) => (vals[i.id]?.actual ?? null) !== i.actual || (vals[i.id]?.note ?? '') !== (i.note ?? '')) : []
  const dirty = changed.length > 0
  const edit = (itemId: number, patch: Partial<Vals[number]>) => {
    if (!d) return
    setDraft({ rv: d.sheet.rowVersion, vals: { ...vals, [itemId]: { ...vals[itemId], ...patch } } })
  }

  const done = (r: KpiSheetDetail, msg: string) => { qc.setQueryData(['kpi-sheet', id], r); setDraft(null); setModal(null); toast.success(msg); invalidateKpi(qc) }
  const fail = (e: unknown) => {
    toast.error(kpiErrText(t, e))
    if (errInfo(e).code === 'stale') { setDraft(null); q.refetch() }
  }
  const save = useMutation({
    mutationFn: () => kpi.saveActuals(id, d!.sheet.rowVersion, changed.map((i) => ({ itemId: i.id, actual: vals[i.id].actual, note: vals[i.id].note.trim() || null }))),
    onSuccess: (r) => done(r, t('kpi.sheet.saved')), onError: fail,
  })
  const submit = useMutation({ mutationFn: () => kpi.submit(id, d!.sheet.rowVersion), onSuccess: (r) => done(r, t('kpi.sheet.submitted')), onError: fail })
  const approve = useMutation({ mutationFn: (c: string) => kpi.approve(id, d!.sheet.rowVersion, c), onSuccess: (r) => done(r, t('kpi.sheet.approved')), onError: fail })
  const reject = useMutation({ mutationFn: (c: string) => kpi.reject(id, d!.sheet.rowVersion, c), onSuccess: (r) => done(r, t('kpi.sheet.rejected')), onError: fail })
  const busy = save.isPending || submit.isPending || approve.isPending || reject.isPending

  const back = (
    <Button icon={<ArrowLeftOutlined />} onClick={onBack}>{t('kpi.sheet.back')}</Button>
  )
  if (!d) return <><div className="kpi-bar">{back}</div><KpiState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} /></>

  const s = d.sheet
  const canEdit = d.can.edit
  const items = [...d.items].sort((a, b) => a.sort - b.sort)
  const live = items.map((i) => ({ i, a: achieve(i.indicator.valueType, i.indicator.lowerBetter, i.target, vals[i.id]?.actual ?? null) }))
  const liveScore = weightedScore(live.map((x) => ({ weight: x.i.weight, achieve: x.a })))
  const missing = live.filter((x) => (vals[x.i.id]?.actual ?? null) == null).length

  const cols: ColumnsType<KpiItem> = [
    { title: t('kpi.col.kpi'), key: 'n', render: (_, r) => <NameCell ind={r.indicator} /> },
    { title: t('kpi.col.weight'), dataIndex: 'weight', width: 70, align: 'right', render: (v: number) => `${v}%` },
    { title: t('kpi.col.target'), key: 'tg', width: 110, align: 'right', render: (_, r) => (r.indicator.valueType === 'yesno' ? t('kpi.sheet.yes') : `${r.indicator.lowerBetter ? '≤ ' : '≥ '}${fmtNum(r.target, r.indicator.unit)}`) },
    { title: t('kpi.col.actual'), key: 'ac', width: 170, render: (_, r) => {
      const v = vals[r.id]?.actual ?? null
      if (!canEdit) return <b>{r.indicator.valueType === 'yesno' && v != null ? t(v >= 1 ? 'kpi.sheet.yes' : 'kpi.sheet.no') : fmtNum(v, r.indicator.unit)}</b>
      if (r.indicator.valueType === 'yesno') {
        return <Select style={{ width: 140 }} allowClear value={v ?? undefined} onChange={(x) => edit(r.id, { actual: x ?? null })} placeholder={t('kpi.sheet.pick')}
          options={[{ value: 1, label: t('kpi.sheet.yes') }, { value: 0, label: t('kpi.sheet.no') }]} />
      }
      return <InputNumber style={{ width: 150 }} value={v} min={0} decimalSeparator={lang.startsWith('vi') ? ',' : '.'} status={v == null ? 'warning' : undefined}
        onChange={(x) => edit(r.id, { actual: typeof x === 'number' ? x : null })} addonAfter={r.indicator.unit} aria-label={r.indicator.code} />
    } },
    { title: t('kpi.col.achieve'), key: 'pc', width: 180, render: (_, r) => { const a = live.find((x) => x.i.id === r.id)?.a ?? null; return a == null ? <span style={{ color: 'var(--c-muted)' }}>—</span> : <ScoreCell value={a} /> } },
    { title: t('kpi.sheet.note'), key: 'nt', width: 210, render: (_, r) => (canEdit
      ? <Input value={vals[r.id]?.note ?? ''} maxLength={500} onChange={(e) => edit(r.id, { note: e.target.value })} placeholder={t('kpi.sheet.notePh')} />
      : <span>{r.note ?? ''}</span>) },
  ]
  const logCols: ColumnsType<KpiLog> = [
    { title: t('kpi.sheet.at'), dataIndex: 'at', width: 140, render: (v: string) => dt(v) },
    { title: t('kpi.sheet.by'), key: 'by', width: 170, render: (_, r) => r.byName ?? r.by },
    { title: t('kpi.sheet.action'), dataIndex: 'action', width: 120, render: (v: string) => t(`kpi.sheet.act.${v}`, { defaultValue: v }) },
    { title: t('kpi.lib.code'), dataIndex: 'indicatorCode', width: 110, render: (v: string | null) => v ?? '' },
    { title: t('kpi.sheet.change'), key: 'ch', width: 150, render: (_, r) => (r.oldValue == null && r.newValue == null ? '' : `${r.oldValue ?? '—'} → ${r.newValue ?? '—'}`) },
    { title: t('kpi.sheet.reason'), dataIndex: 'reason', render: (v: string | null) => v ?? '' },
  ]

  return (
    <>
      <div className="kpi-bar sticky">
        {back}
        <Space wrap style={{ marginLeft: 'auto' }}>
          {canEdit && <Button icon={<FileExcelOutlined />} onClick={() => setModal('import')} disabled={busy || dirty}>{t('kpi.import.title')}</Button>}
          {canEdit && <Button type="primary" icon={<SaveOutlined />} loading={save.isPending} disabled={!dirty || busy} onClick={() => save.mutate()}>{t('kpi.sheet.save')}</Button>}
          {d.can.submit && (
            <Tooltip title={dirty ? t('kpi.sheet.saveFirst') : missing ? t('kpi.err.missing_actual') : undefined}>
              <Popconfirm title={t('kpi.sheet.submitConfirm')} okText={t('kpi.sheet.submit')} cancelText={t('kpi.cancel')} disabled={dirty || missing > 0} onConfirm={() => submit.mutate()}>
                <Button icon={<SendOutlined />} loading={submit.isPending} disabled={dirty || missing > 0 || busy}>{t('kpi.sheet.submit')}</Button>
              </Popconfirm>
            </Tooltip>
          )}
          {d.can.approve && <Button type="primary" icon={<CheckOutlined />} disabled={busy} onClick={() => setModal('approve')}>{t('kpi.sheet.approve')}</Button>}
          {d.can.reject && <Button danger icon={<CloseOutlined />} disabled={busy} onClick={() => setModal('reject')}>{t('kpi.sheet.reject')}</Button>}
        </Space>
      </div>

      {s.status === 'rejected' && s.rejectReason && <Alert style={{ marginBottom: 12 }} type="error" showIcon message={t('kpi.sheet.rejectedBy', { at: dt(s.rejectedAt) })} description={s.rejectReason} />}
      {s.periodStatus === 'locked' && <Alert style={{ marginBottom: 12 }} type="info" showIcon message={t('kpi.sheet.periodLocked')} />}
      {d.approvers.length === 0 && s.status === 'submitted' && <Alert style={{ marginBottom: 12 }} type="warning" showIcon message={t('kpi.sheet.noApprover')} />}

      <div className="kpi-hero">
        <div className="kpi-card">
          <h3>{trData(s.unitName)}<small>{s.periodCode}{s.site ? ` · ${s.site}` : ''}</small></h3>
          <div className="kpi-score">
            <ScoreRing value={liveScore ?? 0} />
            <div className="meta">
              <div><SheetStatusTag status={s.status} />{dirty && <span style={{ color: STATUS_TEXT.near, fontWeight: 600 }}>{t('kpi.sheet.unsaved')}</span>}</div>
              <div>{t('kpi.sheet.filled', { n: items.length - missing, total: items.length })}</div>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <h3>{t('kpi.sheet.people')}</h3>
          <div className="kpi-facts">
            <span>{t('kpi.sheet.owners')}</span><b>{s.owners.map((o) => o.name).join(', ') || '—'}</b>
            <span>{t('kpi.sheet.approvers')}</span><b>{d.approvers.length ? d.approvers.map((a) => `${a.name} (${t('kpi.sheet.level', { n: a.level })})`).join(', ') : t('kpi.sheet.noApproverShort')}</b>
            <span>{t('kpi.sheet.submittedAt')}</span><b>{dt(s.submittedAt)}</b>
            <span>{t('kpi.sheet.approvedAt')}</span><b>{dt(s.approvedAt)}</b>
          </div>
        </div>
      </div>

      <div className="kpi-card" style={{ marginTop: 16 }}>
        <h3>{t('kpi.sheet.items')}<small>{canEdit ? t('kpi.sheet.editHint') : t('kpi.sheet.readOnly')}</small></h3>
        <Table<KpiItem> size="small" rowKey="id" columns={cols} dataSource={items} pagination={false} scroll={{ x: 1000 }} locale={{ emptyText: t('kpi.sheet.noItems') }} />
      </div>
      <div className="kpi-card" style={{ marginTop: 16 }}>
        <h3>{t('kpi.sheet.log')}</h3>
        <Table<KpiLog> size="small" rowKey="id" columns={logCols} dataSource={d.log} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 860 }} locale={{ emptyText: t('kpi.sheet.logEmpty') }} />
      </div>

      {modal === 'approve' && <ReasonModal open required={false} title={t('kpi.sheet.approve')} label={t('kpi.sheet.approveComment')} okText={t('kpi.sheet.approve')}
        loading={approve.isPending} onOk={(c) => approve.mutate(c)} onCancel={() => setModal(null)} />}
      {modal === 'reject' && <ReasonModal open title={t('kpi.sheet.reject')} label={t('kpi.sheet.rejectLabel')} okText={t('kpi.sheet.reject')}
        loading={reject.isPending} onOk={(c) => reject.mutate(c)} onCancel={() => setModal(null)} />}
      <KpiImportModal open={modal === 'import'} onClose={() => setModal(null)} title={`${t('kpi.import.title')} · ${s.unitName} · ${s.periodCode}`}
        onTemplate={() => kpi.sheetTemplate(id)} run={(f, dry) => kpi.importSheet(id, f, dry)} onApplied={() => { q.refetch(); invalidateKpi(qc) }} />
    </>
  )
}
