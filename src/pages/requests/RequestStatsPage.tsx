import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Empty, Input, Select, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BarChartOutlined, DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { getDepartments } from '../../api/attendance'
import { downloadStatsExcel, getStats, statsErrorCode, type StatFilter, type StatKind, type StatRow, type StatStatus } from '../../api/requestStats'
import { personColumn, deptColumn, TimeRange } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { fmtDate, num } from '../../utils/format'

const KIND_LABEL: Record<StatKind, string> = {
  overtime: 'nav.overtime', leave: 'nav.leave', finger: 'nav.fingerForm', goout: 'nav.goOut', late: 'nav.lateForm', early: 'nav.earlyForm',
}
const KIND_ORDER: StatKind[] = ['overtime', 'leave', 'finger', 'goout', 'late', 'early']
const COLOR = { none: 'default', waiting: 'processing', approved: 'success', rejected: 'error' } as const

/** Thống kê đơn từ theo loại đơn: lọc theo ngày, bộ phận, nhân viên, trạng thái; xem theo trang và xuất Excel. Chỉ quản trị. */
export default function RequestStatsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const [kind, setKind] = useState<StatKind>('overtime')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [department, setDepartment] = useState<string>()
  const [employee, setEmployee] = useState('')
  const [status, setStatus] = useState<StatStatus>('')
  const [applied, setApplied] = useState<StatFilter | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [exporting, setExporting] = useState(false)

  const depts = useQuery({ queryKey: ['att', 'departments'], queryFn: getDepartments, staleTime: 60_000 })
  const q = useQuery({
    queryKey: ['request-stats', applied, page, pageSize],
    queryFn: () => getStats(applied!, page, pageSize),
    enabled: applied !== null, retry: false, placeholderData: (prev) => prev,
  })

  const [errCode, setErrCode] = useState('')
  if (q.isError && !errCode) statsErrorCode(q.error).then((c) => setErrCode(c || 'x'))
  const errText = !q.isError ? '' :
    errCode === 'range_too_long' ? t('stt.err.range_too_long') : errCode === 'invalid_range' ? t('att.invalid_range') :
    errCode === 'too_many_rows' ? t('stt.err.too_many_rows') : errCode === 'forbidden' ? t('att.forbidden') : t('stt.err.generic')

  const filter = (): StatFilter => ({ kind, from: fmtDate(range[0]), to: fmtDate(range[1]), department, employee: employee.trim(), status })
  const apply = () => { setErrCode(''); setPage(1); setApplied(filter()) }

  const onExport = async () => {
    setExporting(true)
    try { await downloadStatsExcel(applied ?? filter()); msg.success(t('att.exportDone')) }
    catch (e) {
      const c = await statsErrorCode(e)
      msg.error(c === 'too_many_rows' ? t('stt.err.too_many_rows') : c === 'range_too_long' ? t('stt.err.range_too_long') : t('att.exportFailed'))
    } finally { setExporting(false) }
  }

  const k = applied?.kind ?? kind
  const isLeave = k === 'leave'
  const isGoOut = k === 'goout'
  const security = isGoOut || k === 'late' || k === 'early'
  const tt = q.data?.totals

  const approvals = (r: StatRow) => {
    const used = r.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.status !== 'none')
    if (used.length === 0) return <Typography.Text type="secondary">—</Typography.Text>
    return (
      <div style={{ display: 'grid', gap: 3 }}>
        {used.map(({ s, i }) => {
          const tag = <Tag color={COLOR[s.status]} variant="filled" style={{ margin: 0 }}>{t(`req.status.${s.status}`)}</Tag>
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>{s.name}</span>
              {s.at && <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>{dayjs(s.at).format('DD/MM HH:mm')}</span>}
              {s.rejectReason ? <Tooltip title={s.rejectReason}>{tag}</Tooltip> : tag}
            </div>
          )
        })}
      </div>
    )
  }

  const columns: ColumnsType<StatRow> = [
    personColumn<StatRow>(t('att.name'), 220),
    deptColumn<StatRow>(t('att.dept'), 170),
    {
      title: isLeave ? `${t('att.date')}` : t('att.date'), width: isLeave || isGoOut ? 190 : 110,
      render: (_: unknown, r) => {
        const d = dayjs(r.date).format('DD/MM/YYYY')
        return r.dateTo && !dayjs(r.dateTo).isSame(dayjs(r.date), 'day') ? <b>{d} → {dayjs(r.dateTo).format('DD/MM/YYYY')}</b> : <b>{d}</b>
      },
    },
    { title: t('att.day'), width: 90, render: (_: unknown, r) => t(`cal.dow.${dayjs(r.date).day()}`) },
    {
      title: isGoOut ? t('sh.timeOut') : t('stt.time'), width: 140, align: 'center',
      render: (_: unknown, r) => (isGoOut ? <b>{r.timeFrom}</b> : <TimeRange from={r.timeFrom} to={r.timeTo} />),
    },
    ...(isGoOut ? [
      { title: t('sh.purpose'), width: 120, render: (_: unknown, r: StatRow) => t(r.purpose === 'company' ? 'sh.purposeCompany' : 'sh.purposePersonal') },
      { title: t('sh.comeBack'), width: 110, render: (_: unknown, r: StatRow) => r.comeBackTime ?? t('sh.comeBackNo') },
    ] : [
      { title: isLeave ? t('att.days') : t('att.hours'), width: 80, align: 'right' as const, render: (_: unknown, r: StatRow) => num(r.amount) },
    ]),
    { title: t('req.reason'), dataIndex: 'reason', width: 230, ellipsis: { showTitle: true } },
    {
      title: t('req.sender'), width: 150,
      render: (_: unknown, r) => (
        <div style={{ lineHeight: 1.25 }}>
          <div>{r.senderName || r.senderId}</div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{r.senderId}{r.submittedAt ? ` · ${dayjs(r.submittedAt).format('DD/MM HH:mm')}` : ''}</div>
        </div>
      ),
    },
    { title: t('stt.approvers'), width: 330, render: (_: unknown, r) => approvals(r) },
    {
      title: t('req.overall'), dataIndex: 'status', width: 110, align: 'center',
      render: (v: StatRow['status']) => <Tag color={COLOR[v]} variant="filled">{t(`req.status.${v}`)}</Tag>,
    },
    ...(security ? [{
      title: t('sh.security'), width: 180,
      render: (_: unknown, r: StatRow) => (r.securityName ? <span>{r.securityName}{r.securityAt ? ` · ${dayjs(r.securityAt).format('DD/MM HH:mm')}` : ''}</span> : <span className="cell-muted">{t('sh.securityNone')}</span>),
    }] : []),
  ]

  const unit = isLeave ? t('att.days') : t('att.hours')
  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<BarChartOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.requestStats')} subtitle={t('nav.requestStatsDesc')}
        chips={applied ? [t(KIND_LABEL[applied.kind]), `${dayjs(applied.from).format('DD/MM/YYYY')} – ${dayjs(applied.to).format('DD/MM/YYYY')}`] : []}
        extra={<Button size="large" icon={<DownloadOutlined />} loading={exporting} onClick={onExport}>{t('att.export')}</Button>}
      />
      {errText && <Alert type="error" showIcon title={errText} style={{ marginBottom: 16 }} />}
      {tt && (
        <StatTiles items={[
          { label: t('stt.tileTotal'), value: tt.rows.toLocaleString(), color: 'var(--c-primary)' },
          { label: t('req.status.approved'), value: tt.approved.toLocaleString(), color: '#2E9E4F' },
          { label: t('req.status.waiting'), value: tt.waiting.toLocaleString(), color: '#2F6FB0' },
          { label: t('req.status.rejected'), value: tt.rejected.toLocaleString(), color: '#D92D20' },
          ...(isGoOut ? [] : [{ label: t('stt.tileAmount'), value: num(tt.amount) || 0, unit, color: '#D48806' }]),
        ]} />
      )}
      <div className="list-table">
        <DataTable<StatRow>
          rowKey={(r) => `${r.id}`} size="small" sticky={false} scroll={{ x: 1700 }}
          loading={q.isFetching} columns={columns} dataSource={q.data?.rows ?? []} rowClassName={(r) => `row-st-${r.status}`}
          locale={{ emptyText: applied === null ? <Empty description={t('stt.pressQuery')} /> : <Empty description={t('req.submittedEmpty')} /> }}
          pagination={{
            current: page, pageSize, total: tt?.rows ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
            showTotal: (n: number) => n.toLocaleString(), onChange: (p: number, s: number) => { setPage(p); setPageSize(s) },
          }}
          toolbar={
            <Space wrap>
              <Select<StatKind> value={kind} onChange={setKind} style={{ width: 170 }} aria-label={t('stt.kind')}
                options={KIND_ORDER.map((v) => ({ value: v, label: t(KIND_LABEL[v]) }))} />
              <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                presets={[
                  { label: t('att.thisMonth'), value: [dayjs().startOf('month'), dayjs()] },
                  { label: t('att.lastMonth'), value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                ]} />
              <Select allowClear showSearch value={department} onChange={setDepartment} style={{ width: 190 }} placeholder={t('att.allDepts')}
                options={(depts.data ?? []).map((d) => ({ value: d, label: d }))} />
              <Input allowClear placeholder={t('stt.employeePh')} value={employee} onChange={(e) => setEmployee(e.target.value)} onPressEnter={apply} style={{ width: 190 }} />
              <Select<StatStatus> value={status} onChange={setStatus} style={{ width: 150 }} aria-label={t('req.overall')}
                options={[
                  { value: '', label: `${t('req.overall')}: ${t('att.typeAll')}` },
                  { value: 'approved', label: t('req.status.approved') },
                  { value: 'waiting', label: t('req.status.waiting') },
                  { value: 'rejected', label: t('req.status.rejected') },
                ]} />
              <Button type="primary" loading={q.isFetching} onClick={apply}>{t('att.query')}</Button>
            </Space>
          }
        />
      </div>
    </div>
  )
}
