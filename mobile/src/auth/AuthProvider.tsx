/* 2026-11-23 [Truong] - Mobile app: session state (restore from SecureStore, login + admin OTP, logout)
 * 2026-11-26: đăng nhập bằng vân tay / Face ID — trạng thái "locked" khi mở app hoặc quay lại sau 1 phút ở nền.
 * 2026-11-26: "Ghi nhớ đăng nhập" và "Dùng vân tay / Face ID lần sau" chọn ngay ở màn đăng nhập (thay cho hộp thoại hỏi sau khi đăng nhập);
 *   đã bật vân tay thì đăng xuất / phiên hết hạn vẫn đăng nhập lại được bằng vân tay (bioSignIn, xem bioLogin.ts). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { onSessionLost, errorCode, type AppUser, type MobileTokens } from '../api/client'
import { mobileAuth, type MobileOtpChallenge } from '../api/mobileAuth'
import { tokenStore } from './tokenStore'
import i18n, { loadLanguage } from '../i18n'
import {
  bioAuthenticate, bioLoginEnabled, bioLoginKind, clearBioCred, loadBioCred, loadLastUser, rememberLogin, saveBioCred, saveLastUser,
  setBioLogin, setRememberLogin, type BioKind, type SavedLogin,
} from './bioLogin'

type Status = 'loading' | 'signedOut' | 'locked' | 'signedIn'

/** Ở nền lâu hơn chừng này thì quay lại phải xác thực lại (khi đã bật đăng nhập sinh trắc học). */
const RELOCK_MS = 60_000

/** Lựa chọn ở màn đăng nhập. undefined = giữ nguyên như trước (đăng nhập lại bằng vân tay). */
export interface SignInOptions { remember: boolean; bio: boolean }

interface AuthValue {
  status: Status
  user: AppUser | null
  /** Đăng nhập; trả về thử thách OTP nếu là quản trị đang bật xác thực hai bước. Lỗi: ném lại lỗi axios (dùng errorCode để lấy mã). */
  signIn: (userId: string, password: string, opts?: SignInOptions) => Promise<MobileOtpChallenge | null>
  verifyOtp: (ticket: string, code: string) => Promise<void>
  /** forget = quên luôn tài khoản trên máy (đổi tài khoản): xoá mã đã nhớ và thông tin đăng nhập bằng vân tay. */
  signOut: (forget?: boolean) => Promise<void>
  /** Loại sinh trắc học của máy (null: không có / chưa đăng ký). */
  bioKind: BioKind | null
  /** Đã bật đăng nhập bằng vân tay / Face ID cho tài khoản này trên máy này. */
  bioOn: boolean
  setBioOn: (on: boolean) => Promise<boolean>
  /** Màn khoá: hỏi vân tay / Face ID; đúng thì vào app. */
  unlock: () => Promise<boolean>
  /** Người đăng nhập gần nhất trên máy (điền sẵn mã, lời chào). */
  savedLogin: SavedLogin | null
  /** Có thể đăng nhập bằng vân tay / Face ID khi không còn phiên (đã cất thông tin lúc đăng nhập). */
  bioSignInReady: boolean
  /** Hỏi vân tay rồi đăng nhập bằng thông tin đã cất. 'ok' | 'cancel' | 'otp' (cần mã OTP, trả kèm thử thách) | mã lỗi. */
  bioSignIn: () => Promise<{ result: 'ok' | 'cancel' | 'stale' | string; otp?: MobileOtpChallenge }>
  /** Ghi nhớ đăng nhập (lựa chọn lần trước, mặc định bật). */
  remember: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export const bioLabel = (kind: BioKind | null) => (kind === 'face' ? 'Face ID' : i18n.t('mobile.bioLogin.finger'))

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<AppUser | null>(null)
  const [bioKind, setBioKind] = useState<BioKind | null>(null)
  const [bioOn, setBioOnState] = useState(false)
  const [savedLogin, setSavedLogin] = useState<SavedLogin | null>(null)
  const [bioSignInReady, setBioSignInReady] = useState(false)
  const [remember, setRemember] = useState(true)
  const qc = useQueryClient()
  const bgAt = useRef<number | null>(null)
  const prompting = useRef(false)
  // Lựa chọn + mật khẩu của lần đăng nhập đang chờ OTP (quản trị), áp dụng khi OTP đúng
  const pending = useRef<{ userId: string; password: string; opts?: SignInOptions } | null>(null)

  const lost = useCallback(() => { setUser(null); setStatus('signedOut'); qc.clear() }, [qc])

  useEffect(() => {
    onSessionLost(lost)
    let alive = true
    ;(async () => {
      await loadLanguage()
      const [s, kind, keep, last, cred] = await Promise.all([tokenStore.load(), bioLoginKind(), rememberLogin(), loadLastUser(), loadBioCred()])
      if (!alive) return
      setBioKind(kind)
      setRemember(keep)
      setSavedLogin(last)
      setBioSignInReady(!!kind && !!cred && !!last && cred.userId.toLowerCase() === last.userId.toLowerCase() && await bioLoginEnabled(last.userId))
      // Không ghi nhớ đăng nhập: mở lại app là phải đăng nhập (thu hồi phiên cũ của máy ở máy chủ)
      if (s && !keep) {
        void mobileAuth.logout(s.refreshToken).catch(() => undefined)
        await tokenStore.clear()
        setStatus('signedOut'); return
      }
      // Access token hết hạn thì yêu cầu đầu tiên tự làm mới (client.ts); refresh token hỏng thì onSessionLost đưa về đăng nhập
      if (!s) { setStatus('signedOut'); return }
      const on = !!kind && await bioLoginEnabled(s.user.userId)
      setBioOnState(on)
      setUser(s.user)
      setStatus(on ? 'locked' : 'signedIn')
    })()
    return () => { alive = false; onSessionLost(null) }
  }, [lost])

