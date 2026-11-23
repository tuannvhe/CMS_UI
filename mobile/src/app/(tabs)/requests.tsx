/*
 * 2026-11-23 [Truong] - Mobile app: requests tab
 * Pick a request kind → "Drafts" (tick, submit for approval, delete, edit) or "Submitted" (status per approval level, cancel). "+ Register" opens the form.
 * Same two-step flow and server rules as the web pages (drafts → submit; late submissions by HR need fault + note).
 */
import { useCallback, useMemo, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { leave, requests, type ApprovalStep, type LateSubmit, type SubmittedScope, type WindowKind } from '@web/api/requests'
import { shortRequests } from '@web/api/shortRequests'
import { isPastSelfService, useSelfService } from '@web/utils/selfService'
import { useAuth } from '../../auth/AuthProvider'
import { StepStatusList, STATUS_COLOR } from '../../components/StepStatusList'
import {
  REQUEST_KINDS, canCancelSteps, dmy, draftsKey, isShortKind, requestError, requestKindName, skipText, submittedKey, toYmd, type MobileRequestKind,
} from '../../requests'
import { Button, C, Card, QueryState, Tag, s } from '../../ui'

/** Một dòng nháp / đã gửi đã quy về cùng dạng để hiển thị (3 nguồn dữ liệu khác nhau). */
interface Item {
  id: number; employeeId: string; fullName: string; department: string | null
  dateText: string; timeText: string; amount: string; reason: string; extra?: string
  approvers: string[]; dates: string[]
  steps?: [string, ApprovalStep][]; overall?: 'approved' | 'rejected' | 'waiting'; rejectReason?: string | null; senderId?: string; senderName?: string; canCancel?: boolean
}

const monthRange = (offset: number) => {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { from: toYmd(first), to: toYmd(last), label: `${String(first.getMonth() + 1).padStart(2, '0')}/${first.getFullYear()}` }
}

export default function RequestsTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [kind, setKind] = useState<MobileRequestKind>('overtime')
  const [view, setView] = useState<'drafts' | 'submitted'>('drafts')
  const [scope, setScope] = useState<SubmittedScope>('sent')
  const [month, setMonth] = useState(0)
  const [picked, setPicked] = useState<number[]>([])
  const [lateOpen, setLateOpen] = useState(false)
  const short = isShortKind(kind)
  const range = monthRange(month)
  const selfRule = useSelfService()

  // ---- Nháp
  const drafts = useQuery({
    queryKey: draftsKey(kind),
    queryFn: async (): Promise<Item[]> => {
      if (kind === 'leave') return (await leave.drafts()).map((r) => ({
        id: r.id, employeeId: r.employeeId, fullName: r.fullName, department: r.department, dates: [r.from, r.to],
        dateText: r.from.slice(0, 10) === r.to.slice(0, 10) ? dmy(r.from) : `${dmy(r.from)} → ${dmy(r.to)}`, timeText: `${r.shift} · ${r.timeIn} – ${r.timeOut}`,
        amount: `${r.totalDays} ${t('leave.days').toLowerCase()}`, reason: r.reason, extra: r.personTakeJob ? `${t('leave.handover')}: ${r.personTakeJob}` : undefined,
        approvers: [r.approverOne, r.approverTwo, r.approverThree, r.approverFour],
      }))
      if (isShortKind(kind)) return (await shortRequests.drafts(kind)).map((r) => ({
        id: r.id, employeeId: r.employeeId, fullName: r.fullName, department: r.department, dates: [r.date],
        dateText: r.dateTo && r.dateTo.slice(0, 10) !== r.date.slice(0, 10) ? `${dmy(r.date)} → ${dmy(r.dateTo)}` : dmy(r.date),
        timeText: kind === 'goout' ? `${r.timeFrom} · ${t(r.purpose === 'company' ? 'sh.purposeCompany' : 'sh.purposePersonal')} · ${t('sh.comeBack')}: ${r.comeBackTime ?? t('sh.comeBackNo')}` : `${r.timeFrom} → ${r.timeTo}`,
        amount: '', reason: r.reason, approvers: [r.approverName],
      }))
      return (await requests.drafts(kind as 'finger' | 'overtime')).map((r) => ({
        id: r.id, employeeId: r.employeeId, fullName: r.fullName, department: r.department, dates: [r.date],
        dateText: `${dmy(r.date)} · ${r.dayName}`, timeText: `${r.shift} · ${r.timeFrom} → ${r.timeTo}`, amount: `${r.hours} ${t('apr.hours')}`, reason: r.reason,
        approvers: [r.approverOne, r.approverTwo, r.approverThree],
      }))
    },
  })

  // ---- Đã gửi
  const submitted = useQuery({
    queryKey: [...submittedKey(kind), range.from, range.to, scope],
    enabled: view === 'submitted',
    queryFn: async (): Promise<Item[]> => {
      if (kind === 'leave') return (await leave.submitted(range.from, range.to, scope)).map((r) => {
        const steps: [string, ApprovalStep][] = [[t('req.shortOne'), r.one], [t('req.shortTwo'), r.two], [t('req.shortThree'), r.three], [t('leave.shortFour'), r.four]]
        return {
          id: r.id, employeeId: r.employeeId, fullName: r.fullName, department: r.department, dates: [r.from, r.to], approvers: [],
          dateText: r.from.slice(0, 10) === r.to.slice(0, 10) ? dmy(r.from) : `${dmy(r.from)} → ${dmy(r.to)}`, timeText: `${r.shift} · ${r.timeIn} – ${r.timeOut}`,
          amount: `${r.totalDays} ${t('leave.days').toLowerCase()}`, reason: r.reason, extra: r.personTakeJob ? `${t('leave.handover')}: ${r.personTakeJob}` : undefined,
          steps, overall: r.overall, senderId: r.senderId, senderName: r.senderName, canCancel: canCancelSteps(steps.map((x) => x[1]), r.senderId, user?.userId),
        }
      })
      if (isShortKind(kind)) return (await shortRequests.submitted(kind, range.from, range.to, scope)).map((r) => ({
        id: r.id, employeeId: r.employeeId, fullName: r.fullName, department: r.department, dates: [r.date], approvers: [r.approverName],
        dateText: r.dateTo && r.dateTo.slice(0, 10) !== r.date.slice(0, 10) ? `${dmy(r.date)} → ${dmy(r.dateTo)}` : dmy(r.date),
        timeText: kind === 'goout' ? `${r.timeFrom} · ${t('sh.comeBack')}: ${r.comeBackTime ?? t('sh.comeBackNo')}` : `${r.timeFrom} → ${r.timeTo}`,
        amount: '', reason: r.reason, overall: r.overall, rejectReason: r.rejectReason, senderId: r.senderId, senderName: r.senderName,
        extra: r.securityName ? `${t('sh.security')}: ${r.securityName}` : undefined,
        canCancel: r.overall !== 'approved' && !!user?.userId && r.senderId.trim().toLowerCase() === user.userId.trim().toLowerCase(),
      }))
      return (await requests.submitted(kind as 'finger' | 'overtime', range.from, range.to, scope)).map((r) => {
        const steps: [string, ApprovalStep][] = [[t('req.shortOne'), r.one], [t('req.shortTwo'), r.two], [t('req.shortThree'), r.three]]
        return {
          id: r.id, employeeId: r.employeeId, fullName: r.fullName, department: r.department, dates: [r.date], approvers: [],
          dateText: `${dmy(r.date)} · ${r.dayName}`, timeText: `${r.shift} · ${r.timeFrom} → ${r.timeTo}`, amount: `${r.hours} ${t('apr.hours')}`, reason: r.reason,
          steps, overall: r.overall, senderId: r.senderId, senderName: r.senderName, canCancel: canCancelSteps(steps.map((x) => x[1]), r.senderId, user?.userId),
        }
      })
    },
  })

  // Quay lại từ màn form: làm mới danh sách nháp
  useFocusEffect(useCallback(() => { void qc.invalidateQueries({ queryKey: draftsKey(kind) }) }, [qc, kind]))

  const balance = useQuery({ queryKey: ['req', 'leave-balance', 'me'], queryFn: () => leave.balance(), enabled: kind === 'leave' && !!user?.employeeId, staleTime: 60_000 })

  const refreshAll = () => { setPicked([]); void qc.invalidateQueries({ queryKey: draftsKey(kind) }); void qc.invalidateQueries({ queryKey: submittedKey(kind) }) }

  // HR gửi nháp đã quá hạn tự gửi: phải ghi "Lỗi do" và ghi chú (người thường bị máy chủ bỏ qua và nhận danh sách)
  const lateCount = selfRule?.bypass && !short
    ? (drafts.data ?? []).filter((d) => picked.includes(d.id) && d.dates.some((x) => isPastSelfService(x, selfRule, kind as WindowKind))).length : 0

  const submit = useMutation({
    mutationFn: (late?: LateSubmit) => {
      if (kind === 'leave') return leave.submit(picked, late)
      if (isShortKind(kind)) return shortRequests.submit(kind, picked)
      return requests.submit(kind as 'finger' | 'overtime', picked, late)
    },
    onSuccess: (r) => {
      setLateOpen(false)
      const lines = [r.submitted > 0 ? t('req.submitted', { n: r.submitted, code: r.groupId }) : '', ...(r.skipped ?? []).map((x) => skipText(t, x))].filter(Boolean)
      Alert.alert(r.skipped?.length ? t('late.skippedTitle', { n: r.skipped.length }) : t('req.submit'), lines.join('\n'))
      refreshAll()
    },
    onError: (e) => Alert.alert(requestError(t, e, kind)),
  })
  const remove = useMutation({
    mutationFn: () => (kind === 'leave' ? leave.remove(picked) : isShortKind(kind) ? shortRequests.remove(kind, picked) : requests.remove(kind as 'finger' | 'overtime', picked)),
    onSuccess: () => { Alert.alert(t('req.deleted')); refreshAll() },
    onError: (e) => Alert.alert(requestError(t, e, kind)),
  })
  const cancel = useMutation({
    mutationFn: (id: number) => (kind === 'leave' ? leave.cancel([id]) : isShortKind(kind) ? shortRequests.cancel(kind, [id]) : requests.cancel(kind as 'finger' | 'overtime', [id])),
    onSuccess: (r) => { Alert.alert(r.cancelled > 0 ? t('req.cancelRequestDone') : t('req.cancelRequestNone')); void submitted.refetch() },
    onError: () => Alert.alert(t('req.cancelRequestFail')),
  })

  const askSubmit = () => {
    if (lateCount > 0) { setLateOpen(true); return }
    Alert.alert(t('req.submit'), t('req.confirmSubmit', { n: picked.length }), [{ text: t('req.cancel'), style: 'cancel' }, { text: t('req.submit'), onPress: () => submit.mutate(undefined) }])
  }
  const askDelete = () => Alert.alert(t('req.delete'), t('req.confirmDelete', { n: picked.length }), [
    { text: t('req.cancel'), style: 'cancel' }, { text: t('req.delete'), style: 'destructive', onPress: () => remove.mutate() },
  ])
  const askCancel = (it: Item) => Alert.alert(t('req.cancelRequestAsk'), t('req.cancelRequestHint'), [
    { text: t('req.cancel'), style: 'cancel' }, { text: t('req.cancelRequest'), style: 'destructive', onPress: () => cancel.mutate(it.id) },
  ])
  const openForm = (extra?: Record<string, string>) => router.push({ pathname: '/request-form', params: { kind, ...extra } })

  const list = view === 'drafts' ? drafts : submitted
  const items = useMemo(() => list.data ?? [], [list.data])
  const busy = submit.isPending || remove.isPending

  return (
    <View style={s.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
        {REQUEST_KINDS.map((k) => (
          <Pressable key={k} onPress={() => { setKind(k); setPicked([]) }}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: k === kind ? C.brand : C.border, backgroundColor: k === kind ? C.brand : C.card }}>
            <Text style={{ color: k === kind ? '#fff' : C.text, fontWeight: k === kind ? '700' : '500' }}>{requestKindName(t, k)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
        {(['drafts', 'submitted'] as const).map((v) => (
          <Pressable key={v} onPress={() => setView(v)} style={{ flex: 1, paddingVertical: 8, borderBottomWidth: 2, borderColor: v === view ? C.brand : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: v === view ? C.brand : C.muted, fontWeight: '700' }}>
              {v === 'drafts' ? `${t('req.drafts')}${drafts.data ? ` (${drafts.data.length})` : ''}` : t('req.tabSubmitted')}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        data={items}
        keyExtractor={(it) => String(it.id)}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={C.brand} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {kind === 'leave' && balance.data?.[0] && (
              <Card style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  [t('leave.balanceYear', { year: balance.data[0].year }), balance.data[0].entitledHours, C.brand],
                  [t('leave.used'), balance.data[0].usedHours, '#B54708'],
                  [t('leave.remaining'), balance.data[0].remainingHours, balance.data[0].remainingHours < 0 ? C.danger : C.brand],
                ].map(([label, v, color]) => (
                  <View key={String(label)} style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: String(color) }}>{String(v)}</Text>
                    <Text style={[s.muted, { fontSize: 12 }]}>{String(label)} ({t('leave.hours')})</Text>
                  </View>
                ))}
              </Card>
            )}
            {view === 'submitted' && (
              <View style={{ gap: 8 }}>
                <View style={[s.row, { gap: 8 }]}>
                  <Button small kind="ghost" title="‹" onPress={() => setMonth((m) => m - 1)} />
                  <Text style={s.h2}>{range.label}</Text>
                  <Button small kind="ghost" title="›" onPress={() => setMonth((m) => Math.min(1, m + 1))} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['sent', 'mine'] as const).map((sc) => (
                    <Pressable key={sc} onPress={() => setScope(sc)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: sc === scope ? C.brand : C.border, backgroundColor: sc === scope ? C.unread : C.card }}>
                      <Text style={{ color: sc === scope ? C.brand : C.text }}>{t(sc === 'sent' ? 'req.scopeSent' : 'req.scopeMine')}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <QueryState loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} />
          </View>
        }
        ListEmptyComponent={list.isSuccess ? <Text style={[s.muted, { textAlign: 'center', marginTop: 16 }]}>{view === 'drafts' ? t(kind === 'leave' ? 'leave.draftsEmpty' : 'req.draftsEmpty') : t('req.submittedEmpty')}</Text> : undefined}
        renderItem={({ item: it }) => {
          const on = picked.includes(it.id)
          return (
            <Card style={{ gap: 6, borderColor: on ? C.brand : C.border, backgroundColor: on ? C.unread : C.card }}>
              <Pressable disabled={view !== 'drafts'} onPress={() => setPicked((v) => (v.includes(it.id) ? v.filter((x) => x !== it.id) : [...v, it.id]))} style={{ gap: 3 }}>
                <View style={s.row}>
                  <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{view === 'drafts' ? (on ? '☑ ' : '☐ ') : ''}{it.fullName}</Text>
                  {!!it.amount && <Text style={[s.h2, { color: C.brand }]}>{it.amount}</Text>}
                </View>
                <Text style={s.muted}>{it.employeeId}{it.department ? ` · ${it.department}` : ''}</Text>
                <Text style={s.body}>{it.dateText}</Text>
                <Text style={s.body}>{it.timeText}</Text>
                {!!it.reason && <Text style={s.body}>{t('req.reason')}: {it.reason}</Text>}
                {!!it.extra && <Text style={s.muted}>{it.extra}</Text>}
                {view === 'drafts' && it.approvers.filter((a) => a && !/^no need/i.test(a)).length > 0 && (
                  <Text style={s.muted}>{t('req.sectionApprovers')}: {it.approvers.filter((a) => a && !/^no need/i.test(a)).join(' → ')}</Text>
                )}
              </Pressable>
              {view === 'submitted' && (
                <>
                  {it.steps ? <StepStatusList steps={it.steps} /> : (
                    <View style={[s.row, { gap: 8 }]}>
                      <Text style={[s.muted, { flex: 1 }]}>{t('sh.approver')}: {it.approvers[0]}</Text>
                      {it.overall && <Tag text={t(`req.status.${it.overall}`)} color={STATUS_COLOR[it.overall]} />}
                    </View>
                  )}
                  {!!it.rejectReason && <Text style={[s.muted, { color: C.danger }]}>{it.rejectReason}</Text>}
                  <Text style={s.muted}>{t('req.sender')}: {it.senderName || it.senderId}</Text>
                  {it.canCancel && <Button small kind="danger" title={t('req.cancelRequest')} onPress={() => askCancel(it)} disabled={cancel.isPending} />}
                </>
              )}
              {view === 'drafts' && !short && <Button small kind="ghost" title={t('req.edit')} onPress={() => openForm({ draftId: String(it.id), department: it.department ?? '' })} />}
            </Card>
          )
        }}
      />

      <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
        {view === 'drafts' && picked.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}><Button title={`${t('req.submit')} (${picked.length})`} onPress={askSubmit} disabled={busy} /></View>
            <View style={{ flex: 1 }}><Button kind="danger" title={`${t('req.delete')} (${picked.length})`} onPress={askDelete} disabled={busy} /></View>
          </View>
        ) : (
          <Button title={`+ ${t('req.tabRegister')} · ${requestKindName(t, kind)}`} onPress={() => openForm()} />
        )}
      </View>

      <LateSubmitModal open={lateOpen} count={lateCount} busy={submit.isPending} onClose={() => setLateOpen(false)} onSubmit={(late) => submit.mutate(late)} />
    </View>
  )
}

