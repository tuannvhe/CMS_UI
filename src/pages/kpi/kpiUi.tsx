import { useEffect, useRef, useState } from 'react'
import { Tooltip } from 'antd'
import { STATUS_COLOR, STATUS_TEXT, statusOf } from './kpiCalc'

/** Thành phần giao diện dùng chung cho các tab Demo KPI: thanh bullet, sparkline, vòng điểm, ô người, kiểu chữ và khung. */
const MAXV = 120

export const KPI_CSS = `
.kpi-page { --k-ok: ${STATUS_COLOR.ok}; --k-near: ${STATUS_COLOR.near}; --k-low: ${STATUS_COLOR.low}; --k-gap: 16px; font-variant-numeric: tabular-nums; }
.kpi-page small { font-size: 12px; }

/* Đầu trang: một khối trắng gồm tiêu đề + thanh lọc, không gradient để nhường chỗ cho số liệu */
.kpi-head { display: flex; align-items: center; gap: 14px; padding: 16px 20px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; box-shadow: var(--shadow-sm); margin-bottom: var(--k-gap); }
.kpi-head .kh-ic { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; flex: none; font-size: 20px; color: var(--c-primary); background: var(--c-tint); }
.kpi-head .kh-main { flex: 1 1 auto; min-width: 0; }
.kpi-head h1 { margin: 0; font-size: 20px; line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; color: var(--c-text); }
.kpi-head p { margin: 2px 0 0; font-size: 13px; color: var(--c-muted); }
.kpi-head .kh-extra { display: flex; gap: 8px; flex-wrap: wrap; }
.kpi-head:has(+ .kpi-bar) { border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: 0; box-shadow: none; }
.kpi-head + .kpi-bar { border-top: 1px dashed var(--c-border); border-top-left-radius: 0; border-top-right-radius: 0; }

/* Thanh lọc / thao tác */
.kpi-bar { display: flex; flex-wrap: wrap; gap: 10px 12px; align-items: center; margin-bottom: var(--k-gap); padding: 12px 20px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; box-shadow: var(--shadow-sm); }
.kpi-bar label { color: var(--c-muted); font-size: 13px; font-weight: 500; }
.kpi-bar .kpi-sep { flex: 1 1 auto; }
.kpi-bar.sticky { position: sticky; top: 0; z-index: 5; }

/* Thẻ */
.kpi-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; padding: 18px 20px; min-width: 0; box-shadow: var(--shadow-sm); }
.kpi-card > h3 { margin: 0 0 14px; font-size: 15px; font-weight: 650; color: var(--c-text); display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; }
.kpi-card > h3 small { font-weight: 400; color: var(--c-muted); }
.kpi-card.flush { padding: 0; overflow: hidden; }
.kpi-card.flush > h3 { padding: 16px 20px 0; }
.kpi-grid { display: grid; gap: var(--k-gap); margin-top: var(--k-gap); }
.kpi-grid.two { grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
.kpi-grid.main { grid-template-columns: minmax(0, 3fr) minmax(300px, 2fr); align-items: start; }
.kpi-stack { display: grid; gap: var(--k-gap); min-width: 0; }
@media (max-width: 1100px) { .kpi-grid.main { grid-template-columns: 1fr; } }
.kpi-hero { display: grid; grid-template-columns: minmax(260px, 360px) 1fr; gap: var(--k-gap); }
@media (max-width: 900px) { .kpi-hero { grid-template-columns: 1fr; } }

/* Ô số tổng hợp */
.kpi-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--k-gap); }
.kpi-stat { position: relative; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; padding: 16px 18px; box-shadow: var(--shadow-sm); min-width: 0; }
.kpi-stat .l { font-size: 13px; color: var(--c-muted); font-weight: 500; display: flex; align-items: center; gap: 6px; }
.kpi-stat .v { font-size: 30px; font-weight: 700; line-height: 1.2; margin-top: 6px; color: var(--c-text); letter-spacing: -0.02em; }
.kpi-stat .v small { font-size: 14px; font-weight: 500; color: var(--c-muted); margin-left: 4px; letter-spacing: 0; }
.kpi-stat .s { font-size: 12.5px; color: var(--c-muted); margin-top: 4px; }
.kpi-stat.main { background: linear-gradient(135deg, var(--c-deep, #0A4D2C), var(--c-primary)); border-color: transparent; color: #fff; }
.kpi-stat.main .l, .kpi-stat.main .s, .kpi-stat.main .v small { color: rgba(255,255,255,.82); }
.kpi-stat.main .v { color: #fff; }

.kpi-score { display: flex; gap: 18px; align-items: center; }
.kpi-score .meta { display: grid; gap: 6px; font-size: 13px; color: var(--c-muted); }
.kpi-score .meta b { color: var(--c-text); }
.kpi-delta { font-size: 12.5px; font-weight: 600; }
.kpi-mix { display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin: 12px 0 6px; background: var(--c-border); gap: 2px; }
.kpi-mix i { display: block; }
.kpi-mix-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--c-muted); }
.kpi-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 0; flex: none; }

/* Danh sách xếp hạng */
.kpi-list { display: grid; }
.kpi-row { display: grid; grid-template-columns: 28px minmax(120px, 1.3fr) minmax(100px, 2fr) 72px 96px; gap: 12px; align-items: center; padding: 9px 8px; margin: 0 -8px; border-radius: 8px; font-size: 13.5px; }
.kpi-row + .kpi-row { border-top: 1px solid var(--c-border); }
.kpi-row.click { cursor: pointer; transition: background .15s; }
.kpi-row.click:hover { background: var(--c-surface-2); }
.kpi-row .rk { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 600; color: var(--c-muted); background: var(--c-surface-2); }
.kpi-row .nm { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--c-text); }
.kpi-row .nm small { color: var(--c-muted); font-weight: 400; }
.kpi-row .vl { text-align: right; font-weight: 700; }
@media (max-width: 640px) { .kpi-row { grid-template-columns: 24px minmax(0, 1fr) 64px; } .kpi-row .kpi-bullet, .kpi-row .tg { display: none; } }

/* Thanh tiến độ: nền xám, thanh màu trạng thái, vạch mục tiêu 100% */
.kpi-bullet { position: relative; height: 8px; border-radius: 4px; background: var(--c-surface-2); box-shadow: inset 0 0 0 1px var(--c-border); min-width: 70px; }
.kpi-bullet .f { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; }
.kpi-bullet .t { position: absolute; top: -3px; bottom: -3px; width: 2px; border-radius: 1px; background: var(--c-text); opacity: .45; }
.kpi-cell { display: flex; align-items: center; gap: 10px; }
.kpi-cell .kpi-bullet { flex: 1; }
.kpi-cell b { min-width: 50px; text-align: right; }

.kpi-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.kpi-st { display: inline-flex; align-items: center; font-size: 12.5px; white-space: nowrap; }

/* Tên chỉ tiêu trong bảng */
.kpi-name b { display: block; font-weight: 600; color: var(--c-text); line-height: 1.35; }
.kpi-name small { color: var(--c-muted); display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; }
a.kpi-name:hover b { color: var(--c-primary); }

/* Điểm theo nhóm Q/C/D/S/P */
.kpi-cats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.kpi-cat { border: 1px solid var(--c-border); border-radius: 12px; padding: 12px 14px; background: var(--c-surface-2); }
.kpi-cat .h { font-size: 12.5px; color: var(--c-muted); }
.kpi-cat .h .kpi-st { color: var(--c-text); font-weight: 600; font-size: 13px; }
.kpi-cat .c { font-size: 12px; color: var(--c-muted); margin-top: 8px; }
.kpi-cat .n { font-size: 22px; font-weight: 700; margin: 4px 0 8px; color: var(--c-text); }

/* Danh sách phòng ban dạng ô (Line / người, dữ liệu mẫu) */
.kpi-heat { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.kpi-tile { border: 1px solid var(--c-border); border-radius: 10px; padding: 10px 12px; background: var(--c-surface); }
.kpi-tile b { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi-tile .v { font-size: 20px; font-weight: 700; line-height: 1.3; }
.kpi-tile .s { display: flex; justify-content: space-between; align-items: end; }
.kpi-lane { border: 1px solid var(--c-border); border-radius: 12px; padding: 14px 16px; background: var(--c-surface); cursor: pointer; transition: border-color .15s, box-shadow .15s; box-shadow: var(--shadow-sm); }
.kpi-lane:hover { border-color: var(--c-primary); }
.kpi-lane.on { border-color: var(--c-primary); box-shadow: 0 0 0 2px var(--c-tint-strong); }
.kpi-lane:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 2px; }
.kpi-lane-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.kpi-lane-h b { font-size: 15px; }
.kpi-lane-h .sc { font-size: 22px; font-weight: 700; }
.kpi-lane-m { color: var(--c-muted); font-size: 12px; margin: 2px 0 10px; }
.kpi-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.kpi-chip { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; font-size: 11px; font-weight: 700; border: 1.5px solid; }
.kpi-chip.lead { border-radius: 50%; box-shadow: 0 0 0 2px var(--c-surface), 0 0 0 3.5px #E0A526; }
.kpi-wip { display: flex; align-items: center; gap: 10px; margin-bottom: var(--k-gap); padding: 10px 16px; border-radius: 12px; background: color-mix(in srgb, #E0A526 10%, var(--c-surface)); border: 1px solid color-mix(in srgb, #E0A526 40%, transparent); font-size: 13px; font-weight: 600; }
.kpi-legend { display: flex; gap: 14px; font-size: 12.5px; color: var(--c-muted); flex-wrap: wrap; font-weight: 400; }
.kpi-heatcell { display: inline-block; min-width: 58px; padding: 3px 8px; border-radius: 6px; text-align: center; font-weight: 600; }

/* Chỉ tiêu cần chú ý */
.kpi-attn { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 12px; padding: 10px 8px; margin: 0 -8px; border-radius: 8px; font-size: 13.5px; align-items: center; cursor: pointer; transition: background .15s; }
.kpi-attn + .kpi-attn { border-top: 1px solid var(--c-border); }
.kpi-attn:hover { background: var(--c-surface-2); }
.kpi-attn span { font-weight: 600; }
.kpi-attn small { color: var(--c-muted); grid-column: 1; }
.kpi-attn .kpi-pill { grid-row: 1 / 3; grid-column: 2; font-size: 13px; }
.kpi-empty { color: var(--c-muted); font-size: 13px; padding: 12px 0; }

/* Cặp nhãn – giá trị */
.kpi-facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 10px 18px; font-size: 13.5px; }
.kpi-facts > span { color: var(--c-muted); }
.kpi-facts > b { font-weight: 600; color: var(--c-text); }

/* Bảng */
.kpi-page .ant-table { font-size: 13.5px; }
.kpi-page .ant-table-thead > tr > th { font-weight: 600; font-size: 12.5px; color: var(--c-muted); background: var(--c-surface-2); }
.kpi-page .ant-table-tbody > tr:not(.ant-table-measure-row) > td { padding-top: 10px; padding-bottom: 10px; }
.kpi-page .ant-tabs-nav { margin-bottom: 12px; }

@media (max-width: 767px) {
  .kpi-head { padding: 14px 16px; }
  .kpi-head .kh-ic { display: none; }
  .kpi-head h1 { font-size: 18px; }
  .kpi-bar { padding: 12px 16px; }
  .kpi-bar label { display: none; }
  .kpi-bar .ant-select, .kpi-bar .ant-picker { flex: 1 1 140px; width: auto !important; }
  .kpi-bar .kpi-legend { display: none; }
  .kpi-card { padding: 16px; }
  .kpi-stat .v { font-size: 26px; }
  .kpi-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
}
@media (prefers-reduced-motion: reduce) { .kpi-page * { transition: none !important; } }
`

