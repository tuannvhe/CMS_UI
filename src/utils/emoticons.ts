/**
 * Mặt cười gõ bằng chữ → emoji khi HIỂN THỊ (như Messenger): ":)" → 🙂, ":v" → 😆, "<3" → ❤️ ...
 * Chỉ đổi khi đứng riêng (đầu / cuối dòng hoặc cách nhau bằng khoảng trắng / dấu câu), nên "http://", "10:30" hay "a:b" không bị đổi.
 * Không đổi nội dung đã lưu: hệ thống cũ vẫn thấy đúng chữ người dùng gõ.
 */
const MAP: Record<string, string> = {
  ':))': '😄', ':)))': '😆', ':((': '😭', ":'(": '😢', '>:(': '😠', '>:o': '😠',
  ':-)': '🙂', ':)': '🙂', '=)': '🙂', '(:': '🙂',
  ':-(': '🙁', ':(': '🙁', '=(': '🙁',
  ':-d': '😀', ':d': '😀', '=d': '😀', 'xd': '😆',
  ':v': '😆', ':-v': '😆',
  ';-)': '😉', ';)': '😉',
  ':-p': '😛', ':p': '😛', ';p': '😜',
  ':-o': '😮', ':o': '😮',
  ':-*': '😘', ':*': '😘',
  ':3': '😊', '^^': '😊', '^_^': '😊', '^.^': '😊',
  '-_-': '😑', ':|': '😐', ':-|': '😐',
  ':/': '😕', ':-/': '😕',
  'b-)': '😎', '8-)': '😎',
  'o:)': '😇', '3:)': '😈',
  '<3': '❤️', '</3': '💔',
  ':like:': '👍', '(y)': '👍',
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Dài trước để ":))" không bị bắt thành ":)" + ")"
const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length)
const RX = new RegExp(`(^|[\\s.,!?])(${KEYS.map(esc).join('|')})(?=$|[\\s.,!?])`, 'gi')

export function emojify(text: string): string {
  if (!text) return text
  // Thay hai lượt: hai mặt cười liền nhau cách một khoảng trắng (":) :)") vẫn đổi được cả hai
  const once = (s: string) => s.replace(RX, (_m, pre: string, tok: string) => pre + (MAP[tok.toLowerCase()] ?? tok))
  return once(once(text))
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|\s)+$/u
const PICTO = /\p{Extended_Pictographic}/gu

/** Tin chỉ gồm 1–3 emoji (sau khi đổi): hiện to, không khung (như Messenger). */
export function isJumboEmoji(text: string): boolean {
  const s = text.trim()
  if (!s || !EMOJI_ONLY.test(s)) return false
  const n = s.match(PICTO)?.length ?? 0
  return n >= 1 && n <= 3
}