/** HR gửi đơn bổ sung trễ hạn: "Lỗi do" (cá nhân / công ty) + ghi chú (LateSubmitFields của web). */
function LateSubmitModal({ open, count, busy, onClose, onSubmit }: { open: boolean; count: number; busy: boolean; onClose: () => void; onSubmit: (v: LateSubmit) => void }) {
  const { t } = useTranslation()
  const [fault, setFault] = useState<'personal' | 'company'>('personal')
  const [note, setNote] = useState('')
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 24 }}>
        <View style={[s.card, { gap: 12 }]}>
          <Text style={s.h2}>{t('req.submit')}</Text>
          <Text style={[s.body, { color: '#B54708' }]}>{t('late.hrText', { n: count })}</Text>
          <Text style={s.muted}>{t('late.fault')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['personal', 'company'] as const).map((f) => (
              <Pressable key={f} onPress={() => setFault(f)} style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', borderColor: f === fault ? C.brand : C.border, backgroundColor: f === fault ? C.unread : C.card }}>
                <Text style={{ color: f === fault ? C.brand : C.text, textAlign: 'center' }}>{t(f === 'personal' ? 'late.faultPersonal' : 'late.faultCompany')}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]} multiline maxLength={500} value={note} onChangeText={setNote} placeholder={t('late.note')} />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Button kind="ghost" title={t('req.cancel')} onPress={onClose} disabled={busy} />
            <Button title={t('req.submit')} onPress={() => onSubmit({ lateFault: fault, lateNote: note.trim() || undefined })} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
