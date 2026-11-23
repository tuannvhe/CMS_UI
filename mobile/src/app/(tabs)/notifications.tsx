/* 2026-11-23 [Truong] - Mobile app: notifications tab (list + mark read, via web api/notifications) */
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notifications, type Notice } from '@web/api/notifications'
import { tabForLink } from '../../push'
import { Button, C, Card, QueryState, s } from '../../ui'

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
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={q.data?.items ?? []}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={C.brand} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <QueryState loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} />
          {!!q.data?.unread && (
            <View style={s.row}>
              <Text style={s.muted}>{t('mobile.noti.unread', { n: q.data.unread })}</Text>
              <Button title={t('mobile.noti.readAll')} kind="ghost" onPress={() => read.mutate(undefined)} disabled={read.isPending} />
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item)}>
          <Card style={{ gap: 4, backgroundColor: item.read ? C.card : C.unread }}>
            <Text style={[s.h2, !item.read && { color: C.brand }]}>{item.title}</Text>
            {!!item.body && <Text style={s.body} numberOfLines={3}>{item.body}</Text>}
            <Text style={s.muted}>{item.at}</Text>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={q.isSuccess ? <Text style={[s.muted, { textAlign: 'center' }]}>{t('mobile.empty')}</Text> : undefined}
    />
  )
}