const clamp = (v: number) => Math.max(0, Math.min(MAXV, v))
const pctW = (v: number) => `${(clamp(v) / MAXV) * 100}%`

/** Thanh tiến độ: nền xám, thanh màu theo trạng thái (thang 0–120%), vạch mục tiêu 100%. */
export function Bullet({ value }: { value: number }) {
  const col = STATUS_COLOR[statusOf(value)]
  return (
    <div className="kpi-bullet" role="img" aria-label={`${value}%`}>
      <span className="f" style={{ width: pctW(value), background: col }} />
      <span className="t" style={{ left: pctW(100) }} />
    </div>
  )
}

/** Ô điểm: thanh bullet kèm số %. */
export function ScoreCell({ value }: { value: number }) {
  return <div className="kpi-cell"><Bullet value={value} /><b style={{ color: STATUS_TEXT[statusOf(value)] }}>{value}%</b></div>
}

/** Nhãn % có nền nhạt theo trạng thái (dùng cho điểm, % đạt). */
export function Pill({ value, suffix = '%' }: { value: number | null | undefined; suffix?: string }) {
  if (value == null) return <span className="kpi-pill" style={{ background: 'var(--c-surface-2)', color: 'var(--c-muted)' }}>—</span>
  const s = statusOf(value)
  return <span className="kpi-pill" style={{ background: `${STATUS_COLOR[s]}1f`, color: STATUS_TEXT[s] }}>{value}{suffix}</span>
}

