/*
 * 2026-11-26 - Mobile app: tab Phản hồi công (cùng API / quy tắc với màn web /attendance/complaints)
 * Tab chỉ hiện khi máy chủ cho thấy trang (ngày 1–7 hằng tháng mở cho tất cả, ngoài khoảng đó theo phân quyền menu); xem access.ts.
 * Hỏi đáp tách ra bong bóng chat nổi (components/QaBubble.tsx → màn /qa).
 */
import { useRef, useState, type ComponentRef } from 'react'
import { Alert, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { COMPLAINT_CATEGORIES, complaints, type ComplaintCategory, type ComplaintRow, type ComplaintStatus } from '@web/api/complaints'
import { apiErrorCode } from '@web/api/requests'
import { errorCode } from '../../api/client'
import { useAccess } from '../../access'
import { DateField } from '../../components/DateField'
import { KeyboardView } from '../../keyboard'
import { dmy, toYmd } from '../../requests'
import { Button, Card, Chip, ChipRow, EmptyState, IconBadge, QueryState, SectionTitle, Tag, TabHero, useTheme, type Colors } from '../../ui'

export default function FeedbackTab() {
  const { t } = useTranslation()
  const { s } = useTheme()
  const acc = useAccess()
  return (
    <View style={s.screen}>
      <TabHero title={t('nav.complaints')} subtitle={t('nav.complaintsDesc')} />
      {acc.showComplaints ? <ComplaintsView /> : <EmptyState text={t('mobile.fb.closed')} icon="lock-closed-outline" />}
    </View>
  )
}

const statusTone = (C: Colors): Record<ComplaintStatus, string> => ({ new: C.info, processing: C.warn, resolved: C.brand, rejected: C.danger })
const fmtTime = (v?: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ComplaintsView() {
  const { t } = useTranslation()
  const { C, s } = useTheme()
  const qc = useQueryClient()
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)
  const formY = useRef(0)
  const msgY = useRef(0)
  const q = useQuery({ queryKey: ['complaints', 'mine'], queryFn: complaints.mine })
  const yesterday = toYmd(new Date(Date.now() - 86_400_000))
  const [date, setDate] = useState<string | undefined>(yesterday)
  const [category, setCategory] = useState<ComplaintCategory | null>(null)
  const [message, setMessage] = useState('')
  const limits = q.data?.limits
  const blocked = new Map((limits?.blocked ?? []).map((b) => [b.date.slice(0, 10), b]))
  const waitUntil = limits?.nextAllowedAt && new Date(limits.nextAllowedAt).getTime() > Date.now() ? limits.nextAllowedAt : null
  const full = !!limits && limits.used >= limits.max

  const errText = (e: unknown) => {
    if (errorCode(e) === 'network') return t('mobile.err.network')
    const { code, detail } = apiErrorCode(e)
    return t(`cmp.err.${detail || code}`, { defaultValue: t('mobile.err.generic'), h: limits?.cooldownHours ?? 24, m: limits?.minGapMinutes ?? 120, n: limits?.max ?? 6 })
  }
  const create = useMutation({
    mutationFn: () => complaints.create({ workDate: date!, category: category!, message: message.trim() }),
    onSuccess: () => { setMessage(''); setCategory(null); Alert.alert(t('cmp.sent')); void qc.invalidateQueries({ queryKey: ['complaints'] }) },
    onError: (e) => { Alert.alert(t('cmp.new'), errText(e)); void qc.invalidateQueries({ queryKey: ['complaints'] }) },
  })

  // Kiểm tra giống ô chọn ngày của web: không ngày tương lai, trong 62 ngày, ngày đang có phản hồi mở / đang chờ thì chưa gửi được
  const dateProblem = (() => {
    if (!date) return ''
    const today = toYmd(new Date())
    const oldest = toYmd(new Date(Date.now() - 62 * 86_400_000))
    if (date > today || date < oldest) return t('cmp.err.date')
    const b = blocked.get(date)
    if (b) return b.reason === 'open' ? t('cmp.lim.blockedOpen') : t('cmp.lim.blockedCool', { t: fmtTime(b.until) })
    return ''
  })()
  const msgLen = message.trim().length
  const canSend = !!date && !!category && msgLen >= 5 && msgLen <= 1000 && !dateProblem && !create.isPending

  const send = () => {
    if (!canSend) return
    const body = [
      `${t('cmp.lim.confirmDay')}: ${dmy(date)}`,
      `${t('cmp.lim.confirmCat')}: ${t(`cmp.cat.${category}`)}`,
      limits ? t('cmp.lim.confirmBody', { gap: limits.minGapMinutes, left: Math.max(0, limits.max - limits.used), max: limits.max, h: limits.windowHours }) : '',
    ].filter(Boolean).join('\n\n')
    Alert.alert(t('cmp.lim.confirmTitle'), body, [
      { text: t('cmp.lim.back'), style: 'cancel' },
      { text: t('cmp.lim.confirmOk'), onPress: () => create.mutate() },
    ])
  }

  if (q.data && !q.data.ready) return <EmptyState text={t('mobile.err.table_missing')} icon="construct-outline" />
  const tone = statusTone(C)
  return (
    <KeyboardView>
    <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={C.brand} />}>
      <QueryState loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} />
      {q.isSuccess && (
        <>
          <Card style={{ flexDirection: 'row', gap: 12, backgroundColor: waitUntil || full ? C.warnSoft : C.brandSoft, borderColor: 'transparent' }}>
            <Ionicons name={waitUntil || full ? 'warning-outline' : 'information-circle-outline'} size={22} color={waitUntil || full ? C.warn : C.brand} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[s.body, { fontSize: 14 }]}>{t('cmp.note')}</Text>
              {limits && <Text style={[s.muted]}>{t('cmp.lim.rule', { max: limits.max, h: limits.windowHours, used: limits.used, gap: limits.minGapMinutes, cool: limits.cooldownHours })}</Text>}
              {waitUntil && <Text style={[s.body, { fontSize: 14, color: C.warn, fontWeight: '700' }]}>{t(full ? 'cmp.lim.full' : 'cmp.lim.wait', { t: fmtTime(waitUntil), max: limits?.max, h: limits?.windowHours })}</Text>}
            </View>
          </Card>

          <View onLayout={(e) => { formY.current = e.nativeEvent.layout.y }}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconBadge name="create-outline" />
              <Text style={s.h2}>{t('cmp.new')}</Text>
            </View>
            <DateField label={t('cmp.workDate')} value={date} onChange={setDate} />
            {!!dateProblem && <Text style={[s.muted, { color: C.danger }]}>{dateProblem}</Text>}
            <Text style={s.h3}>{t('cmp.category')}</Text>
            <ChipRow>
              {COMPLAINT_CATEGORIES.map((c) => <Chip key={c} label={t(`cmp.cat.${c}`)} on={category === c} onPress={() => setCategory(c)} />)}
            </ChipRow>
            <Text style={s.h3}>{t('cmp.message')}</Text>
            <TextInput value={message} onChangeText={setMessage} multiline onLayout={(e) => { msgY.current = e.nativeEvent.layout.y }}
              onFocus={() => setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, formY.current + msgY.current - 80), animated: true }), 300)} maxLength={1000} placeholder={t('cmp.messageHint')} placeholderTextColor={C.faint}
              style={[s.input, { minHeight: 110, textAlignVertical: 'top', minWidth: 0 }]} />
            <Text style={[s.muted, { fontSize: 12, textAlign: 'right' }]}>{msgLen}/1000</Text>
            <Button title={t('cmp.send')} icon="paper-plane" onPress={send} disabled={!canSend || full || !!waitUntil} loading={create.isPending} />
          </Card>
          </View>

          <SectionTitle title={t('cmp.mine')} />
          {(q.data.items ?? []).length === 0 && <EmptyState text={t('cmp.empty')} icon="chatbox-outline" />}
          {(q.data.items ?? []).map((r: ComplaintRow) => (
            <Card key={r.id} style={{ gap: 8 }}>
              <View style={[s.row, { gap: 8, alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.h2}>{dmy(r.workDate)} · {t(`cmp.cat.${r.category}`)}</Text>
                  {!!r.createdAt && <Text style={[s.muted, { fontSize: 12 }]}>{t('cmp.sentAt')} {fmtTime(r.createdAt)}</Text>}
                </View>
                <Tag text={r.overdue ? t('cmp.overdue') : t(`cmp.st.${r.status}`)} color={r.overdue ? C.danger : tone[r.status]} />
              </View>
              <Text style={[s.body, { fontSize: 14 }]}>{r.message}</Text>
              {r.reply ? (
                <View style={{ backgroundColor: C.cardAlt, borderRadius: 12, padding: 10, gap: 2, borderLeftWidth: 3, borderLeftColor: tone[r.status] }}>
                  <Text style={[s.muted, { fontWeight: '700', color: C.text }]}>{r.handlerName ?? r.handler ?? 'HR'}</Text>
                  <Text style={[s.body, { fontSize: 14 }]}>{r.reply}</Text>
                </View>
              ) : <Text style={[s.muted, { fontSize: 12 }]}>{t('cmp.due', { d: dmy(r.dueDate) })}</Text>}
            </Card>
          ))}
        </>
      )}
    </ScrollView>
    </KeyboardView>
  )
}
