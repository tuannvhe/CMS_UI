/*
 * 2026-11-26 - Mobile app: Hỏi đáp kiểu Messenger, mở từ bong bóng chat nổi (components/QaBubble.tsx) hoặc thông báo
 * Danh sách chủ đề của mình (cả hai kênh gộp như web), bấm vào mở /qa-thread; nút bút để đặt câu hỏi mới.
 */
import { useEffect } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { qa, type QaThread } from '@web/api/qa'
import { useAuth } from '../auth/AuthProvider'
import { qaThreadsKey, useQaSeen } from '../qaSeen'
import { emojify } from '@web/utils/emoticons'
import { Avatar, EmptyState, QueryState, useTheme } from '../ui'

/** Giờ gọn như web: hôm nay = giờ:phút, trong 6 ngày = thứ, xa hơn = ngày/tháng. */
export function shortWhen(v: string, lang: string) {
  const d = new Date(v), now = new Date()
  if (Number.isNaN(d.getTime())) return ''
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString(lang, { weekday: 'short' })
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function QaScreen() {
  const { t, i18n } = useTranslation()
  const { C, s } = useTheme()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: qaThreadsKey, queryFn: () => qa.allThreads('mine'), refetchInterval: 30_000 })
  const { markSeen } = useQaSeen(q.data)
  useEffect(() => { if (q.data) markSeen() }, [q.data, markSeen])
  const open = (th: QaThread) => router.push({ pathname: '/qa-thread', params: { channel: th.channel, group: th.groupId } })

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: t('qa.panel') }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(th) => `${th.channel}:${th.groupId}`}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 120 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={C.brand} />}
        ListHeaderComponent={<View style={{ paddingHorizontal: 16 }}>
          <QueryState loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} />
          {q.isSuccess && q.data.length === 0 && <EmptyState text={t('qa.empty')} icon="chatbubbles-outline" />}
        </View>}
        ItemSeparatorComponent={() => <View style={[s.divider, { marginLeft: 80 }]} />}
        renderItem={({ item: th }) => {
          const who = th.awaitingStaff ? `${t('qa.youAsked')}: ` : `${th.lastByName ?? 'HR'}: `
          const reply = !th.awaitingStaff
          return (
            <Pressable onPress={() => open(th)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }, pressed && { backgroundColor: C.cardAlt }]}>
              <Avatar name={th.awaitingStaff ? user?.fullName : th.lastByName ?? 'HR'} uri={th.awaitingStaff ? th.avatarUrl : th.lastByAvatarUrl} size={52} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={[s.row, { gap: 8 }]}>
                  <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{th.title}</Text>
                  <Text style={[s.muted, { fontSize: 12 }]}>{shortWhen(th.lastAt, i18n.language)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[s.muted, { flex: 1, fontSize: 14 }, reply && { color: C.text }]} numberOfLines={1}>{who}{emojify(th.lastText || th.title)}</Text>
                  {th.awaitingStaff
                    ? <Ionicons name="time-outline" size={15} color={C.warn} accessibilityLabel={t('qa.waitingHr')} />
                    : <Ionicons name="checkmark-done" size={16} color={C.brand} accessibilityLabel={t('qa.answered')} />}
                </View>
              </View>
            </Pressable>
          )
        }}
      />
      {/* Nút soạn câu hỏi mới */}
      <Pressable onPress={() => router.push('/qa-thread')} accessibilityRole="button" accessibilityLabel={t('qa.newAsk')}
        style={({ pressed }) => [{ position: 'absolute', right: 20, bottom: 24 + insets.bottom, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, height: 54, borderRadius: 27, backgroundColor: C.brand, ...s.shadow, elevation: 6 }, pressed && { opacity: 0.85 }]}>
        <Ionicons name="create-outline" size={22} color={C.onBrand} />
        <Text style={{ color: C.onBrand, fontWeight: '700', fontSize: 15 }}>{t('qa.newAsk')}</Text>
      </Pressable>
    </View>
  )
}
