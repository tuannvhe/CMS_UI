/*
 * 2026-11-26 - Mobile app: kênh realtime giống web (SignalR /hubs/notify, useNotifications.ts của web)
 * Máy chủ đẩy "notice" (thông báo mới: chuông, đơn chờ duyệt…) và "qa" (tin hỏi đáp mới) ngay khi có, nên tin nhắn / số chờ duyệt
 * hiện tức thì thay vì đợi lần tải lại định kỳ. Đăng nhập bằng Bearer (thư viện tự gửi tiêu đề Authorization trên React Native).
 * App xuống nền thì ngắt kết nối (hệ điều hành cũng sẽ cắt), quay lại thì nối lại và tải lại một lượt.
 */
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { API_URL, freshAccessToken } from './api/client'

const HUB_URL = `${API_URL.replace(/\/api$/, '')}/hubs/notify`

export function useRealtime(enabled: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled || !API_URL) return
    let conn: HubConnection | null = null
    let alive = true

    const refreshAll = () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['qa'] })
    }
    const start = async () => {
      if (!alive || (conn && conn.state !== HubConnectionState.Disconnected)) return
      conn = new HubConnectionBuilder()
        .withUrl(HUB_URL, { accessTokenFactory: freshAccessToken })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.None)
        .build()
      conn.on('notice', () => {
        void qc.invalidateQueries({ queryKey: ['notifications'] })
        void qc.invalidateQueries({ queryKey: ['approvals'] })
        void qc.invalidateQueries({ queryKey: ['complaints'] })
      })
      // Tin hỏi đáp mới (của mình hoặc nhân sự trả lời): tải lại danh sách + cuộc trò chuyện đang mở
      conn.on('qa', () => { void qc.invalidateQueries({ queryKey: ['qa'] }) })
      conn.onreconnected(refreshAll)
      try { await conn.start() } catch { /* mất mạng / máy chủ tắt: lần quay lại app sẽ thử lại, dữ liệu vẫn tự tải định kỳ */ }
    }
    const stop = () => { const c = conn; conn = null; void c?.stop().catch(() => undefined) }

    void start()
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') { void start().then(refreshAll) } else if (st === 'background') stop()
    })
    return () => { alive = false; sub.remove(); stop() }
  }, [enabled, qc])
}
