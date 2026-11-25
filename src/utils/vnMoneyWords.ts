/* 2026-11-24 [Truong] - HN payslip: amount in Vietnamese words ("Bằng chữ") for the net pay box */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const GROUPS = ['', 'nghìn', 'triệu', 'tỷ']

/** Đọc một nhóm 3 chữ số. full = không phải nhóm đứng đầu (phải đọc cả "không trăm", "linh"). */
function readTriple(n: number, full: boolean): string {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10
  const out: string[] = []
  if (h > 0 || full) out.push(DIGITS[h], 'trăm')
  if (t === 0) { if (u > 0 && (h > 0 || full)) out.push('linh') }
  else if (t === 1) out.push('mười')
  else out.push(DIGITS[t], 'mươi')
  if (u === 1) out.push(t > 1 ? 'mốt' : 'một')
  else if (u === 5) out.push(t > 0 ? 'lăm' : 'năm')
  else if (u === 4) out.push(t > 1 ? 'tư' : 'bốn')
  else if (u > 0) out.push(DIGITS[u])
  return out.join(' ')
}

/** 20060000 → "Hai mươi triệu không trăm sáu mươi nghìn đồng". Số âm / không phải số → "". */
export function vnMoneyWords(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return ''
  let n = Math.round(amount)
  if (n === 0) return 'Không đồng'
  const groups: number[] = []
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000) }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    // Nhóm "tỷ" lặp lại cho số rất lớn (nghìn tỷ, triệu tỷ)
    const unit = i < GROUPS.length ? GROUPS[i] : `${GROUPS[i % 3]} tỷ`.trim()
    parts.push(readTriple(g, i < groups.length - 1), unit)
  }
  const s = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} đồng`
}
