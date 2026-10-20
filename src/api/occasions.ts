import { api } from './client'

export interface OccasionText { vi: string; en?: string | null; ko?: string | null }
export interface OccasionBackground { kind: 'none' | 'gradient' | 'image'; color1?: string | null; color2?: string | null; angle: number; imageUrl?: string | null; veil: number }
export interface OccasionPost { enabled: boolean; type?: string | null; title?: string | null; html?: string | null }
export interface OccasionOverride { title?: OccasionText | null; sub?: OccasionText | null; background?: OccasionBackground | null; post?: OccasionPost | null }
export interface CustomOccasion {
  id: string; name: string; enabled: boolean; ranges: { from: string; to: string }[]; emoji: string[]; primary: string; accent: string
  title: OccasionText; sub: OccasionText; background?: OccasionBackground | null; post?: OccasionPost | null
}
export interface OccasionSettings { custom: CustomOccasion[]; disabledBuiltins: string[]; overrides: Record<string, OccasionOverride>; posted: string[] }

export const EMPTY_OCCASIONS: OccasionSettings = { custom: [], disabledBuiltins: [], overrides: {}, posted: [] }

/** Cấu hình dịp lễ dùng chung (đọc không cần đăng nhập vì màn đăng nhập cũng đổi giao diện theo dịp). */
export const occasionsApi = {
  get: () => api.get<OccasionSettings>('/occasions').then((r) => ({ ...EMPTY_OCCASIONS, ...r.data })),
  save: (b: OccasionSettings) => api.put<OccasionSettings>('/admin/occasions', b).then((r) => ({ ...EMPTY_OCCASIONS, ...r.data })),
  /** Tải một ảnh nền; trả về đường dẫn ảnh. */
  uploadImage: (file: File) => {
    const f = new FormData()
    f.append('files', file)
    return api.post<{ urls: string[] }>('/admin/occasions/images', f, { timeout: 120000 }).then((r) => r.data.urls[0])
  },
}
