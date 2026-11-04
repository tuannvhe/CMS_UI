import { useMemo, useState } from 'react'
import { Empty, Input, Segmented, Select, Space, Tag, Tooltip } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { MEAL_ORDER_CODES, MEAL_SITES, type MealCode, type MealOrder, type MealSite } from '../../api/meals'
import { DASH_CSS, DashCard, Donut, KpiCard, OR, TrendBars } from '../../components/DashKit'

const COLORS: Record<MealCode, string> = { lunch: '#0F6B3E', dinner: '#5FA830', night: '#0A4D2C', overtime: '#E0A526', breakfast: '#8CC56B' }

type Counts = Record<MealCode, number> & { total: number }
const zero = (): Counts => ({ breakfast: 0, lunch: 0, dinner: 0, night: 0, overtime: 0, total: 0 })
const add = (c: Counts, o: MealOrder) => { c[o.meal] += o.qty; c.total += o.qty }

/** Thanh ngang chia theo bữa: độ dài theo tổng so với max, mỗi khúc một bữa. */
function MealBar({ c, max }: { c: Counts; max: number }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', height: 14, width: `${max > 0 ? Math.max(2, (c.total / max) * 100) : 0}%`, borderRadius: 4, overflow: 'hidden', background: 'var(--ant-color-fill-tertiary, #eee)' }}>
      {MEAL_ORDER_CODES.filter((m) => c[m] > 0).map((m) => (
        <Tooltip key={m} title={`${t(`meal.code.${m}`)}: ${c[m]}`}>
          <div style={{ width: `${(c[m] / c.total) * 100}%`, background: COLORS[m] }} />
        </Tooltip>
      ))}
    </div>
  )
}

type DeptRow = Counts & { key: string; dept: string }

/**
 * Dashboard suất ăn ĐÃ TÍNH (đăng ký đã duyệt, không gồm dòng xin sửa / huỷ) trong khoảng ngày: tổng theo bữa, theo ngày, theo nhà máy
 * (bảng + đường tổng mỗi ngày của từng nhà máy) và theo bộ phận TÁCH RIÊNG từng nhà máy. Lọc theo nhà máy và bộ phận.
 */
