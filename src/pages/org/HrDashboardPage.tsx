import { useMemo, useState } from 'react'
import { Alert, Button, Card, DatePicker, Empty, Select, Tag, Tooltip } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { getHrDashboard, type HrDepartmentRow, type HrOtPerson, type HrSite } from '../../api/hrDashboard'
import { DeptChip, PersonCell } from '../../components/cells'
import { DASH_CSS, DashCard, Donut, HBar, KpiCard, OR, Pareto, TrendBars } from '../../components/DashKit'
import { num } from '../../utils/format'

const SITES: HrSite[] = ['BN', 'HY', 'OTHER']
const C = { up: OR.up, down: OR.down }
const pct = (a: number, b: number) => (b > 0 ? Math.round((a * 1000) / b) / 10 : 0)
type Metric = 'headcount' | 'joiners' | 'leavers' | 'turnoverPct'

/** Dashboard nhân sự (giao diện theo mẫu dashboard): bộ lọc tháng / nhà máy, thẻ chỉ số so với tháng trước, biến động 12 tháng theo tab chỉ số,
 * vành khuyên theo nhà máy / trạng thái, Pareto giờ tăng ca theo bộ phận, đi làm hôm nay, nghỉ việc, vượt trần tăng ca và bảng theo bộ phận. */
