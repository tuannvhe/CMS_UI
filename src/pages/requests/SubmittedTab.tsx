import { useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Empty, Input, Segmented, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { apiErrorCode, requests, type ApprovalStep, type RequestKind, type StepStatus, type SubmittedRow, type SubmittedScope } from '../../api/requests'
import { useAuth } from '../../auth/AuthContext'
import { personColumn, deptColumn, ShiftChip, DayChip, TimeRange, AmountBadge } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { SentFilters, emptySentFilter, filterSent, type SentFilter } from '../../components/SentFilters'
import { fmtDate, localDayName } from '../../utils/format'

const COLOR: Record<StepStatus, string> = { none: 'default', waiting: 'processing', approved: 'success', rejected: 'error' }

/** Màn xem đơn đã gửi: trạng thái từng cấp duyệt (trưởng nhóm → trưởng bộ phận → trưởng khối). */
export default function SubmittedTab({ kind }: { kind: RequestKind }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [scope, setScope] = useState<SubmittedScope>('sent')
  const [sender, setSender] = useState('')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [applied, setApplied] = useState({ range, scope: 'sent' as SubmittedScope, sender: '' })

  const q = useQuery({
    queryKey: ['req', 'submitted', kind, fmtDate(applied.range[0]), fmtDate(applied.range[1]), applied.scope, applied.sender],
    queryFn: () => requests.submitted(kind, fmtDate(applied.range[0]), fmtDate(applied.range[1]), applied.scope, applied.sender),
    retry: false, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 60_000,
  })

  const [filter, setFilter] = useState<SentFilter>(emptySentFilter)
  const all = q.data ?? []
  const rows = useMemo(() => filterSent(all, filter), [all, filter])

  const code = q.isError ? apiErrorCode(q.error).code : ''
  const errText = !q.isError ? '' : code === 'range_too_long' ? t('req.err.range_too_long') : code === 'invalid_range' ? t('att.invalid_range') : code === 'forbidden' ? t('att.forbidden') : code === 'not_found' ? t('att.noEmployee') : t('req.err.generic')

  /** Một dòng cho mỗi cấp duyệt: [cấp] tên + trạng thái (rê chuột vào "Từ chối" để xem lý do). */
  const approvals = (r: SubmittedRow) => {
    const steps: [string, ApprovalStep][] = [[t('req.shortOne'), r.one], [t('req.shortTwo'), r.two], [t('req.shortThree'), r.three]]
    const active = steps.filter(([, st]) => st.status !== 'none')
    if (active.length === 0) return <Typography.Text type="secondary">—</Typography.Text>
    return (
      <div style={{ display: 'grid', gap: 4 }}>
        {active.map(([label, st]) => {
          const tag = <Tag color={COLOR[st.status]} variant="filled" style={{ margin: 0 }}>{t(`req.status.${st.status}`)}</Tag>
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 98, flex: 'none', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--c-muted)' }}>{label}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={st.name}>{st.name}</span>
              {st.rejectReason ? <Tooltip title={st.rejectReason}>{tag}</Tooltip> : tag}
            </div>
          )
        })}
      </div>
    )
  }

  const columns: ColumnsType<SubmittedRow> = [
    personColumn<SubmittedRow>(t('att.name'), 230),
    deptColumn<SubmittedRow>(t('att.dept'), 190),
    { title: t('att.date'), dataIndex: 'date', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('att.day'), dataIndex: 'dayName', width: 100, render: (v: string) => <DayChip raw={v} label={localDayName(v, i18n.language)} /> },
    { title: t('att.shift'), dataIndex: 'shift', width: 110, render: (v: string) => <ShiftChip value={v} /> },
    {
      title: t('req.sender'), width: 150,
      render: (_: unknown, r: SubmittedRow) => (
        <div style={{ lineHeight: 1.25 }}>
          <div>{r.senderName || r.senderId}</div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{r.senderId}{r.submittedAt ? ` · ${dayjs(r.submittedAt).format('DD/MM HH:mm')}` : ''}</div>
        </div>
      ),
    },
    { title: `${kind === 'finger' ? t('req.timeIn') : t('req.otFrom')} → ${kind === 'finger' ? t('req.timeOut') : t('req.otTo')}`, width: 150, align: 'center', render: (_: unknown, r: SubmittedRow) => <TimeRange from={r.timeFrom} to={r.timeTo} /> },
    { title: t('req.hours'), dataIndex: 'hours', width: 90, align: 'center', render: (v: string) => <AmountBadge value={v} unit={t('att.hours')} /> },
    { title: t('req.reason'), dataIndex: 'reason', width: 230, ellipsis: { showTitle: true } },
    { title: t('req.sectionApprovers'), width: 360, render: (_: unknown, r: SubmittedRow) => approvals(r) },
    {
      title: t('apr.reason'), width: 240,
      render: (_: unknown, r: SubmittedRow) => {
        const why = ([[t('req.shortOne'), r.one], [t('req.shortTwo'), r.two], [t('req.shortThree'), r.three]] as [string, ApprovalStep][]).filter(([, s]) => s.status === 'rejected' && s.rejectReason)
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
  ]

  return (
    <>
      {errText && <Alert type="error" showIcon title={errText} style={{ marginBottom: 16 }} />}
      <div className="list-table">
        <DataTable<SubmittedRow>
          rowKey={(r) => `${r.employeeId}|${r.date}|${r.timeFrom}|${r.timeTo}`}
          size="small" sticky={false} scroll={{ x: 1600 }}
          loading={q.isFetching} columns={columns} dataSource={rows} rowClassName={(r) => `row-st-${r.overall}`}
          locale={{ emptyText: <Empty description={t('req.submittedEmpty')} /> }}
          pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
          toolbar={
            <div className="dt-rows">
              <div className="dt-row">
              <Segmented<SubmittedScope>
                value={scope} onChange={setScope}
                options={[
                  { value: 'sent', label: t('req.scopeSent') },
                  { value: 'mine', label: t('req.scopeMine') },
                  ...(user?.isAdmin ? [{ value: 'all' as const, label: t('req.scopeAll') }] : []),
                ]}
              />
              {user?.isAdmin && scope === 'all' && (
                <Input allowClear style={{ width: 220 }} placeholder={t('req.senderPlaceholder')} value={sender} onChange={(e) => setSender(e.target.value)}
                  onPressEnter={() => setApplied({ range, scope, sender: sender.trim() })} />
              )}
              <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
              <Button type="primary" loading={q.isFetching} onClick={() => setApplied({ range, scope, sender: scope === 'all' ? sender.trim() : '' })}>{t('att.query')}</Button>
              </div>
              <div className="dt-row dt-row-filters">
                <SentFilters rows={all} value={filter} onChange={setFilter} shown={rows.length} />
              </div>
            </div>
          }
        />
      </div>
    </>
  )
}
