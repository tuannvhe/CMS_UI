import { api } from './client'

/** Thông tin thêm của ứng viên hiện trên bảng (ngày dạng yyyy-MM-dd). */
export interface GridProfile { gender: 'male' | 'female' | 'other' | null; address: string | null; major: string | null; languages: string | null; availableFrom: string | null; birthDate: string | null }

/** Các ô sửa được trên bảng. expMonths tính theo tháng; ngày dạng yyyy-MM-dd. */
export type GridField = 'fullName' | 'phone' | 'email' | 'department' | 'position' | 'factory' | 'note'
  | 'birthYear' | 'expMonths' | 'education'
  | 'gender' | 'birthDate' | 'address' | 'major' | 'languages' | 'availableFrom'
export type GridValue = string | number | null
export type GridChanges = Partial<Record<GridField, GridValue>>

/** Trạng thái hàng đợi đọc CV bằng AI (trong bộ nhớ máy chủ). */
export interface CvQueueStatus {
  ai: boolean
  waiting: { id: number; step: 'read' | 'ko' }[]
  current: { id: number; step: 'read' | 'prepare' | 'ko'; seconds: number } | null
  recent: Record<string, { result: 'ai' | 'skip' | 'error'; at: string }>
}

export const recruitGrid = {
  profiles: (ids: number[]) => api.post<Record<string, GridProfile>>('/admin/recruit/grid/profiles', { ids }).then((r) => r.data),
  /** Lưu một lần mọi hồ sơ đã sửa; chỉ gửi các ô đã đổi. */
  save: (rows: { id: number; changes: GridChanges }[]) =>
    api.post<{ saved: number[]; failed: { id: number; reason: string }[] }>('/admin/recruit/grid/save', { rows }).then((r) => r.data),
  cvStatus: () => api.get<CvQueueStatus>('/admin/recruit/grid/cv-status').then((r) => r.data),
}
