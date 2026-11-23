/**
 * Nhạc nền "Happy Birthday" kiểu hộp nhạc, tổng hợp bằng Web Audio (không cần file âm thanh).
 * Nên gọi trong sự kiện bấm chuột để trình duyệt cho phát ngay; nếu bị chặn thì chờ lần bấm/gõ đầu tiên. Gọi lại khi đang phát thì phát lại từ đầu.
 */
const N: Record<string, number> = { F2: 87.31, G2: 98, C3: 130.81, E3: 164.81, G3: 196, A3: 220, B3: 246.94, C4: 261.63, F3: 174.61,
  G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 }

// [nốt, số phách] theo nhịp 3/4, bắt đầu bằng hai nốt lấy đà.
const MELODY: [string, number][] = [
  ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
  ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
  ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
  ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3],
]
// Hợp âm đệm mỗi ô nhịp (3 phách), tính từ sau hai nốt lấy đà.
const CHORDS: string[][] = [['C3', 'E3', 'G3'], ['G2', 'B3', 'F3'], ['G2', 'B3', 'F3'], ['C3', 'E3', 'G3'], ['C3', 'E3', 'G3'], ['F2', 'A3', 'C4'], ['C3', 'E3', 'G3'], ['G2', 'B3', 'F3'], ['C3', 'E3', 'G3']]
const BEAT = 0.46   // giây mỗi phách

let current: { ctx: AudioContext; master: GainNode } | null = null

function bell(ctx: AudioContext, out: AudioNode, f: number, at: number, dur: number, vol: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0008, at + Math.max(0.5, dur * 1.6))
  g.connect(out)
  // Tiếng hộp nhạc: âm gốc + bội âm mỏng.
  for (const [mul, type, v] of [[1, 'sine', 1], [2, 'triangle', 0.25], [4.01, 'sine', 0.06]] as const) {
    const o = ctx.createOscillator(), og = ctx.createGain()
    o.type = type; o.frequency.value = f * mul; og.gain.value = v
    o.connect(og).connect(g)
    o.start(at); o.stop(at + Math.max(0.5, dur * 1.6) + 0.05)
  }
}

export function playBirthdaySong() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  stopBirthdaySong(0)
  const ctx = new AC()
  const master = ctx.createGain()
  master.gain.value = 0.22
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 4200
  master.connect(lp).connect(ctx.destination)
  current = { ctx, master }
  // Tự mở lúc vừa vào trang (chưa có thao tác nào) thì trình duyệt giữ âm thanh ở trạng thái tạm dừng: phát ngay khi người dùng bấm/gõ lần đầu.
  if (ctx.state === 'suspended') {
    const unlock = () => { void ctx.resume().catch(() => undefined); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  const t0 = ctx.currentTime + 0.08
  let t = t0
  for (const [n, beats] of MELODY) { bell(ctx, master, N[n], t, beats * BEAT, 0.5); t += beats * BEAT }
  CHORDS.forEach((ch, i) => {
    const at = t0 + BEAT + i * 3 * BEAT
    ch.forEach((n, j) => bell(ctx, master, N[n], at + j * 0.03, 3 * BEAT, j === 0 ? 0.22 : 0.12))
  })
  const total = t - t0 + 1.8
  const me = current
  setTimeout(() => { if (current === me) stopBirthdaySong(0) }, total * 1000)
}

/** Dừng nhạc, nhỏ dần trong `fade` giây. */
export function stopBirthdaySong(fade = 0.6) {
  const c = current
  if (!c) return
  current = null
  try {
    const now = c.ctx.currentTime
    c.master.gain.cancelScheduledValues(now)
    c.master.gain.setValueAtTime(c.master.gain.value, now)
    c.master.gain.linearRampToValueAtTime(0, now + Math.max(0.01, fade))
  } catch { /* ngữ cảnh âm thanh đã đóng */ }
  setTimeout(() => { void c.ctx.close().catch(() => undefined) }, Math.max(0.01, fade) * 1000 + 50)
}
