import { useState, type ReactNode } from 'react'
import { Empty } from 'antd'

/** Bảng màu dashboard theo tông xanh của web (--c-primary / --c-accent). */
export const OR = { main: '#0F6B3E', mid: '#5FA830', soft: '#D7EBCB', gray: '#C9CFCC', line: '#E0A526', up: '#12B76A', down: '#D92D20' }
export const OR_SERIES = ['#0F6B3E', '#5FA830', '#8CC56B', '#C5E3B0', '#0A4D2C', '#C9CFCC', '#8C9590']
const pct = (a: number, b: number) => (b > 0 ? Math.round((a * 1000) / b) / 10 : 0)

/** Khung thẻ của dashboard: tiêu đề đậm bên trái, phần phụ bên phải. */
export function DashCard({ title, extra, children, style }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="rdb-card" style={style}>
      {(title || extra) && <div className="rdb-card-h"><b>{title}</b>{extra && <span className="rdb-card-x">{extra}</span>}</div>}
      {children}
    </div>
  )
}

/** Thẻ chỉ số: tên có gạch chân màu chính, số lớn, dòng so với kỳ trước (▲ / ▼ %). lowerIsBetter: giảm là tốt (vd số ngày xử lý). */
export function KpiCard({ label, value, prev, fmt = (v) => v.toLocaleString(), unit, lowerIsBetter, prevLabel, sub }: {
  label: string; value: number | null; prev?: number | null; fmt?: (v: number) => string; unit?: string; lowerIsBetter?: boolean; prevLabel: string
  /** Dòng phụ thay cho phần so sánh khi chỉ số không có kỳ trước. */
  sub?: ReactNode
}) {
  const diff = value != null && prev != null && prev !== 0 ? Math.round(((value - prev) / Math.abs(prev)) * 1000) / 10 : null
  const good = diff == null || diff === 0 ? undefined : (diff > 0) !== !!lowerIsBetter
  return (
    <div className="rdb-kpi">
      <div className="rdb-kpi-l" title={label}>{label}</div>
      <div className="rdb-kpi-v">{value == null ? '—' : fmt(value)}{unit && value != null && <span className="rdb-kpi-u">{unit}</span>}</div>
      {sub !== undefined ? <div className="rdb-kpi-p">{sub}<div className="rdb-kpi-pl">&nbsp;</div></div> : <div className="rdb-kpi-p">
        <span>{prev == null ? '—' : fmt(prev)}</span>
        {diff != null && <span style={{ color: good === undefined ? undefined : good ? OR.up : OR.down }}> | {diff > 0 ? '▲' : diff < 0 ? '▼' : '■'} {Math.abs(diff)}%</span>}
        <div className="rdb-kpi-pl">{prevLabel}</div>
      </div>}
    </div>
  )
}

