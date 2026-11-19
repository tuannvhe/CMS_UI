/**
 * Âm báo nhỏ khi có tin nhắn đến (hai nốt ngắn, nhẹ), tạo bằng Web Audio nên không cần tệp âm thanh.
 * Trình duyệt chỉ cho phát âm thanh sau khi người dùng đã bấm / gõ trên trang: lần bấm đầu tiên sẽ "mở khoá" âm thanh.
 * Nhiều tin dồn dập trong 1,2 giây chỉ kêu một lần.
 */
let ctx: AudioContext | null = null
let last = 0

function audio(): AudioContext | null {
  if (ctx) return ctx
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return null
  try { ctx = new C() } catch { return null }
  return ctx
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    void audio()?.resume().catch(() => undefined)
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function playChime() {
  const now = Date.now()
  if (now - last < 1200) return
  last = now
  const a = audio()
  if (!a) return
  if (a.state !== 'running') { void a.resume().catch(() => undefined); return }   // chưa được mở khoá (người dùng chưa bấm gì trên trang): bỏ qua lần này
  const t0 = a.currentTime
  for (const [freq, delay] of [[880, 0], [1318.5, 0.12]] as const) {
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0 + delay)
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + delay + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.3)
    osc.connect(gain).connect(a.destination)
    osc.start(t0 + delay)
    osc.stop(t0 + delay + 0.32)
  }
}

const KEY = 'cms.qaSound'
/** Bật / tắt âm báo hỏi đáp (lưu trên trình duyệt; mặc định bật). */
export const chimeEnabled = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export const setChimeEnabled = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* không lưu được thì chỉ áp dụng trong phiên */ } }