/** Đường xu hướng nhỏ (sparkline). Màu theo chiều đi của chuỗi (lên xanh, xuống đỏ). */
export function Spark({ values, w = 64, h = 20 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return null
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - lo) / span) * (h - 6)] as const)
  const up = values[values.length - 1] >= values[0]
  const col = up ? STATUS_COLOR.ok : STATUS_COLOR.low
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={col} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={col} />
    </svg>
  )
}

/** Vòng điểm (tối đa 120%): cung màu theo trạng thái, vạch ở mốc 100%. */
export function ScoreRing({ value, size = 112 }: { value: number; size?: number }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, col = STATUS_COLOR[statusOf(value)]
  const frac = clamp(value) / MAXV
  const a = (100 / MAXV) * 2 * Math.PI - Math.PI / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-border)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <line x1={size / 2 + (r - 7) * Math.cos(a)} y1={size / 2 + (r - 7) * Math.sin(a)} x2={size / 2 + (r + 7) * Math.cos(a)} y2={size / 2 + (r + 7) * Math.sin(a)} stroke="var(--c-text)" strokeWidth={2} opacity={0.7} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * (String(value).length > 4 ? 0.19 : 0.23)} fontWeight={700} fill="var(--c-text)">{value}<tspan fontSize={size * 0.11} fontWeight={500} fill="var(--c-muted)" dx={1}>%</tspan></text>
    </svg>
  )
}

