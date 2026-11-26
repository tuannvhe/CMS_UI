import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, type AppUser, type LoginResponse, type OtpChallenge, type Site } from '../api/client'
import { accessHidden } from '../api/permissions'
import { avatarApi } from '../api/avatar'
import { hnApi } from '../api/hn'
import { saveLastAccount } from './lastAccount'
import i18n from '../i18n'

interface AuthState {
  user: AppUser | null
  loading: boolean
  /** Trả về thử thách OTP nếu tài khoản quản trị còn phải nhập mã; không thì đã đăng nhập xong (undefined). */
  login: (userId: string, password: string, site?: Site) => Promise<OtpChallenge | undefined>
  /** Bước 2 của quản trị: nhập mã OTP để nhận phiên. */
  verifyOtp: (code: string) => Promise<void>
  logout: () => void
  /** Đã đổi mật khẩu thành công: bỏ yêu cầu đổi bắt buộc */
  passwordChanged: () => void
  /** Ảnh đại diện vừa đổi / xóa. */
  setAvatarUrl: (url: string | null, own?: boolean) => void
}

const AuthContext = createContext<AuthState | null>(null)

/** Mỗi lần đăng nhập: bỏ cờ "Để sau" của hộp nhắc bật thông báo (PushRequiredGate) để nhắc lại nếu trình duyệt chưa bật. */
const clearPushSkip = () => { try { sessionStorage.removeItem('cmsvn.pushPromptSkip') } catch { /* bỏ qua */ } }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<{ hidden: string[]; granted: string[]; unionPoster?: boolean; ehsPoster?: boolean; ehsLead?: boolean; announcementPoster?: boolean; community?: boolean } | undefined>()
  const [avatar, setAvatar] = useState<{ url: string | null; own: boolean }>({ url: null, own: false })
  const avatarUrl = avatar.url
  const setAvatarUrl = useCallback((url: string | null, own = true) => setAvatar({ url, own: own && !!url }), [])
  const qc = useQueryClient()

  // Khôi phục phiên khi tải lại trang
  useEffect(() => {
    api.get<AppUser>('/auth/me')   // cookie phiên tự gửi kèm; không có phiên thì 401 và vào trang đăng nhập
      .then((r) => setUser(r.data))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  // Gửi ngôn ngữ giao diện lên máy chủ (khi đăng nhập và mỗi lần đổi) để chuông / mail tuyển dụng gửi người này theo đúng thứ tiếng
  useEffect(() => {
    if (!user?.userId || user.site === 'HN') return
    const push = (l: string) => { api.put('/me/lang', { lang: l }).catch(() => undefined) }
    push(i18n.language)
    i18n.on('languageChanged', push)
    return () => { i18n.off('languageChanged', push) }
  }, [user?.userId, user?.site])

  // Các trang bị ẩn theo menu của nhóm quyền (nếu không tải được thì không ẩn gì: chỉ là ẩn menu, quyền thật nằm ở máy chủ).
  const uid = user?.userId
  const isHn = user?.site === 'HN'   // cơ sở Hà Nội: các API này viết cho CSDL VINA, máy chủ trả 403 nên không gọi
  useEffect(() => {
    if (!uid || isHn) { setAccess(undefined); return }
    let live = true
    accessHidden().then((a) => { if (live) setAccess({ hidden: a.hiddenPages, granted: a.grantedPages ?? [], unionPoster: !!a.unionPoster, ehsPoster: !!a.ehsPoster, ehsLead: !!a.ehsLead, announcementPoster: !!a.announcementPoster, community: !!a.community }) }).catch(() => { if (live) setAccess({ hidden: [], granted: [] }) })
    return () => { live = false }
  }, [uid, isHn])

  // Quyền trang có thể đổi bất cứ lúc nào (quản trị bật / tắt trang cho nhóm): tải lại khi quay lại cửa sổ và mỗi 2 phút để menu không dùng quyền cũ tới khi đăng nhập lại.
  useEffect(() => {
    if (!uid || isHn) return
    const reload = () => { accessHidden().then((a) => setAccess({ hidden: a.hiddenPages, granted: a.grantedPages ?? [], unionPoster: !!a.unionPoster, ehsPoster: !!a.ehsPoster, ehsLead: !!a.ehsLead, announcementPoster: !!a.announcementPoster, community: !!a.community })).catch(() => undefined) }
    const timer = window.setInterval(reload, 120_000)
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [uid, isHn])

  // Cơ sở HN: quyền xem từng module lấy từ /api/hn/me (lỗi thì coi như chưa có quyền nào; menu chỉ ẩn, quyền thật nằm ở máy chủ). Tải lại khi quay lại cửa sổ và mỗi 5 phút.
  const [hnModules, setHnModules] = useState<string[] | undefined>()
  useEffect(() => {
    if (!uid || !isHn) { setHnModules(undefined); return }
    let live = true
    const load = () => { hnApi.me().then((m) => { if (live) setHnModules(m.permissions.filter((p) => p.view).map((p) => p.module)) }).catch(() => { if (live) setHnModules((old) => old ?? []) }) }
    load()
    const timer = window.setInterval(load, 300_000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { live = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [uid, isHn])

  // Ảnh đại diện (không có thì thôi, chỉ hiện chữ cái đầu)
  useEffect(() => {
    if (!uid || isHn) { setAvatar({ url: null, own: false }); return }
    let live = true
    avatarApi.mine().then((a) => { if (live) setAvatar(a) }).catch(() => { /* không có ảnh */ })
    return () => { live = false }
  }, [uid, isHn])

  // Nhớ người đăng nhập gần nhất cho màn đăng nhập (mã, tên, ảnh); đăng xuất vẫn giữ, chỉ "Chuyển tài khoản" mới xoá.
  const fullName = user?.fullName
  useEffect(() => {
    if (uid) saveLastAccount({ userId: uid, fullName: fullName ?? '', avatarUrl })
  }, [uid, fullName, avatarUrl])

  const login = useCallback(async (userId: string, password: string, site?: Site) => {
    const { data } = await api.post<LoginResponse | OtpChallenge>('/auth/login', { userId, password, site })
    if ('otpRequired' in data) return data
    clearPushSkip()
    qc.clear()   // bỏ mọi dữ liệu đã tải của phiên trước: người đăng nhập sau không được thấy dữ liệu của người trước (bộ nhớ đệm không gắn với tài khoản)
    setUser({ ...data.user, mustChangePassword: data.mustChangePassword })
    return undefined
  }, [qc])

  const verifyOtp = useCallback(async (code: string) => {
    const { data } = await api.post<LoginResponse>('/auth/otp/verify', { code })
    clearPushSkip()
    qc.clear()
    setUser({ ...data.user, mustChangePassword: data.mustChangePassword })
  }, [qc])

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => undefined)   // máy chủ xóa cookie phiên (JavaScript không xóa được cookie HttpOnly)
    qc.clear()   // xoá bộ nhớ đệm dữ liệu của tài khoản vừa thoát
    setUser(null)
  }, [qc])

  const passwordChanged = useCallback(() => setUser((u) => (u ? { ...u, mustChangePassword: false } : u)), [])

  const shown = useMemo(() => (user ? { ...user, hiddenPages: access?.hidden, grantedPages: access?.granted, unionPoster: access?.unionPoster, ehsPoster: access?.ehsPoster, ehsLead: access?.ehsLead, announcementPoster: access?.announcementPoster, community: access?.community, avatarUrl, avatarOwn: avatar.own, hnModules } : null), [user, access, avatarUrl, avatar.own, hnModules])
  const value = useMemo(() => ({ user: shown, loading, login, verifyOtp, logout, passwordChanged, setAvatarUrl }), [shown, loading, login, verifyOtp, logout, passwordChanged, setAvatarUrl])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong AuthProvider')
  return ctx
}
