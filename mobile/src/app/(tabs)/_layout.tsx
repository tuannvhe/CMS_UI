/* 2026-11-23 [Truong] - Mobile app: 5 tabs, push registration, notification tap routing
 * 2026-11-25: icon Ionicons, số đơn chờ duyệt / thông báo chưa đọc trên tab, header gradient nằm trong từng màn (TabHero). */
import { useEffect } from 'react'
import { Platform, type ColorValue } from 'react-native'
import { Tabs, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { approvalSummary } from '@web/api/approvals'
import { notifications } from '@web/api/notifications'
import { registerPush, tabForLink } from '../../push'
import { C, type IconName } from '../../ui'

/** Icon tab: viền khi chưa chọn, đặc khi đang chọn. */
const icon = (name: IconName) => ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
  <Ionicons name={(focused ? name : `${name}-outline`) as IconName} size={size - 1} color={color as string} />
)

export default function TabLayout() {
  const { t } = useTranslation()
  // Cùng khoá truy vấn với màn Phê duyệt / Thông báo nên dùng chung dữ liệu, không gọi thêm
  const summary = useQuery({ queryKey: ['approvals', 'summary'], queryFn: approvalSummary, refetchInterval: 60_000 })
  const noti = useQuery({ queryKey: ['notifications'], queryFn: () => notifications.list(50), refetchInterval: 60_000 })
  const pending = (summary.data ?? []).reduce((n, x) => n + x.forms, 0)
  const unread = noti.data?.unread ?? 0
  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined)

  useEffect(() => {
    void registerPush()
    const open = (r: Notifications.NotificationResponse | null) => { if (r) router.navigate(tabForLink(r.notification.request.content.data?.link)) }
    // Mở app từ thông báo khi app đang tắt hẳn
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined)
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: Platform.OS === 'android' ? 6 : 0 },
        tabBarStyle: {
          backgroundColor: C.card, borderTopWidth: 0, height: Platform.OS === 'ios' ? 88 : 64, paddingTop: 6,
          shadowColor: '#0A3B24', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12,
        },
        tabBarBadgeStyle: { backgroundColor: C.danger, fontSize: 10, fontWeight: '800' },
      }}>
        <Tabs.Screen name="index" options={{ title: t('mobile.tab.attendance'), tabBarIcon: icon('time') }} />
        <Tabs.Screen name="requests" options={{ title: t('mobile.tab.requests'), tabBarIcon: icon('document-text') }} />
        <Tabs.Screen name="approvals" options={{ title: t('mobile.tab.approvals'), tabBarIcon: icon('checkmark-done-circle'), tabBarBadge: badge(pending) }} />
        <Tabs.Screen name="payslip" options={{ title: t('mobile.tab.payslip'), tabBarIcon: icon('wallet') }} />
        <Tabs.Screen name="notifications" options={{ title: t('mobile.tab.notifications'), tabBarIcon: icon('notifications'), tabBarBadge: badge(unread) }} />
      </Tabs>
    </>
  )
}
