import dayjs from 'dayjs'

const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

/** Giá trị rỗng: null, chuỗi trắng. (Số 0 và false không phải rỗng.) */
export const isEmptyCell = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')

/** Hiển thị an toàn một ô lấy từ nguồn: ngày / giờ ISO -> dd/MM/yyyy [HH:mm]; chuỗi khác giữ nguyên; kiểu lạ -> chuỗi. */
export function fmtCell(v: unknown): string {
  if (isEmptyCell(v)) return ''
  if (typeof v === 'string') {
    const s = v.trim()
    if (ISO.test(s)) {
      const d = dayjs(s)
      if (d.isValid()) return s.length > 10 && (d.hour() || d.minute() || d.second()) ? d.format('DD/MM/YYYY HH:mm') : d.format('DD/MM/YYYY')
    }
    return v
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v) } catch { return String(v) }
}

/** Lấy giá trị theo tên cột không phân biệt hoa thường. */
export function cell(row: Record<string, unknown>, name: string): unknown {
  if (name in row) return row[name]
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase())
  return k ? row[k] : undefined
}

/** Các cột (khoá JSON) theo thứ tự xuất hiện đầu tiên, bỏ cột rỗng ở mọi dòng; `first` được đưa lên đầu, `skip` bị bỏ. */
export function visibleColumns(rows: Record<string, unknown>[], first: string[] = [], skip: string[] = []): string[] {
  const order: string[] = []
  const seen = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); order.push(k) }
  const lower = (a: string[]) => a.map((x) => x.toLowerCase())
  const f = lower(first), sk = new Set(lower(skip))
  const used = order.filter((k) => !sk.has(k.toLowerCase()) && rows.some((r) => !isEmptyCell(r[k])))
  return [...f.flatMap((x) => used.filter((k) => k.toLowerCase() === x)), ...used.filter((k) => !f.includes(k.toLowerCase()))]
}

/* 2026-11-24 [Truong] - HN timework sheet route: "10/2026" <-> "10-2026" (a slash cannot sit inside one URL segment) */
export const periodToSlug = (p: string) => p.trim().replace('/', '-')
export const slugToPeriod = (s?: string) => (s ?? '').replace('-', '/')
