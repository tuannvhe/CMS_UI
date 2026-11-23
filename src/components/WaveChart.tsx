import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { theme } from 'antd'

export interface WaveSeries {
  key: string
  name: string
  color: string
  values: number[]
  /** Vẽ phía dưới trục 0 (đối xứng), ví dụ số nghỉ việc dưới số vào mới. */
  mirror?: boolean
}

interface Props {
  labels: string[]
  series: WaveSeries[]
  height?: number
  /** Cố định trục trên / dưới (ví dụ điểm 0–100); không có thì tự tính. */
  yMax?: number
  yMin?: number
  /** Hiện chấm tại từng điểm (ít điểm, ví dụ điểm đánh giá theo kỳ). */
  dots?: boolean
  /** Hiện chú thích màu các đường (mặc định khi có từ 2 đường). */
  legend?: boolean
  format?: (v: number) => string
  /** Dòng thêm trong khung số liệu khi rê chuột tại điểm i. */
  tipExtra?: (i: number) => ReactNode
  tipTitle?: (i: number) => ReactNode
}

/** Đường cong mềm qua các điểm, không vọt quá giá trị thật (nội suy đơn điệu Fritsch–Carlson). */
function smoothPath(pts: [number, number][]) {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M ${pts[0][0]},${pts[0][1]}`
  const dx: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1)) }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C ${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

/** Bước chia trục đẹp (1, 2, 2.5, 5 × 10ⁿ) sao cho khoảng [0, v] chia khoảng `parts` khúc; trả về bước và đỉnh trục. */
function niceScale(v: number, parts = 4) {
  if (v <= 0) return { step: 1, top: parts }
  const raw = v / parts
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
  if (step < 1) step = 1   // số đếm: không chia lẻ dưới 1
  return { step, top: Math.ceil(v / step) * step }
}

const fmtDefault = (v: number) => (Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString())

/**
 * Biểu đồ đường cong mềm (không cần thư viện): mỗi chuỗi một đường màu chuyển sắc, vùng dưới đường tô mờ, lưới gạch nhạt.
 * Chuỗi `mirror` vẽ đối xứng phía dưới trục 0. Rê chuột hiện đường dóng và số liệu từng chuỗi.
 */
export function WaveChart({ labels, series, height = 220, yMax, yMin, dots, legend, format = fmtDefault, tipExtra, tipTitle }: Props) {
  const { token } = theme.useToken()
  const uid = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth || 600)
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = labels.length
  const up = series.filter((s) => !s.mirror), down = series.filter((s) => s.mirror)
  const hasDown = down.length > 0
  const bottom = yMin ?? 0
  const upScale = niceScale(Math.max(0, ...up.flatMap((s) => s.values)) - bottom, hasDown ? 3 : 4)
  const topMax = yMax ?? bottom + upScale.top
  const downScale = niceScale(Math.max(0, ...down.flatMap((s) => s.values)), 2)
  const downMax = hasDown ? downScale.top : 0

  const L = 44, R = 14, T = 12, B = 26
  const plotH = height - T - B
  // Chia chiều cao theo tỉ lệ giá trị trên / dưới trục 0 (tối thiểu 30% cho phần dưới để vẫn đọc được)
  const upH = hasDown ? plotH * Math.min(0.7, Math.max(0.5, topMax / (topMax + downMax))) : plotH
  const zeroY = T + upH
  const yUp = (v: number) => zeroY - ((v - bottom) / (topMax - bottom || 1)) * upH
  const yDown = (v: number) => zeroY + (v / (downMax || 1)) * (plotH - upH)
  const x = (i: number) => (n <= 1 ? (L + w - R) / 2 : L + ((w - L - R) * i) / (n - 1))

  // Mốc trục: theo bước đẹp; trục cố định (yMax) thì chia 4 khúc đều
  const upStep = yMax !== undefined ? (topMax - bottom) / 4 : upScale.step
  const ticksUp: number[] = []
  for (let v = bottom + upStep; v <= topMax + 1e-9; v += upStep) ticksUp.push(v)
  const ticksDown: number[] = []
  if (hasDown) for (let v = downScale.step; v <= downMax + 1e-9; v += downScale.step) ticksDown.push(v)
  // Nhãn trục ngang: thưa bớt khi nhiều điểm để không chồng chữ
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - L - R) / 56))))

  const muted = token.colorTextQuaternary, text = token.colorTextTertiary, grid = token.colorBorderSecondary
  const showLegend = legend ?? series.length > 1
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) + 14, 0), w - 190)

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (n === 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left + L
    const i = n <= 1 ? 0 : Math.round(((px - L) / (w - L - R)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setHover(null)}>
      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: 6, fontSize: 12, color: text }}>
          {series.map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />{s.name}
            </span>
          ))}
        </div>
      )}
      <svg width={w} height={height} role="img" style={{ display: 'block', fontFamily: 'inherit', overflow: 'visible' }}>
        <defs>
          {series.map((s) => (
            <g key={s.key}>
              <linearGradient id={`${uid}-s-${s.key}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
                <stop offset="50%" stopColor={s.color} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id={`${uid}-a-${s.key}`} x1="0" x2="0" y1={s.mirror ? '1' : '0'} y2={s.mirror ? '0' : '1'}>
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            </g>
          ))}
        </defs>

        {ticksUp.map((v) => (
          <g key={`u${v}`}>
            <line x1={L} x2={w - R} y1={yUp(v)} y2={yUp(v)} stroke={grid} strokeDasharray="3 5" />
            <text x={L - 8} y={yUp(v) + 4} fontSize={11} textAnchor="end" fill={muted}>{format(v)}</text>
          </g>
        ))}
        {ticksDown.map((v) => (
          <g key={`d${v}`}>
            <line x1={L} x2={w - R} y1={yDown(v)} y2={yDown(v)} stroke={grid} strokeDasharray="3 5" />
            <text x={L - 8} y={yDown(v) + 4} fontSize={11} textAnchor="end" fill={muted}>{format(v)}</text>
          </g>
        ))}
        <line x1={L} x2={w - R} y1={zeroY} y2={zeroY} stroke={grid} />
        <text x={L - 8} y={zeroY + 4} fontSize={11} textAnchor="end" fill={muted}>{format(bottom)}</text>

        {series.map((s) => {
          const pts = s.values.map((v, i) => [x(i), s.mirror ? yDown(v) : yUp(v)] as [number, number])
          if (pts.length === 0) return null
          const line = smoothPath(pts)
          const area = `${line} L ${pts[pts.length - 1][0]},${zeroY} L ${pts[0][0]},${zeroY} Z`
          return (
            <g key={s.key}>
              <path d={area} fill={`url(#${uid}-a-${s.key})`} />
              <path d={line} fill="none" stroke={`url(#${uid}-s-${s.key})`} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
              {dots && pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={3} fill={token.colorBgContainer} stroke={s.color} strokeWidth={2} />)}
            </g>
          )
        })}

        {labels.map((l, i) => (i % every === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={height - 6} fontSize={11} textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'} fill={hover === i ? token.colorText : muted}>{l}</text>
        ))}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={height - B} stroke={token.colorTextQuaternary} strokeDasharray="2 4" />
            {series.map((s) => {
              const v = s.values[hover]
              if (v === undefined) return null
              return <circle key={s.key} cx={x(hover)} cy={s.mirror ? yDown(v) : yUp(v)} r={4} fill={s.color} stroke={token.colorBgContainer} strokeWidth={2} />
            })}
          </g>
        )}
        <rect x={L} y={0} width={Math.max(0, w - L - R)} height={height} fill="transparent" onMouseMove={onMove} />
      </svg>
      {hover !== null && (
        <div style={{ position: 'absolute', top: (showLegend ? 26 : 0) + T, left: tipLeft, minWidth: 150, pointerEvents: 'none', background: token.colorBgElevated,
          boxShadow: token.boxShadowSecondary, borderRadius: token.borderRadius, padding: '8px 10px', fontSize: 12, lineHeight: 1.7, zIndex: 2 }}>
          <b>{tipTitle ? tipTitle(hover) : labels[hover]}</b>
          {series.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              <span style={{ flex: 1 }}>{s.name}</span><b>{(s.values[hover] ?? 0).toLocaleString()}</b>
            </div>
          ))}
          {tipExtra?.(hover)}
        </div>
      )}
    </div>
  )
}
