import { api } from './client'

export interface PublicBadge { key: string; level: number; count: number }
export interface EarnedBadge { key: string; level: number }
export interface HonorPerson { employeeId: string; name: string; department: string | null; level: number; avatarUrl: string | null }
export interface HonorGroup { key: string; count: number; people: HonorPerson[] }
export interface HonorBoard { year: number; month: number; people: number; groups: HonorGroup[] }
export interface MyBadgePrefs { ready: boolean; pinned: string | null; hidden: boolean; earned: string[] }

/** Gom các mã cần tra trong cùng một nhịp thành một lần gọi /badges/public (một trang bảng tin có thể có hàng chục tên). */
let pending = new Map<string, ((v: PublicBadge | null) => void)[]>()
let timer: ReturnType<typeof setTimeout> | null = null
function flush() {
  timer = null
  const batch = pending
  pending = new Map()
  const ids = [...batch.keys()]
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200)
    api.get<Record<string, PublicBadge>>('/badges/public', { params: { ids: part.join(',') } })
      .then((r) => {
        const got = new Map(Object.entries(r.data ?? {}).map(([k, v]) => [k.toUpperCase(), v]))
        part.forEach((id) => batch.get(id)?.forEach((cb) => cb(got.get(id.toUpperCase()) ?? null)))
      })
      .catch(() => part.forEach((id) => batch.get(id)?.forEach((cb) => cb(null))))
  }
}

export const badges = {
  /** Huy hiệu cạnh tên của một người (null = chưa có / đã ẩn / lỗi). */
  one: (id: string) => new Promise<PublicBadge | null>((resolve) => {
    const key = id.trim()
    if (!key) { resolve(null); return }
    pending.set(key, [...(pending.get(key) ?? []), resolve])
    if (!timer) timer = setTimeout(flush, 30)
  }),
  person: (id: string) => api.get<{ badges: EarnedBadge[] }>(`/badges/person/${encodeURIComponent(id)}`).then((r) => r.data.badges),
  honor: () => api.get<HonorBoard>('/badges/honor').then((r) => r.data),
  myPrefs: () => api.get<MyBadgePrefs>('/badges/prefs/me').then((r) => r.data),
  saveMyPrefs: (p: { pinned: string | null; hidden: boolean }) => api.put<MyBadgePrefs>('/badges/prefs/me', p).then((r) => r.data),
}
