import { useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useThemeMode } from '../theme/ThemeProvider'
import { badgeOf } from '../theme/occasions'

type Fall = 'petals' | 'flowers' | 'snow' | 'lanterns' | 'confetti' | 'stars' | 'emoji'
type Top = 'lights' | 'bunting' | 'lanterns' | null
type Corner = 'moon' | 'fireworks' | null
interface Theme { fall: Fall; top: Top; corner: Corner }

/** Mỗi dịp có một "cảnh" riêng, dễ nhận ra: nhìn là biết dịp gì. Dịp tự thêm dùng biểu tượng rơi như trước. */
const THEMES: Record<string, Theme> = {
  women20: { fall: 'petals', top: null, corner: null },
  women8: { fall: 'petals', top: null, corner: null },
  tet: { fall: 'flowers', top: 'lanterns', corner: null },
  newyear: { fall: 'confetti', top: null, corner: 'fireworks' },
  liberation: { fall: 'stars', top: 'bunting', corner: null },
  national: { fall: 'stars', top: 'bunting', corner: null },
  midautumn: { fall: 'lanterns', top: null, corner: 'moon' },
  xmas: { fall: 'snow', top: 'lights', corner: null },
}
const DEFAULT_THEME: Theme = { fall: 'emoji', top: null, corner: null }

const GOLD = '#FFCD00', SNOW = '#FFFFFF'

function Piece({ kind, color }: { kind: Exclude<Fall, 'emoji'>; color: string }): ReactNode {
  switch (kind) {
    case 'petals':
      return <svg viewBox="0 0 20 24" aria-hidden><path d="M10 1C16 6 17 17 10 23C3 17 4 6 10 1Z" fill={color} /><path d="M10 4C10 10 10 16 10 21" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" fill="none" /></svg>
    case 'flowers':
      return <svg viewBox="0 0 24 24" aria-hidden>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={12 + Math.cos((a * Math.PI) / 180) * 6.4} cy={12 + Math.sin((a * Math.PI) / 180) * 6.4} r="5.2" fill={color} />)}<circle cx="12" cy="12" r="2.6" fill="#B7410E" /></svg>
    case 'snow':
      return <svg viewBox="0 0 24 24" aria-hidden stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none">{[0, 60, 120].map((a) => <line key={a} x1="12" y1="2" x2="12" y2="22" transform={`rotate(${a} 12 12)`} />)}<circle cx="12" cy="12" r="1.6" fill={color} stroke="none" /></svg>
    case 'lanterns':
      return <svg viewBox="0 0 24 30" aria-hidden><path d="M12 1l2.6 6.6L22 8.4l-5.4 4.8 1.8 7.2L12 16.6 5.6 20.4l1.8-7.2L2 8.4l7.4-.8z" fill={color} /><circle cx="12" cy="12" r="3.2" fill="#FFF3B0" /></svg>
    case 'confetti':
      return <svg viewBox="0 0 12 20" aria-hidden><rect x="1" y="1" width="10" height="18" rx="2" fill={color} /></svg>
    case 'stars':
      return <svg viewBox="0 0 24 24" aria-hidden><path d="M12 1.5l3 7.4 8 .6-6.1 5.2 1.9 7.8L12 18.2 5.2 22.5l1.9-7.8L1 9.5l8-.6z" fill={color} /></svg>
  }
}

function Bulbs({ colors }: { colors: string[] }) {
  const n = 22
  return (
    <div className="occ-top occ-lights" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ ['--c' as string]: colors[i % colors.length], ['--d' as string]: `${(i % 5) * 0.35}s`, marginTop: `${Math.round(Math.abs(Math.sin((i / (n - 1)) * Math.PI * 3)) * 14)}px` } as CSSProperties} />
      ))}
    </div>
  )
}

function Bunting({ a, b }: { a: string; b: string }) {
  const n = 20
  return (
    <div className="occ-top occ-bunting" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const sag = Math.round(Math.sin((i / (n - 1)) * Math.PI * 2) ** 2 * 10)
        return <span key={i} style={{ background: i % 2 ? b : a, marginTop: `${sag}px`, ['--d' as string]: `${(i % 4) * 0.4}s` } as CSSProperties} />
      })}
    </div>
  )
}

function HangingLanterns({ color, trim }: { color: string; trim: string }) {
  const one = (cls: string) => (
    <div className={`occ-hang ${cls}`}>
      <i />
      <svg viewBox="0 0 40 70" aria-hidden>
        <rect x="14" y="2" width="12" height="5" rx="1.5" fill={trim} />
        <ellipse cx="20" cy="32" rx="17" ry="22" fill={color} />
        <path d="M20 10C8 20 8 44 20 54M20 10C32 20 32 44 20 54M20 10V54" stroke={trim} strokeOpacity=".65" strokeWidth="1.3" fill="none" />
        <rect x="14" y="52" width="12" height="5" rx="1.5" fill={trim} />
        <path d="M17 57v11M20 57v13M23 57v11" stroke={trim} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  )
  return <div className="occ-top occ-lanterns" aria-hidden>{one('l')}{one('r')}</div>
}

