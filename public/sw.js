// Service worker: cài được như ứng dụng và nhận thông báo đẩy. Cố ý KHÔNG lưu cache: dữ liệu chấm công / đơn từ luôn phải lấy mới từ máy chủ,
// và mỗi lần triển khai bản mới người dùng không bị kẹt bản cũ.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

// Thông báo đẩy từ máy chủ: { title, body, link, tag }. Đang mở và nhìn thấy trang CMS thì không hiện thêm (chuông trong trang đã báo).
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { title: 'CMS', body: e.data ? e.data.text() : '' } }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (data.tag !== 'test' && wins.some((w) => w.visibilityState === 'visible' && w.focused)) return
    await self.registration.showNotification(data.title || 'VINATECH CMS', {
      body: data.body || '',
      icon: '/logo-192.png',
      badge: '/favicon.png',
      tag: data.tag ? `${data.tag}:${data.link || ''}` : undefined,
      renotify: !!data.tag,
      silent: false,             // 2026-11-26: luôn có tiếng (âm báo của hệ điều hành) và rung trên Android
      vibrate: [200, 100, 200],
      data: { link: data.link || '/' },
    })
  })())
})

// Bấm thông báo: mở đúng màn (dùng lại cửa sổ CMS đang mở nếu có)
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.link) || '/', self.location.origin).href
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus()
        if ('navigate' in w) await w.navigate(url).catch(() => undefined)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
