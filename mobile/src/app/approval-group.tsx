/*
 * 2026-11-23 [Truong] - Mobile app: requests inside one pending batch
 * Same actions as the web GroupRows: approve one / selected requests, reject one request with a reason, approve the whole batch.
 */
import { StatusBar } from 'expo-status-bar'
import { useMemo, useState } from 'react'
import { Alert, FlatList, Pressable, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { approvals, isSingleApprover, type ApprovalRow } from '@web/api/approvals'
import { approvalError, dmy, isApprovalKind, kindName, levelName } from '../approvals'
import { RejectModal } from '../components/RejectModal'
import { Button, C, Card, QueryState, Tag, s } from '../ui'

export default function ApprovalGroupScreen() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const p = useLocalSearchParams<{ kind: string; level: string; groupId: string; department?: string }>()
  const kind = isApprovalKind(p.kind) ? p.kind : 'overtime'
  const level = Number(p.level) || 1
  const groupId = p.groupId ?? ''

  const q = useQuery({ queryKey: ['apr', 'group', kind, level, groupId], queryFn: () => approvals.group(kind, level, groupId), enabled: !!groupId })
  const rows = useMemo(() => q.data ?? [], [q.data])
  const [picked, setPicked] = useState<number[]>([])
  const [rejecting, setRejecting] = useState<ApprovalRow | null>(null)

  // Lô hết đơn (đã duyệt / từ chối hết) thì quay về danh sách lô
  const refresh = async () => {
    void qc.invalidateQueries({ queryKey: ['approvals'] })
    await qc.invalidateQueries({ queryKey: ['apr'] })
    const left = qc.getQueryData<ApprovalRow[]>(['apr', 'group', kind, level, groupId])
    if (left && left.length === 0 && router.canGoBack()) router.back()
  }

  const approveRecords = useMutation({
    mutationFn: (ids: number[]) => approvals.approveRecords(kind, level, groupId, ids),
    onSuccess: (r) => { setPicked([]); Alert.alert(t('apr.approvedN', { n: r.approved })); void refresh() },
    onError: (e) => { Alert.alert(approvalError(t, e)); void refresh() },
  })
  const approveAll = useMutation({
    mutationFn: () => approvals.approve(kind, level, groupId),
    onSuccess: () => { Alert.alert(t('apr.approved')); void refresh() },
    onError: (e) => { Alert.alert(approvalError(t, e)); void refresh() },
  })
  const reject = useMutation({
    mutationFn: (v: { id: number; reason: string }) => approvals.rejectRecord(kind, level, groupId, v.id, v.reason),
    onSuccess: () => { setRejecting(null); Alert.alert(t('apr.rejected')); void refresh() },
    onError: (e) => Alert.alert(approvalError(t, e)),
  })
  const busy = approveRecords.isPending || approveAll.isPending || reject.isPending

  const confirm = (title: string, message: string, run: () => void) =>
    Alert.alert(title, message, [{ text: t('req.cancel'), style: 'cancel' }, { text: t('apr.approve'), onPress: run }])
  const toggle = (id: number) => setPicked((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: true, title: kindName(t, kind), headerBackTitle: t('mobile.login.back') }} />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        data={rows}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            <View style={s.row}>
              <Tag text={levelName(t, kind, level)} />
              <Text style={s.muted}>{groupId}</Text>
            </View>
            {!!p.department && <Text style={s.h2}>{p.department}</Text>}
            <QueryState loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} />
          </View>
        }
        ListEmptyComponent={q.isSuccess ? <Text style={[s.muted, { textAlign: 'center' }]}>{t('apr.rowsEmpty')}</Text> : undefined}
        renderItem={({ item: r }) => (
          <RowCard row={r} kind={kind} picked={picked.includes(r.id)} disabled={busy} onToggle={() => toggle(r.id)}
            onApprove={() => confirm(t('apr.approve'), t('apr.approveOneConfirm', { name: r.fullName }), () => approveRecords.mutate([r.id]))}
            onReject={() => setRejecting(r)} />
        )}
      />

      {rows.length > 0 && (
        <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
          {picked.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Button title={t('apr.approveSelected') + ` (${picked.length})`} disabled={busy}
                  onPress={() => confirm(t('apr.approveSelected'), t('apr.approveSelectedConfirm', { n: picked.length }), () => approveRecords.mutate(picked))} />
              </View>
              <View style={{ flex: 1 }}><Button kind="ghost" title={t('apr.clearSelection')} onPress={() => setPicked([])} disabled={busy} /></View>
            </View>
          ) : (
            <Button title={t('apr.approveAll')} disabled={busy}
              onPress={() => confirm(t('apr.approveAll'), t('apr.confirmApprove', { n: rows.length }), () => approveAll.mutate())} />
          )}
        </View>
      )}

      <RejectModal open={!!rejecting} subtitle={rejecting ? `${rejecting.employeeId} · ${rejecting.fullName}` : undefined} busy={reject.isPending}
        onClose={() => setRejecting(null)} onSubmit={(reason) => rejecting && reject.mutate({ id: rejecting.id, reason })} />
    </SafeAreaView>
  )
}

