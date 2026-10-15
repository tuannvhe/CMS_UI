/** Cờ quốc gia vẽ bằng SVG (emoji cờ không hiển thị trên Windows). code = mã ngôn ngữ: vi | en | ko. */
export function Flag({ code, width = 24 }: { code: string; width?: number }) {
  const h = Math.round((width * 2) / 3)
  const common = { width, height: h, 'aria-hidden': true, style: { borderRadius: 3, boxShadow: '0 0 0 1px rgba(16,24,40,.12)', flex: 'none', display: 'block' } as const }

  if (code === 'vi') {
    // Ngôi sao 5 cánh vàng trên nền đỏ
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? 7 : 2.9
      const a = (-90 + i * 36) * (Math.PI / 180)
      return `${(18 + r * Math.cos(a)).toFixed(2)},${(12.4 + r * Math.sin(a)).toFixed(2)}`
    }).join(' ')
    return <svg viewBox="0 0 36 24" {...common}><rect width="36" height="24" fill="#DA251D" /><polygon points={pts} fill="#FFFF00" /></svg>
  }

  if (code === 'en') {
    return (
      <svg viewBox="0 0 60 30" {...common}>
        <clipPath id="fl-uk-s"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
        <clipPath id="fl-uk-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
        <g clipPath="url(#fl-uk-s)">
          <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#fl-uk-t)" stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </g>
      </svg>
    )
  }

  // Hàn Quốc: thái cực ở giữa + bốn quẻ ở bốn góc
  const bar = (y: number, broken: boolean) => broken
    ? <g key={y}><rect x={-3} y={y} width={2.2} height={0.9} /><rect x={0.8} y={y} width={2.2} height={0.9} /></g>
    : <rect key={y} x={-3} y={y} width={6} height={0.9} />
  const trigram = (angle: number, lines: boolean[]) => (
    <g transform={`translate(18 12) rotate(${angle}) translate(0 -9.6)`} fill="#000">{lines.map((b, i) => bar(i * 1.5 - 1.5, b))}</g>
  )
  return (
    <svg viewBox="0 0 36 24" {...common}>
      <rect width="36" height="24" fill="#fff" />
      <g transform="translate(18 12) rotate(-33.7)">
        <circle r="5.6" fill="#0047A0" />
        <path d="M-5.6,0 A5.6,5.6 0 0 1 5.6,0 A2.8,2.8 0 0 1 0,0 A2.8,2.8 0 0 0 -5.6,0 z" fill="#CD2E3A" />
      </g>
      {trigram(-56.3, [false, false, false])}
      {trigram(56.3, [true, false, true])}
      {trigram(-123.7, [false, true, false])}
      {trigram(123.7, [true, true, true])}
    </svg>
  )
}
