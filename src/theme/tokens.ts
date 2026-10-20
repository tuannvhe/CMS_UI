/**
 * Design tokens của VINATECH CMS – nguồn duy nhất cho màu, bo góc, font, kích thước khung.
 * Mọi component dùng chung các giá trị này (qua Ant Design theme + biến CSS trong index.css),
 * không đặt màu "cứng" rải rác trong từng trang.
 */
export const brand = {
  primary: '#0F6B3E',      // xanh Vina – màu chủ đạo, nút chính, mục đang chọn
  primaryHover: '#0C5A34',
  deep: '#0A4D2C',         // xanh đậm – nền thương hiệu
  accent: '#5FA830',       // xanh lá sáng – điểm nhấn, gradient
  rail: '#0A3B24',         // nền thanh icon bên trái
} as const

export const radius = 10

export const fontFamily =
  "'Inter Variable', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"

export const gradients = {
  brand: `linear-gradient(135deg, ${brand.deep} 0%, ${brand.primary} 45%, ${brand.accent} 100%)`,
} as const

/** Bảng màu giao diện người dùng chọn được (màn Cài đặt › Giao diện). Mặc định là xanh Vina; mỗi bảng màu đổi màu chủ đạo, điểm nhấn, thanh icon và màu nền bảng. */
export type PaletteKey = 'green' | 'pink' | 'blue' | 'purple' | 'orange' | 'teal'
export interface Palette {
  key: PaletteKey
  primary: string; primaryHover: string; deep: string; accent: string; rail: string
  /** Màu nền hàng bảng (sáng): hover, đang chọn, đang chọn + hover */
  hover: string; selected: string; selectedHover: string; headerBg: string
}
export const PALETTES: Record<PaletteKey, Palette> = {
  green: { key: 'green', primary: '#0F6B3E', primaryHover: '#0C5A34', deep: '#0A4D2C', accent: '#5FA830', rail: '#0A3B24', hover: '#F2F8F4', selected: '#E6F3EB', selectedHover: '#DCEEE3', headerBg: '#F8FAF9' },
  pink: { key: 'pink', primary: '#D6336C', primaryHover: '#B82A5C', deep: '#A61E4D', accent: '#F783AC', rail: '#4A1030', hover: '#FFF3F8', selected: '#FFE3EE', selectedHover: '#FFD3E4', headerBg: '#FFF8FB' },
  blue: { key: 'blue', primary: '#1971C2', primaryHover: '#155FA3', deep: '#0B4A8C', accent: '#4DABF7', rail: '#0B2545', hover: '#F1F7FD', selected: '#E3EFFB', selectedHover: '#D3E6F8', headerBg: '#F7FAFD' },
  orange: { key: 'orange', primary: '#E8590C', primaryHover: '#C94A09', deep: '#B03A00', accent: '#FFA94D', rail: '#4A1F05', hover: '#FFF6EE', selected: '#FFE8D4', selectedHover: '#FFDABB', headerBg: '#FFFAF5' },
  teal: { key: 'teal', primary: '#0C8599', primaryHover: '#0A6E80', deep: '#085E6E', accent: '#3BC9DB', rail: '#06303A', hover: '#F0FAFC', selected: '#DDF3F7', selectedHover: '#C9EBF1', headerBg: '#F6FBFC' },
  purple: { key: 'purple', primary: '#7048E8', primaryHover: '#5C39C7', deep: '#5235AB', accent: '#B197FC', rail: '#2B1B5A', hover: '#F6F3FE', selected: '#ECE6FD', selectedHover: '#E0D7FB', headerBg: '#FAF8FF' },
}
