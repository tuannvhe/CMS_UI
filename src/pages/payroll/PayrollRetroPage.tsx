import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Empty, Input, InputNumber, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AuditOutlined, CalculatorOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { payrollRetro, type LateRequestView, type RetroProposal, type RetroRow, type RetroStatus } from '../../api/payrollRetro'
import { CLOSED_FIELDS } from '../../api/closedAttendance'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { FilterBar, FilterRow, PillFilter } from '../../components/FilterBar'
import { useToast } from '../../hooks/useToast'
import { foldFilter } from '../../utils/search'
import { trData } from '../../utils/dataText'

const STATUS_COLOR: Record<RetroStatus, string> = { draft: 'default', approved: 'processing', applied: 'success', rejected: 'error' }
const VALUE_FIELDS = CLOSED_FIELDS.filter((f) => f.group !== 'allowance')
/** 'MM/yyyy' → ngày đầu tháng. */
const monthOf = (p: string) => dayjs(`${p.slice(3)}-${p.slice(0, 2)}-01`)
const money = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('vi-VN'))

/** Nhãn cột chốt công: tên cột (cls.f.*) + (CT) / (TV). */
function useFieldLabel() {
  const { t } = useTranslation()
  return (key: string) => {
    const f = VALUE_FIELDS.find((x) => x.key === key)
    return f ? `${t(`cls.f.${f.label}`)}${f.group === 'official' ? ' (CT)' : f.group === 'probation' ? ' (TV)' : ''}` : key
  }
}

interface Draft { id?: number; period: Dayjs | null; employeeId: string; lateRequestId?: number | null; proposal: RetroProposal | null; delta: Record<string, number>; estimated: number | null | undefined; amount: number | null; note: string }
const EMPTY: Draft = { period: dayjs().subtract(1, 'month').startOf('month'), employeeId: '', proposal: null, delta: {}, estimated: undefined, amount: null, note: '' }

