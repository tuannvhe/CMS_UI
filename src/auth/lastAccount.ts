/** Tài khoản đăng nhập gần nhất trên máy này: chỉ mã đăng nhập, họ tên và ảnh đại diện (không lưu mật khẩu hay token). */
export interface LastAccount { userId: string; fullName: string; avatarUrl: string | null }

const KEY = 'cms.lastAccount'

export function loadLastAccount(): LastAccount | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<LastAccount>
    if (typeof v?.userId !== 'string' || !v.userId.trim()) return null
    return { userId: v.userId, fullName: typeof v.fullName === 'string' ? v.fullName : '', avatarUrl: typeof v.avatarUrl === 'string' ? v.avatarUrl : null }
  } catch {
    return null
  }
}

export function saveLastAccount(a: LastAccount) {
  try { localStorage.setItem(KEY, JSON.stringify({ userId: a.userId, fullName: a.fullName, avatarUrl: a.avatarUrl })) } catch { /* trình duyệt chặn lưu trữ: bỏ qua */ }
}

export function clearLastAccount() {
  try { localStorage.removeItem(KEY) } catch { /* bỏ qua */ }
}