  // Quay lại app sau một lúc ở nền: khoá lại (chỉ "background"; hộp thoại vân tay chỉ làm app "inactive")
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') { if (!prompting.current) bgAt.current = Date.now(); return }
      if (st === 'active' && bgAt.current != null) {
        const away = Date.now() - bgAt.current
        bgAt.current = null
        if (bioOn && away > RELOCK_MS) setStatus((cur) => (cur === 'signedIn' ? 'locked' : cur))
      }
    })
    return () => sub.remove()
  }, [bioOn])

  const auth = useCallback(async () => {
    prompting.current = true
    try { return await bioAuthenticate(i18n.t('mobile.bioLogin.prompt'), i18n.t('mobile.cancel')) } finally { prompting.current = false }
  }, [])

  /** Áp dụng lựa chọn ở màn đăng nhập sau khi đăng nhập thành công. */
  const applyOptions = useCallback(async (u: AppUser, password: string, opts?: SignInOptions) => {
    const kind = await bioLoginKind()
    setBioKind(kind)
    const last = { userId: u.userId, fullName: u.fullName }
    await saveLastUser(last)
    setSavedLogin(last)
    if (!opts) {   // đăng nhập lại bằng vân tay: giữ nguyên lựa chọn cũ
      setBioOnState(!!kind && await bioLoginEnabled(u.userId))
      return
    }
    await setRememberLogin(opts.remember)
    setRemember(opts.remember)
    if (opts.bio && kind) {
      // Xác nhận đúng người một lần rồi mới cất thông tin (tránh người khác cầm máy bật hộ)
      if (await auth()) {
        await setBioLogin(u.userId, true)
        await saveBioCred(u.userId, password)
        setBioOnState(true); setBioSignInReady(true)
        return
      }
    }
    if (!opts.bio) { await setBioLogin(u.userId, false); await clearBioCred(); setBioOnState(false); setBioSignInReady(false) }
    else setBioOnState(!!kind && await bioLoginEnabled(u.userId))
  }, [auth])

  const accept = useCallback(async (t: MobileTokens, password: string, opts?: SignInOptions) => {
    const old = tokenStore.refresh()
    await tokenStore.save({ accessToken: t.accessToken, accessExpiresAt: t.accessExpiresAt, refreshToken: t.refreshToken, user: t.user })
    // Đăng nhập lại bằng mật khẩu từ màn khoá: thu hồi phiên cũ của máy
    if (old && old !== t.refreshToken) void mobileAuth.logout(old).catch(() => undefined)
    await applyOptions(t.user, password, opts)
    setUser(t.user)
    setStatus('signedIn')
  }, [applyOptions])

  const signIn = useCallback(async (userId: string, password: string, opts?: SignInOptions) => {
    const r = await mobileAuth.login(userId.trim(), password)
    if ('otpRequired' in r) { pending.current = { userId, password, opts }; return r }
    await accept(r, password, opts)
    return null
  }, [accept])

  const verifyOtp = useCallback(async (ticket: string, code: string) => {
    const p = pending.current
    await accept(await mobileAuth.verifyOtp(ticket, code.trim()), p?.password ?? '', p?.password ? p.opts : undefined)
    pending.current = null
  }, [accept])

  const signOut = useCallback(async (forget?: boolean) => {
    const rt = tokenStore.refresh()
    // Thu hồi phía máy chủ (gỡ luôn push token của máy); lỗi mạng vẫn xoá phiên ở máy
    if (rt) await mobileAuth.logout(rt).catch(() => undefined)
    await tokenStore.clear()
    if (forget) {
      await Promise.all([clearBioCred(), saveLastUser(null)])
      setSavedLogin(null); setBioSignInReady(false)
    }
    lost()
  }, [lost])

  const setBioOn = useCallback(async (on: boolean) => {
    if (!user) return false
    if (on && !(await auth())) return false
    await setBioLogin(user.userId, on)
    if (!on) { await clearBioCred(); setBioSignInReady(false) }
    setBioOnState(on)
    return true
  }, [user, auth])

  const unlock = useCallback(async () => {
    if (!(await auth())) return false
    setStatus((cur) => (cur === 'locked' ? 'signedIn' : cur))
    return true
  }, [auth])

  const bioSignIn = useCallback(async (): Promise<{ result: string; otp?: MobileOtpChallenge }> => {
    const cred = await loadBioCred()
    if (!cred) { setBioSignInReady(false); return { result: 'stale' } }
    if (!(await auth())) return { result: 'cancel' }
    try {
      const otp = await signIn(cred.userId, cred.password)
      return otp ? { result: 'otp', otp } : { result: 'ok' }
    } catch (e) {
      const code = errorCode(e)
      // Mật khẩu đã đổi: bỏ thông tin cũ, lần này nhập mật khẩu (tick lại "Dùng vân tay lần sau" để cất mật khẩu mới)
      if (code === 'invalid_credential') { await clearBioCred(); setBioSignInReady(false); return { result: 'stale' } }
      return { result: code }
    }
  }, [auth, signIn])

  const value = useMemo(() => ({ status, user, signIn, verifyOtp, signOut, bioKind, bioOn, setBioOn, unlock, savedLogin, bioSignInReady, bioSignIn, remember }),
    [status, user, signIn, verifyOtp, signOut, bioKind, bioOn, setBioOn, unlock, savedLogin, bioSignInReady, bioSignIn, remember])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
