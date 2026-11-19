import { useMemo, useState } from 'react'
import { Input, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import KpiBanner from './KpiBanner'
import { KpiHead } from './KpiParts'
import KpiDetailDrawer from './KpiDetailDrawer'
import { ScoreCell, Spark, StatusText, delta } from './kpiUi'
import { LINES, PEOPLE, ROLE_LABEL, personScore, type DemoPerson } from './kpiPeopleData'
import { DEPTS, MONTHS, STATUS_COLOR, achievement, fmtVal, pick, statusOf, type KpiItem } from './kpiDemoData'
import { matchText } from '../../utils/search'
import { useDebouncedValue } from '../../hooks/useDebounce'

/** Demo: KPI từng người theo bộ phận (và theo line với bộ phận Sản xuất); bấm dấu + để xem từng chỉ tiêu (dữ liệu mẫu, đang trong quá trình xây dựng). */
export default function KpiPeoplePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [m, setM] = useState(MONTHS.length - 1)
  const [dept, setDept] = useState<string>('PROD')
  const [line, setLine] = useState<string | undefined>()
  const [q, setQ] = useState('')
  const dq = useDebouncedValue(q)
  const [detail, setDetail] = useState<{ k: KpiItem; who: string } | null>(null)

  const rows = useMemo(() => PEOPLE.filter((p) => p.dept === dept && (!line || p.line === line)
    && matchText(dq, p.name, p.code)), [dept, line, dq])
  const scores = rows.map((p) => personScore(p, m))
  const avg = scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10 : 0
  const prevAvg = m > 0 && rows.length ? Math.round((rows.reduce((s, p) => s + personScore(p, m - 1), 0) / rows.length) * 10) / 10 : undefined
  const dl = delta(avg, prevAvg)
  const cnt = (s: 'ok' | 'near' | 'low') => scores.filter((x) => statusOf(x) === s).length
  const dn = DEPTS.find((d) => d.code === dept)!

  const cols: ColumnsType<DemoPerson> = [
    { title: t('kpi.col.employee'), key: 'n', width: 240, render: (_, p) => <span><b>{p.name}</b><br /><small style={{ color: 'var(--c-muted)' }}>{p.code} · {pick(ROLE_LABEL[p.role], lang)}</small></span> },
    ...(dept === 'PROD' ? [{ title: t('kpi.col.line'), key: 'l', width: 80, render: (_: unknown, p: DemoPerson) => p.line, filters: LINES.map((l) => ({ text: l.code, value: l.code })), onFilter: (v: unknown, p: DemoPerson) => p.line === v }] : []),
    { title: t('kpi.col.score'), key: 'sc', width: 240, defaultSortOrder: 'descend', sorter: (a, b) => personScore(a, m) - personScore(b, m), render: (_, p) => <ScoreCell value={personScore(p, m)} /> },
    { title: t('kpi.trend6'), key: 'sp', width: 84, render: (_, p) => <Spark values={MONTHS.map((_x, i) => personScore(p, i))} /> },
    { title: t('kpi.col.vsPrev'), key: 'vp', width: 90, align: 'right', render: (_, p) => { if (m === 0) return '—'; const d = delta(personScore(p, m), personScore(p, m - 1)) ?? 0; return <span style={{ color: d >= 0 ? STATUS_COLOR.ok : STATUS_COLOR.low }}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)}</span> } },
    { title: t('kpi.col.status'), key: 'st', width: 100, render: (_, p) => { const s = personScore(p, m); return <StatusText value={s} label={t(`kpi.status.${statusOf(s)}`)} /> } },
  ]
  const kCols = (p: DemoPerson): ColumnsType<KpiItem> => [
    { title: t('kpi.col.kpi'), key: 'n', render: (_, k) => <a onClick={() => setDetail({ k, who: p.name })}>{pick(k.name, lang)}</a> },
    { title: t('kpi.col.weight'), dataIndex: 'weight', width: 80, align: 'right', render: (v: number) => `${v}%` },
    { title: t('kpi.col.target'), key: 'tg', width: 110, align: 'right', render: (_, k) => `${k.lowerIsBetter ? '≤ ' : '≥ '}${fmtVal(k.target, k.unit)}` },
    { title: t('kpi.col.actual'), key: 'ac', width: 100, align: 'right', render: (_, k) => <b>{fmtVal(k.actual[m], k.unit)}</b> },
    { title: t('kpi.col.achieve'), key: 'pc', width: 230, render: (_, k) => <ScoreCell value={achievement(k, k.actual[m])} /> },
    { title: t('kpi.trend6'), key: 'sp', width: 84, render: (_, k) => <Spark values={k.actual} /> },
  ]

  return (
    <div className="page wide kpi-page">
      <KpiHead page="kpiPeople" />
      <KpiBanner />
      <div className="kpi-bar">
        <label>{t('kpi.col.dept')}</label>
        <Select style={{ width: 220 }} value={dept} onChange={(v) => { setDept(v); setLine(undefined) }} options={DEPTS.map((d) => ({ value: d.code, label: pick(d.name, lang) }))} />
        {dept === 'PROD' && <Select allowClear placeholder={t('kpi.allLines')} style={{ width: 200 }} value={line} onChange={setLine} options={LINES.map((l) => ({ value: l.code, label: `${pick(l.name, lang)} · ${pick(l.product, lang)}` }))} />}
        <label>{t('kpi.month')}</label>
        <Select style={{ width: 120 }} value={m} onChange={setM} options={MONTHS.map((x, i) => ({ value: i, label: x }))} />
        <Input.Search allowClear placeholder={t('kpi.searchPerson')} style={{ width: 220 }} onChange={(e) => setQ(e.target.value)} />
        <Tag>{t('kpi.sample')}</Tag>
      </div>
      <div className="kpi-card">
        <h3>
          <span>{pick(dn.name, lang)} · {rows.length} {t('kpi.people')} · {t('kpi.tile.avgPerson')}: <b style={{ color: STATUS_COLOR[statusOf(avg)] }}>{avg}%</b>{dl != null ? ` (${dl >= 0 ? '+' : ''}${dl})` : ''}</span>
          <small>{(['ok', 'near', 'low'] as const).map((s) => <span key={s} style={{ marginLeft: 12 }}><i className="kpi-dot" style={{ background: STATUS_COLOR[s] }} />{cnt(s)} {t(`kpi.status.${s}`)}</span>)}</small>
        </h3>
        <Table<DemoPerson> size="small" rowKey="code" columns={cols} dataSource={rows} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 820 }}
          expandable={{ expandedRowRender: (p) => <Table<KpiItem> size="small" rowKey="id" columns={kCols(p)} dataSource={p.kpis} pagination={false} /> }} />
      </div>
      <KpiDetailDrawer item={detail?.k ?? null} title={detail?.who} onClose={() => setDetail(null)} />
    </div>
  )
}
