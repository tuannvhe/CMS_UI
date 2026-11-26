/* 2026-11-23 [Truong] - Mobile app: 5 tabs, push registration, notification tap routing
 * 2026-11-26: màu theo theme, thanh tab phẳng viền mảnh.
 * 2026-11-26: OP (nhóm công nhân) không thấy tab Đơn từ / Phê duyệt; Phê duyệt chỉ cho người duyệt (nhân viên thường cũng không thấy); tab Phản hồi (Phản hồi công + Hỏi đáp) hiện khi được mở
 *   (ngày 1–7 hằng tháng hoặc theo phân quyền menu, cùng quy tắc với web). Hỏi đáp là bong bóng chat nổi (QaBubble).
 *   Thông báo đẩy tới khi đang mở app: tải lại ngay chuông / đơn chờ duyệt / hỏi đáp / phản hồi công (thời gian thực).
 * 2026-11-25: icon Ionicons, số đơn chờ duyệt / thông báo chưa đọc trên tab, header gradient nằm trong từng màn (TabHero). */
import { useEffect } from 'react'
import { type ColorValue } from 'react-native'
import { Tabs, router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { approvalSummary } from '@web/api/approvals'
import { notifications } from '@web/api/notifications'
import { registerPush, tabForLink } from '../../push'
import { useAccess } from '../../access'
import { QaBubble } from '../../components/QaBubble'
import { useRealtime } from '../../realtime'
import { type IconName, useTheme } from '../../ui'

/** Icon tab: viền khi chưa chọn, đặc khi đang chọn. */
const icon = (name: IconName) => ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
  <Ionicons name={(focused ? name : `${name}-outline`) as IconName} size={size - 1} color={color as string} />
)

export default function TabLayout() {
  const { t } = useTranslation()
  const { C } = useTheme()
  // Cùng khoá truy vấn với màn Phê duyệt / Thông báo nên dùng chung dữ liệu, không gọi thêm
  const acc = useAccess()
  const summary = useQuery({ queryKey: ['approvals', 'summary'], queryFn: approvalSummary, refetchInterval: 60_000, enabled: !acc.worker })
  const noti = useQuery({ queryKey: ['notifications'], queryFn: () => notifications.list(50), refetchInterval: 60_000 })
  const pending = (summary.data ?? []).reduce((n, x) => n + x.forms, 0)
  // Người duyệt luôn thấy tab; người được ủy quyền (chưa ở line duyệt) thấy khi đang có đơn chờ
  const showApprovals = acc.approver || (!acc.worker && pending > 0)
  const unread = noti.data?.unread ?? 0
  const tabCount = 3 + Number(acc.showRequests) + Number(showApprovals) + Number(acc.showComplaints)
  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined)

  const qc = useQueryClient()
  // Kênh realtime như web: tin nhắn / thông báo mới hiện ngay khi app đang mở
  useRealtime(true)
  // Thông báo đến khi app đang mở: Expo vẫn hiện banner (setNotificationHandler), đồng thời tải lại dữ liệu liên quan ngay
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const link = String(n.request.content.data?.link ?? '')
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      if (link.startsWith('/approvals')) void qc.invalidateQueries({ queryKey: ['approvals'] })
      if (link.startsWith('/qa')) void qc.invalidateQueries({ queryKey: ['qa'] })
      if (link.startsWith('/attendance/complaints')) void qc.invalidateQueries({ queryKey: ['complaints'] })
      if (link.startsWith('/requests') || link.startsWith('/leave')) { void qc.invalidateQueries({ queryKey: ['req'] }); void qc.invalidateQueries({ queryKey: ['short'] }) }
    })
    return () => sub.remove()
  }, [qc])

  useEffect(() => {
    void registerPush()
    const open = (r: Notifications.NotificationResponse | null) => { if (r) router.navigate(tabForLink(r.notification.request.content.data?.link)) }
    // Mở app từ thông báo khi app đang tắt hẳn
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined)
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [])

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.faint,
        // 6 tab (staff trong ngày mở Phản hồi) thì chữ nhỏ lại để không bị cắt "Thông b…"
        tabBarLabelStyle: { fontSize: tabCount > 5 ? 10 : 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, elevation: 0, shadowOpacity: 0,
        },
        tabBarBadgeStyle: { backgroundColor: C.danger, color: '#fff', fontSize: 10, fontWeight: '800' },
      }}>
        <Tabs.Screen name="index" options={{ title: t('mobile.tab.attendance'), tabBarIcon: icon('time') }} />
        {/* href: null = ẩn khỏi thanh tab (màn vẫn tồn tại nhưng không mở được từ thanh tab) */}
        <Tabs.Screen name="requests" options={{ title: t('mobile.tab.requests'), tabBarIcon: icon('document-text'), href: acc.showRequests ? undefined : null }} />
        <Tabs.Screen name="approvals" options={{ title: t('mobile.tab.approvals'), tabBarIcon: icon('checkmark-done-circle'), tabBarBadge: badge(pending), href: showApprovals ? undefined : null }} />
        <Tabs.Screen name="feedback" options={{ title: t('mobile.tab.feedback'), tabBarIcon: icon('chatbubbles'), href: acc.showComplaints ? undefined : null }} />
        <Tabs.Screen name="payslip" options={{ title: t('mobile.tab.payslip'), tabBarIcon: icon('wallet') }} />
        <Tabs.Screen name="notifications" options={{ title: t('mobile.tab.notifications'), tabBarIcon: icon('notifications'), tabBarBadge: badge(unread) }} />
      </Tabs>
      {acc.showQa && <QaBubble />}
    </View>
  )
}
