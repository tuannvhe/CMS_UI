/**
 * Hiệu ứng pháo hoa + giấy màu chúc mừng sinh nhật, vẽ trên một canvas phủ toàn màn hình (không chặn chuột).
 * Pháo bay lên có vệt sáng rồi nổ nhiều kiểu (cầu, vòng, trái tim, liễu rủ, kim tuyến), giấy màu rơi khắp màn hình;
 * chạy đúng 5 giây (mờ dần ở cuối) rồi tự gỡ canvas. Không cần thư viện ngoài.
 * Người dùng bật "giảm chuyển động" của hệ điều hành thì bỏ qua.
 */
const COLORS = ['#FF4D6D', '#FFB703', '#06D6A0', '#4CC9F0', '#B388EB', '#F72585', '#FFD60A', '#3A86FF', '#FF8FAB', '#80FFDB']
const GOLD = '#FFC94D'
const SHOW_MS = 3_400       // thời gian bắn thêm pháo
const END_MS = 5_000        // tổng thời gian hiệu ứng: hết giờ thì mờ dần trong FADE_MS cuối rồi gỡ hẳn
const FADE_MS = 700
const MAX_PARTS = 3500

type Kind = 'rocket' | 'spark' | 'paper'
interface P {
  kind: Kind; x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number
  drag: number; grav: number; trail: number[]; twinkle: boolean; rot: number; vr: number; shape: number; wob: number
  burst?: Burst; ty?: number
}
type Burst = 'sphere' | 'ring' | 'heart' | 'willow' | 'glitter' | 'double'

let st: { canvas: HTMLCanvasElement; parts: P[]; until: number; end: number; nextRocket: number; nextRain: number; w: number; h: number } | null = null
const sprites = new Map<string, HTMLCanvasElement>()

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** Đốm sáng có quầng (vẽ sẵn một lần cho mỗi màu) để pháo trông phát sáng mà vẫn nhanh. */
function glow(color: string) {
  let c = sprites.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grd.addColorStop(0, '#FFFFFF'); grd.addColorStop(0.18, color); grd.addColorStop(0.45, color + '66'); grd.addColorStop(1, color + '00')
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32)
  sprites.set(color, c)
  return c
}

function part(o: Partial<P> & Pick<P, 'kind' | 'x' | 'y' | 'vx' | 'vy' | 'max' | 'color' | 'size'>): P {
  return { life: 0, drag: 0.985, grav: 0.05, trail: [], twinkle: false, rot: rnd(0, Math.PI), vr: rnd(-0.2, 0.2), shape: Math.floor(rnd(0, 3)), wob: rnd(0, 6), ...o }
}

function launch(s: NonNullable<typeof st>, x?: number) {
  const sx = x ?? rnd(s.w * 0.12, s.w * 0.88)
  const ty = rnd(s.h * 0.12, s.h * 0.42)
  const vy = -Math.sqrt(2 * 0.12 * (s.h - ty)) * rnd(0.98, 1.04)
  s.parts.push(part({ kind: 'rocket', x: sx, y: s.h + 10, vx: rnd(-1, 1), vy, max: 400, color: GOLD, size: 2.4, drag: 1, grav: 0.12, ty, burst: pick<Burst>(['sphere', 'sphere', 'ring', 'heart', 'willow', 'glitter', 'double']) }))
}

