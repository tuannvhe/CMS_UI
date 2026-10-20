import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const EVERY_MS = 2 * 60 * 1000

interface Stored<T> { at: number; data: T }

function read<T>(key: string): Stored<T> | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as Stored<T>) : null } catch { return null }
}

/**
 * Tự lưu bản nháp của form đang nhập dở (mỗi 2 phút và khi rời trang) trong trình duyệt, theo từng tài khoản và từng loại đơn.
 * Vào lại màn hình thì nạp lại; thêm đơn thành công (clear) hoặc bỏ nháp (discard) thì xoá. Chỉ lưu khi form có nội dung (isEmpty = false).
 */
/** Có bản nháp đã lưu của loại đơn này không (đọc một lần khi vào màn hình) để các phần tự nạp khác (line gần nhất) không ghi đè lên bản nháp. */
export function useHasSavedDraft(kind: string) {
  const { user } = useAuth()
  const key = `cmsvn:draft:${(user?.userId ?? '').toLowerCase()}:${kind}`
  const [has] = useState(() => read(key) !== null)
  return has
}

export function useFormAutosave<T extends object>(kind: string, snapshot: T, isEmpty: boolean, restore: (d: T) => void, enabled = true) {
  const { user } = useAuth()
  const key = `cmsvn:draft:${(user?.userId ?? '').toLowerCase()}:${kind}`
  const [restoredAt, setRestoredAt] = useState<number | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const latest = useRef({ snapshot, isEmpty })
  latest.current = { snapshot, isEmpty }
  const lastJson = useRef('')
  const restoreRef = useRef(restore)
  restoreRef.current = restore

  const save = useCallback(() => {
    const { snapshot: s, isEmpty: empty } = latest.current
    if (empty) return
    const json = JSON.stringify(s)
    if (json === lastJson.current) return
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: s } satisfies Stored<T>)); lastJson.current = json; setSavedAt(Date.now()) } catch { /* đầy bộ nhớ / bị chặn: bỏ qua */ }
  }, [key])

  // nạp lại bản nháp đã lưu (một lần khi vào màn hình)
  useEffect(() => {
    if (!enabled || !user) return
    const st = read<T>(key)
    if (st?.data) { restoreRef.current(st.data); lastJson.current = JSON.stringify(st.data); setRestoredAt(st.at) }
  }, [key, enabled, user])

  useEffect(() => {
    const h = setInterval(save, EVERY_MS)
    const onHide = () => save()
    window.addEventListener('pagehide', onHide)
    return () => { clearInterval(h); window.removeEventListener('pagehide', onHide); save() }
  }, [save])

  const clear = useCallback(() => { try { localStorage.removeItem(key) } catch { /* bỏ qua */ } lastJson.current = ''; setSavedAt(null); setRestoredAt(null) }, [key])
  return { savedAt, restoredAt, clear, hasSaved: enabled && !!user && read<T>(key) !== null }
}
