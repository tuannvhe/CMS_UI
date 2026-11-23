/* 2026-11-23 [Truong] - Mobile app: register Expo push token, route notification taps to the matching tab */
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import type { Href } from 'expo-router'
import { mobileAuth } from './api/mobileAuth'

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

/**
 * Xin quyền, lấy Expo push token và gửi lên máy chủ. Không ném lỗi: máy ảo, Expo Go (Android không nhận push từ SDK 53),
 * chưa có projectId (chưa chạy `eas init`) hoặc người dùng từ chối quyền thì bỏ qua, app vẫn dùng bình thường.
 */
export async function registerPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'CMS', importance: Notifications.AndroidImportance.HIGH })
    }
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
    if (status !== 'granted') return null
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) return null
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    await mobileAuth.setPushToken(data)
    return data
  } catch (e) {
    console.warn('registerPush', e)
    return null
  }
}

/** Đường dẫn trong thông báo (link của web, ví dụ /approvals/overtime, /payslip) → tab của app. */
export function tabForLink(link: unknown): Href {
  const l = typeof link === 'string' ? link : ''
  if (l.startsWith('/approvals')) {
    // /approvals/<loại>?group=<mã lô> (Notifier): mở đúng loại đơn và đưa lô đó lên đầu
    const m = /^\/approvals\/([a-z]+)(?:\?group=([^&#]+))?/.exec(l)
    if (!m) return '/approvals'
    return { pathname: '/approvals', params: { kind: m[1], ...(m[2] ? { group: decodeURIComponent(m[2]) } : {}) } }
  }
  if (l.startsWith('/payslip')) return '/payslip'
  if (l.startsWith('/requests') || l.startsWith('/leave')) return '/requests'
  if (l.startsWith('/attendance')) return '/'
  return '/notifications'
}
