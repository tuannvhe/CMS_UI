import type { TFunction } from 'i18next'
import type { YearReview } from '../../api/yearReview'

export const BADGE_ICON: Record<string, string> = {
  iron: '🛡️', streak: '🔥', punctual: '⏰', ot_hero: '💪', night_owl: '🦉', traveler: '🚌', veteran: '🏅', newcomer: '🌱', workhorse: '💼', connector: '💬',
}

/** Ảnh nền của từng trang (ảnh nhà máy và hoạt động có sẵn trong public/images/landing). */
export const SLIDE_BG: Record<string, string> = {
  intro: '/images/landing/banner-bacninh.webp',
  days: '/images/landing/about-factory-bn.webp',
  ot: '/images/landing/recruit-banner.webp',
  night: '/images/landing/banner-factory-overview.webp',
  top: '/images/landing/banner-hungyen-2.webp',
  att: '/images/landing/gallery-02.webp',
  hy: '/images/landing/banner-hungyen-1.webp',
  tenure: '/images/landing/gallery-01.webp',
  badges: '/images/landing/gallery-07.webp',
  thanks: '/images/landing/hero-factory.webp',
}

const FONT = "'Inter Variable', 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif"

export function tenureText(t: TFunction, months: number) {
  const y = Math.floor(months / 12), m = months % 12
  return y > 0 ? t('yr.tenure.years', { y, m }) : t('yr.tenure.months', { m })
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

/** Thu nhỏ cỡ chữ cho vừa bề rộng. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number) {
  let s = size
  do { ctx.font = `${weight} ${s}px ${FONT}`; s -= 2 } while (ctx.measureText(text).width > max && s > 14)
}

/** Vẽ thẻ tổng kết 1080×1350 (tỷ lệ 4:5, hợp đăng Zalo / Facebook) và trả về ảnh PNG. Không gửi gì lên máy chủ. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Vẽ ảnh phủ kín khung (giống background-size: cover). */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height)
  const sw = w / r, sh = h / r
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

export async function drawSummary(d: YearReview, t: TFunction, lang: string, avatarUrl?: string | null): Promise<Blob | null> {
  try { await document.fonts?.ready } catch { /* bỏ qua */ }
  const W = 1080, H = 1350
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null

  const [photo, face] = await Promise.all([loadImage(SLIDE_BG.thanks), avatarUrl ? loadImage(avatarUrl) : Promise.resolve(null)])

  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#0b1f4d'); g.addColorStop(0.55, '#1d4ed8'); g.addColorStop(1, '#7c3aed')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  // ảnh nhà máy ở nửa trên, mờ dần xuống nền
  const PH = 560
  if (photo) {
    cover(ctx, photo, 0, 0, W, PH)
    const fade = ctx.createLinearGradient(0, 0, 0, PH)
    fade.addColorStop(0, 'rgba(11,31,77,0.35)'); fade.addColorStop(0.6, 'rgba(29,78,216,0.55)'); fade.addColorStop(1, 'rgba(29,78,216,1)')
    ctx.fillStyle = fade; ctx.fillRect(0, 0, W, PH)
  }
  for (const [x, y, r, a] of [[140, 1180, 320, 0.10], [980, 1100, 140, 0.08]] as const) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill()
  }

  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18
  ctx.font = `700 34px ${FONT}`; ctx.fillText('VINATECH', 80, 100)
  ctx.font = `900 180px ${FONT}`; ctx.fillText(String(d.year), 68, 290)
  fit(ctx, t('yr.summary.title', { year: d.year }), 600, 40, W - 160)
  ctx.fillText(t('yr.summary.title', { year: d.year }), 80, 350)
  ctx.shadowBlur = 0

  // ảnh đại diện tròn + tên
  const AX = 80, AY = 400, AS = 150
  ctx.save(); ctx.beginPath(); ctx.arc(AX + AS / 2, AY + AS / 2, AS / 2 + 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore()
  ctx.save(); ctx.beginPath(); ctx.arc(AX + AS / 2, AY + AS / 2, AS / 2, 0, Math.PI * 2); ctx.clip()
  if (face) cover(ctx, face, AX, AY, AS, AS)
  else {
    const ag = ctx.createLinearGradient(AX, AY, AX + AS, AY + AS); ag.addColorStop(0, '#f472b6'); ag.addColorStop(1, '#7c3aed')
    ctx.fillStyle = ag; ctx.fillRect(AX, AY, AS, AS)
    const given = d.name.split('_')[0].trim().split(/\s+/).pop() ?? d.name
    ctx.fillStyle = '#fff'; ctx.font = `800 72px ${FONT}`; ctx.textAlign = 'center'
    ctx.fillText(given.charAt(0).toLocaleUpperCase('vi'), AX + AS / 2, AY + AS / 2 + 26); ctx.textAlign = 'left'
  }
  ctx.restore()
  const NX = AX + AS + 36
  fit(ctx, d.name, 800, 56, W - NX - 80); ctx.fillStyle = '#fff'; ctx.fillText(d.name, NX, AY + 70)
  if (d.department) { fit(ctx, d.department, 500, 32, W - NX - 80); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(d.department, NX, AY + 118) }

  const stats: [string, string][] = [
    [String(d.workDays), t('yr.summary.days')],
    [String(Math.round(d.otHours)), t('yr.summary.ot')],
    [`${d.attendanceMonths}/${d.monthsWithData || 12}`, t('yr.summary.att')],
    [tenureText(t, d.tenureMonths), t('yr.summary.tenure')],
  ]
  const bw = (W - 160 - 30) / 2, bh = 200
  stats.forEach(([v, label], i) => {
    const x = 80 + (i % 2) * (bw + 30), y = 600 + Math.floor(i / 2) * (bh + 30)
    round(ctx, x, y, bw, bh, 32); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill()
    fit(ctx, v, 800, 88, bw - 60); ctx.fillStyle = '#fff'; ctx.fillText(v, x + 32, y + 120)
    fit(ctx, label, 500, 32, bw - 60); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(label, x + 32, y + 172)
  })

  if (d.badges.length > 0) {
    let x = 80, y = 1130
    for (const b of d.badges.slice(0, 6)) {
      const text = `${BADGE_ICON[b] ?? '⭐'} ${t(`yr.badge.${b}`)}`
      ctx.font = `600 30px ${FONT}`
      const w = ctx.measureText(text).width + 44
      if (x + w > W - 80) { x = 80; y += 70 }
      round(ctx, x, y - 42, w, 58, 29); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill()
      ctx.fillStyle = '#1e3a8a'; ctx.fillText(text, x + 22, y - 3)
      x += w + 16
    }
  }

  ctx.font = `500 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString(lang), W - 80, H - 60)
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'))
}
