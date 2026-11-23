/* 2026-11-23 [Truong] - Mobile app: /api/mobile endpoints (login, OTP, logout, push token) */
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { api, type MobileTokens } from './client'

/** Quản trị bật OTP: bước 2 cần vé này (5 phút). */
export interface MobileOtpChallenge { otpRequired: true; otpSetup: boolean; ticket: string }

const device = () => ({
  platform: Platform.OS,
  deviceName: Device.modelName ?? Device.deviceName ?? null,
  appVersion: Constants.expoConfig?.version ?? null,
})

export const mobileAuth = {
  login: (userId: string, password: string) =>
    api.post<MobileTokens | MobileOtpChallenge>('/mobile/auth/login', { userId, password, ...device() }).then((r) => r.data),
  verifyOtp: (ticket: string, code: string) =>
    api.post<MobileTokens>('/mobile/auth/otp/verify', { ticket, code, ...device() }).then((r) => r.data),
  logout: (refreshToken: string) => api.post('/mobile/auth/logout', { refreshToken }).then(() => undefined),
  /** Gắn Expo push token cho máy đang đăng nhập (rỗng = gỡ). */
  setPushToken: (pushToken: string | null) => api.put('/mobile/push', { pushToken }).then(() => undefined),
}
