import { useState } from 'react'
import { Avatar, Button, Popconfirm, Segmented, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BellOutlined, HourglassOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { backlog, type BacklogRow } from '../../api/backlog'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

/** Đơn chờ duyệt lâu theo từng người duyệt: ai đang giữ bao nhiêu đơn, lâu nhất bao nhiêu ngày; nhắc từng người hoặc tất cả. */
export default function ApprovalBacklogPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const [days, setDays] = useState(3)
  const q = useQuery({ queryKey: ['approval-backlog', days], queryFn: () => backlog.report(days), retry: false })
  const rows = q.data ?? []

  const remind = useMutation({
    mutationFn: (key?: string) => backlog.remind(days, key),
    onSuccess: (r) => msg.success(t('blg.reminded', { n: r.reminded })),
    onError: () => msg.error(t('usr.err.generic')),
  })

  const columns: ColumnsType<BacklogRow> = [
    { title: t('blg.approver'), render: (_: unknown, r) => <span><b>{r.approverName}</b>{r.approverId ? <span className="cell-muted"> · {r.approverId}</span> : null}{!r.reachable && <span className="org-chip bad" style={{ marginLeft: 8 }}>{t('blg.noAccount')}</span>}</span> },
    { title: t('blg.forms'), dataIndex: 'forms', width: 90, align: 'right', render: (v: number) => <b>{v}</b> },
    { title: t('blg.oldest'), dataIndex: 'oldestDays', width: 130, align: 'right', render: (v: number) => <span className={`org-chip ${v >= 14 ? 'bad' : v >= 7 ? 'warn' : ''}`}>{t('blg.daysN', { n: v })}</span> },
    {
      title: t('blg.kinds'),
      render: (_: unknown, r) => <Space size={4} wrap>{r.kinds.slice(0, 6).map((k) => <Tag key={`${k.kind}${k.level}`} variant="filled">{t(`blg.kind.${k.kind}`)} · {t('line.roundN', { n: k.level })}: {k.forms}</Tag>)}</Space>,
    },
    {
      title: '', width: 120,
      render: (_: unknown, r) => r.reachable && (
        <Popconfirm title={t('blg.remindAsk', { name: r.approverName })} okText={t('blg.remind')} cancelText={t('req.cancel')} onConfirm={() => remind.mutate(r.approverKey)}>
          <Button size="small" icon={<BellOutlined />} loading={remind.isPending && remind.variables === r.approverKey}>{t('blg.remind')}</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<HourglassOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.backlog')} subtitle={t('nav.backlogDesc')} />
      <StatTiles items={[
        { label: t('blg.tileApprovers'), value: rows.length },
        { label: t('blg.tileForms'), value: rows.reduce((s, r) => s + r.forms, 0), color: '#D48806' },
        { label: t('blg.tileNoAccount'), value: rows.filter((r) => !r.reachable).length, color: rows.some((r) => !r.reachable) ? '#D92D20' : undefined },
        { label: t('blg.tileOldest'), value: rows.reduce((m, r) => Math.max(m, r.oldestDays), 0), unit: t('blg.dayUnit') },
      ]} />
      <DataTable<BacklogRow>
        rowKey="approverKey" loading={q.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 25, showSizeChanger: false }}
        locale={{ emptyText: q.isError ? t('usr.err.generic') : t('blg.empty') }}
        toolbar={(
          <Space wrap>
            <Segmented value={days} onChange={(v) => setDays(Number(v))} options={[{ value: 1, label: t('blg.d1') }, { value: 3, label: t('blg.d3') }, { value: 7, label: t('blg.d7') }, { value: 14, label: t('blg.d14') }]} />
            <Popconfirm title={t('blg.remindAllAsk', { n: rows.filter((r) => r.reachable).length })} okText={t('blg.remind')} cancelText={t('req.cancel')} onConfirm={() => remind.mutate(undefined)} disabled={!rows.length}>
              <Button type="primary" icon={<BellOutlined />} disabled={!rows.length} loading={remind.isPending && remind.variables === undefined}>{t('blg.remindAll')}</Button>
            </Popconfirm>
          </Space>
        )}
      />
    </div>
  )
}
