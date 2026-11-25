/* 2026-11-23 [Truong] - Mobile app: notifications tab (list + mark read, via web api/notifications) */
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notifications, type Notice } from '@web/api/notifications'
import { tabForLink } from '../../push'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Button, C, Card, EmptyState, IconBadge, QueryState, TabHero, s } from '../../ui'

export default function NotificationsTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => notifications.list(50) })
  const read = useMutation({ mutationFn: (id?: string) => notifications.read(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }) })

  const open = (n: Notice) => {
    if (!n.read) read.mutate(n.id)
    const target = tabForLink(n.link)
    if (target !== '/notifications') router.navigate(target)
  }

  return (
    <View style={s.screen}>
    <TabHero title={t('mobile.tab.notifications')} subtitle={q.data?.unread ? t('mobile.noti.unread', { n: q.data.unread }) : undefined} />
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      data={q.data?.items ?? []}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={C.brand} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <QueryState loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} />
          {!!q.data?.unread && (
            <View style={s.row}>
              <Text style={s.h2}>{t('mobile.noti.unread', { n: q.data.unread })}</Text>
              <Button small icon="checkmark-done" title={t('mobile.noti.readAll')} kind="ghost" onPress={() => read.mutate(undefined)} disabled={read.isPending} />
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item)} style={({ pressed }) => pressed && { opacity: 0.85 }}>
          <Card style={{ flexDirection: 'row', gap: 12, backgroundColor: item.read ? C.card : C.unread, borderColor: item.read ? C.border : `${C.brand}33` }}>
            <IconBadge name={KIND_ICON[item.kind] ?? 'notifications'} color={KIND_COLOR[item.kind] ?? C.brand} size={40} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={[s.row, { gap: 8, alignItems: 'flex-start' }]}>
                <Text style={[s.h2, { flex: 1 }, !item.read && { color: C.deep }]} numberOfLines={2}>{item.title}</Text>
                {!item.read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.brand, marginTop: 6 }} />}
              </View>
              {!!item.body && <Text style={[s.body, { color: C.muted, fontSize: 14 }]} numberOfLines={3}>{item.body}</Text>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={13} color={C.faint} />
                <Text style={[s.muted, { fontSize: 12 }]}>{item.at}</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={q.isSuccess ? <EmptyState text={t('mobile.empty')} icon="notifications-off-outline" /> : undefined}
    />
    </View>
  )
}

/** Icon / màu theo loại thông báo (cùng bộ với chuông thông báo trên web). */
const KIND_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  approval: 'document-text', approved: 'checkmark-circle', rejected: 'close-circle', evaluation: 'ribbon', sent: 'paper-plane', birthday: 'gift',
}
const KIND_COLOR: Record<string, string> = {
  approval: C.info, approved: C.brand, rejected: C.danger, evaluation: C.purple, sent: '#0EA5E9', birthday: '#D6336C',
}
