/*
 * 2026-11-23 [Truong] - Mobile app: my attendance by month (same data as the web AttendancePage: /attendance/me, employee taken from the token)
 * Summary tiles, one card per day (tap to see the day's OT requests / finger forms), shortcuts to register a missed punch / overtime on flagged days.
 */
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getMyAttendance, type AttendanceDay } from '@web/api/attendance'
import { apiErrorCode } from '@web/api/requests'
import { trServer } from '@web/utils/serverText'
import { useAuth } from '../../auth/AuthProvider'
import { dmy, toYmd } from '../../requests'
import { Button, C, Card, EmptyState, IconBadge, type IconName, Tag, TabHero, s } from '../../ui'

/** Cờ "cần xem lại" sửa bằng đơn quên vân tay (attendanceColumns.tsx của web). */
const FINGER_FLAGS = ['missing_in', 'missing_out', 'absent', 'hy_no_punch']

const monthRange = (offset: number) => {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { from: toYmd(first), to: toYmd(last < now ? last : now), label: `${String(first.getMonth() + 1).padStart(2, '0')}/${first.getFullYear()}` }
}

const n1 = (v: number | null | undefined) => (v == null ? 0 : Math.round(v * 100) / 100)

export default function AttendanceTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [month, setMonth] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const range = monthRange(month)
  const q = useQuery({ queryKey: ['me', 'attendance', range.from, range.to], queryFn: () => getMyAttendance(range.from, range.to), enabled: !!user?.employeeId, retry: false })
  const sum = q.data?.summary

  const code = q.isError ? apiErrorCode(q.error).code : ''
  const errText = !user?.employeeId || code === 'no_employee' ? t('att.noEmployee') : code === 'invalid_range' ? t('att.invalid_range') : code === 'forbidden' ? t('att.forbidden') : q.isError ? t('att.loadFailed') : ''

  const tiles: [string, number, string, string, IconName][] = sum ? [
    [t('att.present'), sum.presentDays, t('att.days'), C.brand, 'checkmark-circle'],
    [t('att.absent'), sum.absentDays, t('att.days'), C.danger, 'close-circle'],
    [t('att.manual'), sum.manualDays, t('att.days'), C.info, 'finger-print'],
    [t('att.dayWork'), n1(sum.dayWorkHours), t('att.hours'), C.accent, 'sunny'],
    [t('att.nightWork'), n1(sum.nightWorkHours), t('att.hours'), C.purple, 'moon'],
    [t('att.otHours'), n1(sum.otHours), t('att.hours'), C.warn, 'flash'],
    [t('att.leave'), n1(sum.annualLeaveHours), t('att.hours'), C.teal, 'airplane'],
  ] : []

  const sub = [user?.fullName, user?.employeeId, q.data?.department].filter(Boolean).join(' · ')

  return (
    <View style={s.screen}>
      <TabHero title={t('mobile.tab.attendance')} subtitle={sub}>
        {/* Đổi tháng ngay trên header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 6 }}>
          <Pressable onPress={() => setMonth((m) => m - 1)} hitSlop={8} style={({ pressed }) => [heroBtn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{range.label}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5 }}>{dmy(range.from)} – {dmy(range.to)}</Text>
          </View>
          <Pressable onPress={() => setMonth((m) => Math.min(0, m + 1))} disabled={month >= 0} hitSlop={8} style={({ pressed }) => [heroBtn, (pressed || month >= 0) && { opacity: month >= 0 ? 0.3 : 0.6 }]}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </TabHero>
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      data={q.data ? [...q.data.rows].reverse() : []}
      keyExtractor={(r) => r.date}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={C.brand} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {!!errText && <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><IconBadge name="alert-circle" color={C.danger} /><Text style={[s.body, { flex: 1, color: C.danger }]}>{errText}</Text></Card>}
          {q.isLoading && <Text style={[s.muted, { textAlign: 'center', paddingVertical: 12 }]}>{t('mobile.loading')}</Text>}
          {tiles.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {tiles.map(([label, value, unit, color, icon]) => (
                <View key={label} style={[s.card, { flexGrow: 1, flexBasis: '30%', maxWidth: '32%', padding: 12, gap: 8 }]}>
                  <IconBadge name={icon} color={color} size={32} />
                  <View>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{value}<Text style={{ fontSize: 12, fontWeight: '600', color: C.muted }}> {unit}</Text></Text>
                    <Text style={[s.muted, { fontSize: 12 }]} numberOfLines={1}>{label}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {q.data && q.data.rows.length > 0 && <Text style={[s.h2, { marginTop: 4 }]}>{t('mobile.att.daily', { defaultValue: t('nav.attendance') })}</Text>}
        </View>
      }
      renderItem={({ item }) => <DayCard r={item} open={open === item.date} onToggle={() => setOpen((d) => (d === item.date ? null : item.date))} />}
      ListEmptyComponent={q.isSuccess ? <EmptyState text={t('mobile.empty')} icon="calendar-outline" /> : undefined}
    />
    </View>
  )
}

const heroBtn = { width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255,255,255,0.14)' }

function DayCard({ r, open, onToggle }: { r: AttendanceDay; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const holiday = r.dayKind === 'Ngày Lễ'
  const off = r.dayKind === 'Ngày nghỉ'
  const absent = r.status === 'Không đi làm'
  const flags = r.flags ?? []
  const hasDetails = (r.otRegs?.length ?? 0) > 0 || (r.forms?.length ?? 0) > 0
  const leaveH = n1(r.annualLeaveHours) + n1(r.leaveInsurance) + n1(r.leaveSpecial) + n1(r.leaveMaternity) + n1(r.leaveUnpaid)
  const fix = (kind: 'finger' | 'overtime') => router.push({ pathname: '/request-form', params: { kind, date: r.date.slice(0, 10) } })
  const tone = holiday ? C.danger : off ? C.faint : absent ? C.warn : flags.length > 0 ? C.warn : C.brand
  const day = r.date.slice(8, 10)
  const work = n1(r.dayWorkHours) + n1(r.nightWorkHours)

  return (
    <Card style={{ padding: 14, gap: 10 }}>
      <Pressable onPress={onToggle} disabled={!hasDetails} style={{ flexDirection: 'row', gap: 14 }}>
        {/* Ô ngày */}
        <View style={{ width: 54, borderRadius: 14, paddingVertical: 8, alignItems: 'center', backgroundColor: `${tone}14` }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: tone, fontVariant: ['tabular-nums'] }}>{day}</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: tone }} numberOfLines={1}>{trServer(r.dayName, t)}</Text>
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <View style={s.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="log-in-outline" size={16} color={r.timeIn ? C.brand : C.faint} />
              <Text style={[s.h2, { fontVariant: ['tabular-nums'] }, !r.timeIn && { color: C.faint }]}>{r.timeIn ?? '--:--'}</Text>
              <Ionicons name="arrow-forward" size={13} color={C.faint} />
              <Ionicons name="log-out-outline" size={16} color={r.timeOut ? C.brand : C.faint} />
              <Text style={[s.h2, { fontVariant: ['tabular-nums'] }, !r.timeOut && { color: C.faint }]}>{r.timeOut ?? '--:--'}</Text>
            </View>
            {!!r.shift && <Text style={[s.muted, { fontSize: 12 }]} numberOfLines={1}>{trServer(r.shift, t)}</Text>}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(holiday || off) && <Tag text={trServer(r.dayKind, t)} color={holiday ? C.danger : C.muted} />}
            {work > 0 && <Tag text={`${t('att.dayWork')} ${n1(r.dayWorkHours)}${n1(r.nightWorkHours) > 0 ? ` · ${t('att.nightWork')} ${n1(r.nightWorkHours)}` : ''}`} color={C.brand} />}
            {r.totalOt > 0 && <Tag text={`${t('att.otHours')} ${n1(r.totalOt)}${r.otFrom ? ` (${r.otFrom}–${r.otTo ?? ''})` : ''}`} color={C.warn} />}
            {leaveH > 0 && <Tag text={`${t('att.leave')} ${leaveH}h`} color={C.teal} />}
            {r.swapDay && <Tag text={t('att.swapDay')} color={C.warn} />}
            {r.businessTrip && <Tag text={t('att.businessTrip')} color={C.purple} />}
            {!!r.hungYen && <Tag text={t('att.hungYen')} color={C.teal} />}
            {r.hungYenArrival && <Tag text={t('attFlag.arrival')} color={C.teal} />}
            {flags.map((f) => <Tag key={f} text={t(`attFlag.code.${f}`, { defaultValue: f })} color={C.danger} />)}
          </View>
          {!!r.status && !(holiday || off) && <Text style={[s.muted, absent && { color: C.warn, fontWeight: '600' }]}>{trServer(r.status, t)}</Text>}
          {hasDetails && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={C.brand} />
              <Text style={{ color: C.brand, fontSize: 13, fontWeight: '600' }}>{t('att.forms.badge', { n: (r.otRegs?.length ?? 0) + (r.forms?.length ?? 0) })}</Text>
            </View>
          )}
        </View>
      </Pressable>

      {open && (
        <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: C.border }}>
          {(r.otRegs ?? []).map((o) => (
            <View key={`ot${o.id}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <IconBadge name="flash" color={C.warn} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{t('att.otHours')}: {o.from ?? '?'} → {o.to ?? '?'} · {o.hours ?? ''}h</Text>
                <Text style={s.muted}>{t(o.state === 'approved' ? 'att.ots.approved' : 'att.forms.pending')}{o.reason ? ` · ${o.reason}` : ''}</Text>
              </View>
            </View>
          ))}
          {(r.forms ?? []).map((f) => (
            <View key={`f${f.id}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <IconBadge name="finger-print" color={C.info} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{t('nav.fingerForm')}: {f.timeIn ?? '?'} → {f.timeOut ?? '?'}</Text>
                <Text style={s.muted}>{t(f.state === 'approved' ? 'att.ots.approved' : 'att.forms.pending')}{f.used ? ` · ${t('att.forms.used')}` : ''}{f.reason ? ` · ${f.reason}` : ''}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {(flags.some((f) => FINGER_FLAGS.includes(f)) || flags.includes('ot_short')) && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {flags.some((f) => FINGER_FLAGS.includes(f)) && <View style={{ flex: 1 }}><Button small kind="ghost" icon="finger-print" title={t('attFlag.fixFinger')} onPress={() => fix('finger')} /></View>}
          {flags.includes('ot_short') && <View style={{ flex: 1 }}><Button small kind="ghost" icon="flash-outline" title={t('attFlag.fixOt')} onPress={() => fix('overtime')} /></View>}
        </View>
      )}
    </Card>
  )
}
