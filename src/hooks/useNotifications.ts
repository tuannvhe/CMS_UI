import { useEffect } from 'react'
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from './useToast'
import { tokenStore } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { notifications, type Notice, type NoticeList } from '../api/notifications'

const KEY: readonly unknown[] = ['notifications']

/**
 * Thông báo của tôi: tải danh sách từ API và nhận thông báo mới realtime qua SignalR (/hubs/notify).
 * Mất kết nối thì tự nối lại và tải lại danh sách để không sót.
 */
export function useNotifications(take = 30) {
  const qc = useQueryClient()
  const toast = useToast()
  const uid = useAuth().user?.userId   // đổi tài khoản thì nối lại SignalR bằng token mới và tải lại danh sách

  const query = useQuery({ queryKey: [...KEY, uid, take], queryFn: () => notifications.list(take), refetchInterval: 120_000, staleTime: 30_000, retry: false, placeholderData: keepPreviousData })

  useEffect(() => {
    const token = tokenStore.get()
    if (!token) return
    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/notify', { accessTokenFactory: () => tokenStore.get() ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.None)
      .build()

    conn.on('notice', (n: Notice) => {
      qc.setQueriesData<NoticeList>({ queryKey: KEY }, (old) => old
        // Chỉ cộng số chưa đọc khi thông báo thật sự mới (cùng thông báo đến hai lần, ví dụ sau khi nối lại, không được đếm đôi).
        ? { items: [n, ...old.items.filter((x) => x.id !== n.id)], unread: old.items.some((x) => x.id === n.id) ? old.unread : old.unread + 1 }
        : old)
      // Số đơn chờ duyệt / chờ đánh giá trên menu cập nhật ngay.
      qc.invalidateQueries({ queryKey: ['approvals'] })
      // Danh sách lô chờ duyệt / đơn đã gửi / đã duyệt cũng làm mới ngay để đơn mới hiện luôn.
      qc.invalidateQueries({ queryKey: ['apr'] })
      qc.invalidateQueries({ queryKey: ['req', 'submitted'] })
      qc.invalidateQueries({ queryKey: ['req', 'leave-submitted'] })
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      toast.info({ title: n.title, description: n.body, duration: 6 })
    })
    // Tin nhắn hỏi đáp mới (không vào chuông): làm mới ngay màn Hỏi đáp / Trả lời hỏi đáp đang mở.
    // Tin đến dồn dập thì gộp thành một lần tải lại (trễ tối đa 1,5 giây).
    let qaTimer: ReturnType<typeof setTimeout> | undefined
    conn.on('qa', () => {
      if (qaTimer) return
      qaTimer = setTimeout(() => { qaTimer = undefined; qc.invalidateQueries({ queryKey: ['qa'] }) }, 1500)
    })
    conn.onreconnected(() => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ['qa'] }) })

    let stopped = false
    conn.start().catch(() => { /* API chưa sẵn sàng: bỏ qua, danh sách vẫn được làm mới định kỳ */ })
    return () => {
      stopped = true
      if (qaTimer) clearTimeout(qaTimer)
      if (stopped && conn.state !== HubConnectionState.Disconnected) void conn.stop()
    }
  }, [qc, toast, uid])

  return query
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return async (id?: string) => {
    // Hủy lượt tải đang chạy dở: nếu không, kết quả cũ (chưa kịp ghi "đã đọc") về sau sẽ đè số chưa đọc trở lại.
    await qc.cancelQueries({ queryKey: KEY })
    qc.setQueriesData<NoticeList>({ queryKey: KEY }, (old) => old
      ? { items: old.items.map((n) => (!id || n.id === id ? { ...n, read: true } : n)), unread: id ? Math.max(0, old.unread - (old.items.find((n) => n.id === id && !n.read) ? 1 : 0)) : 0 }
      : old)
    try { await notifications.read(id) } catch { /* lỗi: tải lại bên dưới để hiện đúng trạng thái thật */ }
    qc.invalidateQueries({ queryKey: KEY })   // đồng bộ lại với máy chủ sau khi đã ghi
  }
}
