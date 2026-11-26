/*
 * 2026-11-26 - Mobile app: số chủ đề Hỏi đáp có câu trả lời mới chưa xem (chấm đỏ trên bong bóng chat)
 * Lưu thời điểm câu trả lời mới nhất đã xem trên máy này (SecureStore), giống chấm Hỏi đáp trên menu web (useQaDots).
 */
import { useCallback, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import type { QaThread } from '@web/api/qa'

/** Khoá react-query danh sách chủ đề của mình (bong bóng chat, màn /qa và màn chat dùng chung). */
export const qaThreadsKey = ['qa', 'mine', 'threads'] as const

const KEY = 'cms.qaSeen'
let cache: string | null | undefined
const listeners = new Set<(v: string | null) => void>()

async function load() {
  if (cache === undefined) { try { cache = await SecureStore.getItemAsync(KEY) } catch { cache = null } }
  return cache
}

/** unread = số chủ đề nhân sự đã trả lời sau lần xem cuối; markSeen = đã xem tới câu trả lời mới nhất. */
export function useQaSeen(threads: QaThread[] | undefined) {
  const [seen, setSeen] = useState<string | null>(cache ?? null)
  useEffect(() => {
    void load().then((v) => setSeen(v ?? null))
    listeners.add(setSeen)
    return () => { listeners.delete(setSeen) }
  }, [])
  const answered = (threads ?? []).filter((x) => !x.awaitingStaff)
  const unread = answered.filter((x) => !seen || x.lastAt > seen).length
  const latest = answered.map((x) => x.lastAt).sort().pop()
  const markSeen = useCallback(() => {
    if (!latest || (cache && cache >= latest)) return
    cache = latest
    listeners.forEach((f) => f(latest))
    void SecureStore.setItemAsync(KEY, latest).catch(() => undefined)
  }, [latest])
  return { unread, markSeen }
}