function Corner({ kind, colors }: { kind: Exclude<Corner, null>; colors: string[] }) {
  if (kind === 'moon') return <div className="occ-moon" aria-hidden><i /></div>
  const bursts = [{ x: '9%', y: '16%', d: '0s', c: colors[0] }, { x: '91%', y: '22%', d: '1.6s', c: colors[1] }, { x: '5%', y: '58%', d: '3.1s', c: colors[2] }]
  return (
    <div className="occ-fw" aria-hidden>
      {bursts.map((b, i) => (
        <div key={i} className="occ-burst" style={{ left: b.x, top: b.y, ['--c' as string]: b.c, animationDelay: b.d } as CSSProperties}>
          {Array.from({ length: 16 }, (_, k) => <span key={k} style={{ ['--a' as string]: `${k * 22.5}deg`, animationDelay: b.d } as CSSProperties} />)}
        </div>
      ))}
    </div>
  )
}

/** Hiệu ứng dịp lễ: mỗi dịp một cảnh riêng (hoa, đèn lồng, pháo hoa, cờ, tuyết…) chỉ ở hai dải lề và mép trên để không che nội dung; không chặn thao tác, tắt khi người dùng chọn giảm chuyển động. */
export function OccasionDecor({ count = 12 }: { count?: number }) {
  const { occasion } = useThemeMode()
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: i % 2 === 0 ? 1 + ((i * 37) % 11) : 88 + ((i * 29) % 10),   // chỉ rơi ở hai dải lề trái / phải
    size: 18 + ((i * 11) % 14),
    dur: 13 + ((i * 5) % 9),
    delay: -((i * 3.1) % 14),
    sway: 16 + ((i * 7) % 34),
    glyph: i,
  })), [count])
  if (!occasion) return null
  const badge = badgeOf(occasion)
  const th = THEMES[occasion.key] ?? DEFAULT_THEME
  const p = occasion.palette
  const tints = (): string[] => {
    switch (th.fall) {
      case 'petals': return [p.accent, '#FFD6E5', p.primary, '#FFB3D1']
      case 'flowers': return [GOLD, '#FFB3C1', '#FFD166', '#FF8FA3']
      case 'snow': return ['#7CB9F2', '#A5CCF5', '#5FA5EC']
      case 'lanterns': return ['#FFB347', '#FFD43B', '#FF9F1C']
      case 'confetti': return [GOLD, SNOW, '#60A5FA', '#F472B6', '#34D399']
      case 'stars': return [GOLD, '#FFE066']
      default: return []
    }
  }
  const colors = tints()
  const rise = th.fall === 'lanterns'
  return (
    <>
      {badge && <div className="occ-ribbon"><span>{occasion.emoji[0]}</span> {badge}</div>}
      {th.top === 'lights' && <Bulbs colors={['#EF4444', '#FACC15', '#22C55E', '#60A5FA']} />}
      {th.top === 'bunting' && <Bunting a="#DA251D" b={GOLD} />}
      {th.top === 'lanterns' && <HangingLanterns color="#D7261E" trim={GOLD} />}
      {th.corner && <Corner kind={th.corner} colors={[GOLD, '#F472B6', '#60A5FA']} />}
      <div className="occ-decor" aria-hidden>
        {items.map((it, i) => th.fall === 'emoji' ? (
          badge && i % 6 === 1 ? (
            <span key={i} className="occ-tag" style={{ left: `${it.left}%`, animationDuration: `${it.dur + 4}s`, animationDelay: `${it.delay}s`, ['--sway' as string]: `${it.sway}px` } as CSSProperties}>{badge}</span>
          ) : (
            <span key={i} style={{ left: `${it.left}%`, fontSize: it.size - 4, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s`, ['--sway' as string]: `${it.sway}px` } as CSSProperties}>
              {occasion.emoji[it.glyph % occasion.emoji.length]}
            </span>
          )
        ) : (
          <div key={i} className={`occ-piece${rise ? ' rise' : ''}`} style={{ left: `${it.left}%`, width: it.size, height: it.size, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s`, ['--sway' as string]: `${it.sway}px` } as CSSProperties}>
            <Piece kind={th.fall} color={colors[i % colors.length]} />
          </div>
        ))}
      </div>
    </>
  )
}
