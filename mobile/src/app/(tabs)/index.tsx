/*
 * 2026-11-23 [Truong] - Mobile app: my attendance by month (same data as the web AttendancePage: /attendance/me, employee taken from the token)
 * Summary tiles, one card per day (tap to see the day's OT requests / finger forms), shortcuts to register a missed punch / overtime on flagged days.
 */
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getMyAttendance, type AttendanceDay } from '@web/api/attendance'
import { apiErrorCode } from '@web/api/requests'
import { trServer } from '@web/utils/serverText'
import { useAuth } from '../../auth/AuthProvider'
import { dmy, toYmd } from '../../requests'
import { Button, C, Card, Tag, s } from '../../ui'

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

  const tiles: [string, number, string, string][] = sum ? [
    [t('att.present'), sum.presentDays, t('att.days'), C.brand],
    [t('att.absent'), sum.absentDays, t('att.days'), C.danger],
    [t('att.manual'), sum.manualDays, t('att.days'), '#1570EF'],
    [t('att.dayWork'), n1(sum.dayWorkHours), t('att.hours'), C.brand],
    [t('att.nightWork'), n1(sum.nightWorkHours), t('att.hours'), '#6D5BD0'],
    [t('att.otHours'), n1(sum.otHours), t('att.hours'), '#B54708'],
    [t('att.leave'), n1(sum.annualLeaveHours), t('att.hours'), '#0E9384'],
  ] : []

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={q.data ? [...q.data.rows].reverse() : []}
      keyExtractor={(r) => r.date}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={C.brand} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <View style={[s.row, { gap: 8 }]}>
            <Button small kind="ghost" title="‹" onPress={() => setMonth((m) => m - 1)} />
            <View style={{ alignItems: 'center' }}>
              <Text style={s.h2}>{range.label}</Text>
              <Text style={s.muted}>{dmy(range.from)} – {dmy(range.to)}</Text>
            </View>
            <Button small kind="ghost" title="›" onPress={() => setMonth((m) => Math.min(0, m + 1))} disabled={month >= 0} />
          </View>
          {q.data && (
            <Text style={s.muted}>{user?.fullName} · {user?.employeeId}{q.data.department ? ` · ${q.data.department}` : ''}{q.data.position ? ` · ${q.data.position}` : ''}</Text>
          )}
          {!!errText && <Card><Text style={s.error}>{errText}</Text></Card>}
          {q.isLoading && <Text style={[s.muted, { textAlign: 'center' }]}>{t('mobile.loading')}</Text>}
          {tiles.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tiles.map(([label, value, unit, color]) => (
                <View key={label} style={[s.stat, { minWidth: '30%', backgroundColor: `${color}14` }]}>
                  <Text style={[s.statValue, { color }]}>{value}</Text>
                  <Text style={[s.muted, { fontSize: 12 }]}>{label} ({unit})</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => <DayCard r={item} open={open === item.date} onToggle={() => setOpen((d) => (d === item.date ? null : item.date))} />}
      ListEmptyComponent={q.isSuccess ? <Text style={[s.muted, { textAlign: 'center' }]}>{t('mobile.empty')}</Text> : undefined}
    />
  )
}

