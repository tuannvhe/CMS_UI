/* 2026-11-23 [Truong] - Mobile app: session state (restore from SecureStore, login + admin OTP, logout) */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onSessionLost, type AppUser, type MobileTokens } from '../api/client'
import { mobileAuth, type MobileOtpChallenge } from '../api/mobileAuth'
import { tokenStore } from './tokenStore'
import { loadLanguage } from '../i18n'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthValue {
  status: Status
  user: AppUser | null
  /** Đăng nhập; trả về thử thách OTP nếu là quản trị đang bật xác thực hai bước. Lỗi: ném lại lỗi axios (dùng errorCode để lấy mã). */
  signIn: (userId: string, password: string) => Promise<MobileOtpChallenge | null>
  verifyOtp: (ticket: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<AppUser | null>(null)
  const qc = useQueryClient()

  const lost = useCallback(() => { setUser(null); setStatus('signedOut'); qc.clear() }, [qc])

  useEffect(() => {
    onSessionLost(lost)
    let alive = true
    ;(async () => {
      await loadLanguage()
      const s = await tokenStore.load()
      if (!alive) return
      // Access token hết hạn thì yêu cầu đầu tiên tự làm mới (client.ts); refresh token hỏng thì onSessionLost đưa về đăng nhập
      if (s) { setUser(s.user); setStatus('signedIn') } else setStatus('signedOut')
    })()
    return () => { alive = false; onSessionLost(null) }
  }, [lost])

  const accept = useCallback(async (t: MobileTokens) => {
    await tokenStore.save({ accessToken: t.accessToken, accessExpiresAt: t.accessExpiresAt, refreshToken: t.refreshToken, user: t.user })
    setUser(t.user)
    setStatus('signedIn')
  }, [])

  const signIn = useCallback(async (userId: string, password: string) => {
    const r = await mobileAuth.login(userId.trim(), password)
    if ('otpRequired' in r) return r
    await accept(r)
    return null
  }, [accept])

  const verifyOtp = useCallback(async (ticket: string, code: string) => { await accept(await mobileAuth.verifyOtp(ticket, code.trim())) }, [accept])

  const signOut = useCallback(async () => {
    const rt = tokenStore.refresh()
    // Thu hồi phía máy chủ (gỡ luôn push token của máy); lỗi mạng vẫn xoá phiên ở máy
    if (rt) await mobileAuth.logout(rt).catch(() => undefined)
    await tokenStore.clear()
    lost()
  }, [lost])

  const value = useMemo(() => ({ status, user, signIn, verifyOtp, signOut }), [status, user, signIn, verifyOtp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
