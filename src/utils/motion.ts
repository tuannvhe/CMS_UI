/**
 * Tự tắt hiệu ứng chuyển động trên máy / trình duyệt cũ hoặc yếu: gắn data-motion="off" lên <html>, CSS dựa vào đó để bỏ toàn bộ transition / animation.
 * Tắt khi: người dùng chọn giảm chuyển động, bật tiết kiệm dữ liệu, ít nhân CPU hoặc ít RAM, trình duyệt thiếu tính năng CSS / JS cần dùng,
 * hoặc đo thử thấy khung hình chậm (dưới khoảng 30 khung / giây) lúc mới mở. Ghi đè thủ công: localStorage cmsvn_motion = "on" | "off".
 */
const KEY = 'cmsvn_motion'

function forced(): 'on' | 'off' | null {
  try { const v = localStorage.getItem(KEY); return v === 'on' || v === 'off' ? v : null } catch { return null }
}

function weak(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true
  if (nav.connection?.saveData) return true
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return true
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true
  if (typeof ResizeObserver === 'undefined' || typeof CSS === 'undefined' || !CSS.supports?.('color', 'color-mix(in srgb, red, blue)')) return true
  return false
}

const set = (off: boolean) => { document.documentElement.dataset.motion = off ? 'off' : 'on' }

export function initMotion() {
  const f = forced()
  if (f) { set(f === 'off'); return }
  if (weak()) { set(true); return }
  set(false)
  // Đo nhịp khung hình sau khi trang đã dựng xong (đo lúc đang tải sẽ sai vì JS đang chạy nặng): lấy trung vị, máy chậm (> 40 ms / khung, dưới 25 khung / giây) thì tắt hiệu ứng.
  const probe = () => {
    if (document.hidden) return
    const dts: number[] = []
    let last = performance.now()
    const tick = (t: number) => {
      const dt = t - last; last = t
      if (dt < 300) dts.push(dt)   // bỏ khoảng trống do tab bị ẩn / treo tạm
      if (dts.length < 45 && performance.now() < last + 3000) requestAnimationFrame(tick)
      else if (dts.length >= 30) { dts.sort((x, y) => x - y); if (dts[Math.floor(dts.length / 2)] > 40) set(true) }
    }
    requestAnimationFrame(tick)
  }
  const start = () => window.setTimeout(probe, 2500)
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true })
}
