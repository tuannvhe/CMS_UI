import { useMemo, useState } from 'react'
import { Alert, Avatar, DatePicker, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BlockOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { overtimeOverlaps, type OtOverlapPair, type OtPiece } from '../../api/overtimeOverlaps'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'

/** Đơn tăng ca của cùng một người trùng khung giờ: để HR huỷ / từ chối đơn thừa trước khi chốt công (chỉ đọc). */
export default function OvertimeOverlapPage() {
  const { t } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])
  const tooLong = range[1].diff(range[0], 'day') > 93
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['ot-overlaps', from, to], queryFn: () => overtimeOverlaps.report(from, to), enabled: !tooLong, retry: false })
  const rows = q.data ?? []
  const people = useMemo(() => new Set(rows.map((r) => r.a.employeeId.trim().toUpperCase())).size, [rows])
  const totalHours = rows.reduce((s, r) => s + r.overlapHours, 0)

  const piece = (p: OtPiece) => (
    <div style={{ lineHeight: 1.3 }}>
      <b>{dayjs(p.date).format('DD/MM/YYYY')}</b> {p.start} → {p.end} <span className="cell-muted">({p.hours}h)</span>{' '}
      <Tag color={p.state === 'approved' ? 'success' : 'warning'} variant="filled">{t(`ovl.${p.state}`)}</Tag>
      <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('ovl.sender')}: {p.senderName || '—'} · #{p.id}</div>
    </div>
  )

  const columns: ColumnsType<OtOverlapPair> = [
    {
      title: t('ovl.person'), width: 260,
      render: (_: unknown, r) => (<div style={{ lineHeight: 1.3 }}><b>{r.a.fullName}</b><div className="cell-muted">{r.a.employeeId} · {r.a.department ?? ''}</div></div>),
    },
    { title: t('ovl.requestA'), render: (_: unknown, r) => piece(r.a) },
    { title: t('ovl.requestB'), render: (_: unknown, r) => piece(r.b) },
    { title: t('ovl.overlap'), width: 110, align: 'right', render: (_: unknown, r) => <span className="org-chip warn">{r.overlapHours} {t('ovl.unit')}</span> },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<BlockOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.otOverlaps')} subtitle={t('nav.otOverlapsDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('ovl.hint')} />
      <StatTiles items={[
        { label: t('ovl.tilePairs'), value: rows.length, color: rows.length ? '#D48806' : undefined },
        { label: t('ovl.tilePeople'), value: people },
        { label: t('ovl.tileHours'), value: Math.round(totalHours * 10) / 10, unit: t('ovl.unit') },
      ]} />
      {tooLong && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('ovl.rangeErr')} />}
      <DataTable<OtOverlapPair>
        rowKey={(r) => `${r.a.id}-${r.b.id}`} loading={q.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 25, showSizeChanger: false }}
        locale={{ emptyText: q.isError ? t('usr.err.generic') : t('ovl.empty') }}
        toolbar={<DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />}
      />
    </div>
  )
}
