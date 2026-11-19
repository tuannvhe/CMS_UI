import { api } from './client'

/** Thông báo đẩy (PWA) cho thiết bị đang dùng. */
export const pushApi = {
  key: () => api.get<{ enabled: boolean; ready: boolean; publicKey: string | null; devices: number }>('/push/key').then((r) => r.data),
  subscribe: (s: { endpoint: string; p256dh: string; auth: string }) => api.post('/push/subscriptions', s).then(() => undefined),
  unsubscribe: (endpoint: string) => api.delete('/push/subscriptions', { data: { endpoint } }).then(() => undefined),
  test: () => api.post<{ sent: number; failed: number }>('/push/test').then((r) => r.data),
}

const b64ToBytes = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(t + '='.repeat((4 - (t.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
const bytesToB64 = (b: ArrayBuffer | null) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '')

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
/** iPhone / iPad: chỉ nhận thông báo khi đã "Thêm vào Màn hình chính" và mở từ biểu tượng đó (iOS 16.4 trở lên). */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js'))
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

/** Xin quyền, đăng ký với dịch vụ đẩy của trình duyệt và lưu lên máy chủ. Trả về 'denied' nếu người dùng chặn thông báo. */
export async function enablePush(publicKey: string): Promise<'ok' | 'denied'> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const reg = await registration()
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  // Khoá máy chủ đã đổi: huỷ đăng ký cũ rồi đăng ký lại
  const key = b64ToBytes(publicKey)
  if (sub && sub.options.applicationServerKey && bytesToB64(sub.options.applicationServerKey) !== publicKey) { await sub.unsubscribe(); sub = null }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await pushApi.subscribe({ endpoint: sub.endpoint, p256dh: bytesToB64(sub.getKey('p256dh')), auth: bytesToB64(sub.getKey('auth')) })
  return 'ok'
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await pushApi.unsubscribe(sub.endpoint).catch(() => undefined)
  await sub.unsubscribe()
}
