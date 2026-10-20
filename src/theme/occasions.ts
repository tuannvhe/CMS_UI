/**
 * Giao diện theo DỊP LỄ: hệ thống tự đổi màu chủ đạo, hiệu ứng rơi (hoa, đèn lồng, tuyết…), nền và lời chúc khi tới ngày.
 * Ngày dương lịch lặp lại hằng năm (MM-DD); dịp theo âm lịch (Tết Nguyên đán, Trung thu) khai báo theo từng năm cụ thể.
 * Quản trị có thể đổi lời chúc / nền / tự đăng bài của dịp có sẵn và thêm dịp riêng ở màn "Quản lý dịp"; cấu hình do máy chủ giữ.
 * Người dùng có thể tắt ở Cài đặt › Giao diện (hoặc bấm biểu tượng dịp lễ ở thanh dưới) và xem thử bất kỳ dịp nào.
 */
import type { OccasionOverride, OccasionSettings, OccasionBackground, OccasionText, CustomOccasion } from '../api/occasions'

export type BuiltinKey = 'newyear' | 'tet' | 'women8' | 'liberation' | 'national' | 'midautumn' | 'women20' | 'xmas'

export interface OccasionPalette {
  primary: string; primaryHover: string; deep: string; accent: string; rail: string
  /** Màu nền hàng bảng chế độ sáng */
  hover: string; selected: string; selectedHover: string; headerBg: string
  /** Chế độ sáng: nền phụ, viền, tint (rgb của màu chủ đạo) */
  surface2: string; border: string; tint: string
  /** Chế độ tối */
  dark: { primary: string; bg: string; surface: string; surface2: string; border: string; tint: string }
}

export interface Occasion {
  key: string
  /** Dịp tự thêm (không phải dịp có sẵn) */
  custom?: boolean
  /** Tên hiển thị của dịp tự thêm (dịp có sẵn lấy từ bản dịch occ.<key>.name) */
  name?: string
  /** Khoảng ngày: 'MM-DD' lặp hằng năm, hoặc 'YYYY-MM-DD' cho một năm cụ thể */
  ranges: { from: string; to: string }[]
  emoji: string[]
  palette: OccasionPalette
  /** Lời chúc do quản trị đặt (thay cho lời chúc mặc định trong bản dịch) */
  title?: OccasionText
  sub?: OccasionText
  background?: OccasionBackground
}

// ---- màu: tính bảng màu đầy đủ từ hai màu (cho dịp tự thêm)
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
function rgb(hex: string): [number, number, number] { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
const toHex = (c: [number, number, number]) => '#' + c.map((v) => clamp(v).toString(16).padStart(2, '0')).join('')
/** Trộn a với b: t = 0 giữ a, t = 1 thành b. */
export function mix(a: string, b: string, t: number) { const x = rgb(a), y = rgb(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]) }

export function paletteFromColors(primary: string, accent: string): OccasionPalette {
  const white = '#FFFFFF', black = '#000000'
  return {
    primary, primaryHover: mix(primary, black, 0.14), deep: mix(primary, black, 0.38), accent, rail: mix(primary, black, 0.75),
    hover: mix(primary, white, 0.94), selected: mix(primary, white, 0.88), selectedHover: mix(primary, white, 0.82), headerBg: mix(primary, white, 0.96),
    surface2: mix(primary, white, 0.96), border: mix(primary, white, 0.86), tint: rgb(primary).join(', '),
    dark: { primary: mix(accent, white, 0.2), bg: mix(primary, black, 0.93), surface: mix(primary, black, 0.89), surface2: mix(primary, black, 0.84), border: mix(primary, black, 0.7), tint: rgb(mix(accent, white, 0.2)).join(', ') },
  }
}