function explode(s: NonNullable<typeof st>, x: number, y: number, type: Burst) {
  const c1 = pick(COLORS), c2 = pick(COLORS)
  const add = (vx: number, vy: number, color: string, o: Partial<P> = {}) =>
    s.parts.push(part({ kind: 'spark', x, y, vx, vy, max: rnd(70, 100), color, size: rnd(1.6, 2.6), drag: 0.955, grav: 0.045, twinkle: Math.random() < 0.3, ...o }))
  const n = Math.round(rnd(90, 130))
  switch (type) {
    case 'ring':
      for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n; add(Math.cos(a) * 6.5, Math.sin(a) * 6.5, c1) }
      break
    case 'double':
      for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n; add(Math.cos(a) * 7, Math.sin(a) * 7, c1); if (i % 2 === 0) add(Math.cos(a) * 3.6, Math.sin(a) * 3.6, c2) }
      break
    case 'heart':
      for (let i = 0; i < n; i++) {
        const t = (Math.PI * 2 * i) / n
        const hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
        add(hx * 0.38, hy * 0.38, i % 3 === 0 ? '#FF8FAB' : '#FF4D6D', { grav: 0.025 })
      }
      break
    case 'willow':
      for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(2, 5.5); add(Math.cos(a) * v, Math.sin(a) * v, GOLD, { max: rnd(130, 170), drag: 0.975, grav: 0.03, size: rnd(1.3, 2), twinkle: true }) }
      break
    case 'glitter':
      for (let i = 0; i < n * 1.4; i++) { const a = rnd(0, Math.PI * 2), v = rnd(1, 7); add(Math.cos(a) * v, Math.sin(a) * v, Math.random() < 0.5 ? '#FFFFFF' : GOLD, { twinkle: true, size: rnd(1.2, 2) }) }
      break
    default:
      for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = Math.cbrt(Math.random()) * 7; add(Math.cos(a) * v, Math.sin(a) * v, Math.random() < 0.75 ? c1 : c2) }
  }
}

function confetti(s: NonNullable<typeof st>, x: number, y: number, n: number, dir: number, spread: number, speed: number) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(-spread, spread), v = rnd(speed * 0.5, speed)
    s.parts.push(part({ kind: 'paper', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: rnd(260, 380), color: pick(COLORS), size: rnd(6, 11), drag: 0.985, grav: 0.1 }))
  }
}

function rain(s: NonNullable<typeof st>, n: number) {
  for (let i = 0; i < n; i++)
    s.parts.push(part({ kind: 'paper', x: rnd(0, s.w), y: rnd(-40, -10), vx: rnd(-1, 1), vy: rnd(1, 2.5), max: 600, color: pick(COLORS), size: rnd(6, 10), drag: 0.99, grav: 0.04 }))
}

function draw(ctx: CanvasRenderingContext2D, p: P) {
  const fade = p.kind === 'paper' ? Math.min(1, (p.max - p.life) / 60) : Math.max(0, 1 - p.life / p.max)
  if (p.kind === 'paper') {
    ctx.globalAlpha = fade
    ctx.fillStyle = p.color
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot)
    const flip = Math.cos(p.life / 7 + p.wob)
    if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4 * flip, p.size, (p.size / 2) * flip)
    else if (p.shape === 1) { ctx.beginPath(); ctx.ellipse(0, 0, p.size / 2.6, (p.size / 2.6) * Math.abs(flip) + 0.5, 0, 0, Math.PI * 2); ctx.fill() }
    else { ctx.strokeStyle = p.color; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.quadraticCurveTo(0, p.size * flip, p.size, 0); ctx.stroke() }
    ctx.restore()
    return
  }
  // Vệt sáng phía sau
  const tr = p.trail
  if (tr.length >= 4) {
    ctx.strokeStyle = p.color; ctx.lineCap = 'round'
    for (let i = 2; i < tr.length; i += 2) {
      ctx.globalAlpha = fade * (i / tr.length) * 0.55
      ctx.lineWidth = p.size * (i / tr.length) * 1.1
      ctx.beginPath(); ctx.moveTo(tr[i - 2], tr[i - 1]); ctx.lineTo(i + 2 < tr.length ? tr[i] : p.x, i + 2 < tr.length ? tr[i + 1] : p.y); ctx.stroke()
    }
  }
  if (p.twinkle && p.life > p.max * 0.4 && Math.random() < 0.35) return
  ctx.globalAlpha = fade
  const r = p.size * (p.kind === 'rocket' ? 5 : 4)
  ctx.drawImage(glow(p.color), p.x - r, p.y - r, r * 2, r * 2)
}

