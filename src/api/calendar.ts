import { api } from './client'

/** work = đi làm · swap = ngày làm bù · sunday / biweekly / holiday / rest = các loại ngày nghỉ */
export type DayKind = 'work' | 'swap' | 'sunday' | 'biweekly' | 'holiday' | 'rest'
export interface CalendarDay { date: string; kind: DayKind; note: string | null }
export interface MonthCalendar { year: number; month: number; days: CalendarDay[]; workDays: number; offDays: number }

export const calendarApi = {
  month: (year: number, month: number) => api.get<MonthCalendar>('/calendar/month', { params: { year, month } }).then((r) => r.data),
}
