import { useMemo, useState } from 'react'
import { DatePicker, Input, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { approvals, isSingleApprover, type ApprovalKind, type DoneRow } from '../../api/approvals'
import { personColumn, deptColumn } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { StatTiles } from '../../components/StatTiles'

const d = (s: string | null) => (s ? dayjs(s).format('DD/MM/YYYY') : '')

/** Đơn tôi đã duyệt hoặc từ chối: lọc theo ngày duyệt, tìm nhanh, xem lý do từ chối. */
export default function ApprovalDoneTab({ kind }: { kind: ApprovalKind }) {
  const { t } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [filter, setFilter] = useState('')
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['apr', 'done', kind, from, to], queryFn: () => approvals.done(kind, from, to), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true })

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (q.data ?? []).filter((r) => !f || `${r.employeeId} ${r.fullName} ${r.department ?? ''} ${r.groupId} ${r.senderName}`.toLowerCase().includes(f))
  }, [q.data, filter])

  const approved = (q.data ?? []).filter((r) => r.approved).length
  const single = isSingleApprover(kind)
  const levelName = (l: number) => (single ? t('sh.approver') : l === 1 ? t('req.shortOne') : l === 2 ? t('req.shortTwo') : l === 3 ? t('req.shortThree') : t('leave.shortFour'))
  const hoursLabel = kind === 'leave' ? t('apr.days') : t('apr.hours')

  const columns: ColumnsType<DoneRow> = [
    { title: t('apr.level'), dataIndex: 'level', width: 120, render: (l: number) => <Tag variant="filled" color={l === 1 ? 'blue' : l === 2 ? 'purple' : l === 3 ? 'orange' : 'magenta'}>{levelName(l)}</Tag> },
    personColumn<DoneRow>(t('att.name'), 230),
    deptColumn<DoneRow>(t('att.dept'), 190),
    { title: t('att.date'), width: 170, render: (_: unknown, r: DoneRow) => (r.dateTo && r.dateTo !== r.date ? `${d(r.date)} → ${d(r.dateTo)}` : d(r.date)) },
    ...(single ? [] : [{ title: hoursLabel, dataIndex: 'hours', width: 80, align: 'right' as const }]),
    { title: t('req.sender'), dataIndex: 'senderName', width: 150, ellipsis: true },
    { title: t('apr.decision'), dataIndex: 'approved', width: 130, render: (ok: boolean) => <Tag variant="filled" color={ok ? 'success' : 'error'}>{ok ? t('apr.decisionApproved') : t('apr.decisionRejected')}</Tag> },
    { title: t('apr.decidedAt'), dataIndex: 'decidedAt', width: 150, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '') },
    { title: t('apr.reason'), dataIndex: 'reason', ellipsis: true },
    { title: t('apr.group'), dataIndex: 'groupId', width: 220, ellipsis: true },
  ]

  return (
    <>
      <StatTiles items={[
        { label: t('apr.tileDone'), value: q.data?.length ?? 0, color: '#2E9E4F' },
        { label: t('apr.decisionApproved'), value: approved, color: '#2F6FB0' },
        { label: t('apr.decisionRejected'), value: (q.data?.length ?? 0) - approved, color: '#D92D20' },
      ]} />
      <div className="list-table">
        <DataTable<DoneRow>
          rowKey={(r) => `${r.level}|${r.id}`} size="small" sticky={false} scroll={{ x: 1500 }} loading={q.isLoading} columns={columns} dataSource={rows} rowClassName={(r) => (r.approved ? 'row-st-approved' : 'row-st-rejected')}
          pagination={{ pageSize: 30, showSizeChanger: false }}
          toolbar={(
            <>
              <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
              <Input.Search allowClear style={{ width: 260 }} placeholder={t('eva.search')} onChange={(e) => setFilter(e.target.value)} />
            </>
          )}
          locale={{ emptyText: q.isError ? t('req.err.generic') : t('apr.emptyDone') }}
        />
      </div>
    </>
  )
}
