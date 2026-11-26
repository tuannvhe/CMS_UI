/* 2026-11-23 [Truong] - Mobile app: 5 tabs, push registration, notification tap routing
 * 2026-11-26: màu theo theme, thanh tab phẳng viền mảnh.
 * 2026-11-26: OP (nhóm công nhân) không thấy tab Đơn từ / Phê duyệt; Phê duyệt chỉ cho người duyệt (nhân viên thường cũng không thấy); tab Phản hồi (Phản hồi công + Hỏi đáp) hiện khi được mở
 *   (ngày 1–7 hằng tháng hoặc theo phân quyền menu, cùng quy tắc với web). Hỏi đáp là bong bóng chat nổi (QaBubble).
 *   Thông báo đẩy tới khi đang mở app: tải lại ngay chuông / đơn chờ duyệt / hỏi đáp / phản hồi công (thời gian thực).
 * 2026-11-26: thông báo đẩy BẮT BUỘC: chưa cho quyền thông báo thì chặn app bằng màn hướng dẫn (PushRequired), kiểm tra lại mỗi lần quay lại app.
 *   Expo Go Android / máy ảo / chưa có projectId thì không chặn được (không có push), app vẫn dùng bình thường.
 * 2026-11-25: icon Ionicons, số đơn chờ duyệt / thông báo chưa đọc trên tab, header gradient nằm trong từng màn (TabHero). */
import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Platform, ScrollView, Text, useWindowDimensions, type ColorValue } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Tabs, router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { approvalSummary } from '@web/api/approvals'
import { notifications } from '@web/api/notifications'
import { registerPush, tabForLink, type PushState } from '../../push'
import { useAccess } from '../../access'
import { QaBubble } from '../../components/QaBubble'
import { useRealtime } from '../../realtime'
import { Button, type IconName, useTheme } from '../../ui'

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

  // Bắt buộc bật thông báo: đăng ký khi vào app và mỗi lần quay lại app (người dùng có thể vừa bật / tắt trong Cài đặt máy)
  const [push, setPush] = useState<PushState | null>(null)
  const checkPush = useCallback(async () => { setPush(await registerPush()) }, [])
  useEffect(() => {
    void checkPush()
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void checkPush() })
    return () => sub.remove()
  }, [checkPush])

  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => { if (r) router.navigate(tabForLink(r.notification.request.content.data?.link)) }
    // Mở app từ thông báo khi app đang tắt hẳn
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined)
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [])

  if (push === 'denied') return <PushRequired onCheck={checkPush} />

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

/** Màn chặn khi chưa cho quyền thông báo: giải thích vì sao bắt buộc, cách bật; quay lại app là tự kiểm tra lại.
 * Co giãn: thẻ rộng tối đa 520, cuộn được khi màn thấp (điện thoại nhỏ / xoay ngang); máy rộng (≥ 700) thì 4 lợi ích xếp 2 cột. */
function PushRequired({ onCheck }: { onCheck: () => Promise<void> }) {
  const { t } = useTranslation()
  const { C, s, grad } = useTheme()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [busy, setBusy] = useState(false)
  const check = async () => { setBusy(true); await onCheck(); setBusy(false) }
  const wide = width >= 700
  const compact = height < 640
  const why: [IconName, string, string][] = [
    ['checkmark-done-circle', t('mobile.push.why.approve'), C.brand],
    ['document-text', t('mobile.push.why.result'), C.info],
    ['chatbubbles', t('mobile.push.why.qa'), C.purple],
    ['megaphone', t('mobile.push.why.notice'), C.warn],
  ]
  const steps = [Platform.OS === 'ios' ? t('mobile.push.stepsIos') : t('mobile.push.stepsAndroid'), t('mobile.push.stepsBack')]
  return (
    <View style={[s.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + (compact ? 12 : 28), paddingBottom: insets.bottom + 20 }}>
        <View style={[s.card, { width: '100%', maxWidth: wide ? 640 : 520, padding: 0, overflow: 'hidden' }]}>
          {/* Đầu thẻ: màu thương hiệu + chuông */}
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignItems: 'center', paddingVertical: compact ? 18 : 28, paddingHorizontal: 20, gap: 10 }}>
            <View style={{ width: compact ? 60 : 76, height: compact ? 60 : 76, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications" size={compact ? 30 : 38} color="#fff" />
              <View style={{ position: 'absolute', top: compact ? 10 : 14, right: compact ? 10 : 14, width: 14, height: 14, borderRadius: 7, backgroundColor: C.danger, borderWidth: 2, borderColor: '#fff' }} />
            </View>
            <Text style={{ color: '#fff', fontSize: compact ? 20 : 23, fontWeight: '800', textAlign: 'center' }} accessibilityRole="header">{t('mobile.push.requiredTitle')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 460 }}>{t('mobile.push.requiredText')}</Text>
          </LinearGradient>

          <View style={{ padding: compact ? 14 : 18, gap: 14 }}>
            {/* Ý nghĩa: nhận được gì */}
            <Text style={[s.h3, { color: C.muted, textTransform: 'uppercase', fontSize: 12.5, letterSpacing: 0.6 }]}>{t('mobile.push.whyTitle')}</Text>
            <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: 10 }}>
              {why.map(([icon, text, color]) => (
                <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: wide ? '48.5%' : '100%', backgroundColor: C.cardAlt, borderRadius: 14, padding: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={21} color={color} />
                  </View>
                  <Text style={[s.body, { flex: 1, fontSize: 14.5, lineHeight: 20 }]}>{text}</Text>
                </View>
              ))}
            </View>

            {/* Cách bật */}
            <Text style={[s.h3, { color: C.muted, textTransform: 'uppercase', fontSize: 12.5, letterSpacing: 0.6, marginTop: 2 }]}>{t('mobile.push.stepsTitle')}</Text>
            {steps.map((st, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.onBrand, fontWeight: '800', fontSize: 13 }}>{i + 1}</Text>
                </View>
                <Text style={[s.body, { flex: 1, fontSize: 14.5, lineHeight: 21, paddingTop: 2 }]}>{st}</Text>
              </View>
            ))}

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 2 }}>
              <Ionicons name="lock-closed-outline" size={15} color={C.faint} style={{ marginTop: 2 }} />
              <Text style={[s.muted, { flex: 1, fontSize: 12.5, lineHeight: 18 }]}>{t('mobile.push.privacy')}</Text>
            </View>

            <View style={{ flexDirection: wide ? 'row-reverse' : 'column', gap: 10, marginTop: 4 }}>
              <View style={wide && { flex: 1 }}><Button title={t('mobile.push.openSettings')} icon="settings-outline" onPress={() => void Linking.openSettings()} /></View>
              <View style={wide && { flex: 1 }}><Button title={t('mobile.push.checkAgain')} kind="outline" icon="refresh" onPress={() => void check()} loading={busy} /></View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
