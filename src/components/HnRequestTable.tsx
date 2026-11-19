import { useMemo, type ReactNode } from 'react'
import { Descriptions, Empty, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import type { HnApprovalLevel, HnRequest, HnRequestStatus } from '../api/hn'
import { fmtCell, isEmptyCell } from '../utils/hnFormat'
import { DataTable, MiniTable } from './DataTable'

const STATUS_COLOR: Record<HnRequestStatus, string> = { pending: 'processing', inProgress: 'warning', rejected: 'error', done: 'success' }

export function HnRequestStatusTag({ status }: { status: HnRequestStatus }) {
  const { t } = useTranslation()
  return <Tag color={STATUS_COLOR[status] ?? 'default'} variant="filled">{t(`hn.requests.status.${status}`, { defaultValue: String(status) })}</Tag>
}

/** Tiến trình các cấp duyệt: mỗi cấp một thẻ nhỏ (xanh = đã duyệt, đỏ = từ chối, xanh dương = đang chờ cấp này, xám = chưa tới). */
function Progress({ r }: { r: HnRequest }) {
  const { t } = useTranslation()
  const levels = r.levels ?? []
  if (levels.length === 0) return <span style={{ color: 'var(--c-muted)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {levels.map((l) => {
        const current = l.decision == null && r.status !== 'rejected' && l.level === r.currentLevel
        const color = l.decision === true ? 'success' : l.decision === false ? 'error' : current ? 'processing' : 'default'
        const tip = [l.approverName, l.decision === true ? t('hn.requests.decision.approved') : l.decision === false ? t('hn.requests.decision.rejected') : t('hn.requests.decision.waiting'), fmtCell(l.decidedAt), l.rejectReason].filter((x) => !isEmptyCell(x)).join(' · ')
        return <Tooltip key={l.level} title={tip}><Tag color={color} variant="filled" style={{ marginInlineEnd: 0 }}>{t('hn.requests.level', { n: l.level })}</Tag></Tooltip>
      })}
      {r.pendingForMe && <Tag color="gold" variant="solid" style={{ marginInlineEnd: 0 }}>{t('hn.requests.mine')}</Tag>}
    </span>
  )
}

function Expanded({ r }: { r: HnRequest }) {
  const { t } = useTranslation()
  const detail = r.detail ?? {}
  const items = [
    ...Object.keys(detail).filter((k) => !isEmptyCell(detail[k])).map((k) => ({ key: k, label: t(`hn.requests.d.${k}`, { defaultValue: k }), children: fmtCell(detail[k]) })),
    ...(r.submittedAt ? [{ key: '__submitted', label: t('hn.requests.col.submittedAt'), children: fmtCell(r.submittedAt) }] : []),
  ]
  const levelCols: ColumnsType<HnApprovalLevel> = [
    { title: t('hn.requests.lv.level'), dataIndex: 'level', width: 80 },
    { title: t('hn.requests.lv.approver'), key: 'a', render: (_, l) => l.approverName || l.approverId },
    { title: t('hn.requests.lv.decision'), key: 'd', render: (_, l) => (l.decision === true ? <Tag color="success" variant="filled">{t('hn.requests.decision.approved')}</Tag> : l.decision === false ? <Tag color="error" variant="filled">{t('hn.requests.decision.rejected')}</Tag> : <Tag variant="filled">{t('hn.requests.decision.waiting')}</Tag>) },
    { title: t('hn.requests.lv.decidedAt'), key: 't', render: (_, l) => fmtCell(l.decidedAt) },
    { title: t('hn.requests.lv.rejectReason'), key: 'r', render: (_, l) => fmtCell(l.rejectReason) },
  ]
  return (
    <div style={{ display: 'grid', gap: 12, padding: '4px 0' }}>
      {items.length > 0 && <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }} title={t('hn.requests.detailTitle')} items={items} />}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('hn.requests.approvalTitle')}</div>
        <MiniTable<HnApprovalLevel> rowKey="level" columns={levelCols} dataSource={r.levels ?? []} columnFilters={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.requests.noLevels')} /> }} />
      </div>
    </div>
  )
}

interface Props {
  items: HnRequest[]
  total: number
  page: number
  pageSize: number
  loading?: boolean
  onPage: (page: number, pageSize: number) => void
  toolbar?: ReactNode
  emptyText?: string
}

/** Bảng đơn dùng chung cho các màn "danh sách / duyệt / tổng hợp" của HN: ngày, nhân viên, bộ phận, ca, lý do, trạng thái, tiến trình duyệt; chi tiết trong hàng mở rộng. Phân trang phía máy chủ. */
export function HnRequestTable({ items, total, page, pageSize, loading, onPage, toolbar, emptyText }: Props) {
  const { t } = useTranslation()
  const columns = useMemo<ColumnsType<HnRequest>>(() => [
    { title: t('hn.requests.col.date'), key: 'date', width: 150, render: (_, r) => (r.dateTo && r.dateTo !== r.date ? `${fmtCell(r.date)} – ${fmtCell(r.dateTo)}` : fmtCell(r.date)) },
    { title: t('hn.requests.col.employee'), key: 'emp', render: (_, r) => (<span><b>{r.employeeName}</b><br /><span style={{ color: 'var(--c-muted)', fontSize: 12 }}>{r.employeeId}</span></span>) },
    { title: t('hn.requests.col.department'), dataIndex: 'department', key: 'department', ellipsis: true },
    { title: t('hn.requests.col.shift'), dataIndex: 'shift', key: 'shift', width: 90, render: (v: string | null) => fmtCell(v) },
    { title: t('hn.requests.col.reason'), dataIndex: 'reason', key: 'reason', ellipsis: true, width: 220, render: (v: string | null) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '') },
    { title: t('hn.requests.col.status'), dataIndex: 'status', key: 'status', width: 120, render: (v: HnRequestStatus) => <HnRequestStatusTag status={v} /> },
    { title: t('hn.requests.col.progress'), key: 'progress', width: 200, render: (_, r) => <Progress r={r} /> },
  ], [t])
  return (
    <DataTable<HnRequest>
      rowKey={(r) => String(r.id)}
      columnFilters={false}
      columns={columns}
      dataSource={items}
      loading={loading}
      toolbar={toolbar}
      expandable={{ expandedRowRender: (r) => <Expanded r={r} /> }}
      pagination={{ current: page, pageSize, total, onChange: onPage }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText ?? t('hn.requests.empty')} /> }}
    />
  )
}
