import axios from 'axios'

// Bản cũ lưu token ở localStorage: xóa đi để không còn token nào nằm lại trong trình duyệt
try { localStorage.removeItem('cmsvn_token') } catch { /* bỏ qua */ }
/**
 * Phiên đăng nhập nằm trong cookie HttpOnly do máy chủ cấp: JavaScript không đọc được token (kể cả khi trang bị chèn mã độc) và không cần lưu token ở localStorage.
 * Yêu cầu ghi kèm tiêu đề X-Requested-With: cmsvn để máy chủ chặn giả mạo yêu cầu chéo trang.
 */
export const api = axios.create({ baseURL: '/api', timeout: 30000, withCredentials: true, headers: { 'X-Requested-With': 'cmsvn' } })

api.interceptors.response.use(
  (r) => r,
  (error) => {
    // Phiên hết hạn / bị thu hồi → về trang đăng nhập (riêng các lời gọi đăng nhập / OTP / kiểm tra phiên ban đầu thì để nơi gọi tự xử lý)
    const url: string = error.config?.url ?? ''
    if (error.response?.status === 401 && !url.includes('/auth/') && window.location.pathname !== '/login') window.location.assign('/login')
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
  /** Đường dẫn ảnh đại diện (null = chưa có ảnh), tải riêng sau khi đăng nhập. */
  avatarUrl?: string | null
  /** Được quản trị cho phép đăng thông báo công đoàn (dù không thuộc nhân sự / quản trị) */
  unionPoster?: boolean
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
  expiresAt: string
  user: AppUser
  mustChangePassword?: boolean
}

/** Quản trị (khi bật OTP): mật khẩu đúng nhưng còn bước nhập mã OTP; otpSetup = lần đầu, kèm khóa / liên kết để quét QR. */
export interface OtpChallenge { otpRequired: true; otpSetup: boolean; otpSecret?: string | null; otpUri?: string | null }