/** Hộp soạn / sửa phiếu: tính chênh lệch từ chấm công hiện tại, HR sửa từng cột, chốt số tiền. */
function RetroEditor({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const label = useFieldLabel()
  const [d, setD] = useState<Draft | null>(draft)
  const [lastDraft, setLastDraft] = useState<Draft | null>(draft)
  if (draft !== lastDraft) { setLastDraft(draft); setD(draft) }
  const errText = (e: unknown) => { const { code, detail } = adminError(e); return t(`rtr.err.${code}`, { detail, defaultValue: t('rtr.err.generic') }) }

  const propose = useMutation({
    mutationFn: () => payrollRetro.propose(d!.period!.format('MM/YYYY'), d!.employeeId.trim()),
    onSuccess: (p) => setD((x) => x && ({ ...x, proposal: p, delta: { ...p.delta }, estimated: p.estimated, amount: x.amount ?? p.estimated ?? null })),
    onError: (e) => msg.error(errText(e)),
  })
  const estimate = useMutation({
    mutationFn: () => payrollRetro.estimate(d!.period!.format('MM/YYYY'), d!.employeeId.trim(), d!.delta),
    onSuccess: (v) => setD((x) => x && ({ ...x, estimated: v })),
    onError: (e) => msg.error(errText(e)),
  })
  const save = useMutation({
    mutationFn: () => {
      const body = { period: d!.period!.format('MM/YYYY'), employeeId: d!.employeeId.trim(), delta: d!.delta, amount: d!.amount ?? 0, note: d!.note.trim() || undefined, lateRequestId: d!.lateRequestId ?? null }
      return d!.id ? payrollRetro.update(d!.id, body) : payrollRetro.create(body)
    },
    onSuccess: () => { msg.success(t('rtr.saved')); qc.invalidateQueries({ queryKey: ['retro'] }); onClose() },
    onError: (e) => msg.error(errText(e)),
  })

  if (!d) return null
  const keys = Array.from(new Set([...Object.keys(d.delta), ...Object.keys(d.proposal?.delta ?? {})]))
    .sort((a, b) => VALUE_FIELDS.findIndex((f) => f.key === a) - VALUE_FIELDS.findIndex((f) => f.key === b))
  const setDelta = (k: string, v: number | null) => setD({ ...d, delta: { ...d.delta, [k]: v ?? 0 }, estimated: undefined })
  const canSave = !!d.period && !!d.employeeId.trim() && d.amount != null
  const rows = keys.map((k) => ({ key: k, closed: d.proposal?.closed[k], recomputed: d.proposal?.recomputed[k], diff: d.delta[k] ?? 0 }))

  return (
    <AppModal open onClose={onClose} size="lg" icon={<CalculatorOutlined />} title={d.id ? `${t('rtr.edit')} #${d.id}` : t('rtr.create')}
      subtitle={d.proposal ? `${d.proposal.employeeId} · ${d.proposal.fullName} · ${d.proposal.department}` : undefined}
      okText={t('rtr.save')} okDisabled={!canSave} okLoading={save.isPending} onOk={() => save.mutate()}>
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker picker="month" format="MM/YYYY" allowClear={false} value={d.period} disabled={!!d.id} onChange={(v) => setD({ ...d, period: v, proposal: null })} placeholder={t('rtr.sourcePeriod')} />
        <Input style={{ width: 160 }} value={d.employeeId} disabled={!!d.id} onChange={(e) => setD({ ...d, employeeId: e.target.value, proposal: null })} placeholder={t('rtr.employeeId')} />
        <Button type="primary" ghost loading={propose.isPending} disabled={!d.period || !d.employeeId.trim()} onClick={() => propose.mutate()}>{t('rtr.propose')}</Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>{t('rtr.proposeHint')}</Typography.Paragraph>
      {d.proposal && keys.length === 0 && <Alert type="info" showIcon title={t('rtr.noDiff')} style={{ marginBottom: 12 }} />}
      <Table size="small" pagination={false} rowKey="key" dataSource={rows} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('rtr.noDiff')} /> }}
        columns={[
          { title: t('rtr.column'), dataIndex: 'key', render: (k: string) => label(k) },
          { title: t('rtr.closed'), dataIndex: 'closed', width: 100, align: 'right', render: (v?: number) => v ?? '—' },
          { title: t('rtr.recomputed'), dataIndex: 'recomputed', width: 100, align: 'right', render: (v?: number) => v ?? '—' },
          { title: t('rtr.diff'), dataIndex: 'diff', width: 140, render: (v: number, r) => <InputNumber size="small" style={{ width: 120 }} value={v} step={0.5} onChange={(x) => setDelta(r.key, x)} /> },
        ]} />
      <Select showSearch size="small" style={{ width: 280, marginTop: 8 }} placeholder={t('rtr.addColumn')} value={null as unknown as string}
        options={VALUE_FIELDS.filter((f) => !keys.includes(f.key)).map((f) => ({ value: f.key, label: label(f.key) }))} filterOption={foldFilter('label')} onChange={(k) => setDelta(k, 0)} />
      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <Space wrap>
          <span>{t('rtr.estimated')}: <b>{d.estimated === undefined ? '…' : money(d.estimated)}</b></span>
          <Button size="small" loading={estimate.isPending} disabled={!d.period || !d.employeeId.trim()} onClick={() => estimate.mutate()}>{t('rtr.reestimate')}</Button>
          {d.estimated != null && <Button size="small" onClick={() => setD({ ...d, amount: d.estimated ?? null })}>{t('rtr.useEstimate')}</Button>}
        </Space>
        {d.estimated === null && <Typography.Text type="warning" style={{ fontSize: 12 }}>{t('rtr.estimateNone')}</Typography.Text>}
        <Space wrap align="center">
          <span>{t('rtr.amount')}:</span>
          <InputNumber style={{ width: 200 }} value={d.amount} step={1000} formatter={(v) => (v == null ? '' : Number(v).toLocaleString('vi-VN'))} parser={(v) => Number((v ?? '').replace(/[^\d-]/g, '')) || 0}
            onChange={(v) => setD({ ...d, amount: v == null ? null : Number(v) })} />
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('rtr.amountHint')}</Typography.Text>
        <Input.TextArea rows={2} maxLength={500} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder={t('rtr.note')} />
      </div>
    </AppModal>
  )
}

