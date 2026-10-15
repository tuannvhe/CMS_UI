import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, tokenStore, type AppUser, type LoginResponse } from '../api/client'
import { accessHidden } from '../api/permissions'

interface AuthState {
  user: AppUser | null
  loading: boolean
  login: (userId: string, password: string) => Promise<void>
  logout: () => void
  /** Đã đổi mật khẩu thành công: bỏ yêu cầu đổi bắt buộc */
  passwordChanged: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<{ hidden: string[]; granted: string[] } | undefined>()
  const qc = useQueryClient()

  // Khôi phục phiên khi tải lại trang
  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return }
    api.get<AppUser>('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  // Các trang bị ẩn theo menu của nhóm quyền (nếu không tải được thì không ẩn gì: chỉ là ẩn menu, quyền thật nằm ở máy chủ).
  const uid = user?.userId
  useEffect(() => {
    if (!uid) { setAccess(undefined); return }
    let live = true
    accessHidden().then((a) => { if (live) setAccess({ hidden: a.hiddenPages, granted: a.grantedPages ?? [] }) }).catch(() => { if (live) setAccess({ hidden: [], granted: [] }) })
    return () => { live = false }
  }, [uid])

  const login = useCallback(async (userId: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { userId, password })
    qc.clear()   // bỏ mọi dữ liệu đã tải của phiên trước: người đăng nhập sau không được thấy dữ liệu của người trước (bộ nhớ đệm không gắn với tài khoản)
    tokenStore.set(data.token)
    setUser({ ...data.user, mustChangePassword: data.mustChangePassword })
  }, [qc])

  const logout = useCallback(() => {
    tokenStore.clear()
    qc.clear()   // xoá bộ nhớ đệm dữ liệu của tài khoản vừa thoát
    setUser(null)
  }, [qc])

  const passwordChanged = useCallback(() => setUser((u) => (u ? { ...u, mustChangePassword: false } : u)), [])

  const shown = useMemo(() => (user ? { ...user, hiddenPages: access?.hidden, grantedPages: access?.granted } : null), [user, access])
  const value = useMemo(() => ({ user: shown, loading, login, logout, passwordChanged }), [shown, loading, login, logout, passwordChanged])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong AuthProvider')
  return ctx
}
