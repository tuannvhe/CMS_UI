import axios from 'axios'

const TOKEN_KEY = 'cmsvn_token'

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* bỏ qua */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* bỏ qua */ } },
}

export const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    // Token hết hạn / không hợp lệ → về trang đăng nhập
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      tokenStore.clear()
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export interface AppUser {
  userId: string
  fullName: string
  groupId: string
  groupName: string
  email: string
  factoryCode: string
  /** Mã nhân viên gắn với tài khoản (rỗng nếu tài khoản không gắn nhân viên) */
  employeeId: string
  isAdmin: boolean
  /** Thuộc nhóm bảo vệ: được xác nhận người ra / vào cổng */
  isSecurity?: boolean
  /** Khoá các trang KHÔNG được thấy theo menu của nhóm quyền (chưa tải xong = undefined = hiện tất cả) */
  hiddenPages?: string[]
  /** Trang quản trị được cấp riêng cho nhóm của người dùng (người không thuộc nhóm quản trị). */
  grantedPages?: string[]
  /** Đang dùng mật khẩu mặc định (vina + mã nhân viên): phải đổi trước khi dùng hệ thống */
  mustChangePassword?: boolean
}

export interface LoginResponse {
  token: string
  expiresAt: string
  user: AppUser
  mustChangePassword?: boolean
}
