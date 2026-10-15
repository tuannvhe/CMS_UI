import { useState } from 'react'
import { Alert, Button, Checkbox, Skeleton, Space, Tag, Tooltip } from 'antd'
import { MiniTable } from '../../components/DataTable'
import type { ColumnsType } from 'antd/es/table'
import { SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { AppModal } from '../../components/AppModal'
import { BLOCKING_ISSUES, evaluations, type LineRound, type ReviewRow } from '../../api/evaluations'

const ROUND_COLOR = ['', 'green', 'blue', 'purple', 'orange', 'red']
export const issueColor = (i: string) => (BLOCKING_ISSUES.includes(i) ? 'error' : i === 'overdue' ? 'default' : 'warning')

/** Bước xem tổng hợp trước khi tạo đơn: line của từng nhân viên (mặc định hoặc đã chỉnh), cảnh báo, sửa line tại chỗ. */
export function EvaluationReviewModal({ open, items, onEdit, onConfirm, onClose, loading }: {
  open: boolean; items: { employeeId: string; dateRate: string; line?: LineRound[]; newDateRate?: string }[]
  onEdit: (employeeId: string, dateRate: string) => void; onConfirm: () => void; onClose: () => void; loading?: boolean
}) {
  const { t } = useTranslation()
  const [ack, setAck] = useState(false)
  const q = useQuery({ queryKey: ['evaluations', 'review', JSON.stringify(items)], queryFn: () => evaluations.review(items), enabled: open && items.length > 0, gcTime: 0 })
  const rows = q.data ?? []
  const blocking = rows.filter((r) => r.issues.some((i) => BLOCKING_ISSUES.includes(i)))
  const warned = rows.filter((r) => r.issues.some((i) => !BLOCKING_ISSUES.includes(i)))
  const missing = items.length - rows.length   // đã không còn trong danh sách đến hạn
  const canCreate = rows.length > 0 && blocking.length === 0 && (warned.length === 0 || ack)

  const columns: ColumnsType<ReviewRow> = [
    { title: t('eva.employeeId'), dataIndex: 'employeeId', width: 100 },
    {
      title: t('eva.fullName'), width: 200,
      render: (_: unknown, r: ReviewRow) => <div><b>{r.fullName}</b><div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{r.position} · {r.department}</div></div>,
    },
    {
      title: t('eva.typeRate'), width: 170,
      render: (_: unknown, r: ReviewRow) => <div>{r.typeRate}<div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('eva.dateRate')}: <b>{dayjs(r.dateRate).format('DD/MM/YYYY')}</b>{r.dateChanged && <Tag color="orange" variant="filled" style={{ marginLeft: 6 }}>{t('eva.dateChangedShort')}</Tag>}</div></div>,
    },
    {
      title: t('eva.lineCol'),
      render: (_: unknown, r: ReviewRow) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {r.line.length === 0 && <span style={{ color: 'var(--c-muted)' }}>—</span>}
          {r.line.map((l) => (
            <Tag key={`${l.round}-${l.userId}`} color={l.active === false ? 'error' : ROUND_COLOR[l.round] ?? 'default'} variant="filled" icon={l.active === false || l.active == null ? <WarningOutlined /> : undefined}>
              {t('line.roundN', { n: l.round })}: {l.userId === r.employeeId ? t('eva.lineSelf') : (l.fullName ?? l.userId)}
            </Tag>
          ))}
          {r.customized && <Tag color="orange" variant="filled">{t('eva.lineCustom')}</Tag>}
        </div>
      ),
    },
    {
      title: t('eva.reviewIssues'), width: 220,
      render: (_: unknown, r: ReviewRow) => (r.issues.length === 0
        ? <Tag color="success" variant="filled" icon={<SafetyCertificateOutlined />}>{t('eva.reviewOk')}</Tag>
        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{r.issues.map((i) => <Tooltip key={i} title={t(`eva.issueHint.${i}`, { defaultValue: '' })}><Tag color={issueColor(i)} variant="filled">{t(`eva.issue.${i}`, { defaultValue: i })}</Tag></Tooltip>)}</div>),
    },
    { title: '', width: 100, render: (_: unknown, r: ReviewRow) => <Button size="small" onClick={() => onEdit(r.employeeId, items.find((i) => i.employeeId === r.employeeId)?.dateRate ?? r.dateRate.slice(0, 10))}>{t('eva.lineEdit')}</Button> },
  ]

  return (
    <AppModal open={open} onClose={onClose} size="xl" icon={<SafetyCertificateOutlined />} title={t('eva.reviewTitle')} subtitle={t('eva.reviewSubtitle', { n: items.length })}
      extra={warned.length > 0 && blocking.length === 0 ? <Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)}>{t('eva.reviewAck', { n: warned.length })}</Checkbox> : undefined}
      onOk={onConfirm} okText={`${t('eva.regDo')} (${rows.length})`} okDisabled={!canCreate} okLoading={loading}>
      {q.isLoading ? <Skeleton active /> : q.isError ? <Alert type="error" showIcon title={t('req.err.generic')} /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          {blocking.length > 0 && <Alert type="error" showIcon title={t('eva.reviewBlocked', { n: blocking.length })} />}
          {blocking.length === 0 && warned.length > 0 && <Alert type="warning" showIcon title={t('eva.reviewWarned', { n: warned.length })} />}
          {blocking.length === 0 && warned.length === 0 && rows.length > 0 && <Alert type="success" showIcon title={t('eva.reviewAllOk')} />}
          {missing > 0 && <Alert type="info" showIcon title={t('eva.reviewMissing', { n: missing })} />}
          <MiniTable<ReviewRow> rowKey={(r) => `${r.employeeId}|${r.dateRate}`} columns={columns} dataSource={rows} scroll={{ x: 'max-content' }} />
        </Space>
      )}
    </AppModal>
  )
}
