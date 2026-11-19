import { api } from './client'

export const AVATAR_MAX = 5 * 1024 * 1024

export const avatarApi = {
  /** own = ảnh tự tải; false = chưa tự tải, url là ảnh dự phòng (nhân sự tải / hệ thống cũ) hoặc null */
  mine: () => api.get<{ url: string | null; own?: boolean }>('/avatar/me').then((r) => ({ url: r.data.url, own: !!r.data.own })),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ url: string | null }>('/avatar', fd, { timeout: 120000 }).then((r) => r.data.url)
  },
  /** Trả về ảnh dự phòng còn lại sau khi xoá (null = không có) */
  remove: () => api.delete<{ url: string | null } | ''>('/avatar').then((r) => (r.data && typeof r.data === 'object' ? r.data.url : null)),
}