function RowCard({ row: r, kind, picked, disabled, onToggle, onApprove, onReject }: {
  row: ApprovalRow; kind: string; picked: boolean; disabled: boolean; onToggle: () => void; onApprove: () => void; onReject: () => void
}) {
  const { t } = useTranslation()
  const isLeave = kind === 'leave'
  const isGoOut = kind === 'goout'
  const isShort = isApprovalKind(kind) && isSingleApprover(kind)
  const dateText = r.dateTo && r.dateTo.slice(0, 10) !== r.date.slice(0, 10) ? `${dmy(r.date)} → ${dmy(r.dateTo)}` : dmy(r.date)
  const amount = isLeave ? `${r.hours} ${t('apr.days')}` : isGoOut ? null : `${r.hours} ${t('apr.hours')}`

  return (
    <Card style={{ gap: 6, borderColor: picked ? C.brand : C.border, backgroundColor: picked ? C.unread : C.card }}>
      <Pressable onPress={onToggle} disabled={disabled} style={{ gap: 4 }} accessibilityRole="checkbox" accessibilityState={{ checked: picked }}>
        <View style={s.row}>
          <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{picked ? '☑ ' : '☐ '}{r.fullName}</Text>
          {!!amount && <Text style={[s.h2, { color: C.brand }]}>{amount}</Text>}
        </View>
        <Text style={s.muted}>{r.employeeId}{r.department ? ` · ${r.department}` : ''}</Text>
        <Text style={s.body}>{dateText}{!isLeave && r.dayName ? ` · ${r.dayName}` : ''}{!isShort && r.shift ? ` · ${r.shift}` : ''}</Text>
        {isGoOut ? (
          <Text style={s.body}>{r.timeFrom} · {t(r.purpose === 'company' ? 'sh.purposeCompany' : 'sh.purposePersonal')} · {t('sh.comeBack')}: {r.comeBackTime ?? t('sh.comeBackNo')}</Text>
        ) : (
          <Text style={s.body}>{r.timeFrom} → {r.timeTo}</Text>
        )}
        {!!r.reason && <Text style={s.body}>{t('req.reason')}: {r.reason}</Text>}
        {isLeave && !!r.extra && <Text style={s.muted}>{t('leave.handover')}: {r.extra}</Text>}
        {!!r.overlaps?.length && (
          <View style={{ gap: 2 }}>
            <Tag text={t('apr.overlapTag')} color="#B54708" />
            {r.overlaps.map((o) => (
              <Text key={o.id} style={[s.muted, { color: '#B54708' }]}>
                {dmy(o.date)} {o.start} → {o.end} ({o.hours}h{o.state === 'pending' ? `, ${t('apr.overlapPending')}` : ''}) · {t('apr.overlapHours', { n: o.overlapHours })}
              </Text>
            ))}
          </View>
        )}
        <Text style={s.muted}>{t('req.sender')}: {r.senderName || r.senderId}{r.submittedAt ? ` · ${r.submittedAt.slice(0, 16).replace('T', ' ')}` : ''}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button small title={t('apr.approve')} onPress={onApprove} disabled={disabled} /></View>
        <View style={{ flex: 1 }}><Button small kind="danger" title={t('apr.reject')} onPress={onReject} disabled={disabled} /></View>
      </View>
    </Card>
  )
}
