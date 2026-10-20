import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, DatePicker, Empty, Input, Segmented, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LineChartOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { access, type AccessReport, type AccessRow } from '../../api/access'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'

/** Cột đứng đơn giản (không cần thư viện biểu đồ): chiều cao theo giá trị lớn nhất, rê chuột xem số. */
function Bars({ items, color = '#2E9E4F' }: { items: { label: string; value: number; tip?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="acc-bars">
      {items.map((i) => (
        <Tooltip key={i.label} title={i.tip ?? `${i.label}: ${i.value}`}>
          <div className="acc-bar"><i style={{ height: `${Math.max(2, (i.value / max) * 100)}%`, background: color }} /><span>{i.label}</span></div>
        </Tooltip>
      ))}
    </div>
  )
}

const when = (iso: string, lang: string) => new Date(iso).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'medium' })

/** Quản lý lượt truy cập hệ thống: lượt đăng nhập theo ngày, giờ, người dùng, địa chỉ IP, trình duyệt — gộp hệ thống cũ (Tbl_LoginHistory) và hệ thống mới. Chỉ quản trị. */
export default function AccessPage() {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(13, 'day'), dayjs()])
  const [source, setSource] = useState<'all' | 'old' | 'new'>('all')
  const [user, setUser] = useState('')
  const [ip, setIp] = useState('')
  const [page, setPage] = useState(1)
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), source, user, ip }

  const report = useQuery({ queryKey: ['access', 'report', params], queryFn: () => access.report(params), retry: false, placeholderData: (p) => p })
  const recent = useQuery({ queryKey: ['access', 'recent', params, page], queryFn: () => access.recent({ ...params, page, pageSize: 25 }), retry: false, placeholderData: (p) => p })
  const d: AccessReport | undefined = report.data
  const peakHour = useMemo(() => (d?.perHour.length ? d.perHour.reduce((a, b) => (b.logins > a.logins ? b : a)) : null), [d])
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: d?.perHour.find((x) => x.hour === h)?.logins ?? 0, tip: `${h}h: ${d?.perHour.find((x) => x.hour === h)?.logins ?? 0}` })), [d])
  const days = useMemo(() => (d?.perDay ?? []).map((x) => ({ label: dayjs(x.day).format('DD/MM'), value: x.logins, tip: `${dayjs(x.day).format('DD/MM/YYYY')}: ${x.logins} ${t('acc.logins')} · ${x.users} ${t('acc.people')}${x.failed ? ` · ${x.failed} ${t('acc.failed')}` : ''}` })), [d, t])

  const reset = () => { setPage(1) }
  const columns: ColumnsType<AccessRow> = [
    { title: t('aud.at'), dataIndex: 'at', width: 170, render: (v: string) => when(v, i18n.language) },
    { title: t('acc.user'), render: (_: unknown, r) => <span><b>{r.fullName || r.userId}</b> <span className="cell-muted">· {r.userId}</span></span> },
    { title: 'IP', dataIndex: 'ip', width: 140, render: (v: string | null) => v || '—' },
    { title: t('acc.browser'), dataIndex: 'browser', width: 150 },
    { title: t('acc.system'), dataIndex: 'source', width: 100, render: (v: string) => <Tag color={v === 'new' ? 'green' : 'default'}>{v === 'new' ? t('acc.sysNew') : t('acc.sysOld')}</Tag> },
    { title: t('aud.status'), dataIndex: 'success', width: 100, render: (v: boolean) => <Tag color={v ? 'green' : 'red'} variant="filled">{v ? t('acc.ok') : t('acc.failed')}</Tag> },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<LineChartOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.access')} subtitle={t('nav.accessDesc')} />
      <Card size="small" style={{ margin: '12px 0' }}>
        <Space wrap>
          <DatePicker.RangePicker allowClear={false} value={range} onChange={(v) => { if (v && v[0] && v[1]) { setRange([v[0], v[1]]); reset() } }} />
          <Segmented value={source} onChange={(v) => { setSource(v as 'all' | 'old' | 'new'); reset() }}
            options={[{ value: 'all', label: t('acc.sysAll') }, { value: 'old', label: t('acc.sysOld') }, { value: 'new', label: t('acc.sysNew') }]} />
          <Input allowClear style={{ width: 180 }} placeholder={t('acc.userPh')} value={user} onChange={(e) => { setUser(e.target.value); reset() }} />
          <Input allowClear style={{ width: 150 }} placeholder="IP" value={ip} onChange={(e) => { setIp(e.target.value); reset() }} />
          <Button icon={<ReloadOutlined />} onClick={() => { report.refetch(); recent.refetch() }} loading={report.isFetching}>{t('org.recheck')}</Button>
        </Space>
      </Card>
      {report.isError && <Alert type="error" showIcon title={t('usr.err.generic')} style={{ marginBottom: 12 }} />}
      {d && !d.newReady && source !== 'old' && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('acc.newNotReady')} />}
      <StatTiles items={[
        { label: t('acc.tileLogins'), value: d?.totals.logins ?? 0, color: '#2F6FB0' },
        { label: t('acc.tileUsers'), value: d?.totals.users ?? 0, color: '#2E9E4F' },
        { label: t('acc.tileToday'), value: d?.totals.today ?? 0, unit: `· ${d?.totals.todayUsers ?? 0} ${t('acc.people')}`, color: '#D48806' },
        { label: t('acc.tileFailed'), value: d?.totals.failed ?? 0, color: d?.totals.failed ? '#D92D20' : undefined },
        { label: t('acc.tilePeak'), value: peakHour ? `${peakHour.hour}h` : '—', unit: peakHour ? `· ${peakHour.logins}` : '' },
      ]} />
      <div className="acc-grid">
        <Card size="small" title={t('acc.perDay')}>{days.length ? <Bars items={days} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}</Card>
        <Card size="small" title={t('acc.perHour')}>{d?.perHour.length ? <Bars items={hours} color="#2F6FB0" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}</Card>
      </div>
      <div className="acc-grid three">
        <Card size="small" title={t('acc.topUsers')}>
          <Table size="small" rowKey="userId" pagination={false} dataSource={(d?.topUsers ?? []).slice(0, 10)} columns={[
            { title: t('acc.user'), render: (_: unknown, r) => <span><b>{r.fullName || r.userId}</b><div className="cell-muted">{r.userId}{r.department ? ` · ${r.department}` : ''}</div></span> },
            { title: t('acc.logins'), dataIndex: 'logins', width: 80, align: 'right' },
          ]} />
        </Card>
        <Card size="small" title={t('acc.topIps')}>
          <Table size="small" rowKey="ip" pagination={false} dataSource={(d?.topIps ?? []).slice(0, 10)} columns={[
            { title: 'IP', dataIndex: 'ip' }, { title: t('acc.people'), dataIndex: 'users', width: 70, align: 'right' }, { title: t('acc.logins'), dataIndex: 'logins', width: 80, align: 'right' },
          ]} />
          <p className="cell-muted" style={{ marginTop: 8, fontSize: 12 }}>{t('acc.ipNote')}</p>
        </Card>
        <Card size="small" title={t('acc.browsers')}>
          <Bars items={(d?.browsers ?? []).map((b) => ({ label: b.name, value: b.count }))} color="#7A5AF8" />
        </Card>
      </div>
      <Card size="small" title={t('acc.recent')} style={{ marginTop: 12 }}>
        <Table<AccessRow> size="small" rowKey={(r) => `${r.at}|${r.userId}|${r.source}`} loading={recent.isFetching} columns={columns} dataSource={recent.data?.rows ?? []}
          pagination={{ current: page, pageSize: 25, total: recent.data?.total ?? 0, showSizeChanger: false, onChange: setPage }} />
      </Card>
    </div>
  )
}
