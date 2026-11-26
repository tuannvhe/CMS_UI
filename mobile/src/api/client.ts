/*
 * 2026-11-23 [Truong] - Mobile app: replacement for CMS_UI/src/api/client.ts
 * metro.config.js redirects the web modules' "./client" import here, so every web API module (attendance, requests, approvals, payslip…)
 * runs unchanged with Bearer tokens instead of browser cookies. Keep the same export names as the web client.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import i18n from '../i18n'
import { tokenStore } from '../auth/tokenStore'
import type { AppUser } from '@web/api/client'

export type { Site, AppUser, LoginResponse, OtpChallenge } from '@web/api/client'

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '')

export const api = axios.create({ baseURL: API_URL, timeout: 30000 })

/** Kết quả đăng nhập / làm mới của app (POST /mobile/auth/*). */
export interface MobileTokens {
  accessToken: string; accessExpiresAt: string; refreshToken: string; refreshExpiresAt: string; user: AppUser; mustChangePassword: boolean
}

let sessionLost: (() => void) | null = null
/** AuthProvider đăng ký: refresh token hết hạn / bị thu hồi thì về màn đăng nhập. */
export const onSessionLost = (fn: (() => void) | null) => { sessionLost = fn }

api.interceptors.request.use((config) => {
  config.headers.set('X-Lang', (i18n.language || 'vi').slice(0, 2))
  const token = tokenStore.access()
  if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

/** Một lần làm mới dùng chung cho mọi yêu cầu bị 401 cùng lúc (refresh token xoay vòng: gửi hai lần thì lần sau bị từ chối). */
let refreshing: Promise<boolean> | null = null

async function refreshOnce(): Promise<boolean> {
  const rt = tokenStore.refresh()
  if (!rt) return false
  try {
    const r = await axios.post<MobileTokens>(`${API_URL}/mobile/auth/refresh`, { refreshToken: rt }, { timeout: 30000 })
    await tokenStore.save({ accessToken: r.data.accessToken, accessExpiresAt: r.data.accessExpiresAt, refreshToken: r.data.refreshToken, user: r.data.user })
    return true
  } catch (e) {
    // Lỗi mạng: giữ phiên, lần sau thử lại. Máy chủ từ chối (401 / 403): phiên không còn dùng được.
    const status = (e as AxiosError).response?.status
    if (status === 401 || status === 403) {
      await tokenStore.clear()
      sessionLost?.()
    }
    return false
  }
}

/** 2026-11-26: access token còn hạn (làm mới trước nếu sắp hết) cho kênh realtime SignalR, vốn không đi qua axios. */
export async function freshAccessToken(): Promise<string> {
  const exp = Date.parse(tokenStore.current()?.accessExpiresAt ?? '')
  if (tokenStore.refresh() && (!tokenStore.access() || !Number.isFinite(exp) || exp - Date.now() < 60_000)) {
    refreshing ??= refreshOnce().finally(() => { refreshing = null })
    await refreshing
  }
  return tokenStore.access() ?? ''
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const config = error.config as Retriable | undefined
    const url = config?.url ?? ''
    if (error.response?.status === 401 && config && !config._retried && !url.includes('/mobile/auth/') && tokenStore.refresh()) {
      refreshing ??= refreshOnce().finally(() => { refreshing = null })
      if (await refreshing) {
        config._retried = true
        config.headers.set('Authorization', `Bearer ${tokenStore.access()}`)
        return api.request(config)
      }
    }
    return Promise.reject(error)
  },
)

/** 2026-11-26: đường dẫn ảnh máy chủ trả về dạng /api/... (ảnh đại diện, ảnh hỏi đáp) → địa chỉ đầy đủ cho <Image>. */
export const absUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `${API_URL.replace(/\/api$/, '')}${u.startsWith('/') ? '' : '/'}${u}`)

/** Mã lỗi máy chủ (title của ProblemDetails) hoặc "network" khi không tới được máy chủ. */
export function errorCode(e: unknown): string {
  const ax = e as AxiosError<{ title?: string }>
  if (ax?.isAxiosError && !ax.response) return 'network'
  return ax?.response?.data?.title ?? 'generic'
}
