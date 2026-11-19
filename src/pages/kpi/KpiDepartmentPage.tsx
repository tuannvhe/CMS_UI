import { useState } from 'react'
import { Button, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { kpi, type KpiCategory, type KpiItem } from '../../api/kpi'
import { KpiItemDrawer } from './KpiDetailDrawer'
import { Bullet, KPI_CSS, ScoreCell, ScoreRing, Spark, StatusText } from './kpiUi'
import { STATUS_TEXT, statusOf } from './kpiCalc'
import { CatLabel, KpiState, NameCell, PeriodSelect, SheetStatusTag, SiteSelect, KpiHead } from './KpiParts'
import { fmtNum, usePeriods } from './kpiShared'
import { foldFilter } from '../../utils/search'
import { trData } from '../../utils/dataText'

const CAT_KEYS: KpiCategory[] = ['Q', 'C', 'D', 'S', 'P']

/** KPI chi tiết của một phòng ban trong một kỳ (dữ liệu thật): điểm, điểm theo nhóm, bảng chỉ tiêu, lịch sử các kỳ gần nhất. */
export default function KpiDepartmentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sheetId = Number(params.get('sheet')) || undefined
  const periods = usePeriods()
  const [periodPick, setPeriodPick] = useState<number | undefined>()
  const [site, setSite] = useState('')
  const [detail, setDetail] = useState<KpiItem | null>(null)

  const sheet = useQuery({ queryKey: ['kpi-sheet', sheetId], queryFn: () => kpi.sheet(sheetId as number), enabled: !!sheetId })
  const periodId = periodPick ?? sheet.data?.sheet.periodId ?? periods.data?.[0]?.id
  const list = useQuery({ queryKey: ['kpi-sheets', periodId, site], queryFn: () => kpi.sheets({ periodId, site }), enabled: !!periodId })
  const pickSheet = (id: number | undefined) => setParams(id ? { sheet: String(id) } : {}, { replace: true })
  const onPeriod = (id: number | undefined) => { setPeriodPick(id); pickSheet(undefined) }

  const d = sheet.data
  const s = d?.sheet
  const catRows = d ? CAT_KEYS.map((c) => ({ c, n: d.items.filter((i) => i.indicator.category === c).length, score: d.byCat[c] })).filter((x) => x.n > 0) : []
  const okN = d ? d.items.filter((i) => i.achieve != null && statusOf(i.achieve) === 'ok').length : 0
  const canAct = !!d && (d.can.edit || d.can.submit || d.can.approve || d.can.reject)

  const cols: ColumnsType<KpiItem> = [
    { title: t('kpi.col.kpi'), key: 'n', render: (_, r) => <NameCell ind={r.indicator} onClick={() => setDetail(r)} /> },
    { title: t('kpi.col.weight'), dataIndex: 'weight', width: 80, align: 'right', render: (v: number) => `${v}%` },
    { title: t('kpi.col.target'), key: 'tg', width: 120, align: 'right', render: (_, r) => (r.indicator.valueType === 'yesno' ? t('kpi.sheet.yes') : `${r.indicator.lowerBetter ? '≤ ' : '≥ '}${fmtNum(r.target, r.indicator.unit)}`) },
    { title: t('kpi.col.actual'), key: 'ac', width: 110, align: 'right', render: (_, r) => <b>{r.indicator.valueType === 'yesno' && r.actual != null ? t(r.actual >= 1 ? 'kpi.sheet.yes' : 'kpi.sheet.no') : fmtNum(r.actual, r.indicator.unit)}</b> },
    { title: t('kpi.col.achieve'), key: 'pc', width: 200, render: (_, r) => (r.achieve == null ? <span style={{ color: 'var(--c-muted)' }}>—</span> : <ScoreCell value={r.achieve} />) },
    { title: t('kpi.trendN'), key: 'sp', width: 84, render: (_, r) => <Spark values={r.history.filter((h) => h.achieve != null).map((h) => h.achieve as number)} /> },
    { title: t('kpi.col.status'), key: 'st', width: 100, render: (_, r) => (r.achieve == null ? '' : <StatusText value={r.achieve} label={t(`kpi.status.${statusOf(r.achieve)}`)} />) },
  ]

  return (
    <div className="page wide kpi-page">
      <style>{KPI_CSS}</style>
      <KpiHead page="kpiDepartment" />
      <div className="kpi-bar">
        <label>{t('kpi.period.label')}</label>
        <PeriodSelect periods={periods.data} loading={periods.isLoading} value={periodId} onChange={onPeriod} />
        <label>{t('kpi.site.label')}</label>
        <SiteSelect value={site} onChange={(v) => { setSite(v); pickSheet(undefined) }} />
        <label>{t('kpi.col.dept')}</label>
        <Select style={{ width: 260 }} showSearch filterOption={foldFilter('label')} value={sheetId} onChange={(v) => pickSheet(v)} loading={list.isLoading}
          placeholder={t('kpi.pickDept')} notFoundContent={t('kpi.noSheets')}
          options={(list.data ?? []).map((x) => ({ value: x.id, label: `${x.unitName}${x.site ? ` · ${x.site}` : ''}` }))} />
        {canAct && <Button style={{ marginLeft: 'auto' }} type="primary" icon={<EditOutlined />} onClick={() => navigate(`/kpi/entry?sheet=${sheetId}`)}>{t('kpi.sheet.openEntry')}</Button>}
      </div>

      {!sheetId
        ? <KpiState loading={periods.isLoading || list.isLoading} error={periods.error ?? list.error} onRetry={() => list.refetch()} empty
            emptyText={(list.data?.length ?? 0) === 0 ? t('kpi.noSheets') : t('kpi.pickDept')} />
        : (
          <KpiState loading={sheet.isLoading} error={sheet.error} onRetry={() => sheet.refetch()}>
            {d && s && (
              <>
                <div className="kpi-hero">
                  <div className="kpi-card">
                    <h3>{trData(s.unitName)}<small>{s.periodCode}{s.site ? ` · ${s.site}` : ''}</small></h3>
                    <div className="kpi-score">
                      <ScoreRing value={s.score ?? 0} />
                      <div className="meta">
                        <div><SheetStatusTag status={s.status} /></div>
                        <div><b>{okN}</b> / {d.items.length} {t('kpi.kpis')} {t('kpi.status.ok').toLowerCase()}</div>
                        <div>{t('kpi.sheet.owners')}: <b>{s.owners.length ? s.owners.map((o) => o.name).join(', ') : '—'}</b></div>
                      </div>
                    </div>
                    {s.rejectReason && s.status === 'rejected' && <div style={{ fontSize: 12.5, color: STATUS_TEXT.low, marginTop: 12 }}>{t('kpi.sheet.rejectReason')}: {s.rejectReason}</div>}
                  </div>
                  <div className="kpi-card">
                    <h3>{t('kpi.byGroup')}</h3>
                    {catRows.length === 0 && <div className="kpi-empty">{t('kpi.sheet.noItems')}</div>}
                    <div className="kpi-cats">
                      {catRows.map((c) => (
                        <div key={c.c} className="kpi-cat">
                          <div className="h"><CatLabel cat={c.c} /></div>
                          <div className="n" style={{ color: c.score == null ? 'var(--c-muted)' : STATUS_TEXT[statusOf(c.score)] }}>{c.score == null ? '—' : `${c.score}%`}</div>
                          {c.score != null && <Bullet value={c.score} />}
                          <div className="c">{c.n} {t('kpi.kpis')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="kpi-card" style={{ marginTop: 16 }}>
                  <h3>{t('kpi.sheet.items')}<small>{t('kpi.clickHint')}</small></h3>
                  <Table<KpiItem> size="small" rowKey="id" columns={cols} dataSource={d.items} pagination={false} scroll={{ x: 860 }} locale={{ emptyText: t('kpi.sheet.noItems') }} />
                </div>
                <KpiItemDrawer item={detail} title={s.unitName} onClose={() => setDetail(null)} />
              </>
            )}
          </KpiState>
        )}
    </div>
  )
}
