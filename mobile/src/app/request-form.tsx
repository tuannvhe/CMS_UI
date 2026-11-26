/*
 * 2026-11-23 [Truong] - Mobile app: register a request (add to drafts) or edit a draft
 * Same rules as the web RegisterTab / LeaveRegisterTab / ShortRequestsPage and the edit modals; the server re-checks everything.
 * Params: kind (required), draftId (edit), date (yyyy-MM-dd, prefilled from the attendance tab), department (edit: approver scope of the draft).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { leave, lookups, requests, type Approver, type CreateResult, type DraftForm, type LastLine, type WindowKind } from '@web/api/requests'
import { shortRequests } from '@web/api/shortRequests'
import { useApproverScope } from '@web/hooks/useApproverScope'
import { useLastLine } from '@web/hooks/useLastLine'
import { isPastSelfService, useSelfService } from '@web/utils/selfService'
import { MAX_LEAVE_DAYS } from '@web/pages/leave/leaveLimits'
import { useAuth } from '../auth/AuthProvider'
import { ApproverChainField } from '../components/ApproverChainField'
import { DateField, TimeField } from '../components/DateField'
import { EmployeePicker, peopleIds, type PeopleValue } from '../components/EmployeePicker'
import { SelectField } from '../components/SelectSheet'
import { dmy, draftsKey, duration, fromYmd, isRequestKind, isShortKind, requestError, requestKindName, skipText, toYmd, warnText, MIN_APPROVERS, type MobileRequestKind } from '../requests'
import { Button, Card, useTheme } from '../ui'
import { KeyboardView } from '../keyboard'

const LONG = 10 * 60 * 1000

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const { C, s } = useTheme()
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.brand, color: C.onBrand, textAlign: 'center', lineHeight: 24, fontWeight: '700', overflow: 'hidden' }}>{n}</Text>
        <Text style={s.h2}>{title}</Text>
      </View>
      {children}
    </Card>
  )
}

function Choice({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const { C } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)}
          accessibilityRole="radio" accessibilityState={{ checked: value === o.key }} style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, alignItems: 'center', borderColor: value === o.key ? C.brand : C.border, backgroundColor: value === o.key ? C.brandSoft : C.card }}>
          <Text style={{ color: value === o.key ? C.brand : C.text, fontWeight: value === o.key ? '700' : '500' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export default function RequestFormScreen() {
  const { C, s } = useTheme()
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuth()
  const p = useLocalSearchParams<{ kind: string; draftId?: string; date?: string; department?: string }>()
  const kind: MobileRequestKind = isRequestKind(p.kind) ? p.kind : 'overtime'
  const draftId = Number(p.draftId) || 0
  const editing = draftId > 0 && !isShortKind(kind)
  const isLeave = kind === 'leave'
  const isShort = isShortKind(kind)
  const isGoOut = kind === 'goout'
  const selfId = user?.employeeId ?? ''

  // ---- 1. Người được đăng ký
  const [people, setPeople] = useState<PeopleValue>({ mode: 'self', checked: [], manual: '' })
  const setDepartment = useCallback((d: string) => setPeople((v) => ({ ...v, department: d })), [])
  const ids = editing ? [] : peopleIds(people, selfId)

  // ---- 2. Thời gian / lý do
  const [date, setDate] = useState<string | undefined>(p.date && fromYmd(p.date) ? p.date : isShort ? toYmd(new Date()) : undefined)
  const [dateTo, setDateTo] = useState<string | undefined>()
  const [totalDays, setTotalDays] = useState('')
  const [shift, setShift] = useState<string>()
  const [timeA, setTimeA] = useState<string>()
  const [timeB, setTimeB] = useState<string>()
  const [reasonCode, setReasonCode] = useState<string>()
  const [reasonText, setReasonText] = useState('')
  const [person, setPerson] = useState('')
  const [company, setCompany] = useState(false)
  const [comeBack, setComeBack] = useState(false)
  const [backTime, setBackTime] = useState<string>()

  // ---- 3. Người duyệt
  const [ap, setAp] = useState<(string | undefined)[]>([])
  const [shortApprover, setShortApprover] = useState<string>()

  const [result, setResult] = useState<CreateResult | null>(null)
  const [error, setError] = useState('')

  // ---- Danh mục
  const timesKind = kind === 'overtime' ? 'overtime' : 'finger'   // nghỉ phép dùng giờ vào / ra của quên vân tay (như web)
  const shifts = useQuery({ queryKey: ['req', 'shifts'], queryFn: lookups.shifts, staleTime: LONG, enabled: !isShort })
  const times = useQuery({ queryKey: ['req', 'times', timesKind, shift], queryFn: () => lookups.times(timesKind, shift!), enabled: !isShort && !!shift, staleTime: LONG })
  const fingerReasons = useQuery({ queryKey: ['req', 'reasons'], queryFn: lookups.fingerReasons, staleTime: LONG, enabled: kind === 'finger' })
  const leaveReasons = useQuery({ queryKey: ['req', 'leave-reasons'], queryFn: leave.reasons, staleTime: LONG, enabled: isLeave })

  // Phạm vi người duyệt: sửa nháp = bộ phận của nháp; đăng ký = bộ phận đã chọn, không thì suy từ mã nhân viên (mã của mình / mã gõ tay đầu tiên)
  const probe = people.mode === 'self' ? selfId : people.manual
  const { scope: inferredScope, inferred } = useApproverScope(editing ? p.department : people.department, editing ? '' : probe)
  const scope = editing ? p.department || inferredScope : inferredScope
  const approvers = useQuery({ queryKey: ['req', 'approvers', scope], queryFn: () => lookups.approvers(scope!), enabled: !!scope, staleTime: 60_000 })

  // Line duyệt của đơn gần nhất (chỉ khi đăng ký mới, chưa gõ mã tay)
  const applyLast = useCallback((line: LastLine, list: Approver[]) => {
    if (isShort) {   // đơn ngắn lưu email người duyệt: khớp lại theo email
      const email = (line.email ?? '').trim().toLowerCase()
      const hit = list.find((a) => (a.email ?? '').trim().toLowerCase() === email || a.userId.trim().toLowerCase() === email) ?? list.find((a) => a.name === line.name)
      if (hit) setShortApprover(hit.userId)
      return
    }
    const ok = (id?: string) => (id && list.some((a) => a.userId === id) ? id : undefined)
    setAp(line.approvers.slice(0, isLeave ? 4 : 3).map(ok))
  }, [isShort, isLeave])
  const lastLine = useLastLine(kind, people.department, setDepartment, approvers.data, applyLast, !editing && people.manual.trim().length === 0)

  // ---- Sửa nháp: nạp nội dung
  const draft = useQuery({
    queryKey: ['req', 'draft', kind, draftId], enabled: editing, gcTime: 0,
    queryFn: () => (isLeave ? leave.draft(draftId) : requests.draft(kind as 'finger' | 'overtime', draftId)),
  })
  useEffect(() => {
    const d: DraftForm | undefined = draft.data
    if (!d) return
    setDate(d.date.slice(0, 10)); setShift(d.shift); setTimeA(d.timeFrom); setTimeB(d.timeTo); setReasonCode(d.reasonCode ?? undefined)
    if (isLeave) {
      setDateTo((d.dateTo ?? d.date).slice(0, 10)); setTotalDays(d.totalDays ? d.totalDays.replace(',', '.') : '')
      setPerson(d.personTakeJob ?? ''); setReasonText(d.reasonText ?? '')
    } else setReasonText(d.reasonText ?? '')
    setAp(d.approverIds.slice(0, isLeave ? 4 : 3).map((x) => x || undefined))
  }, [draft.data, isLeave])

  // ---- Phép năm còn lại của những người đang chọn (nghỉ phép)
  const idsKey = ids.slice(0, 50).join(',')
  const balance = useQuery({ queryKey: ['req', 'leave-balance', idsKey], queryFn: () => leave.balance(ids.slice(0, 50)), enabled: isLeave && ids.length > 0, staleTime: 60_000 })
  const days = Number(totalDays.replace(',', '.'))
  const daysOk = Number.isFinite(days) && days > 0 && days <= MAX_LEAVE_DAYS && (Number.isInteger(days) || days === 0.5)
  const needHours = daysOk ? days * 8 : 0

  // ---- Hạn tự gửi (người không phải HR được báo trước; máy chủ vẫn chặn)
  const selfRule = useSelfService()
  const pastDeadline = !isShort && !!date && !!selfRule && !selfRule.bypass && isPastSelfService(date, selfRule, kind as WindowKind)

  // ---- Kiểm tra form
  const otherReason = kind === 'finger' && fingerReasons.data?.find((r) => r.value === reasonCode)?.label === 'Lý do khác'
  const dur = !isShort && !isLeave ? duration(timeA, timeB) : null
  const dayName = date ? fromYmd(date)?.toLocaleDateString(i18n.language, { weekday: 'long' }) : ''
  const later = (a?: string, b?: string) => !!a && !!b && b > a
  const chainOk = ap.filter(Boolean).length >= MIN_APPROVERS
  const valid = (() => {
    if (!editing && ids.length === 0) return false
    if (isShort) {
      const timesOk = isGoOut ? !!timeA && (!comeBack || (!!backTime && (!!dateTo && dateTo !== date ? true : later(timeA, backTime)))) : later(timeA, timeB)
      return !!date && timesOk && !!reasonText.trim() && !!shortApprover && (!isGoOut || !dateTo || dateTo >= date)
    }
    if (isLeave) return !!date && !!dateTo && dateTo >= date && daysOk && !!shift && !!timeA && !!timeB && !!reasonCode && !!person.trim() && chainOk
    const reasonOk = kind === 'finger' ? !!reasonCode && (!otherReason || !!reasonText.trim()) : !!reasonText.trim()
    return !!date && !!shift && !!dur && reasonOk && chainOk
  })()

  const pick = (userId?: string) => (userId ? { userId, name: approvers.data?.find((a) => a.userId === userId)?.name } : undefined)

  const save = useMutation({
    mutationFn: async (): Promise<CreateResult | null> => {
      if (isShort) {
        return shortRequests.create(kind, {
          employeeIds: ids, date: date!, dateTo: isGoOut && dateTo ? dateTo : undefined, timeFrom: timeA!, timeTo: isGoOut ? undefined : timeB,
          company: isGoOut && company, comeBack: isGoOut && comeBack, comeBackTime: isGoOut && comeBack ? backTime : undefined,
          reason: reasonText.trim(), approver: { userId: shortApprover },
        })
      }
      if (isLeave) {
        const form = {
          employeeIds: ids, from: date!, to: dateTo!, totalDays: days, shift: shift!, timeIn: timeA!, timeOut: timeB!, reasonCode: reasonCode!,
          otherReason: reasonText.trim() || undefined, personTakeJob: person.trim(), approvers: { one: pick(ap[0]), two: pick(ap[1]), three: pick(ap[2]), four: pick(ap[3]) },
        }
        if (editing) { await leave.updateDraft(draftId, form); return null }
        return leave.create(form)
      }
      const base = { employeeIds: ids, date: date!, shift: shift!, approvers: { one: pick(ap[0]), two: pick(ap[1]), three: pick(ap[2]) } }
      const finger = { ...base, timeIn: timeA!, timeOut: timeB!, reasonCode: reasonCode!, reasonText: reasonText.trim() || undefined }
      const overtime = { ...base, timeStart: timeA!, timeEnd: timeB!, reasonText: reasonText.trim() }
      if (editing) { await (kind === 'finger' ? requests.updateDraft('finger', draftId, finger) : requests.updateDraft('overtime', draftId, overtime)); return null }
      return kind === 'finger' ? requests.create('finger', finger) : requests.create('overtime', overtime)
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: draftsKey(kind) })
      setError('')
      if (!r) { router.back(); return }   // đã lưu sửa nháp
      setResult(r)   // giữ nguyên lựa chọn để thêm tiếp như web
    },
    onError: (e) => { setResult(null); setError(requestError(t, e, kind)) },
  })

  const labelA = isShort ? (isGoOut ? t('sh.timeOut') : t('sh.fromTime')) : kind === 'overtime' ? t('req.otFrom') : t('req.timeIn')
  const labelB = isShort ? t('sh.toTime') : kind === 'overtime' ? t('req.otTo') : t('req.timeOut')
  const timeOptions = (list?: string[]) => (list ?? []).map((x) => ({ value: x, label: x }))
  const approverList = approvers.data ?? []

  if (editing && draft.isLoading) return <SafeAreaView style={s.screen}><Text style={[s.muted, { padding: 24, textAlign: 'center' }]}>{t('mobile.loading')}</Text></SafeAreaView>

  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: `${editing ? t('req.edit') : t('req.tabRegister')} · ${requestKindName(t, kind)}`, headerBackTitle: t('mobile.login.back') }} />
      {/* SafeAreaView đã chừa phần dưới: bàn phím đè lên phần đó */}
      <KeyboardView bottomInset={insets.bottom}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* 1. Người */}
          {editing ? (
            draft.data && <Card><Text style={s.h2}>{draft.data.employeeId} · {draft.data.fullName}</Text>{!!p.department && <Text style={s.muted}>{p.department}</Text>}</Card>
          ) : (
            <Section n={1} title={t('req.sectionEmployees')}>
              <EmployeePicker value={people} onChange={setPeople} selfId={selfId} selfName={user?.fullName ?? ''} />
            </Section>
          )}

          {/* 2. Thời gian và lý do */}
          <Section n={editing ? 1 : 2} title={isLeave ? t('leave.sectionPeriod') : t('req.sectionTime')}>
            {isLeave ? (
              <>
                <DateField label={t('leave.from')} value={date} onChange={(v) => {
                  setDate(v)
                  if (v && (!dateTo || dateTo < v)) setDateTo(v)
                  const a = fromYmd(v), b = fromYmd(dateTo && v && dateTo >= v ? dateTo : v)
                  if (a && b) setTotalDays(String(Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1))
                }} />
                <DateField label={t('leave.to')} value={dateTo} onChange={(v) => {
                  setDateTo(v)
                  const a = fromYmd(date), b = fromYmd(v)
                  if (a && b && b >= a) setTotalDays(String(Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1))
                }} />
                <View style={{ gap: 4 }}>
                  <Text style={[s.muted, { fontSize: 11 }]}>{t('leave.totalDays')}</Text>
                  <TextInput style={[s.input, totalDays !== '' && !daysOk && { borderColor: C.danger }]} value={totalDays} onChangeText={setTotalDays} keyboardType="decimal-pad" />
                  <Text style={[s.muted, { fontSize: 12 }]}>{t('leave.totalDaysHint')}</Text>
                </View>
              </>
            ) : (
              <>
                <DateField label={isShort ? t('att.date') : t('req.date')} value={date} onChange={setDate} />
                {isGoOut && <DateField label={t('sh.toDate')} value={dateTo} onChange={setDateTo} allowClear />}
                {!!dayName && !isGoOut && <Text style={s.muted}>{t('req.dayOfWeek')}: <Text style={{ fontWeight: '700', color: C.text }}>{dayName}</Text></Text>}
              </>
            )}

            {!isShort && (
              <>
                <SelectField label={t('att.shift')} value={shift} loading={shifts.isLoading} options={(shifts.data ?? []).map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(v) => { setShift(v); setTimeA(undefined); setTimeB(undefined) }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><SelectField label={labelA} value={timeA} options={timeOptions(times.data?.start)} onChange={setTimeA} disabled={!shift} loading={times.isLoading} /></View>
                  <View style={{ flex: 1 }}><SelectField label={labelB} value={timeB} options={timeOptions(times.data?.end)} onChange={setTimeB} disabled={!shift} loading={times.isLoading} /></View>
                </View>
                {dur && <Text style={s.body}>{t('req.total')}: <Text style={{ fontWeight: '700' }}>{dur.hours}</Text> {t('att.hours')} ({dur.minutes} {t('req.minutesUnit')})</Text>}
              </>
            )}

            {isShort && (isGoOut ? (
              <>
                <TimeField label={labelA} value={timeA} onChange={setTimeA} />
                <Choice value={company ? 'company' : 'personal'} onChange={(k) => setCompany(k === 'company')}
                  options={[{ key: 'personal', label: t('sh.purposePersonal') }, { key: 'company', label: t('sh.purposeCompany') }]} />
                <Choice value={comeBack ? 'yes' : 'no'} onChange={(k) => setComeBack(k === 'yes')}
                  options={[{ key: 'no', label: t('sh.comeBackNo') }, { key: 'yes', label: t('sh.comeBackYes') }]} />
                {comeBack && <TimeField label={t('sh.comeBackTime')} value={backTime} onChange={setBackTime} />}
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TimeField label={labelA} value={timeA} onChange={setTimeA} />
                <TimeField label={labelB} value={timeB} onChange={setTimeB} />
              </View>
            ))}

            {kind === 'finger' && (
              <>
                <SelectField label={t('req.reason')} value={reasonCode} loading={fingerReasons.isLoading} options={(fingerReasons.data ?? []).map((o) => ({ value: o.value, label: o.label }))} onChange={setReasonCode} />
                {otherReason && <TextInput style={[s.input, { minHeight: 64 }]} multiline value={reasonText} onChangeText={setReasonText} placeholder={t('req.reasonOtherPlaceholder')} />}
              </>
            )}
            {kind === 'overtime' && <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline value={reasonText} onChangeText={setReasonText} placeholder={t('req.reasonPlaceholder')} />}
            {isLeave && (
              <>
                <SelectField label={t('leave.reasonSelect')} value={reasonCode} loading={leaveReasons.isLoading} options={(leaveReasons.data ?? []).map((o) => ({ value: o.value, label: o.label }))} onChange={setReasonCode} />
                <TextInput style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]} multiline maxLength={500} value={person} onChangeText={setPerson} placeholder={t('leave.personTakeJob')} />
                <TextInput style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]} multiline maxLength={500} value={reasonText} onChangeText={setReasonText} placeholder={t('leave.otherReason')} />
              </>
            )}
            {isShort && <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline maxLength={500} value={reasonText} onChangeText={setReasonText} placeholder={t('sh.reasonPh')} />}

            {isLeave && balance.data && ids.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={s.muted}>{t('leave.balanceOf')}{needHours > 0 ? ` · ${t('leave.needHours', { h: needHours })}` : ''}</Text>
                {ids.map((id) => {
                  const b = balance.data!.find((x) => x.employeeId === id)
                  if (!b) return <Text key={id} style={s.muted}>{id}: {t('leave.balanceNone')}</Text>
                  const over = needHours > 0 && reasonCode === 'CDR16' && b.remainingHours < needHours
                  return <Text key={id} style={[s.body, { color: b.remainingHours < 0 ? C.danger : over ? C.warn : C.brand }]}>{b.employeeId} · {b.fullName}: {b.remainingHours} {t('leave.hours')}{over ? ` — ${t('leave.overLimit')}` : ''}</Text>
                })}
              </View>
            )}
          </Section>

          {/* 3. Người duyệt */}
          <Section n={editing ? 2 : 3} title={isShort ? t('sh.approver') : t('req.sectionApprovers')}>
            {isShort ? (
              <>
                <SelectField label={t('sh.approver')} value={shortApprover} onChange={setShortApprover} disabled={!scope} loading={approvers.isLoading} allowClear
                  options={approverList.map((a) => ({ value: a.userId, label: a.email ? a.name : `${a.name} — ${t('sh.noEmail')}`, disabled: !a.email }))} />
                <Text style={[s.muted, { fontSize: 12 }]}>{t('sh.approverHint')}</Text>
              </>
            ) : (
              <>
                <ApproverChainField count={isLeave ? 4 : 3} values={ap} onChange={setAp} disabled={!scope} loading={approvers.isLoading}
                  approvers={[...approverList, ...ap.filter((id): id is string => !!id && !approverList.some((a) => a.userId === id)).map((id) => ({ userId: id, name: id, level: 0 }))]} />
                <Text style={[s.muted, { fontSize: 12 }]}>{isLeave ? t('leave.approverHint') : t('req.approverHint')}</Text>
              </>
            )}
            {!!inferred && !editing && <Text style={[s.muted, { fontSize: 12 }]}>{t('req.scopeOf', { scope: inferred })}</Text>}
            {!!lastLine && people.department === lastLine.scope && !editing && <Text style={[s.muted, { fontSize: 12 }]}>{t('req.lastLineHint')}</Text>}
          </Section>

          {pastDeadline && date && selfRule && (
            <Card style={{ backgroundColor: C.warnSoft, borderColor: C.warn, gap: 4 }}>
              <Text style={s.h2}>{t('late.warnTitle')}</Text>
              <Text style={s.body}>{t('late.warnText', { period: `${date.slice(5, 7)}/${date.slice(0, 4)}`, day: selfRule.untilDay })}</Text>
            </Card>
          )}

          {!!error && <Text style={s.error}>{error}</Text>}
          {result && (
            <Card style={{ gap: 6, borderColor: result.created > 0 ? (result.skipped.length ? C.warn : C.brand) : C.danger }}>
              <Text style={s.h2}>{result.created > 0 ? t('req.createdCount', { n: result.created }) : t('req.createdNone')}</Text>
              {[...result.skipped.map((x) => skipText(t, x)), ...(result.warnings ?? []).map((x) => warnText(t, x))].map((line, i) => <Text key={i} style={s.muted}>{line}</Text>)}
              {result.created > 0 && <Button small kind="ghost" title={t('mobile.reqf.viewDrafts')} onPress={() => router.back()} />}
            </Card>
          )}
        </ScrollView>

        <View style={{ padding: 12, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card, gap: 6 }}>
          {!editing && (ids.length > 0 || date) && (
            <Text style={[s.muted, { textAlign: 'center' }]}>
              {[ids.length > 0 ? t('req.countSelectedShort', { n: ids.length }) : '', date ? dmy(date) + (isLeave && dateTo && dateTo !== date ? ` → ${dmy(dateTo)}` : '') : '', dur ? `${dur.hours} ${t('att.hours')}` : '', isLeave && daysOk ? `${days} ${t('leave.days').toLowerCase()}` : ''].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Button title={editing ? t('req.saveChanges') : `${t('req.add')}${ids.length > 0 ? ` (${ids.length})` : ''}`} onPress={() => save.mutate()} disabled={!valid || save.isPending} />
        </View>
      </KeyboardView>
    </SafeAreaView>
  )
}
