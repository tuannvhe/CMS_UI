import { api } from './client'

export const online = {
  get: () => api.get<{ online: number; windowMinutes: number }>('/online').then((r) => r.data),
}
