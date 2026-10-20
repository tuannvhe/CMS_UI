import { api } from './client'

/** Nhóm quyền của hệ thống cũ (chỉ đọc); customized = số trang đã cấu hình riêng cho hệ thống mới. */
export interface GroupInfo { groupId: string; name: string; nameVi: string; nameKo: string; active: boolean; sort: number; users: number; customized: number }

/** Quyền vào một trang của hệ thống mới: default theo menu cũ (chỉ đọc), override là cấu hình riêng (null = theo mặc định). */
export interface PageAccess { key: string; legacyPages: string[]; default: boolean; override: boolean | null; allowed: boolean; approval: boolean; admin: boolean }
export interface GroupAccess { group: GroupInfo; pages: PageAccess[] }

const base = '/admin/permissions'
const g = (id: string) => `${base}/groups/${encodeURIComponent(id)}`

export const permissions = {
  groups: () => api.get<GroupInfo[]>(`${base}/groups`).then((r) => r.data),
  access: (id: string) => api.get<GroupAccess>(`${g(id)}/access`).then((r) => r.data),
  save: (id: string, pages: Record<string, boolean>) => api.put(`${g(id)}/access`, { pages }).then(() => undefined),
  reset: (id: string) => api.post(`${g(id)}/access/reset`).then(() => undefined),
}

/** Các trang mới người đăng nhập KHÔNG được thấy. */
export const accessHidden = () => api.get<{ hiddenPages: string[]; grantedPages?: string[]; unionPoster?: boolean; ehsPoster?: boolean; ehsLead?: boolean }>('/auth/access').then((r) => r.data)