/** Biểu đồ cột theo thời gian (một chuỗi), có lưới 3 mức, nhãn trục dưới thưa dần khi nhiều cột. */
export function TrendBars({ labels, values, tips, color = OR.main, height = 210 }: { labels: string[]; values: number[]; tips?: string[]; color?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...values)
  const top = Math.max(1, Math.ceil(max / (max > 10 ? 5 : 1)) * (max > 10 ? 5 : 1))
  const every = Math.max(1, Math.ceil(labels.length / 12))
  if (values.length === 0) return <Empty />
  return (
    <div className="rdb-trend" style={{ height: height + 24 }}>
      <div className="rdb-trend-y">{[top, Math.round(top / 2), 0].map((v) => <span key={v}>{v}</span>)}</div>
      <div className="rdb-trend-plot" style={{ height }}>
        {[0, 0.5, 1].map((g) => <div key={g} className="rdb-grid" style={{ bottom: `${g * 100}%` }} />)}
        <div className="rdb-bars">
          {values.map((v, i) => (
            <div key={i} className="rdb-bar-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && <div className="rdb-tip">{tips?.[i] ?? labels[i]}: <b>{v}</b></div>}
              <div className="rdb-bar" style={{ height: `${(v / top) * 100}%`, background: color, opacity: hover == null || hover === i ? 1 : 0.55 }} />
              <span className="rdb-bar-x">{i % every === 0 ? labels[i] : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Biểu đồ vành khuyên: nhãn và % bên phải, số tổng ở giữa. */
export function Donut({ items, total, centerLabel }: { items: { label: string; value: number }[]; total?: number; centerLabel: string }) {
  const sum = total ?? items.reduce((a, b) => a + b.value, 0)
  if (sum === 0) return <Empty />
  const R = 42, L = 2 * Math.PI * R
  let at = 0
  return (
    <div className="rdb-donut">
      <svg viewBox="0 0 120 120" width={140} height={140} role="img" aria-label={centerLabel}>
        <circle cx={60} cy={60} r={R} fill="none" stroke="var(--c-surface-2)" strokeWidth={18} />
        {items.filter((i) => i.value > 0).map((i, k) => {
          const len = (i.value / sum) * L
          const el = <circle key={i.label} cx={60} cy={60} r={R} fill="none" stroke={OR_SERIES[k % OR_SERIES.length]} strokeWidth={18}
            strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-at} transform="rotate(-90 60 60)"><title>{`${i.label}: ${i.value} (${pct(i.value, sum)}%)`}</title></circle>
          at += len
          return el
        })}
        <text x={60} y={58} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--c-text)">{sum}</text>
        <text x={60} y={74} textAnchor="middle" fontSize={9} fill="var(--c-muted)">{centerLabel}</text>
      </svg>
      <div className="rdb-legend">
        {items.filter((i) => i.value > 0).map((i, k) => (
          <div key={i.label}><span className="dot" style={{ background: OR_SERIES[k % OR_SERIES.length] }} /><span className="lb" title={i.label}>{i.label}</span><b>{i.value}</b><span className="cell-muted">{pct(i.value, sum)}%</span></div>
        ))}
      </div>
    </div>
  )
}

/** Biểu đồ Pareto: cột giảm dần (nhóm tạo nên 80% đầu tô màu chính, còn lại xám) + đường % cộng dồn. */
export function Pareto({ items, max = 14, cumLabel, valueLabel, otherLabel }: { items: { label: string; value: number }[]; max?: number; cumLabel: string; valueLabel: string; otherLabel: string }) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const rows = sorted.length > max ? [...sorted.slice(0, max - 1), { label: otherLabel, value: sorted.slice(max - 1).reduce((a, b) => a + b.value, 0) }] : sorted
  const sum = rows.reduce((a, b) => a + b.value, 0)
  if (sum === 0) return <Empty />
  const W = 420, H = 300, padL = 30, padR = 34, padT = 18, padB = 92
  const pw = W - padL - padR, ph = H - padT - padB
  const top = Math.max(...rows.map((r) => r.value))
  const bw = pw / rows.length
  let cum = 0
  const pts = rows.map((r, i) => { cum += r.value; return { x: padL + bw * (i + 0.5), c: (cum / sum) * 100, prev: ((cum - r.value) / sum) * 100 } })
  return (
    <div>
      <div className="rdb-legend-row"><span><span className="dot" style={{ background: OR.main }} />{valueLabel}</span><span><span className="dot line" style={{ background: OR.line }} />{cumLabel}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={valueLabel}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={padT + ph * (1 - g)} y2={padT + ph * (1 - g)} stroke="var(--c-border)" strokeDasharray={g ? '3 3' : undefined} />
            <text x={padL - 4} y={padT + ph * (1 - g) + 3} textAnchor="end" fontSize={9} fill="var(--c-muted)">{Math.round(top * g)}</text>
            <text x={W - padR + 4} y={padT + ph * (1 - g) + 3} fontSize={9} fill="var(--c-muted)">{g * 100}%</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const h = (r.value / top) * ph
          const x = padL + bw * i + bw * 0.15
          return (
            <g key={r.label}>
              <rect x={x} y={padT + ph - h} width={bw * 0.7} height={h} fill={pts[i].prev < 80 ? OR.main : OR.gray} rx={2}><title>{`${r.label}: ${r.value} (${pct(r.value, sum)}%)`}</title></rect>
              <text transform={`translate(${padL + bw * (i + 0.5) + 3}, ${padT + ph + 6}) rotate(-60)`} textAnchor="end" fontSize={9} fill="var(--c-text)">{r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label}</text>
            </g>
          )
        })}
        <polyline fill="none" stroke={OR.line} strokeWidth={2} points={pts.map((p) => `${p.x},${padT + ph * (1 - p.c / 100)}`).join(' ')} />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={padT + ph * (1 - p.c / 100)} r={2.5} fill={OR.line} />
            {(rows.length <= 8 || i % 2 === 0) && <text x={p.x} y={padT + ph * (1 - p.c / 100) - 6} textAnchor="middle" fontSize={8} fill={OR.main}>{Math.round(p.c * 10) / 10}%</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Thanh ngang: nhãn, thanh màu chính, số và % trên tổng. */
export function HBar({ label, value, max, total, color = OR.main, note }: { label: string; value: number; max: number; total: number; color?: string; note?: string }) {
  return (
    <div className="rdb-hbar">
      <span title={label}>{label}</span>
      <div className="rdb-hbar-track"><div style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} /></div>
      <span className="rdb-hbar-n"><b>{value}</b> <span className="cell-muted">{note ?? `${pct(value, total)}%`}</span></span>
    </div>
  )
}

export const DASH_CSS = `
.rdb { border: 1px solid ${OR.soft}; border-radius: 14px; padding: 14px; background: color-mix(in srgb, ${OR.soft} 14%, var(--c-bg)); }
.rdb-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.rdb-head h1 { margin: 0; font-size: 22px; font-weight: 700; color: var(--c-text); }
.rdb-head h1 em { font-style: normal; color: ${OR.main}; }
.rdb-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 12px; }
.rdb-filter { background: var(--c-surface); border-radius: 10px; padding: 8px 12px; box-shadow: var(--shadow-sm); min-width: 0; }
.rdb-filter .lb { font-size: 12px; color: var(--c-muted); margin-bottom: 4px; }
.rdb-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px; }
.rdb-kpi { background: var(--c-surface); border-radius: 10px; padding: 10px 14px; box-shadow: var(--shadow-sm); min-width: 0; }
.rdb-kpi-l { text-align: center; font-size: 13px; color: var(--c-muted); padding-bottom: 4px; border-bottom: 2px solid ${OR.main}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rdb-kpi-v { font-size: 26px; font-weight: 700; margin-top: 6px; line-height: 1.2; color: var(--c-text); }
.rdb-kpi-u { font-size: 13px; font-weight: 500; color: var(--c-muted); margin-left: 4px; }
.rdb-kpi-p { font-size: 12px; color: var(--c-muted); }
.rdb-kpi-pl { font-size: 11px; }
.rdb-main { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 12px; }
.rdb-main-l { display: grid; gap: 12px; min-width: 0; }
.rdb-row2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
@media (max-width: 1100px) { .rdb-main { grid-template-columns: minmax(0, 1fr); } }
.rdb-card { background: var(--c-surface); border-radius: 10px; padding: 12px 14px; box-shadow: var(--shadow-sm); min-width: 0; }
.rdb-card-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.rdb-card-x { font-size: 12px; color: var(--c-muted); }
.rdb-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.rdb-tabs button { border: 0; border-radius: 4px; padding: 4px 12px; background: var(--c-surface-2); color: var(--c-text); cursor: pointer; font-size: 13px; }
.rdb-tabs button.on { background: ${OR.main}; color: #fff; }
.rdb-trend { display: grid; grid-template-columns: 28px minmax(0, 1fr); }
.rdb-trend-y { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: var(--c-muted); padding-bottom: 24px; text-align: right; padding-right: 4px; }
.rdb-trend-plot { position: relative; }
.rdb-grid { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--c-border); }
.rdb-bars { position: absolute; inset: 0; display: flex; align-items: flex-end; gap: 2px; }
.rdb-bar-col { flex: 1 1 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; min-width: 0; }
.rdb-bar { width: 78%; max-width: 34px; border-radius: 2px 2px 0 0; min-height: 0; transition: height .3s, opacity .15s; }
.rdb-bar-x { position: absolute; bottom: -20px; font-size: 10px; color: var(--c-muted); white-space: nowrap; }
.rdb-tip { position: absolute; bottom: calc(100% + 4px); white-space: nowrap; background: var(--c-text); color: var(--c-surface); font-size: 11px; padding: 2px 6px; border-radius: 4px; z-index: 2; pointer-events: none; }
.rdb-donut { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }
.rdb-legend { display: grid; gap: 4px; min-width: 150px; flex: 1; font-size: 12px; }
.rdb-legend > div { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto 44px; gap: 6px; align-items: center; }
.rdb-legend .lb { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rdb-legend .cell-muted { text-align: right; }
.rdb .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
.rdb .dot.line { height: 3px; border-radius: 2px; width: 14px; vertical-align: middle; }
.rdb-legend-row { display: flex; gap: 14px; font-size: 12px; color: var(--c-muted); }
.rdb-hbar { display: grid; grid-template-columns: minmax(110px, 38%) 1fr 80px; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
.rdb-hbar > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rdb-hbar-track { height: 10px; background: var(--c-surface-2); border-radius: 5px; overflow: hidden; }
.rdb-hbar-track > div { height: 100%; border-radius: 5px; transition: width .3s; }
.rdb-hbar-n { text-align: right; }
.rdb .ant-table-wrapper { margin-top: 4px; }
`