export function StatusText({ value, label }: { value: number; label: string }) {
  return <span className="kpi-st"><i className="kpi-dot" style={{ background: STATUS_COLOR[statusOf(value)] }} />{label}</span>
}

/** Ô một người trên "làn" line: chữ cái đầu của tên, màu theo trạng thái; tổ trưởng có vòng vàng. */
export function PersonChip({ name, score, lead, tip }: { name: string; score: number; lead?: boolean; tip: string }) {
  const col = STATUS_COLOR[statusOf(score)]
  const ini = name.trim().split(/\s+/).pop()?.slice(0, 2) ?? '?'
  return (
    <Tooltip title={tip}>
      <span className={`kpi-chip${lead ? ' lead' : ''}`} style={{ background: `${col}24`, borderColor: col, color: col }}>{ini}</span>
    </Tooltip>
  )
}

export const delta = (cur: number, prev?: number) => (prev == null ? null : Math.round((cur - prev) * 10) / 10)

/** Đường xu hướng điểm theo kỳ: thang tự co theo dữ liệu (luôn gồm mốc 100%), vạch mục tiêu 100%, nhãn giá trị trên từng điểm. */
export function TrendLine({ labels, values, height = 180 }: { labels: string[]; values: number[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  if (values.length === 0) return <div ref={ref} className="kpi-empty">—</div>
  const H = height, padX = 28, top = 22, bottom = 26
  const lo = Math.floor(Math.min(90, ...values) / 5) * 5, hi = Math.ceil(Math.max(105, ...values) / 5) * 5
  const x = (i: number) => (values.length === 1 ? W / 2 : padX + (i / (values.length - 1)) * (W - padX * 2))
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const area = `${x(0)},${H - bottom} ${pts} ${x(values.length - 1)},${H - bottom}`
  return (
    <div ref={ref} style={{ width: '100%' }}>
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label={labels.map((l, i) => `${l}: ${values[i]}%`).join(', ')}>
      <defs><linearGradient id="kpiTrendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--c-primary)" stopOpacity=".18" /><stop offset="1" stopColor="var(--c-primary)" stopOpacity="0" /></linearGradient></defs>
      <line x1={padX} x2={W - padX} y1={y(100)} y2={y(100)} stroke="var(--c-muted)" strokeDasharray="4 4" strokeWidth={1} opacity={.6} />
      <text x={W - padX} y={y(100) - 5} textAnchor="end" fontSize={11} fill="var(--c-muted)">100%</text>
      <polygon points={area} fill="url(#kpiTrendFill)" />
      <polyline points={pts} fill="none" stroke="var(--c-primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={4} fill="var(--c-surface)" stroke={STATUS_COLOR[statusOf(v)]} strokeWidth={2.5} />
          <text x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--c-text)">{v}</text>
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--c-muted)">{labels[i]}</text>
        </g>
      ))}
    </svg>
    </div>
  )
}
