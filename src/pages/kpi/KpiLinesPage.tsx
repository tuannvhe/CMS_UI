import { useState } from 'react'
import { Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import KpiBanner from './KpiBanner'
import { KpiHead } from './KpiParts'
import KpiDetailDrawer from './KpiDetailDrawer'
import { PersonChip, ScoreCell, Spark, StatusText, delta } from './kpiUi'
import { LINES, PEOPLE, ROLE_LABEL, lineKpis, lineScore, personScore, type DemoPerson } from './kpiPeopleData'
import { MONTHS, STATUS_COLOR, achievement, fmtVal, pick, statusOf, type KpiItem } from './kpiDemoData'
import { CATS, metaOf } from './kpiMeta'

/** Demo: line sản xuất có ai, KPI của line và của từng người trong line (dữ liệu mẫu, đang trong quá trình xây dựng). */
export default function KpiLinesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [m, setM] = useState(MONTHS.length - 1)
  const [code, setCode] = useState(LINES[0].code)
  const [detail, setDetail] = useState<KpiItem | null>(null)
  const line = LINES.find((l) => l.code === code) ?? LINES[0]
  const kpis = lineKpis(line.code)
  const members = PEOPLE.filter((p) => p.line === line.code).sort((a, b) => (a.role === 'leader' ? -1 : b.role === 'leader' ? 1 : personScore(b, m) - personScore(a, m)))
  const low = members.filter((p) => personScore(p, m) < 90).length
  const dl = delta(lineScore(line.code, m), m > 0 ? lineScore(line.code, m - 1) : undefined)
  const sample = PEOPLE.find((p) => p.line === line.code && p.role === 'operator')!

  const kCols: ColumnsType<KpiItem> = [
    { title: t('kpi.col.kpi'), key: 'n', render: (_, r) => <a onClick={() => setDetail(r)}><b>{pick(r.name, lang)}</b></a> },
    { title: t('kpi.det.group'), key: 'g', width: 110, render: (_, r) => { const c = metaOf(r.id).cat; return <span className="kpi-st"><i className="kpi-dot" style={{ background: CATS[c].color }} />{pick(CATS[c].name, lang)}</span> } },
    { title: t('kpi.col.target'), key: 'tg', width: 110, align: 'right', render: (_, r) => `${r.lowerIsBetter ? '≤ ' : '≥ '}${fmtVal(r.target, r.unit)}` },
    { title: t('kpi.col.actual'), key: 'ac', width: 100, align: 'right', render: (_, r) => <b>{fmtVal(r.actual[m], r.unit)}</b> },
    { title: t('kpi.col.achieve'), key: 'pc', width: 220, render: (_, r) => <ScoreCell value={achievement(r, r.actual[m])} /> },
    { title: t('kpi.trend6'), key: 'sp', width: 84, render: (_, r) => <Spark values={r.actual} /> },
  ]
  const mCols: ColumnsType<DemoPerson> = [
    { title: t('kpi.col.employee'), key: 'n', width: 210, render: (_, p) => <span><b>{p.name}</b><br /><small style={{ color: 'var(--c-muted)' }}>{p.code} · {pick(ROLE_LABEL[p.role], lang)}</small></span> },
    ...[0, 1, 2].map((i) => ({
      title: pick(sample.kpis[i].name, lang), key: `k${i}`, width: 130, align: 'right' as const,
      render: (_: unknown, p: DemoPerson) => { const k = p.kpis[i]; return <a onClick={() => setDetail(k)} style={{ color: STATUS_COLOR[statusOf(achievement(k, k.actual[m]))] }}>{fmtVal(k.actual[m], k.unit)}</a> },
    })),
    { title: t('kpi.col.score'), key: 'sc', width: 220, sorter: (a, b) => personScore(a, m) - personScore(b, m), render: (_, p) => <ScoreCell value={personScore(p, m)} /> },
    { title: t('kpi.trend6'), key: 'sp', width: 84, render: (_, p) => <Spark values={MONTHS.map((_x, i) => personScore(p, i))} /> },
    { title: t('kpi.col.status'), key: 'st', width: 100, render: (_, p) => { const s = personScore(p, m); return <StatusText value={s} label={t(`kpi.status.${statusOf(s)}`)} /> } },
  ]

  return (
    <div className="page wide kpi-page">
      <KpiHead page="kpiLines" />
      <KpiBanner />
      <div className="kpi-bar">
        <label>{t('kpi.month')}</label>
        <Select style={{ width: 130 }} value={m} onChange={setM} options={MONTHS.map((x, i) => ({ value: i, label: x }))} />
        <Tag>{t('kpi.sample')}</Tag>
        <span className="kpi-legend" style={{ marginLeft: 'auto' }}>
          {(['ok', 'near', 'low'] as const).map((s) => <span key={s}><i className="kpi-dot" style={{ background: STATUS_COLOR[s] }} />{t(`kpi.status.${s}`)}</span>)}
        </span>
      </div>

      <div className="kpi-grid two" style={{ marginTop: 0 }}>
        {LINES.map((l) => {
          const s = lineScore(l.code, m)
          const ppl = PEOPLE.filter((p) => p.line === l.code).sort((a, b) => (a.role === 'leader' ? -1 : b.role === 'leader' ? 1 : 0))
          return (
            <div key={l.code} className={`kpi-lane${l.code === code ? ' on' : ''}`} role="button" tabIndex={0} onClick={() => setCode(l.code)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCode(l.code) } }}>
              <div className="kpi-lane-h"><b>{pick(l.name, lang)}</b><span className="sc" style={{ color: STATUS_COLOR[statusOf(s)] }}>{s}%</span></div>
              <div className="kpi-lane-m">{pick(l.product, lang)} · {pick(l.shift, lang)} · {ppl.length} {t('kpi.people')}</div>
              <div className="kpi-chips">
                {ppl.map((p) => <PersonChip key={p.code} name={p.name} score={personScore(p, m)} lead={p.role === 'leader'} tip={`${p.name} (${pick(ROLE_LABEL[p.role], lang)}): ${personScore(p, m)}%`} />)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <h3>{pick(line.name, lang)} · {t('kpi.lineKpis')}
            <small>{t('kpi.leader')}: {PEOPLE.find((p) => p.code === line.leader)?.name} · {lineScore(line.code, m)}%{dl != null ? ` (${dl >= 0 ? '+' : ''}${dl})` : ''} · {low} {t('kpi.tile.needHelp').toLowerCase()}</small>
          </h3>
          <Table<KpiItem> size="small" rowKey="id" columns={kCols} dataSource={kpis} pagination={false} scroll={{ x: 760 }} />
        </div>
        <div className="kpi-card">
          <h3>{pick(line.name, lang)} · {t('kpi.members')}<small>{t('kpi.clickHint')}</small></h3>
          <Table<DemoPerson> size="small" rowKey="code" columns={mCols} dataSource={members} pagination={false} scroll={{ x: 980 }} />
        </div>
      </div>
      <KpiDetailDrawer item={detail} title={pick(line.name, lang)} onClose={() => setDetail(null)} />
    </div>
  )
}
