import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { qaSummary } from '../api/qa'
import { useAuth } from '../auth/AuthContext'
import { canSee, WORKSPACES } from '../config/navigation'

/** mine = lần cuối nhân viên xem trả lời của nhân sự; staff = lần cuối nhân sự mở màn Trả lời hỏi đáp. Lưu theo tài khoản trên trình duyệt. */
type SeenKind = 'mine' | 'staff'
const seenKey = (kind: SeenKind, uid: string) => (kind === 'mine' ? `qa-seen:${uid}` : `qa-staff-seen:${uid}`)
const readSeen = (kind: SeenKind, uid: string) => { try { return localStorage.getItem(seenKey(kind, uid)) } catch { return null } }
const SEEN_EVENT = 'cmsvn:qa-seen'
const newer = (at: string | null | undefined, seen: string | null) => !!at && (!seen || new Date(at).getTime() > new Date(seen).getTime())

/**
 * Chấm nhỏ trên menu: "Hỏi đáp" khi có nhân sự trả lời mới chưa xem; "Trả lời hỏi đáp" khi có câu hỏi / tin nhắn của nhân viên mới hơn lần
 * nhân sự mở màn gần nhất (từ 12/11/2026: mở màn là tắt chấm, không còn sáng mãi khi vẫn còn câu chờ trả lời). Làm mới ngay khi có sự kiện realtime "qa".
 * Mọi chỗ dùng hook (thanh bên, menu, màn hỏi đáp) cùng đọc một mốc "đã xem" nên đánh dấu ở màn hỏi đáp thì chấm trên menu tắt ngay.
 */
export function useQaDots() {
  const { user } = useAuth()
  const uid = user?.userId ?? ''
  const [seen, setSeen] = useState<string | null>(() => (uid ? readSeen('mine', uid) : null))
  const [staffSeen, setStaffSeen] = useState<string | null>(() => (uid ? readSeen('staff', uid) : null))
  useEffect(() => {
    const sync = () => { setSeen(uid ? readSeen('mine', uid) : null); setStaffSeen(uid ? readSeen('staff', uid) : null) }
    sync()
    window.addEventListener(SEEN_EVENT, sync)
    window.addEventListener('storage', sync)   // tab khác của cùng trình duyệt
    return () => { window.removeEventListener(SEEN_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [uid])

  const staffPage = WORKSPACES.flatMap((w) => w.pages).find((p) => p.key === 'qaManage')
  const askPage = WORKSPACES.flatMap((w) => w.pages).find((p) => p.key === 'qa')
  const canAsk = !!uid && !!askPage && canSee(askPage, user)
  const canManage = !!uid && !!staffPage && canSee(staffPage, user)

  const mine = useQuery({ queryKey: ['qa', 'summary', 'mine', uid], queryFn: qaSummary.mine, enabled: canAsk, refetchInterval: 120_000, staleTime: 30_000, retry: false })
  const pending = useQuery({ queryKey: ['qa', 'summary', 'pending', uid], queryFn: qaSummary.pending, enabled: canManage, refetchInterval: 120_000, staleTime: 30_000, retry: false })

  const last = mine.data?.lastStaffReplyAt ?? null
  const latestAsk = pending.data?.latestAt ?? null

  const write = useCallback((kind: SeenKind, v: string | null | undefined) => {
    if (!uid || !v) return
    if (!newer(v, readSeen(kind, uid))) return   // không lùi mốc đã xem
    try { localStorage.setItem(seenKey(kind, uid), v) } catch { /* không lưu được thì chấm sẽ hiện lại, không sao */ }
    if (kind === 'mine') setSeen(v); else setStaffSeen(v)
    window.dispatchEvent(new Event(SEEN_EVENT))
  }, [uid])

  /** Gọi khi người dùng đã xem màn Hỏi đáp: ghi nhớ thời điểm trả lời mới nhất đã thấy. */
  const markSeen = useCallback((at?: string | null) => write('mine', at ?? last), [write, last])
  /** Gọi khi nhân sự đang mở màn Trả lời hỏi đáp: coi như đã thấy mọi câu hỏi / tin nhắn tới thời điểm này. */
  const markStaffSeen = useCallback(() => write('staff', latestAsk), [write, latestAsk])

  return {
    reply: newer(last, seen), pending: (pending.data?.pending ?? 0) > 0 && newer(latestAsk, staffSeen), markSeen, markStaffSeen, latestAsk,
    /** Số chủ đề đang chờ nhân sự trả lời (chỉ có với người được trả lời hỏi đáp). */
    pendingCount: canManage ? (pending.data?.pending ?? 0) : 0,
    canAsk, canManage,
  }
}
