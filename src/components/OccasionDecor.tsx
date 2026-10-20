import { useMemo } from 'react'
import { useThemeMode } from '../theme/ThemeProvider'
import { badgeOf } from '../theme/occasions'

/** Hiệu ứng rơi nhẹ của dịp lễ (hoa, đèn lồng, tuyết…): phủ cả màn hình nhưng không chặn thao tác; tắt khi người dùng chọn giảm chuyển động. */
export function OccasionDecor({ count = 16 }: { count?: number }) {
  const { occasion } = useThemeMode()
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: (i * 100) / count + ((i * 37) % 7),   // trải đều theo chiều ngang, lệch nhẹ
    size: 16 + ((i * 11) % 14),
    dur: 11 + ((i * 5) % 9),
    delay: -((i * 3.1) % 14),
    sway: 20 + ((i * 7) % 40),
    glyph: i,
  })), [count])
  if (!occasion) return null
  const badge = badgeOf(occasion)
  return (
    <div className="occ-decor" aria-hidden>
      {badge && <div className="occ-ribbon"><span>{occasion.emoji[0]}</span> {badge}</div>}
      {items.map((it, i) => badge && i % 4 === 1 ? (
        <span key={i} className="occ-tag" style={{ left: `${it.left}%`, animationDuration: `${it.dur + 4}s`, animationDelay: `${it.delay}s`, ['--sway' as string]: `${it.sway}px` }}>{badge}</span>
      ) : (
        <span key={i} style={{ left: `${it.left}%`, fontSize: it.size, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s`, ['--sway' as string]: `${it.sway}px` }}>
          {occasion.emoji[it.glyph % occasion.emoji.length]}
        </span>
      ))}
    </div>
  )
}
