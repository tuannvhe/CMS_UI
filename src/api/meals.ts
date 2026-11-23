import { api } from './client'

export type MealCode = 'breakfast' | 'lunch' | 'dinner' | 'night' | 'overtime'
export type MealSite = 'BN' | 'HY'
export type MealGroup = 'ALL' | 'OP' | 'STAFF'
/** Bữa của chế độ tự đếm (màn Tổng suất ăn). */
export const MEAL_CODES: MealCode[] = ['breakfast', 'lunch', 'dinner', 'night']
/** 5 trường đăng ký số lượng: trưa, chiều, đêm, tăng ca của ngày D và bữa sáng ngày D+1. */
export const MEAL_ORDER_CODES: MealCode[] = ['lunch', 'dinner', 'night', 'overtime', 'breakfast']
export const MEAL_SITES: MealSite[] = ['BN', 'HY']
/** Nhóm của từng bữa: mọi bữa gộp một nhóm (Hưng Yên bỏ chia OP / Staff từ 26/10; OP / STAFF chỉ còn ở dữ liệu cũ). */
export const mealGroups = (site: MealSite, meal: MealCode): MealGroup[] => { void site; void meal; return ['ALL'] }

export interface MealCount {
  mealDate: string; site: MealSite; mealCode: MealCode; groupCode: MealGroup; serveTime: string; sendSlot: number; autoQty: number
  detail: string | null; computedAt: string; sentAt: string | null
}
export interface MealAdjust { id: number; mealDate: string; site: MealSite; mealCode: MealCode; groupCode: MealGroup; qty: number; note: string | null; createdBy: string; createdAt: string }
export interface MealBoard { date: string; mode: 'manual' | 'auto'; counts: MealCount[]; adjusts: MealAdjust[]; orders: MealOrder[] }
export interface MealDetail { sources?: Record<string, number>; departments?: { department: string; qty: number }[]; serve?: string }
export interface MealAdjustInput { date: string; site: MealSite; meal: MealCode; group: MealGroup; qty: number; note?: string }

export const parseMealDetail = (s: string | null): MealDetail => { try { return s ? (JSON.parse(s) as MealDetail) : {} } catch { return {} } }

export const meals = {
  board: (date: string) => api.get<MealBoard>('/admin/meals', { params: { date } }).then((r) => r.data),
  recount: (date: string, meal: MealCode, send: boolean) => api.post('/admin/meals/recount', { date, meal, send }).then(() => undefined),
  addAdjust: (b: MealAdjustInput) => api.post<{ id: number }>('/admin/meals/adjust', b).then((r) => r.data),
  removeAdjust: (id: number) => api.delete(`/admin/meals/adjust/${id}`).then(() => undefined),
}

export type MealOrderStatus = 'approved' | 'pending' | 'rejected'
export const MEAL_STATUS_COLOR: Record<MealOrderStatus, string> = { approved: 'green', pending: 'orange', rejected: 'red' }
export interface MealOrder {
  id: number; date: string; meal: MealCode; site: MealSite; group: MealGroup; qty: number; department: string | null; note: string | null
  status: MealOrderStatus; late: boolean; registeredBy: string; registeredByName: string | null; createdAt: string
  decidedBy: string | null; decidedAt: string | null; rejectReason: string | null
  /** Dòng xin sửa (cancel = false) / xin huỷ (cancel = true) đăng ký số replacesId sau giờ khoá, chờ duyệt. */
  replacesId: number | null; cancel: boolean
}
export interface MealOrderInput { date: string; meal: MealCode; site: MealSite; group?: MealGroup; department?: string; qty: number; note?: string }
export interface MealOrderChange { qty: number; note?: string | null; department?: string | null }
export interface MealRegisterMe { canRegister: boolean; approver: boolean; defaultSite: MealSite; department: string | null; today: string; now: string; lockTime: string }

/** Giờ khoá đăng ký: trưa / tối / khuya khoá lúc lockTime (9h) cùng ngày, bữa sáng khoá lúc lockTime ngày hôm trước. */
export const mealLockAt = (me: MealRegisterMe, date: string, meal: MealCode) => {
  const [h, m] = (me.lockTime || '09:00').split(':').map(Number)
  const at = new Date(`${date.slice(0, 10)}T00:00:00`)
  if (meal === 'breakfast') at.setDate(at.getDate() - 1)
  at.setHours(h || 0, m || 0, 0, 0)
  return at
}
/** Bữa đã qua giờ khoá (giờ máy khách ≈ giờ Việt Nam; máy chủ kiểm tra lại). */
export const mealLocked = (me: MealRegisterMe, date: string, meal: MealCode) => Date.now() >= mealLockAt(me, date, meal).getTime()

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** Đăng ký số lượng suất ăn: nhóm "Người dùng" và nhân sự; quá giờ khoá thì chờ nhân sự duyệt. */
export const mealRegister = {
  me: () => api.get<MealRegisterMe>('/meals/register/me').then((r) => r.data),
  /** Đăng ký trong khoảng ngày: người duyệt thấy tất cả, người khác chỉ thấy của mình. */
  list: (from: string, to: string) => api.get<MealOrder[]>('/meals/register', { params: { from, to } }).then((r) => r.data),
  exportXlsx: async (from: string, to: string) =>
    saveBlob(await api.get<Blob>('/meals/register/export', { params: { from, to }, responseType: 'blob', timeout: 120000 }), `DangKySuatAn_${from}_${to}.xlsx`),
  add: (b: MealOrderInput) => api.post<{ id: number; status: MealOrderStatus }>('/meals/register', b).then((r) => r.data),
  /** status = 'pending' khi sửa đăng ký đã tính sau giờ khoá (thành dòng xin sửa chờ duyệt). */
  update: (id: number, b: MealOrderChange) => api.put<{ status: string }>(`/meals/register/${id}`, b).then((r) => r.data),
  /** status = 'pending' khi huỷ đăng ký đã tính sau giờ khoá (thành dòng xin huỷ chờ duyệt), 'deleted' khi xoá hẳn. */
  remove: (id: number) => api.delete<{ status: string }>(`/meals/register/${id}`).then((r) => r.data),
  /** Bộ phận không được đăng ký theo khoảng ngày; rỗng = chưa cấu hình (dùng mặc định theo tên). */
  rangeExcluded: () => api.get<string[]>('/meals/register/range-excluded').then((r) => r.data),
  setRangeExcluded: (departments: string[]) => api.put<string[]>('/meals/register/range-excluded', { departments }).then((r) => r.data),
  pending: () => api.get<MealOrder[]>('/admin/meals/pending').then((r) => r.data),
  decide: (ids: number[], approve: boolean, reason?: string) => api.post<{ done: number }>('/admin/meals/pending/decide', { ids, approve, reason }).then((r) => r.data),
}
