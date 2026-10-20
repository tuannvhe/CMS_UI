import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, type AppUser, type LoginResponse, type OtpChallenge } from '../api/client'
import { accessHidden } from '../api/permissions'
import { avatarApi } from '../api/avatar'

interface AuthState {
  user: AppUser | null
  loading: boolean
  /** Trả về thử thách OTP nếu tài khoản quản trị còn phải nhập mã; không thì đã đăng nhập xong (undefined). */
  login: (userId: string, password: string) => Promise<OtpChallenge | undefined>
  /** Bước 2 của quản trị: nhập mã OTP để nhận phiên. */
  verifyOtp: (code: string) => Promise<void>
  logout: () => void
  /** Đã đổi mật khẩu thành công: bỏ yêu cầu đổi bắt buộc */
  passwordChanged: () => void
  /** Ảnh đại diện vừa đổi / xóa. */
  setAvatarUrl: (url: string | null) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<{ hidden: string[]; granted: string[]; unionPoster?: boolean } | undefined>()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const qc = useQueryClient()

  // Khôi phục phiên khi tải lại trang
  useEffect(() => {
    api.get<AppUser>('/auth/me')   // cookie phiên tự gửi kèm; không có phiên thì 401 và vào trang đăng nhập
      .then((r) => setUser(r.data))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  // Các trang bị ẩn theo menu của nhóm quyền (nếu không tải được thì không ẩn gì: chỉ là ẩn menu, quyền thật nằm ở máy chủ).
  const uid = user?.userId
  useEffect(() => {
    if (!uid) { setAccess(undefined); return }
    let live = true
    accessHidden().then((a) => { if (live) setAccess({ hidden: a.hiddenPages, granted: a.grantedPages ?? [], unionPoster: !!a.unionPoster }) }).catch(() => { if (live) setAccess({ hidden: [], granted: [] }) })
    return () => { live = false }
  }, [uid])

  // Quyền trang có thể đổi bất cứ lúc nào (quản trị bật / tắt trang cho nhóm): tải lại khi quay lại cửa sổ và mỗi 2 phút để menu không dùng quyền cũ tới khi đăng nhập lại.
  useEffect(() => {
    if (!uid) return
    const reload = () => { accessHidden().then((a) => setAccess({ hidden: a.hiddenPages, granted: a.grantedPages ?? [], unionPoster: !!a.unionPoster })).catch(() => undefined) }
    const timer = window.setInterval(reload, 120_000)
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [uid])

  // Ảnh đại diện (không có thì thôi, chỉ hiện chữ cái đầu)
  useEffect(() => {
    if (!uid) { setAvatarUrl(null); return }
    let live = true
    avatarApi.mine().then((u) => { if (live) setAvatarUrl(u) }).catch(() => { /* không có ảnh */ })
    return () => { live = false }
  }, [uid])

  const login = useCallback(async (userId: string, password: string) => {
    const { data } = await api.post<LoginResponse | OtpChallenge>('/auth/login', { userId, password })
    if ('otpRequired' in data) return data
    qc.clear()   // bỏ mọi dữ liệu đã tải của phiên trước: người đăng nhập sau không được thấy dữ liệu của người trước (bộ nhớ đệm không gắn với tài khoản)
    setUser({ ...data.user, mustChangePassword: data.mustChangePassword })
    return undefined
  }, [qc])

  const verifyOtp = useCallback(async (code: string) => {
    const { data } = await api.post<LoginResponse>('/auth/otp/verify', { code })
    qc.clear()
    setUser({ ...data.user, mustChangePassword: data.mustChangePassword })
  }, [qc])

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => undefined)   // máy chủ xóa cookie phiên (JavaScript không xóa được cookie HttpOnly)
    qc.clear()   // xoá bộ nhớ đệm dữ liệu của tài khoản vừa thoát
    setUser(null)
  }, [qc])

  const passwordChanged = useCallback(() => setUser((u) => (u ? { ...u, mustChangePassword: false } : u)), [])

  const shown = useMemo(() => (user ? { ...user, hiddenPages: access?.hidden, grantedPages: access?.granted, unionPoster: access?.unionPoster, avatarUrl } : null), [user, access, avatarUrl])
  const value = useMemo(() => ({ user: shown, loading, login, verifyOtp, logout, passwordChanged, setAvatarUrl }), [shown, loading, login, verifyOtp, logout, passwordChanged])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong AuthProvider')
  return ctx
}
