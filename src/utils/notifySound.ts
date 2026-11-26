/*
 * 2026-11-26 - Tiếng "ting" mỗi khi có thông báo mới lúc đang mở CMS (thông báo đẩy của hệ điều hành đã có tiếng riêng khi CMS đóng / ẩn).
 * Phát bằng Web Audio (không cần tệp âm thanh). Trình duyệt chỉ cho phát tiếng sau khi người dùng đã bấm / gõ vào trang một lần,
 * nên AudioContext được mở ở lần tương tác đầu tiên. Bật / tắt ở Cài đặt → Thông báo (lưu theo trình duyệt, mặc định bật).
 */
const KEY = 'cmsvn.noticeSound'
let ctx: AudioContext | null = null

export const noticeSoundOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export const setNoticeSound = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* bỏ qua */ } }

function audio(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

// Mở khoá âm thanh ở lần tương tác đầu tiên (chính sách tự phát của trình duyệt)
if (typeof window !== 'undefined') {
  const unlock = () => { void audio()?.resume().catch(() => undefined); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/** Hai nốt ngắn (khoảng 0,4 giây), nhỏ vừa phải. force = phát thử ở Cài đặt dù đang tắt. */
export function playNoticeSound(force = false) {
  if (!force && !noticeSoundOn()) return
  const a = audio()
  if (!a || a.state === 'suspended') { void a?.resume().catch(() => undefined); if (!a || a.state !== 'running') return }
  const now = a.currentTime
  for (const [freq, at] of [[880, 0], [1318.5, 0.13]] as const) {
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + at)
    gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.28)
    osc.connect(gain).connect(a.destination)
    osc.start(now + at)
    osc.stop(now + at + 0.3)
  }
}
