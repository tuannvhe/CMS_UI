/* 2026-11-23 [Truong] - Mobile app: 5 tabs, push registration, notification tap routing */
import { useEffect } from 'react'
import { Alert, Pressable, Text, type ColorValue } from 'react-native'
import { Tabs, router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthProvider'
import { registerPush, tabForLink } from '../../push'
import { C } from '../../ui'

function LogoutButton() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const ask = () => Alert.alert(t('mobile.logout'), t('mobile.logoutAsk'), [
    { text: t('mobile.cancel'), style: 'cancel' },
    { text: t('mobile.logout'), style: 'destructive', onPress: () => void signOut() },
  ])
  return <Pressable onPress={ask} hitSlop={8} style={{ paddingHorizontal: 16 }}><Text style={{ color: C.brand, fontWeight: '600' }}>{t('mobile.logout')}</Text></Pressable>
}

/** Biểu tượng chữ đơn giản (đợt sau thay bằng bộ icon). */
const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>

export default function TabLayout() {
  const { t } = useTranslation()

  useEffect(() => {
    void registerPush()
    const open = (r: Notifications.NotificationResponse | null) => { if (r) router.navigate(tabForLink(r.notification.request.content.data?.link)) }
    // Mở app từ thông báo khi app đang tắt hẳn
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined)
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [])

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.brand, headerTitleStyle: { color: C.text }, headerRight: () => <LogoutButton /> }}>
      <Tabs.Screen name="index" options={{ title: t('mobile.tab.attendance'), tabBarIcon: icon('◷') }} />
      <Tabs.Screen name="requests" options={{ title: t('mobile.tab.requests'), tabBarIcon: icon('✎') }} />
      <Tabs.Screen name="approvals" options={{ title: t('mobile.tab.approvals'), tabBarIcon: icon('✓') }} />
      <Tabs.Screen name="payslip" options={{ title: t('mobile.tab.payslip'), tabBarIcon: icon('₫') }} />
      <Tabs.Screen name="notifications" options={{ title: t('mobile.tab.notifications'), tabBarIcon: icon('●') }} />
    </Tabs>
  )
}