/** Bắn pháo hoa chúc mừng; `origin` (toạ độ màn hình) là chỗ phụt giấy màu, mặc định giữa cạnh dưới. Gọi lại khi đang chạy thì kéo dài thêm. */
export function fireBirthdayBurst(origin?: { x: number; y: number }) {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const now = performance.now()

  if (!st) {
    const canvas = document.createElement('canvas')
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '3000' })
    canvas.setAttribute('aria-hidden', 'true')
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) { canvas.remove(); return }
    const s = { canvas, parts: [] as P[], until: now + SHOW_MS, end: now + END_MS, nextRocket: now, nextRain: now, w: 0, h: 0 }
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      s.w = window.innerWidth; s.h = window.innerHeight
      canvas.width = s.w * dpr; canvas.height = s.h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)
    st = s
    let last = now
    const tick = (t: number) => {
      // Chuẩn hoá theo 60 khung hình/giây để màn hình 120 Hz không chạy nhanh gấp đôi.
      const k = Math.min(3, (t - last) / (1000 / 60)); last = t
      if (t < s.until) {
        if (t >= s.nextRocket) {
          const salvo = Math.random() < 0.25 ? 3 : Math.random() < 0.5 ? 2 : 1
          for (let i = 0; i < salvo; i++) launch(s)
          s.nextRocket = t + rnd(450, 900)
        }
        if (t >= s.nextRain && t < s.until - 800) { rain(s, 8); s.nextRain = t + 100 }
      }
      ctx.clearRect(0, 0, s.w, s.h)
      const born: P[] = []
      for (const p of s.parts) {
        p.life += k
        if (p.kind !== 'paper') { p.trail.push(p.x, p.y); if (p.trail.length > (p.kind === 'rocket' ? 24 : p.max > 120 ? 20 : 12)) p.trail.splice(0, 2) }
        const d = Math.pow(p.drag, k)
        p.vx *= d; p.vy = p.vy * d + p.grav * k
        if (p.kind === 'paper') { p.vy = Math.min(p.vy, 3); p.x += Math.sin(p.life / 12 + p.wob) * 0.8 * k; p.rot += p.vr * k }
        if (p.kind === 'rocket') {
          if (Math.random() < 0.6) born.push(part({ kind: 'spark', x: p.x, y: p.y, vx: rnd(-0.4, 0.4), vy: rnd(0.5, 1.5), max: rnd(18, 30), color: GOLD, size: rnd(0.8, 1.3), drag: 0.95, grav: 0.03 }))
          if (p.vy >= -0.6 || p.y <= (p.ty ?? 0)) { p.life = p.max; explode({ ...s, parts: born }, p.x, p.y, p.burst ?? 'sphere') }
        }
        p.x += p.vx * k; p.y += p.vy * k
        draw(ctx, p)
      }
      s.parts = s.parts.filter((p) => p.life < p.max && p.y < s.h + 40 && p.x > -60 && p.x < s.w + 60)
      if (born.length) s.parts.push(...born)
      if (s.parts.length > MAX_PARTS) s.parts.splice(0, s.parts.length - MAX_PARTS)
      ctx.globalAlpha = 1
      canvas.style.opacity = String(Math.max(0, Math.min(1, (s.end - t) / FADE_MS)))
      if (t < s.end && (s.parts.length > 0 || t < s.until)) requestAnimationFrame(tick)
      else { window.removeEventListener('resize', fit); canvas.remove(); st = null }
    }
    requestAnimationFrame(tick)
  } else {
    st.until = Math.max(st.until, now + SHOW_MS)
    st.end = Math.max(st.end, now + END_MS)
  }

  const s = st
  const ox = origin?.x ?? s.w / 2, oy = origin?.y ?? s.h
  confetti(s, ox, oy, 120, -Math.PI / 2, 0.75, Math.max(13, Math.min(22, s.h / 40)))
  confetti(s, 0, s.h * 0.8, 70, -Math.PI / 3, 0.3, 19)
  confetti(s, s.w, s.h * 0.8, 70, (-2 * Math.PI) / 3, 0.3, 19)
  // Loạt mở màn: ba quả bay cùng lúc ở trái, giữa, phải.
  launch(s, s.w * 0.25); launch(s, s.w * 0.5); launch(s, s.w * 0.75)
  s.nextRocket = now + 700
}

/** Ngừng bắn thêm (ví dụ khi đóng lời chúc); pháo đang bay và giấy màu đang rơi vẫn tắt dần cho tự nhiên. */
export function stopBirthdayBurst() {
  if (st) { st.until = 0; st.end = Math.min(st.end, performance.now() + FADE_MS) }
}