/**
 * Truy lĩnh / truy trừ kỳ sau. mode = hr: HR soạn phiếu, xem đơn bổ sung trễ hạn (trang payrollRetro);
 * mode = approve: người được cấp trang payrollRetroApprove duyệt / không duyệt / thu hồi.
 */
export default function PayrollRetroPage({ mode = 'hr' }: { mode?: 'hr' | 'approve' }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const label = useFieldLabel()
  const approve = mode === 'approve'
  const [status, setStatus] = useState<RetroStatus | ''>(approve ? 'draft' : '')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [rejecting, setRejecting] = useState<RetroRow | null>(null)
  const [reason, setReason] = useState('')
  const [latePeriod, setLatePeriod] = useState<Dayjs>(dayjs().subtract(1, 'month').startOf('month'))
  const errText = (e: unknown) => { const { code, detail } = adminError(e); return t(`rtr.err.${code}`, { detail, defaultValue: t('rtr.err.generic') }) }

  const list = useQuery({ queryKey: ['retro', mode, 'list'], queryFn: () => (approve ? payrollRetro.approvals() : payrollRetro.list()), retry: false })
  const late = useQuery({ queryKey: ['retro', 'late', latePeriod.format('MM/YYYY')], queryFn: () => payrollRetro.late(latePeriod.format('MM/YYYY')), enabled: !approve, retry: false })
  const refresh = () => qc.invalidateQueries({ queryKey: ['retro'] })
  const decide = useMutation({
    mutationFn: (v: { id: number; decision: 'approve' | 'reject' | 'revoke'; reason?: string }) => payrollRetro.decide(v.id, v.decision, v.reason),
    onSuccess: (r) => { msg.success(t(r.status === 'approved' ? 'rtr.approved' : r.status === 'rejected' ? 'rtr.rejected' : 'rtr.revoked')); setRejecting(null); setReason(''); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const remove = useMutation({ mutationFn: (id: number) => payrollRetro.remove(id), onSuccess: () => { msg.success(t('rtr.deleted')); refresh() }, onError: (e) => msg.error(errText(e)) })

  const all = list.data ?? []
  const rows = all.filter((r) => !status || r.status === status)
  const notReady = list.isError && adminError(list.error).code === 'table_missing'
  const when = (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '')
  const openEdit = (r: RetroRow) => setEditing({ id: r.id, period: monthOf(r.sourcePeriod), employeeId: r.employeeId, lateRequestId: r.lateRequestId, proposal: null, delta: { ...r.delta }, estimated: r.estimated, amount: r.amount, note: r.note ?? '' })

  const columns: ColumnsType<RetroRow> = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: t('rtr.employee'), width: 220, render: (_: unknown, r) => <span><b>{r.fullName}</b> <span className="cell-muted">· {r.employeeId}</span><div className="cell-muted">{trData(r.department)} · {r.group.toUpperCase()}</div></span> },
    { title: t('rtr.sourcePeriod'), dataIndex: 'sourcePeriod', width: 100 },
    {
      title: t('rtr.delta'), width: 240,
      render: (_: unknown, r) => Object.keys(r.delta).length === 0 ? '—' : (
        <div style={{ display: 'grid', gap: 2, fontSize: 12 }}>
          {Object.entries(r.delta).map(([k, v]) => <div key={k}>{label(k)}: <b>{v > 0 ? `+${v}` : v}</b></div>)}
        </div>
      ),
    },
    { title: t('rtr.estimated'), dataIndex: 'estimated', width: 120, align: 'right', render: (v: number | null) => <span className="cell-muted">{money(v)}</span> },
    { title: t('rtr.amount'), dataIndex: 'amount', width: 130, align: 'right', render: (v: number) => <b style={{ color: v < 0 ? '#D92D20' : undefined }}>{money(v)}</b> },
    {
      title: t('cov.status'), dataIndex: 'status', width: 150,
      render: (v: RetroStatus, r) => <span><Tag color={STATUS_COLOR[v]}>{t(`rtr.status.${v}`)}</Tag>{r.targetPeriod ? <div className="cell-muted" style={{ fontSize: 12 }}>{t('rtr.targetPeriod')} {r.targetPeriod}</div> : null}{r.rejectReason ? <Tooltip title={r.rejectReason}><div className="cell-muted" style={{ fontSize: 12 }}>{t('rtr.rejectReason')}: {r.rejectReason}</div></Tooltip> : null}</span>,
    },
    { title: t('rtr.note'), dataIndex: 'note', ellipsis: true },
    { title: t('rtr.createdBy'), width: 150, render: (_: unknown, r) => <span className="cell-muted" style={{ fontSize: 12 }}>{r.createdBy} {when(r.createdAt)}{r.approvedBy ? <div>{t('rtr.approvedBy')}: {r.approvedBy} {when(r.approvedAt)}</div> : null}</span> },
    {
      title: '', width: 190, fixed: 'right',
      render: (_: unknown, r) => approve ? (
        <Space size={4} wrap>
          {r.status === 'draft' && <Popconfirm title={t('rtr.approveAsk')} onConfirm={() => decide.mutate({ id: r.id, decision: 'approve' })}><Button size="small" type="primary">{t('rtr.approve')}</Button></Popconfirm>}
          {r.status === 'draft' && <Button size="small" danger onClick={() => { setRejecting(r); setReason('') }}>{t('rtr.reject')}</Button>}
          {r.status === 'approved' && <Popconfirm title={t('rtr.revokeAsk')} onConfirm={() => decide.mutate({ id: r.id, decision: 'revoke' })}><Button size="small">{t('rtr.revoke')}</Button></Popconfirm>}
        </Space>
      ) : (
        <Space size={4} wrap>
          {(r.status === 'draft' || r.status === 'rejected') && <Button size="small" onClick={() => openEdit(r)}>{t('rtr.edit')}</Button>}
          {(r.status === 'draft' || r.status === 'rejected') && <Popconfirm title={t('rtr.deleteAsk')} okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(r.id)}><Button size="small" danger>{t('rtr.remove')}</Button></Popconfirm>}
        </Space>
      ),
    },
  ]

  const lateRows = late.data ?? []
  const lateSummary = { n: lateRows.length, c: lateRows.filter((x) => x.request.fault === 'company').length, p: lateRows.filter((x) => x.request.fault !== 'company').length }
  const lateColumns: ColumnsType<LateRequestView> = [
    { title: t('rtr.workDate'), width: 110, render: (_: unknown, r) => new Date(r.request.workDate + 'T00:00:00').toLocaleDateString(i18n.language) },
    { title: t('rtr.employeeId'), width: 110, render: (_: unknown, r) => r.request.employeeId },
    { title: t('rtr.lateRequest'), width: 130, render: (_: unknown, r) => `${t(`rtr.kind.${r.request.kind}`)} #${r.request.requestId}` },
    { title: t('late.fault'), width: 130, render: (_: unknown, r) => <Tag color={r.request.fault === 'company' ? 'blue' : 'orange'}>{t(`rtr.fault.${r.request.fault}`)}</Tag> },
    { title: t('rtr.note'), ellipsis: true, render: (_: unknown, r) => r.request.note ?? '' },
    { title: t('rtr.complaint'), width: 90, render: (_: unknown, r) => (r.request.complaintId ? `#${r.request.complaintId}` : '') },
    { title: t('rtr.createdBy'), width: 160, render: (_: unknown, r) => <span className="cell-muted" style={{ fontSize: 12 }}>{r.request.createdBy} {when(r.request.createdAt)}</span> },
    {
      title: '', width: 190,
      render: (_: unknown, r) => !r.periodClosed ? <Tooltip title={t('rtr.openHint')}><Tag>{t('rtr.periodOpen')}</Tag></Tooltip>
        : r.retroId ? <Tag color={STATUS_COLOR[r.retroStatus ?? 'draft']}>#{r.retroId} · {t(`rtr.status.${r.retroStatus ?? 'draft'}`)}</Tag>
          : <Button size="small" type="primary" ghost onClick={() => setEditing({ ...EMPTY, period: monthOf(r.request.period), employeeId: r.request.employeeId, lateRequestId: r.request.id })}>{t('rtr.create')}</Button>,
    },
  ]

  const retroTable = (
    <DataTable<RetroRow>
      rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} scroll={{ x: 1500 }} pagination={{ pageSize: 20, showSizeChanger: false }}
      locale={{ emptyText: list.isError ? errText(list.error) : t('rtr.empty') }}
      toolbar={(
        <FilterBar>
          <FilterRow kind="status">
            <PillFilter value={status} onChange={(k) => setStatus(k as typeof status)} options={[
              { key: '', label: t('rtr.allStatus'), tone: '#475467' }, { key: 'draft', label: t('rtr.status.draft'), tone: '#D48806' }, { key: 'approved', label: t('rtr.status.approved'), tone: '#2F6FB0' },
              { key: 'applied', label: t('rtr.status.applied'), tone: '#2E9E4F' }, { key: 'rejected', label: t('rtr.status.rejected'), tone: '#D92D20' },
            ]} />
          </FilterRow>
          {!approve && <FilterRow label=""><Button type="primary" icon={<CalculatorOutlined />} onClick={() => setEditing({ ...EMPTY })}>{t('rtr.create')}</Button></FilterRow>}
        </FilterBar>
      )}
    />
  )

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={approve ? <AuditOutlined /> : <CalculatorOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t(approve ? 'nav.payrollRetroApprove' : 'nav.payrollRetro')} subtitle={t(approve ? 'nav.payrollRetroApproveDesc' : 'nav.payrollRetroDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('rtr.intro')} />
      {notReady ? <Alert type="warning" showIcon title={t('rtr.err.table_missing')} /> : (
        <>
          <StatTiles items={[
            { label: t('rtr.status.draft'), value: all.filter((r) => r.status === 'draft').length, color: '#D48806' },
            { label: t('rtr.status.approved'), value: all.filter((r) => r.status === 'approved').length, color: '#2F6FB0' },
            { label: t('rtr.status.applied'), value: all.filter((r) => r.status === 'applied').length, color: '#2E9E4F' },
            { label: t('rtr.status.rejected'), value: all.filter((r) => r.status === 'rejected').length },
          ]} />
          {approve ? retroTable : (
            <Tabs items={[
              { key: 'retro', label: t('rtr.tabRetro'), children: retroTable },
              {
                key: 'late', label: t('rtr.tabLate'), children: (
                  <>
                    <Space wrap style={{ marginBottom: 12 }}>
                      <span>{t('rtr.period')}:</span>
                      <DatePicker picker="month" format="MM/YYYY" allowClear={false} value={latePeriod} onChange={(v) => v && setLatePeriod(v.startOf('month'))} />
                      <Typography.Text type="secondary">{t('rtr.summary', lateSummary)}</Typography.Text>
                    </Space>
                    <DataTable<LateRequestView> rowKey={(r) => r.request.id} loading={late.isLoading} columns={lateColumns} dataSource={lateRows} scroll={{ x: 1200 }} pagination={{ pageSize: 50, showSizeChanger: false }}
                      locale={{ emptyText: late.isError ? errText(late.error) : t('rtr.lateEmpty') }} />
                  </>
                ),
              },
            ]} />
          )}
        </>
      )}
      <RetroEditor draft={editing} onClose={() => setEditing(null)} />
      <AppModal open={!!rejecting} onClose={() => setRejecting(null)} size="sm" title={t('rtr.reject')} subtitle={rejecting ? `#${rejecting.id} · ${rejecting.fullName}` : undefined} danger
        okText={t('rtr.reject')} okDisabled={reason.trim().length < 2} okLoading={decide.isPending} onOk={() => rejecting && decide.mutate({ id: rejecting.id, decision: 'reject', reason: reason.trim() })}>
        <Input.TextArea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('rtr.rejectReasonPh')} />
      </AppModal>
    </div>
  )
}
