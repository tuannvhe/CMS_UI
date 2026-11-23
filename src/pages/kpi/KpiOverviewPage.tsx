import { useState } from 'react'
import { Tag } from 'antd'
import { RiseOutlined, FallOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { kpi } from '../../api/kpi'
import { Bullet, KPI_CSS, Pill, TrendLine, delta } from './kpiUi'
import { STATUS_COLOR, STATUS_TEXT, statusOf } from './kpiCalc'
import { KpiState, PeriodSelect, SheetStatusTag, SiteSelect, KpiHead } from './KpiParts'
import { pickName, usePeriods } from './kpiShared'
import { trData } from '../../utils/dataText'

const r1 = (v: number) => Math.round(v * 10) / 10
const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((s, x) => s + x, 0) / xs.length) : null)

/** Tổng quan KPI các phòng ban theo kỳ (dữ liệu thật từ /api/kpi/overview): điểm trung bình, bản đồ trạng thái, xếp hạng, chỉ tiêu cần chú ý, xu hướng. */
export default function KpiOverviewPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const navigate = useNavigate()
  const periods = usePeriods()
  const [periodId, setPeriodId] = useState<number | undefined>()
  const [site, setSite] = useState('')
  const q = useQuery({ queryKey: ['kpi-overview', periodId ?? null, site], queryFn: () => kpi.overview(periodId, site) })
  const data = q.data
  const units = data?.units ?? []
  const scored = units.filter((u): u is typeof u & { score: number } => u.score != null)
  const cur = mean(scored.map((u) => u.score))
  const prev = mean(units.filter((u) => u.prevScore != null).map((u) => u.prevScore as number))
  const dl = cur != null && prev != null ? delta(cur, prev) : null
  const mix = (['ok', 'near', 'low'] as const).map((s) => ({ s, n: scored.filter((u) => statusOf(u.score) === s).length }))
  const ranked = [...units].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const trend = (data?.trend ?? []).filter((x) => x.avg != null)
  const open = (sheetId: number) => navigate(`/kpi/departments?sheet=${sheetId}`)

  return (
    <div className="page wide kpi-page">
      <style>{KPI_CSS}</style>
      <KpiHead page="kpiOverview" />
      <div className="kpi-bar">
        <label>{t('kpi.period.label')}</label>
        <PeriodSelect periods={periods.data} loading={periods.isLoading} value={periodId ?? data?.period?.id} onChange={setPeriodId} />
        <label>{t('kpi.site.label')}</label>
        <SiteSelect value={site} onChange={setSite} />
        {data?.period && <Tag>{t(`kpi.period.st.${data.period.status}`)}</Tag>}
        <span className="kpi-legend" style={{ marginLeft: 'auto' }}>
          {(['ok', 'near', 'low'] as const).map((s) => <span key={s}><i className="kpi-dot" style={{ background: STATUS_COLOR[s] }} />{t(`kpi.status.${s}`)}</span>)}
        </span>
      </div>

      <KpiState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!data?.period || units.length === 0}
        emptyText={!data?.period ? t('kpi.period.none') : t('kpi.noSheets')}>
        <div className="kpi-stats">
          <div className="kpi-stat main">
            <div className="l">{t('kpi.tile.avg')} · {data?.period?.code}</div>
            <div className="v">{cur ?? '—'}<small>%</small></div>
            <div className="s">
              {dl != null && <span style={{ color: '#fff', fontWeight: 600 }}>{dl >= 0 ? <RiseOutlined /> : <FallOutlined />} {dl >= 0 ? '+' : '−'}{Math.abs(dl)} </span>}
              {dl != null ? t('kpi.vsPrevPeriod') : t('kpi.scoredOf', { n: scored.length, total: units.length })}
            </div>
          </div>
          {mix.map((x) => (
            <div key={x.s} className="kpi-stat">
              <div className="l"><i className="kpi-dot" style={{ background: STATUS_COLOR[x.s] }} />{t(`kpi.status.${x.s}`)}</div>
              <div className="v" style={{ color: x.n ? STATUS_TEXT[x.s] : undefined }}>{x.n}<small>/ {scored.length} {t('kpi.depts')}</small></div>
              <div className="kpi-mix" aria-hidden><i style={{ width: `${scored.length ? (x.n / scored.length) * 100 : 0}%`, background: STATUS_COLOR[x.s] }} /></div>
            </div>
          ))}
        </div>

        <div className="kpi-grid main">
          <div className="kpi-card">
            <h3>{t('kpi.rankTitle')}<small>{t('kpi.clickDeptHint')}</small></h3>
            <div className="kpi-list">
              {ranked.map((u, i) => (
                <div key={u.sheetId} className="kpi-row click" role="button" tabIndex={0} onClick={() => open(u.sheetId)} onKeyDown={(e) => { if (e.key === 'Enter') open(u.sheetId) }}>
                  <span className="rk">{i + 1}</span>
                  <span className="nm" title={u.unitName}>{trData(u.unitName)}{u.site ? <small> · {u.site}</small> : null}</span>
                  {u.score == null ? <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>{t('kpi.sheet.noScore')}</span> : <Bullet value={u.score} />}
                  <span className="vl" style={{ color: u.score == null ? 'var(--c-muted)' : STATUS_TEXT[statusOf(u.score)] }}>{u.score == null ? '—' : `${u.score}%`}</span>
                  <span className="tg"><SheetStatusTag status={u.status} /></span>
                </div>
              ))}
            </div>
          </div>
          <div className="kpi-stack">
            <div className="kpi-card">
              <h3>{t('kpi.attention')}<small>{t('kpi.attentionSub')}</small></h3>
              {(data?.attention.length ?? 0) === 0 && <div className="kpi-empty">{t('kpi.noAttention')}</div>}
              {data?.attention.map((a) => (
                <div key={`${a.sheetId}-${a.indicatorCode}`} className="kpi-attn" role="button" tabIndex={0} onClick={() => open(a.sheetId)} onKeyDown={(e) => { if (e.key === 'Enter') open(a.sheetId) }}>
                  <span>{pickName(a.name, lang)}</span>
                  <Pill value={a.achieve} />
                  <small>{trData(a.unitName)} · {a.indicatorCode}</small>
                </div>
              ))}
            </div>
            <div className="kpi-card">
              <h3>{t('kpi.trendTitleN')}</h3>
              <TrendLine labels={trend.map((x) => x.periodCode)} values={trend.map((x) => x.avg as number)} />
            </div>
          </div>
        </div>
      </KpiState>
    </div>
  )
}
