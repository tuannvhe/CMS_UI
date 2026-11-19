import { useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Empty, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { apiErrorCode, leave, type ApprovalStep, type LeaveSubmittedRow, type StepStatus, type SubmittedScope } from '../../api/requests'
import { personColumn, deptColumn } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { SentFilters, emptySentFilter, filterSent, type SentFilter } from '../../components/SentFilters'
import { fmtDate } from '../../utils/format'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { CancelSubmittedButton, canCancelSteps } from '../../components/CancelSubmitted'
import { FilterBar, FilterRow, PillFilter } from '../../components/FilterBar'
import { useDebouncedValue } from '../../hooks/useDebounce'

const COLOR: Record<StepStatus, string> = { none: 'default', waiting: 'processing', approved: 'success', rejected: 'error' }

/** Đơn nghỉ đã gửi: trạng thái 4 cấp duyệt; lọc theo phạm vi (tôi gửi / của tôi / tất cả – quản trị) và người gửi. */
export default function LeaveSubmittedTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const [scope, setScope] = useState<SubmittedScope>('sent')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [applied, setApplied] = useState({ range, scope: 'sent' as SubmittedScope, sender: '' })

  const q = useQuery({
    queryKey: ['req', 'leave-submitted', fmtDate(applied.range[0]), fmtDate(applied.range[1]), applied.scope, applied.sender],
    queryFn: () => leave.submitted(fmtDate(applied.range[0]), fmtDate(applied.range[1]), applied.scope, applied.sender),
    retry: false, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 60_000,
  })
  const cancel = useMutation({
    mutationFn: (id: number) => leave.cancel([id]),
    onSuccess: (r) => { if (r.cancelled > 0) toast.success(t('req.cancelRequestDone')); else toast.warning(t('req.cancelRequestNone')); q.refetch() },
    onError: () => toast.error(t('req.cancelRequestFail')),
  })
  const [filter, setFilter] = useState<SentFilter>(emptySentFilter)
  const all = q.data ?? []
  const sentText = useDebouncedValue(filter.text)   // ô tìm: gõ xong mới lọc
  const rows = useMemo(() => filterSent(all, { ...filter, text: sentText }), [all, filter, sentText])

  const code = q.isError ? apiErrorCode(q.error).code : ''
  const errText = !q.isError ? '' : code === 'range_too_long' ? t('req.err.range_too_long') : code === 'invalid_range' ? t('att.invalid_range')
    : code === 'forbidden' ? t('att.forbidden') : code === 'not_found' ? t('att.noEmployee') : t('req.err.generic')

  const approvals = (r: LeaveSubmittedRow) => {
    const steps: [string, ApprovalStep][] = [[t('req.shortOne'), r.one], [t('req.shortTwo'), r.two], [t('req.shortThree'), r.three], ['HQ', r.four]]
    const active = steps.filter(([, s]) => s.status !== 'none')
    if (active.length === 0) return <Typography.Text type="secondary">—</Typography.Text>
    return (
      <div style={{ display: 'grid', gap: 4 }}>
        {active.map(([label, s]) => {
          const tag = <Tag color={COLOR[s.status]} variant="filled" style={{ margin: 0 }}>{t(`req.status.${s.status}`)}</Tag>
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 98, flex: 'none', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--c-muted)' }}>{label}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>{s.name}</span>
              {s.rejectReason ? <Tooltip title={s.rejectReason}>{tag}</Tooltip> : tag}
            </div>
          )
        })}
      </div>
    )
  }

  const columns: ColumnsType<LeaveSubmittedRow> = [
    personColumn<LeaveSubmittedRow>(t('att.name'), 230),
    deptColumn<LeaveSubmittedRow>(t('att.dept'), 190),
    { title: t('leave.from'), dataIndex: 'from', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('leave.to'), dataIndex: 'to', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('leave.days'), dataIndex: 'totalDays', width: 70, align: 'right' },
    { title: t('leave.type'), dataIndex: 'reasonType', width: 150, ellipsis: { showTitle: true }, render: (v: string) => v ? <Tag>{v}</Tag> : '' },
    { title: t('req.reason'), dataIndex: 'reason', width: 200, ellipsis: { showTitle: true }, render: (v: string, r: LeaveSubmittedRow) => (v === r.reasonType ? '' : v) },   // lý do ghi tay; không lặp lại loại nghỉ
    { title: t('leave.handover'), dataIndex: 'personTakeJob', width: 140, ellipsis: { showTitle: true } },
    {
      title: t('req.sender'), width: 150,
      render: (_: unknown, r: LeaveSubmittedRow) => (
        <div style={{ lineHeight: 1.25 }}>
          <div>{r.senderName || r.senderId}</div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{r.senderId}{r.submittedAt ? ` · ${dayjs(r.submittedAt).format('DD/MM HH:mm')}` : ''}</div>
        </div>
      ),
    },
    { title: t('req.sectionApprovers'), width: 340, render: (_: unknown, r: LeaveSubmittedRow) => approvals(r) },
    {
      title: t('apr.reason'), width: 240,
      render: (_: unknown, r: LeaveSubmittedRow) => {
        const why = ([[t('req.shortOne'), r.one], [t('req.shortTwo'), r.two], [t('req.shortThree'), r.three], ['HQ', r.four]] as [string, ApprovalStep][]).filter(([, s]) => s.status === 'rejected' && s.rejectReason)
        return why.length === 0 ? null : (
          <div style={{ display: 'grid', gap: 2, lineHeight: 1.3 }}>
            {why.map(([label, s]) => (
              <div key={label} style={{ color: 'var(--ant-color-error, #dc2626)', fontSize: 13, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                <span style={{ fontWeight: 600 }}>{label}:</span> {s.rejectReason}
              </div>
            ))}
          </div>
        )
      },
    },
    {
      title: t('req.overall'), dataIndex: 'overall', width: 110, align: 'center',
      render: (v: 'approved' | 'rejected' | 'waiting') => <Tag color={COLOR[v]} variant="filled">{t(`req.status.${v}`)}</Tag>,
    },
    {
      title: '', width: 110, align: 'center', fixed: 'right',
      render: (_: unknown, r: LeaveSubmittedRow) => canCancelSteps([r.one, r.two, r.three, r.four], r.senderId, user?.userId)
        ? <CancelSubmittedButton loading={cancel.isPending && cancel.variables === r.id} onConfirm={() => cancel.mutate(r.id)} /> : null,
    },
  ]

  return (
    <>
      {errText && <Alert type="error" showIcon title={errText} style={{ marginBottom: 16 }} />}
      <div className="list-table">
        <DataTable<LeaveSubmittedRow>
          rowKey={(r) => String(r.id)} size="small" sticky={false} scroll={{ x: 1600 }}
          loading={q.isFetching} columns={columns} dataSource={rows} rowClassName={(r) => `row-st-${r.overall}`}
          locale={{ emptyText: <Empty description={t('leave.submittedEmpty')} /> }}
          pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
          toolbar={
            <FilterBar>
              <FilterRow kind="status">
                <PillFilter<SubmittedScope> value={scope} onChange={setScope} options={[{ key: 'sent', label: t('req.scopeSent') }, { key: 'mine', label: t('req.scopeMine') }]} />
              </FilterRow>
              <FilterRow kind="find">
                <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
                <Button type="primary" loading={q.isFetching} onClick={() => setApplied({ range, scope, sender: '' })}>{t('att.query')}</Button>
              </FilterRow>
              <FilterRow>
                <SentFilters rows={all} value={filter} onChange={setFilter} shown={rows.length} />
              </FilterRow>
            </FilterBar>
          }
        />
      </div>
    </>
  )
}