export const BUILTIN: Occasion[] = [
  {
    key: 'women20', ranges: [{ from: '10-19', to: '10-21' }], emoji: ['🌸', '🌷', '🌹', '💐', '🌺'],
    palette: { primary: '#D6336C', primaryHover: '#B82A5C', deep: '#9C1F4E', accent: '#FF8FB7', rail: '#4A0E2C', hover: '#FFF1F6', selected: '#FFE0EC', selectedHover: '#FFD0E2', headerBg: '#FFF7FA', surface2: '#FFF7FA', border: '#F6DCE7', tint: '214, 51, 108',
      dark: { primary: '#FF8FB7', bg: '#190B12', surface: '#22101A', surface2: '#2B1521', border: '#43212F', tint: '255, 143, 183' } },
  },
  {
    key: 'women8', ranges: [{ from: '03-07', to: '03-09' }], emoji: ['🌷', '🌸', '💐', '🌼'],
    palette: { primary: '#C2255C', primaryHover: '#A61E4D', deep: '#8F1A44', accent: '#F783AC', rail: '#451028', hover: '#FFF2F7', selected: '#FFE3EE', selectedHover: '#FFD3E4', headerBg: '#FFF8FB', surface2: '#FFF8FB', border: '#F4DDE7', tint: '194, 37, 92',
      dark: { primary: '#F783AC', bg: '#170B10', surface: '#20101A', surface2: '#291520', border: '#40222E', tint: '247, 131, 172' } },
  },
  {
    key: 'tet', ranges: [{ from: '2027-01-29', to: '2027-02-12' }, { from: '2028-01-20', to: '2028-02-03' }], emoji: ['🌸', '🧧', '🏮', '🎆', '🌼'],
    palette: { primary: '#C1121F', primaryHover: '#A30F1B', deep: '#8A0C17', accent: '#FFB703', rail: '#4A070D', hover: '#FFF4F1', selected: '#FFE6DD', selectedHover: '#FFD6C8', headerBg: '#FFF9F5', surface2: '#FFF9F2', border: '#F3E1D4', tint: '193, 18, 31',
      dark: { primary: '#FFB703', bg: '#180A0A', surface: '#211010', surface2: '#2A1515', border: '#432222', tint: '255, 183, 3' } },
  },
  {
    key: 'newyear', ranges: [{ from: '12-31', to: '12-31' }, { from: '01-01', to: '01-02' }], emoji: ['🎆', '✨', '🎉', '🥂'],
    palette: { primary: '#1D4ED8', primaryHover: '#1E40AF', deep: '#172554', accent: '#FBBF24', rail: '#0B1537', hover: '#F2F6FF', selected: '#E0EAFF', selectedHover: '#CFDDFF', headerBg: '#F7F9FF', surface2: '#F7F9FF', border: '#DEE5F5', tint: '29, 78, 216',
      dark: { primary: '#FBBF24', bg: '#090D1C', surface: '#10152B', surface2: '#161C38', border: '#242C52', tint: '251, 191, 36' } },
  },
  {
    key: 'liberation', ranges: [{ from: '04-29', to: '05-01' }], emoji: ['⭐', '🇻🇳', '🎆'],
    palette: { primary: '#C8102E', primaryHover: '#A50D26', deep: '#8A0B20', accent: '#FFCD00', rail: '#4A0610', hover: '#FFF3F3', selected: '#FFE3E3', selectedHover: '#FFD2D2', headerBg: '#FFF8F8', surface2: '#FFF9F5', border: '#F3DEDE', tint: '200, 16, 46',
      dark: { primary: '#FFCD00', bg: '#170A0B', surface: '#201112', surface2: '#2A1618', border: '#43232A', tint: '255, 205, 0' } },
  },
  {
    key: 'national', ranges: [{ from: '09-01', to: '09-03' }], emoji: ['⭐', '🇻🇳', '🎇'],
    palette: { primary: '#C8102E', primaryHover: '#A50D26', deep: '#8A0B20', accent: '#FFCD00', rail: '#4A0610', hover: '#FFF3F3', selected: '#FFE3E3', selectedHover: '#FFD2D2', headerBg: '#FFF8F8', surface2: '#FFF9F5', border: '#F3DEDE', tint: '200, 16, 46',
      dark: { primary: '#FFCD00', bg: '#170A0B', surface: '#201112', surface2: '#2A1618', border: '#43232A', tint: '255, 205, 0' } },
  },
  {
    key: 'midautumn', ranges: [{ from: '2026-09-24', to: '2026-09-26' }, { from: '2027-09-14', to: '2027-09-16' }, { from: '2028-10-02', to: '2028-10-04' }], emoji: ['🏮', '🌕', '🥮', '🐇'],
    palette: { primary: '#E8590C', primaryHover: '#C94A09', deep: '#A63D00', accent: '#FFD43B', rail: '#4A1F05', hover: '#FFF6EE', selected: '#FFE8D4', selectedHover: '#FFDABB', headerBg: '#FFFAF5', surface2: '#FFFAF3', border: '#F2E6DB', tint: '232, 89, 12',
      dark: { primary: '#FFD43B', bg: '#150F08', surface: '#1F160D', surface2: '#281D12', border: '#3D2C1B', tint: '255, 212, 59' } },
  },
  {
    key: 'xmas', ranges: [{ from: '12-23', to: '12-26' }], emoji: ['❄️', '🎄', '⭐', '🎁'],
    palette: { primary: '#B91C1C', primaryHover: '#991B1B', deep: '#14532D', accent: '#22C55E', rail: '#0B3B1E', hover: '#FFF4F4', selected: '#FFE4E4', selectedHover: '#FFD2D2', headerBg: '#FFF9F9', surface2: '#F7FBF8', border: '#E2EBE4', tint: '185, 28, 28',
      dark: { primary: '#4ADE80', bg: '#08130C', surface: '#0F1E14', surface2: '#15291B', border: '#21402B', tint: '74, 222, 128' } },
  },
]

