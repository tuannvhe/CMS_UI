/*
 * 2026-11-23 [Truong] - Mobile app: approvals tab
 * Same flow as the web ApprovalsPage: pick a request kind → pending batches (groups) → approve / reject a whole batch, or open it to act on single requests.
 */
import { useEffect, useMemo, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { approvalSummary, approvals, type ApprovalKind, type PendingGroup } from '@web/api/approvals'
import { APPROVAL_KINDS, approvalError, dmy, isApprovalKind, kindName, levelName } from '../../approvals'
import { RejectModal } from '../../components/RejectModal'
import { Button, Card, Chip, EmptyState, QueryState, Tag, TabHero, useTheme } from '../../ui'

export default function ApprovalsTab() {
  const { C, s } = useTheme()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ kind?: string; group?: string }>()
  const summary = useQuery({ queryKey: ['approvals', 'summary'], queryFn: approvalSummary, refetchInterval: 60_000 })
  const counts = useMemo(() => Object.fromEntries((summary.data ?? []).map((r) => [r.kind, r.forms])) as Partial<Record<ApprovalKind, number>>, [summary.data])

  // Loại đang xem: theo thông báo vừa mở (?kind=), không thì loại đầu tiên đang có đơn chờ
  const [kind, setKind] = useState<ApprovalKind>('overtime')
  const [touched, setTouched] = useState(false)
  useEffect(() => { if (isApprovalKind(params.kind)) { setKind(params.kind); setTouched(true) } }, [params.kind])
  useEffect(() => {
    if (touched || !summary.data) return
    const first = APPROVAL_KINDS.find((k) => (counts[k] ?? 0) > 0)
    if (first) setKind(first)
  }, [summary.data, counts, touched])

  const pending = useQuery({ queryKey: ['apr', 'pending', kind], queryFn: () => approvals.pending(kind), staleTime: 0 })
  const groups = useMemo(() => {
    const list = pending.data ?? []
    const focus = params.group
    return focus ? [...list].sort((x, y) => Number(y.groupId === focus) - Number(x.groupId === focus)) : list
  }, [pending.data, params.group])

  // Làm mới số đơn chờ (tab + màn hình) sau mỗi lần duyệt / từ chối
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['apr'] }); void qc.invalidateQueries({ queryKey: ['approvals'] }) }

  const approve = useMutation({
    mutationFn: (g: PendingGroup) => approvals.approve(kind, g.level, g.groupId),
    onSuccess: () => { Alert.alert(t('apr.approved')); refresh() },
    onError: (e) => { Alert.alert(approvalError(t, e)); refresh() },
  })
  const [rejecting, setRejecting] = useState<PendingGroup | null>(null)
  const reject = useMutation({
    mutationFn: (v: { g: PendingGroup; reason: string }) => approvals.rejectGroup(kind, v.g.level, v.g.groupId, v.reason),
    onSuccess: () => { setRejecting(null); Alert.alert(t('apr.rejected')); refresh() },
    onError: (e) => Alert.alert(approvalError(t, e)),
  })

  const askApprove = (g: PendingGroup) => Alert.alert(t('apr.approveAll'), t('apr.confirmApprove', { n: g.count }), [
    { text: t('req.cancel'), style: 'cancel' },
    { text: t('apr.approve'), onPress: () => approve.mutate(g) },
  ])
  const open = (g: PendingGroup) => router.push({ pathname: '/approval-group', params: { kind, level: String(g.level), groupId: g.groupId, department: g.department ?? '' } })

  return (
    <View style={s.screen}>
      <TabHero title={t('mobile.tab.approvals')} subtitle={t('mobile.appr.pending')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, gap: 8 }}>
        {APPROVAL_KINDS.map((k) => {
          const n = counts[k] ?? 0
          const on = k === kind
          return (
            <Chip key={k} label={kindName(t, k)} on={on} count={n} onPress={() => { setTouched(true); setKind(k) }} />
          )
        })}
      </ScrollView>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        data={groups}
        keyExtractor={(g) => `${g.level}|${g.groupId}`}
        refreshControl={<RefreshControl refreshing={pending.isRefetching} onRefresh={refresh} tintColor={C.brand} />}
        ListHeaderComponent={<QueryState loading={pending.isLoading} error={pending.error} onRetry={() => void pending.refetch()} />}
        ListEmptyComponent={pending.isSuccess ? <EmptyState text={t('apr.empty')} icon="checkmark-done-circle-outline" /> : undefined}
        renderItem={({ item: g }) => {
          const busy = (approve.isPending && approve.variables?.groupId === g.groupId) || (reject.isPending && reject.variables?.g.groupId === g.groupId)
          return (
            <Card style={{ gap: 8, borderColor: g.groupId === params.group ? C.brand : C.border }}>
              <Pressable onPress={() => open(g)} style={{ gap: 6 }}>
                <View style={s.row}>
                  <Tag text={levelName(t, kind, g.level)} />
                  <Text style={[s.h2, { color: C.brand }]}>{t('mobile.appr.forms', { n: g.count })}</Text>
                </View>
                <Text style={s.h2}>{g.department ?? '—'}</Text>
                <Text style={s.muted}>{dmy(g.date)} · {g.groupId}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ color: C.brand, fontSize: 13.5, fontWeight: '700' }}>{t('mobile.appr.openGroup')}</Text>
                  <Ionicons name="chevron-forward" size={15} color={C.brand} />
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Button small icon="checkmark" title={t('apr.approveAll')} onPress={() => askApprove(g)} disabled={busy} /></View>
                <View style={{ flex: 1 }}><Button small kind="danger" icon="close" title={t('apr.rejectAll')} onPress={() => setRejecting(g)} disabled={busy} /></View>
              </View>
            </Card>
          )
        }}
      />

      <RejectModal open={!!rejecting} subtitle={rejecting ? `${rejecting.department ?? ''} · ${rejecting.groupId}` : undefined} busy={reject.isPending}
        onClose={() => setRejecting(null)} onSubmit={(reason) => rejecting && reject.mutate({ g: rejecting, reason })} />
    </View>
  )
}
