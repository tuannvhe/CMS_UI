import { api } from './client'

export interface BirthdayPerson { employeeId: string; name: string; department: string | null; day: number; month: number; daysAhead: number; avatarUrl: string | null }

export const birthdays = {
  get: () => api.get<{ today: BirthdayPerson[]; upcoming: BirthdayPerson[] }>('/birthdays').then((r) => r.data),
}
