import type { Dayjs } from 'dayjs'

export const fmtDate = (d: Dayjs) => d.format('YYYY-MM-DD')
export const num = (v: number | null | undefined) => (v == null ? '' : Number(v.toFixed(2)).toString())

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Monday" (giá trị DAYINWEEK trong DB) → tên thứ theo ngôn ngữ đang chọn. */
export function localDayName(englishName: string, lang: string) {
  const i = EN_DAYS.indexOf(englishName)
  return i < 0 ? englishName : new Date(2024, 0, 7 + i).toLocaleDateString(lang, { weekday: 'long' })
}
