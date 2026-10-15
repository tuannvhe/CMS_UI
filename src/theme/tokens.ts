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
