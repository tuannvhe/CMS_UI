// Service worker tối thiểu để cài được như ứng dụng. Cố ý KHÔNG lưu cache: dữ liệu chấm công / đơn từ luôn phải lấy mới từ máy chủ,
// và mỗi lần triển khai bản mới người dùng không bị kẹt bản cũ.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
