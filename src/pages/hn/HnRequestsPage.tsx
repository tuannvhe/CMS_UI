import { useState, type ReactNode } from 'react'
import { Alert, Button, DatePicker, Input, Segmented, Select, Skeleton } from 'antd'
import { AuditOutlined, CalendarOutlined, CheckSquareOutlined, FieldTimeOutlined, FileTextOutlined, FormOutlined, ScheduleOutlined, SolutionOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorCode, hnErrorKey, type HnRequestKind, type HnRequestStatus } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { HnRequestTable } from '../../components/HnRequestTable'
import { PageBanner } from '../../components/PageBanner'

export type HnRequestsMode = 'mine' | 'approvals' | 'summary'

const MAX_DAYS = 93
const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')
const NAV: Record<string, { key: string; icon: ReactNode }> = {
  'overtime:mine': { key: 'otMine', icon: <FieldTimeOutlined /> },
  'overtime:summary': { key: 'otSummary', icon: <ScheduleOutlined /> },
  'leave:mine': { key: 'leaveMine', icon: <CalendarOutlined /> },
  'leave:approvals': { key: 'leaveApprove', icon: <CheckSquareOutlined /> },
  'leave:summary': { key: 'leaveSummary', icon: <AuditOutlined /> },
  'finger-register:mine': { key: 'fingerRegMine', icon: <FormOutlined /> },
  'finger-register:approvals': { key: 'fingerRegApprove', icon: <CheckSquareOutlined /> },
  'late-early:mine': { key: 'lateEarlyMine', icon: <SolutionOutlined /> },
  'late-early:approvals': { key: 'lateEarlyApprove', icon: <FileTextOutlined /> },
}
const STATUSES: HnRequestStatus[] = ['pending', 'inProgress', 'rejected', 'done']

/** Màn xem đơn (chỉ đọc) của HN cho một loại đơn: "mine" (khoảng ngày tối đa 93), "approvals" (chờ tôi duyệt / tất cả), "summary" (tổng hợp có bộ lọc; chỉ tăng ca / nghỉ phép). Duyệt tăng ca theo nhóm ở HnOtGroupsPage. */
export default function HnRequestsPage({ kind, mode }: { kind: HnRequestKind; mode: HnRequestsMode }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const nav = NAV[`${kind}:${mode}`]
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => mode === 'summary' ? [dayjs().startOf('month'), dayjs().endOf('month')] : [dayjs().subtract(30, 'day'), dayjs().add(30, 'day')])
  const [state, setState] = useState<'pending' | 'all'>('pending')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pick, setPick] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  // Bộ lọc tổng hợp: nhập tự do, chỉ áp dụng khi bấm Xem
  const [f, setF] = useState({ empId: '', name: '', dept: '', status: undefined as HnRequestStatus | undefined })
  const [applied, setApplied] = useState({ range, f })

  const from = fmt(applied.range[0]), to = fmt(applied.range[1])
  const q = useQuery({
    queryKey: ['hn', 'requests', user?.userId, kind, mode, mode === 'approvals' ? state : '', mode === 'approvals' ? '' : from, mode === 'approvals' ? '' : to, mode === 'summary' ? applied.f : null, page, pageSize],
    queryFn: () => {
      if (mode === 'mine') return hnApi.requestsMine(kind, { from, to, page, pageSize })
      if (mode === 'approvals') return hnApi.requestsApprovals(kind as Exclude<HnRequestKind, 'overtime'>, { state, page, pageSize })
      const a = applied.f
      return hnApi.summary(kind as 'overtime' | 'leave', { from, to, empId: a.empId.trim() || undefined, name: a.name.trim() || undefined, dept: a.dept.trim() || undefined, status: a.status, page, pageSize })
    },
    staleTime: 30_000, retry: false, placeholderData: keepPreviousData,
  })

  const disabled = (d: Dayjs) => !!pick?.[0] && !pick[1] && Math.abs(d.diff(pick[0], 'day')) >= MAX_DAYS
  const search = () => { setPage(1); setApplied({ range, f }) }
  const errKey = q.error ? (hnErrorCode(q.error) === 'range_too_long' ? 'hn.requests.rangeTooLong' : hnErrorKey(q.error)) : ''

  const toolbar = mode === 'approvals' ? (
    <Segmented aria-label={t('hn.requests.state')} value={state} onChange={(v) => { setState(v as 'pending' | 'all'); setPage(1) }}
      options={[{ value: 'pending', label: t('hn.requests.statePending') }, { value: 'all', label: t('hn.requests.stateAll') }]} />
  ) : (
    <>
      <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} disabledDate={disabled} aria-label={t('hn.requests.range')}
        onCalendarChange={(v) => setPick(v as [Dayjs | null, Dayjs | null] | null)}
        onOpenChange={(o) => { if (!o) setPick(null) }}
        onChange={(v) => { if (v?.[0] && v[1]) setRange([v[0], v[1]]) }} />
      {mode === 'summary' && (
        <>
          <Input allowClear style={{ width: 120 }} placeholder={t('hn.requests.sum.empId')} aria-label={t('hn.requests.sum.empId')} value={f.empId} onChange={(e) => setF({ ...f, empId: e.target.value })} onPressEnter={search} />
          <Input allowClear style={{ width: 160 }} placeholder={t('hn.requests.sum.name')} aria-label={t('hn.requests.sum.name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onPressEnter={search} />
          <Input allowClear style={{ width: 160 }} placeholder={t('hn.requests.sum.dept')} aria-label={t('hn.requests.sum.dept')} value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })} onPressEnter={search} />
          <Select allowClear style={{ width: 150 }} placeholder={t('hn.requests.sum.allStatus')} aria-label={t('hn.requests.sum.status')} value={f.status} onChange={(v) => setF({ ...f, status: v })}
            options={STATUSES.map((s) => ({ value: s, label: t(`hn.requests.status.${s}`) }))} />
        </>
      )}
      <Button type="primary" onClick={search} loading={q.isFetching}>{t('hn.requests.search')}</Button>
      <span style={{ color: 'var(--c-muted)' }}>{t(mode === 'summary' ? 'hn.requests.sum.hint' : 'hn.requests.rangeHint')}</span>
    </>
  )

  return (
    <div className="page wide">
      <PageBanner avatar={nav.icon} title={t(`hn.nav.${nav.key}`)} subtitle={t(`hn.nav.${nav.key}Desc`)} chips={q.data ? [t('hn.requests.count', { n: q.data.total })] : undefined} />
      {q.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={t(errKey)} action={<Button size="small" onClick={() => void q.refetch()}>{t('hn.common.retry')}</Button>} />}
      {q.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <HnRequestTable
          items={q.data?.items ?? []} total={q.data?.total ?? 0} page={page} pageSize={pageSize} loading={q.isFetching}
          onPage={(p, s) => { setPage(s !== pageSize ? 1 : p); setPageSize(s) }}
          toolbar={toolbar} emptyText={t(mode === 'approvals' ? 'hn.requests.emptyApprovals' : 'hn.requests.empty')} />
      )}
    </div>
  )
}