function DayCard({ r, open, onToggle }: { r: AttendanceDay; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const holiday = r.dayKind === 'Ngày Lễ'
  const off = r.dayKind === 'Ngày nghỉ'
  const absent = r.status === 'Không đi làm'
  const flags = r.flags ?? []
  const hasDetails = (r.otRegs?.length ?? 0) > 0 || (r.forms?.length ?? 0) > 0
  const leaveH = n1(r.annualLeaveHours) + n1(r.leaveInsurance) + n1(r.leaveSpecial) + n1(r.leaveMaternity) + n1(r.leaveUnpaid)
  const fix = (kind: 'finger' | 'overtime') => router.push({ pathname: '/request-form', params: { kind, date: r.date.slice(0, 10) } })

  return (
    <Card style={{ gap: 6, borderLeftWidth: 4, borderLeftColor: holiday ? C.danger : off ? '#98A2B3' : absent ? '#F79009' : C.brand }}>
      <Pressable onPress={onToggle} disabled={!hasDetails} style={{ gap: 4 }}>
        <View style={s.row}>
          <Text style={s.h2}>{dmy(r.date)} · {trServer(r.dayName, t)}</Text>
          <Text style={s.muted}>{trServer(r.shift, t)}</Text>
        </View>
        {(holiday || off) && <Tag text={trServer(r.dayKind, t)} color={holiday ? C.danger : C.muted} />}
        <Text style={s.body}>{t('req.timeIn')} {r.timeIn ?? '--:--'} → {t('req.timeOut')} {r.timeOut ?? '--:--'}</Text>
        {(n1(r.dayWorkHours) > 0 || n1(r.nightWorkHours) > 0) && (
          <Text style={s.muted}>{t('att.dayWork')}: {n1(r.dayWorkHours)} · {t('att.nightWork')}: {n1(r.nightWorkHours)}</Text>
        )}
        {r.totalOt > 0 && <Text style={[s.body, { color: '#B54708' }]}>{t('att.otHours')}: {n1(r.totalOt)}{r.otFrom ? ` (${r.otFrom} → ${r.otTo ?? ''})` : ''}</Text>}
        {leaveH > 0 && <Text style={[s.body, { color: '#0E9384' }]}>{t('att.leave')}: {leaveH} {t('att.hours')}</Text>}
        {!!r.status && <Text style={[s.muted, absent && { color: '#B54708' }]}>{trServer(r.status, t)}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.swapDay && <Tag text={t('att.swapDay')} color="#B54708" />}
          {r.businessTrip && <Tag text={t('att.businessTrip')} color="#6D5BD0" />}
          {!!r.hungYen && <Tag text={t('att.hungYen')} color="#0E9384" />}
          {r.hungYenArrival && <Tag text={t('attFlag.arrival')} color="#0E9384" />}
          {flags.map((f) => <Tag key={f} text={t(`attFlag.code.${f}`, { defaultValue: f })} color="#B54708" />)}
        </View>
        {hasDetails && <Text style={[s.muted, { color: C.brand }]}>{open ? '▴' : '▾'} {t('att.forms.badge', { defaultValue: '' }) || t('req.drafts')}</Text>}
      </Pressable>

      {open && (
        <View style={{ gap: 4, paddingTop: 4, borderTopWidth: 1, borderColor: C.border }}>
          {(r.otRegs ?? []).map((o) => (
            <Text key={`ot${o.id}`} style={s.body}>
              {t('att.otHours')}: {o.from ?? '?'} → {o.to ?? '?'} · {o.hours ?? ''}h · {t(o.state === 'approved' ? 'att.ots.approved' : 'att.forms.pending')}{o.reason ? ` · ${o.reason}` : ''}
            </Text>
          ))}
          {(r.forms ?? []).map((f) => (
            <Text key={`f${f.id}`} style={s.body}>
              {t('nav.fingerForm')}: {f.timeIn ?? '?'} → {f.timeOut ?? '?'} · {t(f.state === 'approved' ? 'att.ots.approved' : 'att.forms.pending')}{f.used ? ` · ${t('att.forms.used')}` : ''}{f.reason ? ` · ${f.reason}` : ''}
            </Text>
          ))}
        </View>
      )}

      {(flags.some((f) => FINGER_FLAGS.includes(f)) || flags.includes('ot_short')) && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {flags.some((f) => FINGER_FLAGS.includes(f)) && <View style={{ flex: 1 }}><Button small kind="ghost" title={t('attFlag.fixFinger')} onPress={() => fix('finger')} /></View>}
          {flags.includes('ot_short') && <View style={{ flex: 1 }}><Button small kind="ghost" title={t('attFlag.fixOt')} onPress={() => fix('overtime')} /></View>}
        </View>
      )}
    </Card>
  )
}