export function MealStats({ rows, loading, toolbar }: { rows: MealOrder[]; loading: boolean; toolbar: React.ReactNode }) {
  const { t } = useTranslation()
  const [site, setSite] = useState<'ALL' | MealSite>('ALL')
  const [dept, setDept] = useState<string>()
  const [search, setSearch] = useState('')
  const all = useMemo(() => rows.filter((r) => r.status === 'approved' && r.replacesId == null && !r.cancel), [rows])
  const deptOptions = useMemo(() => [...new Set(all.map(deptKey))].sort((a, b) => a.localeCompare(b)).map((d) => ({ value: d, label: d })), [all])
  const counted = useMemo(() => all.filter((r) => (site === 'ALL' || r.site === site) && (!dept || deptKey(r) === dept)), [all, site, dept])
  const pending = rows.filter((r) => r.status === 'pending' && (site === 'ALL' || r.site === site) && (!dept || deptKey(r) === dept)).length

  const total = useMemo(() => { const c = zero(); counted.forEach((o) => add(c, o)); return c }, [counted])
  const days = useMemo(() => [...new Set(counted.map((o) => o.date.slice(0, 10)))].sort(), [counted])
  const byDay = useMemo(() => days.map((d) => { const c = zero(); counted.filter((o) => o.date.slice(0, 10) === d).forEach((o) => add(c, o)); return [d, c] as const }), [days, counted])
  const sites = (site === 'ALL' ? MEAL_SITES : [site]).filter((s) => counted.some((o) => o.site === s))
  const bySite = sites.map((s) => { const c = zero(); counted.filter((o) => o.site === s).forEach((o) => add(c, o)); return { key: s, site: s, ...c } })
  const deptsOf = (s: MealSite): DeptRow[] => {
    const m = new Map<string, Counts>()
    for (const o of counted.filter((x) => x.site === s)) { const k = deptKey(o); if (!m.has(k)) m.set(k, zero()); add(m.get(k)!, o) }
    return [...m.entries()].map(([d, c]) => ({ key: d, dept: d, ...c })).sort((a, b) => b.total - a.total || a.dept.localeCompare(b.dept))
  }
  const deptCount = new Set(counted.map((o) => `${o.site}\u0001${deptKey(o)}`)).size
  const mealCols = MEAL_ORDER_CODES.map((m) => ({ title: t(`meal.code.${m}`), dataIndex: m, align: 'right' as const, render: (v: number) => v || <span className="cell-muted">0</span> }))
  const q = search.trim().toLowerCase()
  const [metric, setMetric] = useState<'total' | MealCode>('total')

  return (
    <div className="rdb">
      <style>{DASH_CSS}</style>
      <div className="rdb-filters">
        <div className="rdb-filter">
          <div className="lb">{t('dash.site')}</div>
          <Segmented block value={site} onChange={(v) => setSite(v as 'ALL' | MealSite)}
            options={[{ value: 'ALL', label: t('mealStats.allSites') }, ...MEAL_SITES.map((x) => ({ value: x, label: t(`meal.siteName.${x}`) }))]} />
        </div>
        <div className="rdb-filter">
          <div className="lb">{t('meal.dept')}</div>
          <Select allowClear showSearch style={{ width: '100%' }} placeholder={t('mealStats.pickDept')} value={dept} onChange={setDept} options={deptOptions} optionFilterProp="label" />
        </div>
        <div className="rdb-filter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{toolbar}</div>
      </div>
      <div className="rdb-kpis">
        <KpiCard label={t('mealStats.total')} value={total.total} prevLabel="" sub={byDay.length ? `${(total.total / byDay.length).toFixed(0)} ${t('mealStats.perDay')}` : ''} />
        {MEAL_ORDER_CODES.map((m) => <KpiCard key={m} label={t(`meal.code.${m}`)} value={total[m]} prevLabel="" sub={total.total ? `${((total[m] / total.total) * 100).toFixed(1)}%` : ''} />)}
        <KpiCard label={t('mealStats.depts')} value={deptCount} prevLabel="" sub={`${byDay.length} ${t('mealStats.dayCount')}`} />
      </div>
      {pending > 0 && <Tag color="orange" style={{ marginBottom: 12 }}>{t('mealStats.pendingNote', { n: pending })}</Tag>}

      <div className="rdb-main">
        <DashCard>
          <div className="rdb-tabs" role="tablist">
            {(['total', ...MEAL_ORDER_CODES] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={metric === m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
                {m === 'total' ? t('meal.total') : t(`meal.code.${m}`)}
              </button>
            ))}
          </div>
          <div className="rdb-card-h"><b>{t('mealStats.byDay')}</b></div>
          {loading ? <Empty /> : byDay.length === 0 ? <Empty description={t('mealReg.empty')} /> : (
            <TrendBars labels={byDay.map(([d]) => dayjs(d).format('DD/MM'))} tips={byDay.map(([d]) => dayjs(d).format('dd DD/MM/YYYY'))}
              values={byDay.map(([, c]) => c[metric])} color={metric === 'total' ? OR.main : COLORS[metric]} />
          )}
        </DashCard>
        <div className="rdb-main-l">
          <DashCard title={t('mealStats.byMeal')}>
            <Donut centerLabel={t('mealStats.portions')} items={MEAL_ORDER_CODES.map((m) => ({ label: t(`meal.code.${m}`), value: total[m] }))} />
          </DashCard>
          <DashCard title={t('mealStats.bySite')}>
            <Donut centerLabel={t('mealStats.portions')} items={bySite.map((x) => ({ label: t(`meal.siteName.${x.site}`), value: x.total }))} />
          </DashCard>
        </div>
      </div>

      <DashCard title={t('mealStats.bySite')} style={{ marginTop: 12 }}>
        <Table size="small" rowKey="key" pagination={false} dataSource={bySite} loading={loading} scroll={{ x: 'max-content' }} locale={{ emptyText: t('mealReg.empty') }}
          columns={[
            { title: t('meal.site'), dataIndex: 'site', render: (v: MealSite) => <b>{t(`meal.siteName.${v}`)}</b> },
            ...mealCols,
            { title: t('meal.total'), dataIndex: 'total', align: 'right', render: (v: number) => <b>{v}</b> },
            { title: t('mealStats.share'), key: 'share', align: 'right', render: (_: unknown, r: { total: number }) => <span className="cell-muted">{total.total ? `${((r.total / total.total) * 100).toFixed(1)}%` : ''}</span> },
          ]} />
      </DashCard>

      {sites.map((s) => {
        const list = deptsOf(s)
        const siteTotal = list.reduce((n, d) => n + d.total, 0)
        const max = Math.max(0, ...list.map((d) => d.total))
        const shown = q ? list.filter((d) => d.dept.toLowerCase().includes(q)) : list
        return (
          <DashCard key={s} style={{ marginTop: 12 }}
            title={<Space><b>{t('mealStats.byDeptOf', { site: t(`meal.siteName.${s}`) })}</b><span className="cell-muted">{t('mealReg.sSite', { n: siteTotal, d: list.length })}</span></Space>}
            extra={<Input.Search allowClear size="small" placeholder={t('mealStats.searchDept')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />}>
            <Table<DeptRow> size="small" rowKey="key" dataSource={shown} loading={loading} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('mealReg.empty') }}
              columns={[
                { title: t('meal.dept'), dataIndex: 'dept', render: (v: string) => <b>{v}</b> },
                ...mealCols,
                { title: t('meal.total'), dataIndex: 'total', align: 'right', render: (v: number) => <b>{v}</b> },
                { title: t('mealStats.share'), key: 'share', width: 200, render: (_: unknown, r: DeptRow) => (
                  <Space size={8} style={{ width: '100%' }}>
                    <div style={{ width: 120 }}><MealBar c={r} max={max} /></div>
                    <span className="cell-muted">{siteTotal ? `${((r.total / siteTotal) * 100).toFixed(1)}%` : ''}</span>
                  </Space>
                ) },
              ]}
              summary={() => (
                <Table.Summary.Row className="mb-sum">
                  <Table.Summary.Cell index={0}><b>{t('mealReg.sumRow')}</b></Table.Summary.Cell>
                  {MEAL_ORDER_CODES.map((m, i) => <Table.Summary.Cell key={m} index={1 + i} align="right"><b>{list.reduce((n, d) => n + d[m], 0)}</b></Table.Summary.Cell>)}
                  <Table.Summary.Cell index={6} align="right"><b>{siteTotal}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={7} />
                </Table.Summary.Row>
              )} />
          </DashCard>
        )
      })}
    </div>
  )
}

const deptKey = (o: MealOrder) => (o.department ?? '').trim() || '—'
