import { useState } from 'react'
import { Button, DatePicker, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileExcelOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Dayjs } from 'dayjs'
import { useToast } from '../../hooks/useToast'
import { kpi, type KpiReport } from '../../api/kpi'
import { KPI_CSS, Pill, Spark, TrendLine } from './kpiUi'
import { STATUS_COLOR, STATUS_TEXT } from './kpiCalc'
import { KpiState, SiteSelect, KpiHead } from './KpiParts'
import { kpiErrText } from './kpiShared'
import { foldFilter } from '../../utils/search'
import { trData } from '../../utils/dataText'

type Row = KpiReport['rows'][number]
const ym = (d: Dayjs | null) => (d ? d.format('YYYY-MM') : undefined)

/** Báo cáo điểm KPI theo kỳ của các phòng ban (mặc định 6 kỳ gần nhất), ô màu theo trạng thái; xuất Excel. */
export default function KpiReportPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [from, setFrom] = useState<Dayjs | null>(null)
  const [to, setTo] = useState<Dayjs | null>(null)
  const [site, setSite] = useState('')
  const [unitId, setUnitId] = useState<number | undefined>()
  const [exporting, setExporting] = useState(false)
  const params = { from: ym(from), to: ym(to), site }
  const q = useQuery({ queryKey: ['kpi-report', params.from ?? '', params.to ?? '', site], queryFn: () => kpi.report(params) })
  const periods = q.data?.periods ?? []
  const rows = q.data?.rows ?? []
  const sel = rows.find((r) => r.unitId === unitId) ?? rows[0]
  const selPts = sel ? periods.map((p, i) => ({ p, v: sel.scores[i] })).filter((x): x is { p: string; v: number } => x.v != null) : []

  const doExport = async () => {
    setExporting(true)
    try { await kpi.exportReport(params) } catch (e) { toast.error(kpiErrText(t, e)) } finally { setExporting(false) }
  }

  const cols: ColumnsType<Row> = [
    { title: t('kpi.col.dept'), dataIndex: 'unitName', fixed: 'left', width: 190, sorter: (a, b) => a.unitName.localeCompare(b.unitName),
      render: (v: string, r) => <span><b>{v}</b>{r.site ? <small style={{ color: 'var(--c-muted)' }}> · {r.site}</small> : null}</span> },
    ...periods.map((p, i) => ({
      title: p, key: p, width: 92, align: 'center' as const,
      render: (_: unknown, r: Row) => {
        const v = r.scores[i]
        return <Pill value={v} />
      },
    })),
    { title: t('kpi.trendN'), key: 'sp', width: 90, render: (_, r) => <Spark values={r.scores.filter((x): x is number => x != null)} /> },
    { title: t('kpi.col.changeN'), key: 'ch', width: 110, align: 'right', render: (_, r) => {
      const xs = r.scores.filter((x): x is number => x != null)
      if (xs.length < 2) return '—'
      const x = Math.round((xs[xs.length - 1] - xs[0]) * 10) / 10
      return <b style={{ color: x >= 0 ? STATUS_TEXT.ok : STATUS_TEXT.low }}>{x >= 0 ? '+' : ''}{x}</b>
    } },
  ]

  return (
    <div className="page wide kpi-page">
      <style>{KPI_CSS}</style>
      <KpiHead page="kpiReport" />
      <div className="kpi-bar">
        <label>{t('kpi.report.from')}</label>
        <DatePicker picker="month" format="YYYY-MM" value={from} onChange={setFrom} placeholder={t('kpi.report.auto')} />
        <label>{t('kpi.report.to')}</label>
        <DatePicker picker="month" format="YYYY-MM" value={to} onChange={setTo} placeholder={t('kpi.report.auto')} />
        <label>{t('kpi.site.label')}</label>
        <SiteSelect value={site} onChange={setSite} />
        <Button style={{ marginLeft: 'auto' }} icon={<FileExcelOutlined />} loading={exporting} disabled={!rows.length} onClick={doExport}>{t('kpi.export')}</Button>
      </div>
      <KpiState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={periods.length === 0 || rows.length === 0} emptyText={t('kpi.report.noData')}>
        <div className="kpi-card">
          <h3>
            <span>{t('kpi.trendOf')} {trData(sel?.unitName)}</span>
            <Select size="small" style={{ width: 240 }} showSearch filterOption={foldFilter('label')} value={sel?.unitId} onChange={setUnitId}
              options={rows.map((r) => ({ value: r.unitId, label: r.unitName }))} />
          </h3>
          <TrendLine labels={selPts.map((x) => x.p)} values={selPts.map((x) => x.v)} />
        </div>
        <div className="kpi-card" style={{ marginTop: 16 }}>
          <h3>{t('kpi.matrixTitleN')}
            <small className="kpi-legend">{(['ok', 'near', 'low'] as const).map((s) => <span key={s}><i className="kpi-dot" style={{ background: STATUS_COLOR[s] }} />{t(`kpi.status.${s}`)}</span>)}</small>
          </h3>
          <Table<Row> size="small" rowKey="unitId" columns={cols} dataSource={rows} pagination={rows.length > 50 ? { pageSize: 50 } : false} scroll={{ x: 600 + periods.length * 92 }} />
        </div>
      </KpiState>
    </div>
  )
}
