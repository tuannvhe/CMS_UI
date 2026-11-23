/* 2026-11-23 [Truong] - Mobile app: tokens in SecureStore (Keychain / Android Keystore), cached in memory */
import * as SecureStore from 'expo-secure-store'
import type { AppUser } from '@web/api/client'

const K = { access: 'cms.access', accessExp: 'cms.accessExp', refresh: 'cms.refresh', user: 'cms.user' } as const

export interface StoredSession { accessToken: string; accessExpiresAt: string; refreshToken: string; user: AppUser }

let mem: StoredSession | null = null

export const tokenStore = {
  /** Đọc phiên đã lưu (gọi một lần lúc mở app). */
  async load(): Promise<StoredSession | null> {
    try {
      const [accessToken, accessExpiresAt, refreshToken, user] = await Promise.all([
        SecureStore.getItemAsync(K.access), SecureStore.getItemAsync(K.accessExp), SecureStore.getItemAsync(K.refresh), SecureStore.getItemAsync(K.user),
      ])
      mem = refreshToken && user ? { accessToken: accessToken ?? '', accessExpiresAt: accessExpiresAt ?? '', refreshToken, user: JSON.parse(user) as AppUser } : null
    } catch { mem = null }
    return mem
  },
  current: () => mem,
  access: () => mem?.accessToken || null,
  refresh: () => mem?.refreshToken || null,
  async save(s: StoredSession) {
    mem = s
    await Promise.all([
      SecureStore.setItemAsync(K.access, s.accessToken), SecureStore.setItemAsync(K.accessExp, s.accessExpiresAt),
      SecureStore.setItemAsync(K.refresh, s.refreshToken), SecureStore.setItemAsync(K.user, JSON.stringify(s.user)),
    ])
  },
  async clear() {
    mem = null
    await Promise.all(Object.values(K).map((k) => SecureStore.deleteItemAsync(k).catch(() => undefined)))
  },
}
