import { useState } from 'react'
import { Alert, App, Button, Card, DatePicker, Empty, Select, Space, Tag } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import type { ColumnsType } from 'antd/es/table'
import { FileExcelOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { RECRUIT_STATUSES, recruitDashboard, recruitDashboardExport, type RecruitPositionStat } from '../../api/recruit'
import { DeptChip } from '../../components/cells'
import { DASH_CSS, DashCard, Donut, HBar, KpiCard, OR, OR_SERIES, Pareto, TrendBars } from '../../components/DashKit'
import { RecruitSummaryCard } from './RecruitSummaryCard'

const pct = (a: number, b: number) => (b > 0 ? Math.round((a * 1000) / b) / 10 : 0)
type Metric = 'created' | 'passed' | 'failed'

/** Dashboard tuyển dụng theo khoảng ngày (giao diện theo mẫu dashboard): bộ lọc trên cùng, thẻ chỉ số so với kỳ trước cùng độ dài, xu hướng theo tab chỉ số,
 * vành khuyên nhà máy / cấp bậc, Pareto theo bộ phận, phễu, đánh giá CV / phỏng vấn, báo cáo 13 chỉ số và bảng theo vị trí. Chỉ HR / quản trị. */
export default function RecruitDashboardPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const presets: { key: string; range: () => [Dayjs, Dayjs] }[] = [
    { key: 'pMonth', range: () => [dayjs().startOf('month'), dayjs()] },
    { key: 'pLastMonth', range: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
    { key: 'p30', range: () => [dayjs().subtract(29, 'day'), dayjs()] },
    { key: 'p90', range: () => [dayjs().subtract(89, 'day'), dayjs()] },
    { key: 'pYear', range: () => [dayjs().startOf('year'), dayjs()] },
  ]
  const [range, setRange] = useState<[Dayjs, Dayjs]>(presets[0].range)
  const [preset, setPreset] = useState<string | undefined>('pMonth')
  const [metric, setMetric] = useState<Metric>('created')
  const [exporting, setExporting] = useState(false)
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  // Kỳ trước: cùng số ngày, ngay trước khoảng đang xem
  const len = range[1].diff(range[0], 'day') + 1
  const pFrom = range[0].subtract(len, 'day').format('YYYY-MM-DD'), pTo = range[0].subtract(1, 'day').format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['recruit-dashboard', from, to], queryFn: () => recruitDashboard(from, to), staleTime: 60_000, retry: false })
  const pq = useQuery({ queryKey: ['recruit-dashboard', pFrom, pTo], queryFn: () => recruitDashboard(pFrom, pTo), staleTime: 5 * 60_000, retry: false })
  const d = q.data && q.data.ready !== false ? q.data : undefined
  const r = d?.report
  const p = pq.data && pq.data.ready !== false ? pq.data : undefined

  const sumStatus = (x?: Record<string, number>) => (x ? Object.values(x).reduce((a, b) => a + b, 0) : 0)
  const total = sumStatus(r?.byStatus)
  const st = (k: string) => r?.byStatus[k] ?? 0
  const passRate = (x?: { finalPass: number; finalFail: number }) => (x && x.finalPass + x.finalFail > 0 ? pct(x.finalPass, x.finalPass + x.finalFail) : null)
  const days = (v: number | null | undefined) => (v == null ? '—' : String(Math.round(v * 10) / 10))

  const exportExcel = async () => {
    setExporting(true)
    try { await recruitDashboardExport(from, to) } catch { message.error(t('rdb.exportErr')) } finally { setExporting(false) }
  }

  const fmtLabel = (s: string) => (d?.bucket === 'month' ? dayjs(s).format('MM/YY') : dayjs(s).format('DD/MM'))
  const tipTitle = (s: string) => {
    const x = dayjs(s)
    return d?.bucket === 'day' ? x.format('DD/MM/YYYY') : d?.bucket === 'week' ? `${x.format('DD/MM')} – ${x.add(6, 'day').format('DD/MM')}` : x.format('MM/YYYY')
  }
  const prevLabel = t('dash.prevPeriod')
  const kpis = r ? [
    { label: t('rdb.tTotal'), value: total, prev: p ? sumStatus(p.report.byStatus) : null },
    { label: t('rdb.f.interviewed'), value: d!.funnel.interviewed, prev: p?.funnel.interviewed },
    { label: t('rdb.tPass'), value: r.finalPass, prev: p?.report.finalPass },
    { label: t('rdb.tFail'), value: r.finalFail, prev: p?.report.finalFail, lowerIsBetter: true },
    { label: t('rdb.passRate'), value: passRate(r), prev: passRate(p?.report), unit: '%', fmt: (v: number) => String(v) },
    { label: t('rdb.tAvgDays'), value: r.avgDaysToFinal == null ? null : Math.round(r.avgDaysToFinal * 10) / 10, prev: p?.report.avgDaysToFinal == null ? null : Math.round(p.report.avgDaysToFinal * 10) / 10, unit: t('rec.rp.days'), fmt: (v: number) => String(v), lowerIsBetter: true },
  ] : []

  const funnel = d ? [
    { key: 'received', v: d.funnel.received }, { key: 'screened', v: d.funnel.screened }, { key: 'invited', v: d.funnel.invited },
    { key: 'interviewed', v: d.funnel.interviewed }, { key: 'passed', v: d.funnel.passed },
  ] : []

  const posColumns: ColumnsType<RecruitPositionStat> = [
    { title: t('rdb.col.position'), dataIndex: 'position', width: 220, fixed: 'left', sorter: (a, b) => a.position.localeCompare(b.position) },
    { title: t('rdb.col.department'), dataIndex: 'department', width: 190, render: (v: string | null) => (v ? <DeptChip value={v} /> : '—') },
    { title: t('rdb.col.level'), dataIndex: 'level', width: 110, render: (v: string) => <Tag>{t(`rec.lv.${v}`, { defaultValue: v })}</Tag> },
    { title: t('rdb.col.total'), dataIndex: 'total', width: 90, align: 'right', sorter: (a, b) => a.total - b.total, defaultSortOrder: 'descend' },
    { title: t('rdb.col.open'), dataIndex: 'open', width: 100, align: 'right', sorter: (a, b) => a.open - b.open, render: (v: number) => v || '' },
    { title: t('rdb.col.interviewed'), dataIndex: 'interviewed', width: 110, align: 'right', sorter: (a, b) => a.interviewed - b.interviewed, render: (v: number) => v || '' },
    { title: 'Pass', dataIndex: 'passed', width: 80, align: 'right', sorter: (a, b) => a.passed - b.passed, render: (v: number) => (v ? <b style={{ color: OR.up }}>{v}</b> : '') },
    { title: t('rdb.col.failed'), dataIndex: 'failed', width: 90, align: 'right', sorter: (a, b) => a.failed - b.failed, render: (v: number) => (v ? <span style={{ color: OR.down }}>{v}</span> : '') },
    { title: t('rdb.col.rate'), key: 'rate', width: 100, align: 'right', sorter: (a, b) => pct(a.passed, a.total) - pct(b.passed, b.total), render: (_, x) => (x.passed ? `${pct(x.passed, x.total)}%` : '') },
  ]

  return (
    <div className="page wide">
      <style>{DASH_CSS}</style>
      <div className="rdb">
        <div className="rdb-head">
          <h1>{t('nav.recruitDashboard')} | <em>{t('dash.overview')}</em></h1>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => { q.refetch(); pq.refetch() }} loading={q.isFetching}>{t('hrd.refresh')}</Button>
            <Button type="primary" icon={<FileExcelOutlined />} onClick={exportExcel} loading={exporting} disabled={!d}>{t('rdb.export')}</Button>
          </Space>
        </div>

        <div className="rdb-filters">
          <div className="rdb-filter" style={{ gridColumn: 'span 2' }}>
            <div className="lb">{t('dash.range')}</div>
            <DatePicker.RangePicker allowClear={false} value={range} format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(v) => v.isAfter(dayjs(), 'day')}
              onChange={(v) => { if (v?.[0] && v[1]) { setRange([v[0], v[1]]); setPreset(undefined) } }} />
          </div>
          <div className="rdb-filter">
            <div className="lb">{t('dash.quick')}</div>
            <Select style={{ width: '100%' }} value={preset} placeholder={t('dash.custom')} onChange={(k) => { setPreset(k); setRange(presets.find((x) => x.key === k)!.range()) }}
              options={presets.map((x) => ({ value: x.key, label: t(`rdb.${x.key}`) }))} />
          </div>
          <div className="rdb-filter">
            <div className="lb">{t('dash.compare')}</div>
            <div style={{ lineHeight: '32px' }}>{dayjs(pFrom).format('DD/MM/YY')} – {dayjs(pTo).format('DD/MM/YY')}</div>
          </div>
        </div>

        {q.isError && <Alert type="error" showIcon message={t('rdb.err')} style={{ marginBottom: 12 }} />}
        {q.data?.ready === false && <Alert type="warning" showIcon message={t('rec.notReady')} style={{ marginBottom: 12 }} />}
        {q.isLoading && <Card loading />}

        {d && r && (
          <>
            <div className="rdb-kpis">
              {kpis.map((k) => <KpiCard key={k.label} {...k} prevLabel={prevLabel} />)}
            </div>

            <div className="rdb-main">
              <div className="rdb-main-l">
                <DashCard>
                  <div className="rdb-tabs" role="tablist">
                    {(['created', 'passed', 'failed'] as Metric[]).map((m) => (
                      <button key={m} type="button" role="tab" aria-selected={metric === m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
                        {t(m === 'created' ? 'rdb.sCreated' : m === 'passed' ? 'rdb.sPassed' : 'rdb.sFailed')}
                      </button>
                    ))}
                  </div>
                  <div className="rdb-card-h"><b>{t(`rdb.trend.${d.bucket}`)}</b><span className="rdb-card-x">{t('rdb.trendHint')}</span></div>
                  <TrendBars labels={d.trend.map((x) => fmtLabel(x.start))} tips={d.trend.map((x) => tipTitle(x.start))} values={d.trend.map((x) => x[metric])}
                    color={metric === 'failed' ? OR.mid : OR.main} />
                </DashCard>
                <div className="rdb-row2">
                  <DashCard title={t('rdb.byFactory')}>
                    <Donut centerLabel={t('dash.applications')} items={d.byFactory.map((x) => ({ label: x.key, value: x.value }))} />
                  </DashCard>
                  <DashCard title={t('rec.rp.byLevel')}>
                    <Donut centerLabel={t('dash.applications')} items={Object.entries(r.byLevel).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: t(`rec.lv.${k}`, { defaultValue: k }), value: v }))} />
                  </DashCard>
                </div>
              </div>
              <DashCard title={t('rdb.paretoDept')} extra={t('dash.paretoHint')}>
                <Pareto items={r.byDepartment.map((x) => ({ label: x.key, value: x.value }))} valueLabel={t('dash.applications')} cumLabel={t('dash.cum')} otherLabel={t('dash.other')} />
              </DashCard>
            </div>

            <div className="rdb-row2" style={{ marginTop: 12 }}>
              <DashCard title={t('rdb.funnel')} extra={t('rdb.funnelHint')}>
                {d.funnel.received === 0 ? <Empty description={t('rdb.empty')} /> : funnel.map((f, i) => (
                  <HBar key={f.key} label={t(`rdb.f.${f.key}`)} value={f.v} max={d.funnel.received} total={d.funnel.received} color={OR_SERIES[i]}
                    note={i === 0 ? '100%' : `${pct(f.v, funnel[i - 1].v)}%`} />
                ))}
              </DashCard>
              <DashCard title={t('rec.rp.byStatus')}>
                {total === 0 ? <Empty description={t('rdb.empty')} /> : RECRUIT_STATUSES.filter((s) => st(s) > 0).map((s) => (
                  <HBar key={s} label={t(`rec.st.${s}`)} value={st(s)} max={Math.max(...RECRUIT_STATUSES.map(st))} total={total}
                    color={s === 'pass' ? OR.up : ['fail', 'screen_fail'].includes(s) ? OR.down : s === 'withdrawn' ? OR.gray : OR.main} />
                ))}
              </DashCard>
            </div>

            <div className="rdb-row2" style={{ marginTop: 12 }}>
              <DashCard title={t('rdb.screening')} extra={<>{t('rec.rp.avgScr')}: <b>{days(r.avgScreeningHours)}</b> h</>}>
                {[
                  { k: 'rec.rp.scrSent', v: r.screeningsSent }, { k: 'rec.rp.scrInvite', v: r.screeningsInvite, c: OR.up }, { k: 'rec.rp.scrReject', v: r.screeningsReject, c: OR.down },
                  { k: 'rdb.scrPending', v: r.screeningsPending, c: OR.mid }, { k: 'rec.rp.scrOverdue', v: r.screeningsOverdue, c: OR.down },
                ].map((x) => <HBar key={x.k} label={t(x.k)} value={x.v} max={Math.max(1, r.screeningsSent)} total={r.screeningsSent} color={x.c} />)}
              </DashCard>
              <DashCard title={t('rdb.interviews')}>
                {(() => {
                  const ivs = [
                    { k: 'rec.rp.ivDone', v: r.interviewsDone, c: OR.main }, { k: 'rec.rp.ivPlanned', v: r.interviewsPlanned, c: OR.mid }, { k: 'rec.rp.ivNoShow', v: r.interviewsNoShow, c: OR.down },
                    { k: 'rec.rp.ivCancelled', v: r.interviewsCancelled, c: OR.gray }, { k: 'rec.rp.evPass', v: r.evaluationsPass, c: OR.up }, { k: 'rec.rp.evFail', v: r.evaluationsFail, c: OR.down },
                  ]
                  const all = r.interviewsDone + r.interviewsPlanned + r.interviewsNoShow + r.interviewsCancelled
                  return ivs.map((x) => <HBar key={x.k} label={t(x.k)} value={x.v} max={Math.max(1, ...ivs.map((y) => y.v))} total={all} color={x.c} />)
                })()}
              </DashCard>
            </div>

            <RecruitSummaryCard from={from} to={to} />

            <DashCard title={t('rdb.byPosition')} style={{ marginTop: 12 }}>
              <Table<RecruitPositionStat> size="small" rowKey={(x) => `${x.position}|${x.department ?? ''}|${x.level}`} columns={posColumns} dataSource={d.positions}
                pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 1000 }} locale={{ emptyText: t('rdb.empty') }} />
            </DashCard>
            <p className="cell-muted" style={{ marginTop: 8, marginBottom: 0 }}>{t('rdb.footnote')}</p>
          </>
        )}
      </div>
    </div>
  )
}
