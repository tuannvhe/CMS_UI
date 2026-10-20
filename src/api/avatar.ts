import { api } from './client'

export const AVATAR_MAX = 5 * 1024 * 1024

export const avatarApi = {
  mine: () => api.get<{ url: string | null }>('/avatar/me').then((r) => r.data.url),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ url: string | null }>('/avatar', fd, { timeout: 120000 }).then((r) => r.data.url)
  },
  remove: () => api.delete('/avatar').then(() => undefined),
}