export default function HrDashboardPage() {
  const { t } = useTranslation()
  const [month, setMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const [site, setSite] = useState<HrSite | undefined>()
  const [metric, setMetric] = useState<Metric>('headcount')
  const key = month.format('YYYY-MM'), prevKey = month.subtract(1, 'month').format('YYYY-MM')
  const q = useQuery({ queryKey: ['hr-dashboard', key, site], queryFn: () => getHrDashboard(key, site), staleTime: 60_000, retry: false })
  const d = q.data
  // Tháng trước chỉ để so giờ tăng ca / vượt trần (số người, vào / nghỉ đã có trong chuỗi 12 tháng); tải sau khi tháng đang xem xong
  const pq = useQuery({ queryKey: ['hr-dashboard', prevKey, site], queryFn: () => getHrDashboard(prevKey, site), staleTime: 5 * 60_000, retry: false, enabled: !!d })
  const pd = pq.data
  const siteName = (s: string) => t(`hrd.site.${s}`)

  const cur = d?.trend[d.trend.length - 1]
  const prev = d && d.trend.length > 1 ? d.trend[d.trend.length - 2] : undefined
  const prevLabel = t('dash.prevMonth')
  const kpis = d ? [
    { label: t('hrd.tileActive'), value: d.headcount.total, prev: prev?.headcount },
    { label: t('hrd.tileOp'), value: d.headcount.op, sub: `${pct(d.headcount.op, d.headcount.total)}% · ${t('hrd.tileSeasonal')} ${d.headcount.seasonal}` },
    ...(d.today ? [{ label: t('hrd.tilePresent'), value: d.today.present, sub: `${pct(d.today.present, d.today.active)}% · ${t('hrd.tileLeave')} ${d.today.onLeave}` }] : []),
    { label: t('hrd.tileJoin'), value: cur?.joiners ?? 0, prev: prev?.joiners },
    { label: t('hrd.tileQuit'), value: cur?.leavers ?? 0, prev: prev?.leavers, lowerIsBetter: true },
    { label: t('hrd.turnover'), value: cur?.turnoverPct ?? 0, prev: prev?.turnoverPct, unit: '%', fmt: (v: number) => String(v), lowerIsBetter: true },
    { label: t('hrd.tileOt'), value: d.overtime.approvedHours, prev: pd?.overtime.approvedHours, unit: 'h', fmt: (v: number) => num(v) },
    { label: t('hrd.tileOver'), value: d.overtime.overLimit.length, prev: pd?.overtime.overLimit.length, lowerIsBetter: true },
  ] : []

  const otColumns: ColumnsType<HrOtPerson> = [
    { title: t('hrd.col.employee'), key: 'emp', width: 230, render: (_, r) => <PersonCell id={r.employeeId} name={r.name} /> },
    { title: t('hrd.col.department'), dataIndex: 'department', width: 200, render: (v) => <DeptChip value={v} /> },
    { title: t('hrd.col.group'), dataIndex: 'isOp', width: 80, render: (v: boolean) => <Tag>{v ? 'OP' : 'Staff'}</Tag> },
    { title: t('hrd.col.hours'), dataIndex: 'hours', width: 90, align: 'right', render: (v: number, r) => <b style={{ color: v > r.limit ? C.down : undefined }}>{num(v)}</b> },
    { title: t('hrd.col.limit'), dataIndex: 'limit', width: 80, align: 'right', render: (v: number) => num(v) },
    { title: t('hrd.col.excess'), key: 'ex', width: 90, align: 'right', render: (_, r) => (r.hours > r.limit ? `+${num(r.hours - r.limit)}` : '') },
  ]

  const deptColumns: ColumnsType<HrDepartmentRow> = useMemo(() => [
    { title: t('hrd.col.department'), dataIndex: 'department', width: 220, fixed: 'left', render: (v: string) => <DeptChip value={v} />, sorter: (a, b) => a.department.localeCompare(b.department) },
    { title: t('hrd.col.site'), dataIndex: 'site', width: 80, render: (v: string) => siteName(v), filters: SITES.map((s) => ({ text: siteName(s), value: s })), onFilter: (v, r) => r.site === v },
    { title: t('hrd.col.headcount'), dataIndex: 'headcount', width: 90, align: 'right', sorter: (a, b) => a.headcount - b.headcount, defaultSortOrder: 'descend' },
    { title: 'OP', dataIndex: 'op', width: 70, align: 'right', sorter: (a, b) => a.op - b.op },
    { title: t('hrd.joiners'), dataIndex: 'joiners', width: 80, align: 'right', sorter: (a, b) => a.joiners - b.joiners, render: (v: number) => (v ? <span style={{ color: C.up }}>{v}</span> : '') },
    { title: t('hrd.leavers'), dataIndex: 'leavers', width: 80, align: 'right', sorter: (a, b) => a.leavers - b.leavers, render: (v: number) => (v ? <span style={{ color: C.down }}>{v}</span> : '') },
    { title: t('hrd.col.otHours'), dataIndex: 'otHours', width: 100, align: 'right', sorter: (a, b) => a.otHours - b.otHours, render: (v: number) => (v ? num(v) : '') },
    { title: t('hrd.col.otPerHead'), dataIndex: 'otPerHead', width: 100, align: 'right', sorter: (a, b) => a.otPerHead - b.otPerHead, render: (v: number) => (v ? num(v) : '') },
    { title: t('hrd.col.overLimit'), dataIndex: 'overLimit', width: 90, align: 'right', sorter: (a, b) => a.overLimit - b.overLimit, render: (v: number) => (v ? <Tag color="warning">{v}</Tag> : '') },
    { title: t('hrd.col.leaveDays'), dataIndex: 'leaveDays', width: 100, align: 'right', sorter: (a, b) => a.leaveDays - b.leaveDays, render: (v: number) => (v ? num(v) : '') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t])

  const labels = d?.trend.map((m) => dayjs(m.month + '-01').format('MM/YY')) ?? []
  return (
    <div className="page wide">
      <style>{DASH_CSS}</style>
      <div className="rdb">
        <div className="rdb-head">
          <h1>{t('nav.hrDashboard')} | <em>{t('dash.overview')}</em></h1>
          <Button icon={<ReloadOutlined />} onClick={() => { q.refetch(); pq.refetch() }} loading={q.isFetching}>{t('hrd.refresh')}</Button>
        </div>
        <div className="rdb-filters">
          <div className="rdb-filter">
            <div className="lb">{t('dash.month')}</div>
            <DatePicker picker="month" allowClear={false} value={month} style={{ width: '100%' }} onChange={(v) => v && setMonth(v.startOf('month'))} disabledDate={(v) => v.isAfter(dayjs(), 'month')} format="MM/YYYY" />
          </div>
          <div className="rdb-filter">
            <div className="lb">{t('dash.site')}</div>
            <Select<HrSite | ''> style={{ width: '100%' }} value={site ?? ''} onChange={(v) => setSite(v || undefined)}
              options={[{ value: '', label: t('hrd.allSites') }, ...SITES.map((s) => ({ value: s, label: siteName(s) }))]} />
          </div>
          <div className="rdb-filter">
            <div className="lb">{t('dash.compare')}</div>
            <div style={{ lineHeight: '32px' }}>{month.subtract(1, 'month').format('MM/YYYY')}</div>
          </div>
        </div>

        {q.isError && <Alert type="error" showIcon message={t('hrd.err')} style={{ marginBottom: 12 }} />}
        {d?.overtimeTruncated && <Alert type="warning" showIcon message={t('hrd.truncated')} style={{ marginBottom: 12 }} />}
        {q.isLoading && <Card loading />}

        {d && (
          <>
            <div className="rdb-kpis">
              {kpis.map((k) => <KpiCard key={k.label} {...k} prevLabel={prevLabel} />)}
            </div>

            <div className="rdb-main">
              <div className="rdb-main-l">
                <DashCard>
                  <div className="rdb-tabs" role="tablist">
                    {(['headcount', 'joiners', 'leavers', 'turnoverPct'] as Metric[]).map((m) => (
                      <button key={m} type="button" role="tab" aria-selected={metric === m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
                        {t(m === 'headcount' ? 'hrd.headcountEnd' : m === 'joiners' ? 'hrd.joiners' : m === 'leavers' ? 'hrd.leavers' : 'hrd.turnover')}
                      </button>
                    ))}
                  </div>
                  <div className="rdb-card-h"><b>{t('hrd.trend')}</b></div>
                  {d.trend.length === 0 ? <Empty /> : (
                    <TrendBars labels={labels} tips={d.trend.map((m) => dayjs(m.month + '-01').format('MM/YYYY'))} values={d.trend.map((m) => m[metric])}
                      color={metric === 'leavers' || metric === 'turnoverPct' ? OR.mid : OR.main} />
                  )}
                </DashCard>
                <div className="rdb-row2">
                  <DashCard title={t('hrd.bySiteTitle')}>
                    <Donut centerLabel={t('dash.people')} items={d.headcount.bySite.map((s) => ({ label: siteName(s.site), value: s.total }))} />
                  </DashCard>
                  <DashCard title={t('hrd.byStatus')}>
                    <Donut centerLabel={t('dash.people')} items={d.headcount.byStatus.map((s) => ({ label: s.name, value: s.count }))} />
                  </DashCard>
                </div>
              </div>
              <DashCard title={t('hrd.paretoOt')} extra={t('dash.paretoHint')}>
                <Pareto items={d.departments.map((x) => ({ label: x.department, value: Math.round(x.otHours) }))} valueLabel={t('hrd.col.otHours')} cumLabel={t('dash.cum')} otherLabel={t('dash.other')} />
              </DashCard>
            </div>

            <div className="rdb-row2" style={{ marginTop: 12 }}>
              {d.today && (
                <DashCard title={t('hrd.todayTitle', { date: dayjs(d.today.date).format('DD/MM') })}
                  extra={<Tooltip title={t('hrd.todayHint')}><span>{t('hrd.notPunched', { n: d.today.notPunched })}</span></Tooltip>}>
                  {d.today.bySite.map((s) => (
                    <HBar key={s.site} label={`${siteName(s.site)} · ${t('hrd.tileLeave')} ${s.onLeave}`} value={s.present} max={s.active} total={s.active} note={`/ ${s.active}`} />
                  ))}
                </DashCard>
              )}
              <DashCard title={t('hrd.attritionTitle')}>
                <HBar label={t('hrd.leavers12')} value={d.attrition.leavers} max={d.attrition.leavers} total={d.attrition.leavers} color={OR.mid} note="" />
                <HBar label={t('hrd.early', { days: 60 })} value={d.attrition.earlyLeavers} max={d.attrition.leavers} total={d.attrition.leavers}
                  color={d.attrition.earlyPct >= 30 ? C.down : OR.main} note={`${d.attrition.earlyPct}%`} />
                {d.attrition.quitWithoutEndDate > 0 && <p className="cell-muted" style={{ marginBottom: 0 }}>{t('hrd.noEndDate', { n: d.attrition.quitWithoutEndDate })}</p>}
              </DashCard>
            </div>

            <DashCard style={{ marginTop: 12 }}
              title={t('hrd.overTitle', { op: d.overtime.limitOp, staff: d.overtime.limitStaff })}
              extra={t('hrd.otSummary', { h: num(d.overtime.approvedHours), p: d.overtime.people, avg: num(d.overtime.avgHours), w: d.overtime.waitingForms, wh: num(d.overtime.waitingHours) })}>
              {d.overtime.overLimit.length === 0
                ? <span className="cell-muted">{t('hrd.noOver')}</span>
                : <Table<HrOtPerson> size="small" rowKey="employeeId" columns={otColumns} dataSource={d.overtime.overLimit} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 760 }} />}
            </DashCard>

            <DashCard title={t('hrd.deptTitle', { month: month.format('MM/YYYY') })} style={{ marginTop: 12 }}>
              <Table<HrDepartmentRow> size="small" rowKey="department" columns={deptColumns} dataSource={d.departments}
                pagination={{ pageSize: 50, hideOnSinglePage: true }} scroll={{ x: 1010 }} />
            </DashCard>
            <p className="cell-muted" style={{ marginTop: 8, marginBottom: 0 }}>{t('hrd.footnote', { at: dayjs(d.generatedAt).format('HH:mm DD/MM') })}</p>
          </>
        )}
      </div>
    </div>
  )
}
