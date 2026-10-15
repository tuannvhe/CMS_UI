import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { qaSummary } from '../api/qa'
import { useAuth } from '../auth/AuthContext'
import { canSee, WORKSPACES } from '../config/navigation'

const seenKey = (uid: string) => `qa-seen:${uid}`
const readSeen = (uid: string) => { try { return localStorage.getItem(seenKey(uid)) } catch { return null } }

/** Chấm nhỏ trên menu: "Hỏi đáp" khi có nhân sự trả lời mới chưa xem, "Trả lời hỏi đáp" khi còn chủ đề chờ nhân sự. Làm mới ngay khi có sự kiện realtime "qa". */
export function useQaDots() {
  const { user } = useAuth()
  const uid = user?.userId ?? ''
  const [seen, setSeen] = useState<string | null>(() => (uid ? readSeen(uid) : null))
  const staffPage = WORKSPACES.flatMap((w) => w.pages).find((p) => p.key === 'qaManage')
  const askPage = WORKSPACES.flatMap((w) => w.pages).find((p) => p.key === 'qa')
  const canAsk = !!uid && !!askPage && canSee(askPage, user)
  const canManage = !!uid && !!staffPage && canSee(staffPage, user)

  const mine = useQuery({ queryKey: ['qa', 'summary', 'mine', uid], queryFn: qaSummary.mine, enabled: canAsk, refetchInterval: 120_000, staleTime: 30_000, retry: false })
  const pending = useQuery({ queryKey: ['qa', 'summary', 'pending', uid], queryFn: qaSummary.pending, enabled: canManage, refetchInterval: 120_000, staleTime: 30_000, retry: false })

  const last = mine.data?.lastStaffReplyAt ?? null
  const hasReply = !!last && (!seen || new Date(last).getTime() > new Date(seen).getTime())
  /** Gọi khi người dùng đã xem màn Hỏi đáp: ghi nhớ thời điểm trả lời mới nhất đã thấy. */
  const markSeen = useCallback((at?: string | null) => {
    const v = at ?? last
    if (!uid || !v) return
    try { localStorage.setItem(seenKey(uid), v) } catch { /* không lưu được thì chấm sẽ hiện lại, không sao */ }
    setSeen(v)
  }, [uid, last])

  return { reply: hasReply, pending: (pending.data?.pending ?? 0) > 0, markSeen }
}