/** Danh sách dịp áp dụng: dịp có sẵn (trừ dịp bị tắt, kèm lời chúc / nền tuỳ chỉnh) cộng các dịp tự thêm đang bật. */
export function buildOccasions(settings?: OccasionSettings | null): Occasion[] {
  const disabled = new Set(settings?.disabledBuiltins ?? [])
  const overrides: Record<string, OccasionOverride> = settings?.overrides ?? {}
  const builtin = BUILTIN.filter((o) => !disabled.has(o.key)).map((o) => {
    const ov = overrides[o.key]
    return ov ? { ...o, title: ov.title ?? undefined, sub: ov.sub ?? undefined, background: ov.background ?? undefined } : o
  })
  const custom = (settings?.custom ?? []).filter((c: CustomOccasion) => c.enabled).map<Occasion>((c) => ({
    key: c.id, custom: true, name: c.name, ranges: c.ranges, emoji: c.emoji, palette: paletteFromColors(c.primary, c.accent), title: c.title, sub: c.sub ?? undefined, background: c.background ?? undefined,
  }))
  return [...custom, ...builtin]   // dịp tự thêm ưu tiên khi trùng ngày
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Dịp lễ đang diễn ra vào ngày `d` (giờ máy người dùng); undefined nếu không có. */
export function occasionOn(d: Date, list: Occasion[] = BUILTIN): Occasion | undefined {
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const full = `${d.getFullYear()}-${md}`
  return list.find((o) => o.ranges.some((r) => (r.from.length === 5 ? (r.from <= r.to ? md >= r.from && md <= r.to : md >= r.from || md <= r.to) : full >= r.from && full <= r.to)))
}

export const occasionByKey = (k: string | null | undefined, list: Occasion[] = BUILTIN) => list.find((o) => o.key === k)

/** Lời chúc hiển thị: do quản trị đặt (theo ngôn ngữ, thiếu thì tiếng Việt) hoặc bản dịch mặc định. */
export function greetingOf(o: Occasion, lang: string, t: (k: string, v?: Record<string, unknown>) => string, year: number): { title: string; sub: string } {
  const pick = (x: OccasionText | undefined) => (x ? (lang === 'en' ? x.en : lang === 'ko' ? x.ko : x.vi) || x.vi : '')
  const fill = (s: string) => s.replace('{year}', String(year))
  const title = pick(o.title), sub = pick(o.sub)
  if (o.custom) return { title: fill(title), sub: fill(sub) }
  return { title: title ? fill(title) : t(`occ.${o.key}.title`, { year }), sub: sub ? fill(sub) : t(`occ.${o.key}.sub`, { year }) }
}

export const occasionName = (o: Occasion, t: (k: string) => string) => (o.custom ? o.name ?? o.key : t(`occ.${o.key}.name`))

const BADGES: Record<string, string> = { women20: '20/10', women8: '8/3', tet: 'TẾT', newyear: '1/1', liberation: '30/4', national: '2/9', midautumn: '15/8 ÂL', xmas: '25/12' }

/** Dấu hiệu nhận biết dịp (chữ ngắn như "20/10"): hoa / biểu tượng một mình khó phân biệt các dịp nên luôn kèm ngày. */
export function badgeOf(o: Occasion): string {
  if (!o.custom) return BADGES[o.key] ?? ''
  const f = o.ranges[0]?.from ?? ''
  const m = /(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(f)
  return m ? `${Number(m[2])}/${Number(m[1])}` : ''
}
