/*
 * 2026-11-23 [Truong] - Mobile app: my attendance by month (same data as the web AttendancePage: /attendance/me, employee taken from the token)
 * 2026-11-26: thẻ tổng quan tháng theo màu giao diện, ô phụ 2 cột, cảnh báo số ngày cần xem lại.
 * 2026-11-26: chọn khoảng ngày tuỳ ý (bấm vào tiêu đề tháng; tối đa 93 ngày như máy chủ), danh sách ngày mới nhất lên đầu.
 * 2026-11-26: danh sách ngày gọn (một hàng mỗi ngày, vạch màu theo tình trạng, nổi bật hôm nay), 4 số phụ gộp một hàng.
 * Summary tiles, one card per day (tap to see the day's OT requests / finger forms), shortcuts to register a missed punch / overtime on flagged days.
 */
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getMyAttendance, type AttendanceDay } from '@web/api/attendance'
import { apiErrorCode } from '@web/api/requests'
import { trServer } from '@web/utils/serverText'
import { useAuth } from '../../auth/AuthProvider'
import { dmy, fromYmd, toYmd } from '../../requests'
import { DateField } from '../../components/DateField'
import { Button, Card, Chip, ChipRow, EmptyState, IconBadge, IconButton, type IconName, SectionTitle, Tag, TabHero, useTheme } from '../../ui'

/** Cờ "cần xem lại" sửa bằng đơn quên vân tay (attendanceColumns.tsx của web). */
const FINGER_FLAGS = ['missing_in', 'missing_out', 'absent', 'hy_no_punch']

const monthRange = (offset: number) => {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { from: toYmd(first), to: toYmd(last < now ? last : now), label: `${String(first.getMonth() + 1).padStart(2, '0')}/${first.getFullYear()}` }
}

/** Giới hạn khoảng ngày xem công của chính mình (AttendanceService.MaxPersonalDays). */
const MAX_DAYS = 93
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toYmd(d) }
const spanDays = (from: string, to: string) => Math.round(((fromYmd(to)?.getTime() ?? 0) - (fromYmd(from)?.getTime() ?? 0)) / 86_400_000) + 1

const n1 = (v: number | null | undefined) => (v == null ? 0 : Math.round(v * 100) / 100)

export default function AttendanceTab() {
  const { t } = useTranslation()
  const { C, s, grad } = useTheme()
  const { user } = useAuth()
  const [month, setMonth] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  // Khoảng ngày tự chọn (null = theo tháng, đổi bằng hai nút mũi tên)
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<{ from?: string; to?: string }>({})
  const range = custom ? { ...custom, label: '' } : monthRange(month)
  const goMonth = (m: number) => { setCustom(null); setMonth(m); setPicking(false) }
  const startPick = () => { setDraft({ from: range.from, to: range.to }); setPicking((v) => !v) }
  const draftErr = !draft.from || !draft.to ? '' : draft.to < draft.from ? t('att.invalid_range') : spanDays(draft.from, draft.to) > MAX_DAYS ? t('mobile.att.tooLong', { n: MAX_DAYS }) : ''
  const apply = (from: string, to: string) => { setCustom({ from, to }); setPicking(false) }
  const q = useQuery({ queryKey: ['me', 'attendance', range.from, range.to], queryFn: () => getMyAttendance(range.from, range.to), enabled: !!user?.employeeId, retry: false })
  const sum = q.data?.summary

  const code = q.isError ? apiErrorCode(q.error).code : ''
  const errText = !user?.employeeId || code === 'no_employee' ? t('att.noEmployee') : code === 'invalid_range' ? t('att.invalid_range') : code === 'forbidden' ? t('att.forbidden') : q.isError ? t('att.loadFailed') : ''

  // 3 số chính trên thẻ màu + 4 ô phụ
  const main: [string, number, string][] = sum ? [
    [t('att.present'), sum.presentDays, t('att.days')],
    [t('att.otHours'), n1(sum.otHours), t('att.hours')],
    [t('att.leave'), n1(sum.annualLeaveHours), t('att.hours')],
  ] : []
  const tiles: [string, number, string, string, IconName][] = sum ? [
    [t('att.dayWork'), n1(sum.dayWorkHours), t('att.hours'), C.accent, 'sunny'],
    [t('att.nightWork'), n1(sum.nightWorkHours), t('att.hours'), C.purple, 'moon'],
    [t('att.absent'), sum.absentDays, t('att.days'), C.danger, 'close-circle'],
    [t('att.manual'), sum.manualDays, t('att.days'), C.info, 'finger-print'],
  ] : []
  const flagged = (q.data?.rows ?? []).filter((r) => (r.flags ?? []).length > 0).length

  const sub = [user?.fullName, user?.employeeId].filter(Boolean).join(' · ')

  return (
    <View style={s.screen}>
      <TabHero title={t('mobile.tab.attendance')} subtitle={sub} />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { gap: 8 }]}
        // Ngày mới nhất lên đầu
        data={q.data ? [...q.data.rows].sort((a, b) => b.date.localeCompare(a.date)) : []}
        keyExtractor={(r) => r.date}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={C.brand} colors={[C.brand]} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {/* Thẻ tổng quan tháng: đổi tháng + 3 số chính */}
            <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 16, gap: 16, overflow: 'hidden' }}>
              <View pointerEvents="none" style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)', right: -70, top: -90 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconButton tone="onBrand" name="chevron-back" label={t('mobile.att.prevMonth')} onPress={() => goMonth(custom ? 0 : month - 1)} />
                {/* Bấm vào tiêu đề để chọn khoảng ngày */}
                <Pressable onPress={startPick} accessibilityRole="button" accessibilityLabel={t('mobile.att.pickRange')} style={({ pressed }) => [{ flex: 1, alignItems: 'center' }, pressed && { opacity: 0.75 }]}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{custom ? t('mobile.att.custom') : t('mobile.att.monthLabel', { m: range.label })}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Ionicons name="calendar-outline" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '600' }}>{dmy(range.from)} – {dmy(range.to)}</Text>
                    <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={13} color="#fff" />
                  </View>
                </Pressable>
                <IconButton tone="onBrand" name="chevron-forward" label={t('mobile.att.nextMonth')} onPress={() => goMonth(Math.min(0, month + 1))} disabled={!custom && month >= 0} />
              </View>
              {main.length > 0 ? (
                <View style={{ flexDirection: 'row' }}>
                  {main.map(([label, value, unit], i) => (
                    <View key={label} style={[{ flex: 1, alignItems: 'center', gap: 2 }, i > 0 && { borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }]}>
                      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}<Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}> {unit}</Text></Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', paddingHorizontal: 4 }} numberOfLines={2}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : q.isLoading ? <ActivityIndicator color="#fff" style={{ paddingVertical: 14 }} /> : null}
            </LinearGradient>

            {picking && (
              <Card style={{ gap: 12 }}>
                <Text style={s.h2}>{t('mobile.att.pickRange')}</Text>
                <ChipRow>
                  <Chip label={t('mobile.att.thisMonth')} on={false} onPress={() => goMonth(0)} />
                  <Chip label={t('mobile.att.lastMonth')} on={false} onPress={() => goMonth(-1)} />
                  <Chip label={t('mobile.att.lastNDays', { n: 7 })} on={false} onPress={() => apply(daysAgo(6), daysAgo(0))} />
                  <Chip label={t('mobile.att.lastNDays', { n: 30 })} on={false} onPress={() => apply(daysAgo(29), daysAgo(0))} />
                </ChipRow>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><DateField label={t('mobile.att.from')} value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} /></View>
                  <View style={{ flex: 1 }}><DateField label={t('mobile.att.to')} value={draft.to} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} /></View>
                </View>
                {!!draftErr && <Text style={[s.muted, { color: C.danger }]}>{draftErr}</Text>}
                <Button title={t('mobile.att.view')} icon="search" onPress={() => apply(draft.from!, draft.to!)} disabled={!draft.from || !draft.to || !!draftErr} />
              </Card>
            )}

            {!!errText && <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><IconBadge name="alert-circle" color={C.danger} /><Text style={[s.body, { flex: 1, color: C.danger }]}>{errText}</Text></Card>}

            {/* 4 số phụ gọn trên một hàng */}
            {tiles.length > 0 && (
              <View style={[s.card, { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 4 }]}>
                {tiles.map(([label, value, unit, color, icon], i) => (
                  <View key={label} style={[{ flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 }, i > 0 && { borderLeftWidth: 1, borderColor: C.border }]}>
                    <Ionicons name={icon} size={18} color={color} />
                    <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{value}<Text style={{ fontSize: 11, fontWeight: '600', color: C.muted }}> {unit}</Text></Text>
                    <Text style={[s.muted, { fontSize: 11.5, textAlign: 'center', lineHeight: 15 }]} numberOfLines={2}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {flagged > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.warnSoft, borderRadius: 14, padding: 12 }}>
                <Ionicons name="warning" size={18} color={C.warn} />
                <Text style={{ flex: 1, color: C.warn, fontSize: 14, fontWeight: '600' }}>{t('mobile.att.flagged', { n: flagged })}</Text>
              </View>
            )}
            {q.data && q.data.rows.length > 0 && <SectionTitle title={t('mobile.att.daily', { defaultValue: t('nav.attendance') })} />}
          </View>
        }
        renderItem={({ item }) => <DayCard r={item} showMonth={range.from.slice(0, 7) !== range.to.slice(0, 7)} open={open === item.date} onToggle={() => setOpen((d) => (d === item.date ? null : item.date))} />}
        ListEmptyComponent={q.isSuccess ? <EmptyState text={t('mobile.empty')} icon="calendar-outline" /> : undefined}
      />
    </View>
  )
}

/** Một ngày = một hàng gọn: ngày | giờ vào → ra + ca | giờ công, tăng ca. Ngày có cờ hiện thêm dòng cần sửa. */
function DayCard({ r, open, onToggle, showMonth }: { r: AttendanceDay; open: boolean; onToggle: () => void; showMonth?: boolean }) {
  const { t } = useTranslation()
  const { C, s } = useTheme()
  const holiday = r.dayKind === 'Ngày Lễ'
  const off = r.dayKind === 'Ngày nghỉ'
  const absent = r.status === 'Không đi làm'
  const flags = r.flags ?? []
  const hasDetails = (r.otRegs?.length ?? 0) > 0 || (r.forms?.length ?? 0) > 0
  const leaveH = n1(r.annualLeaveHours) + n1(r.leaveInsurance) + n1(r.leaveSpecial) + n1(r.leaveMaternity) + n1(r.leaveUnpaid)
  const fix = (kind: 'finger' | 'overtime') => router.push({ pathname: '/request-form', params: { kind, date: r.date.slice(0, 10) } })
  const tone = holiday ? C.danger : off ? C.faint : absent || flags.length > 0 ? C.warn : C.brand
  const today = r.date.slice(0, 10) === toYmd(new Date())
  const work = n1(r.dayWorkHours) + n1(r.nightWorkHours)
  const noPunch = !r.timeIn && !r.timeOut
  const rest = (holiday || off) && noPunch
  // Dòng phụ: ca làm, hoặc loại ngày / tình trạng khi không có ca
  const subParts = [
    rest ? trServer(r.dayKind, t) : r.shift ? trServer(r.shift, t) : '',
    !rest && r.status && (absent || noPunch) ? trServer(r.status, t) : '',
  ].filter(Boolean)
  const extras: [string, string][] = [
    ...(leaveH > 0 ? [[`${t('att.leave')} ${leaveH}h`, C.teal] as [string, string]] : []),
    ...(r.swapDay ? [[t('att.swapDay'), C.warn] as [string, string]] : []),
    ...(r.businessTrip ? [[t('att.businessTrip'), C.purple] as [string, string]] : []),
    ...(r.hungYen ? [[t('att.hungYen'), C.teal] as [string, string]] : []),
    ...(r.hungYenArrival ? [[t('attFlag.arrival'), C.teal] as [string, string]] : []),
    ...(holiday && !rest ? [[trServer(r.dayKind, t), C.danger] as [string, string]] : []),
  ]
  const fixFinger = flags.some((f) => FINGER_FLAGS.includes(f))
  const fixOt = flags.includes('ot_short')

  return (
    <View style={[s.card, { padding: 0, overflow: 'hidden', borderColor: today ? C.brand : C.border, borderWidth: today ? 1.5 : 1 }, rest && { backgroundColor: C.cardAlt, shadowOpacity: 0, elevation: 0 }]}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tone }} />
      <Pressable onPress={onToggle} disabled={!hasDetails} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingLeft: 16, paddingRight: 14 }, pressed && { opacity: 0.7 }]}>
        {/* Ngày */}
        <View style={{ width: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: rest ? C.muted : C.text, fontVariant: ['tabular-nums'] }}>{r.date.slice(8, 10)}</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: holiday || r.dayName === 'CN' ? C.danger : C.muted }} numberOfLines={1}>{showMonth ? `${trServer(r.dayName, t)}·${r.date.slice(5, 7)}` : trServer(r.dayName, t)}</Text>
        </View>

        {/* Giờ vào → ra + ca */}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {rest ? (
            <Text style={[s.body, { color: holiday ? C.danger : C.muted, fontWeight: '600' }]}>{trServer(r.dayKind, t)}</Text>
          ) : noPunch ? (
            <Text style={[s.body, { color: absent ? C.warn : C.faint, fontWeight: '600' }]}>{absent ? trServer(r.status, t) : t('mobile.att.noPunch')}</Text>
          ) : (
            <Text style={{ fontSize: 16.5, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] }}>
              <Text style={!r.timeIn && { color: C.danger }}>{r.timeIn ?? '--:--'}</Text>
              <Text style={{ color: C.faint, fontWeight: '400' }}>  →  </Text>
              <Text style={!r.timeOut && { color: C.danger }}>{r.timeOut ?? '--:--'}</Text>
            </Text>
          )}
          {!rest && subParts.length > 0 && <Text style={[s.muted, { fontSize: 12.5 }]} numberOfLines={1}>{subParts.join(' · ')}</Text>}
          {today && <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.brand }}>{t('mobile.att.today')}</Text>}
        </View>

        {/* Giờ công + tăng ca */}
        {(work > 0 || r.totalOt > 0) && (
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            {work > 0 && <Text style={{ fontSize: 15, fontWeight: '800', color: C.brand, fontVariant: ['tabular-nums'] }}>{work}h{n1(r.nightWorkHours) > 0 ? <Text style={{ fontSize: 11, color: C.purple }}> ☾{n1(r.nightWorkHours)}</Text> : null}</Text>}
            {r.totalOt > 0 && (
              <View style={{ backgroundColor: C.warnSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.warn, fontVariant: ['tabular-nums'] }}>OT +{n1(r.totalOt)}h</Text>
              </View>
            )}
          </View>
        )}
        {hasDetails && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.faint} />}
      </Pressable>

      {(extras.length > 0 || flags.length > 0) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 68, paddingRight: 14, paddingBottom: 10, marginTop: -4 }}>
          {extras.map(([text, color]) => <Tag key={text} text={text} color={color} />)}
          {flags.map((f) => <Tag key={f} text={t(`attFlag.code.${f}`, { defaultValue: f })} color={C.danger} />)}
        </View>
      )}

      {open && (
        <View style={{ gap: 8, marginHorizontal: 14, marginLeft: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: C.border }}>
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

      {(fixFinger || fixOt) && (
        <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 14, paddingBottom: 12 }}>
          {fixFinger && <View style={{ flex: 1 }}><Button small kind="ghost" icon="finger-print" title={t('attFlag.fixFinger')} onPress={() => fix('finger')} /></View>}
          {fixOt && <View style={{ flex: 1 }}><Button small kind="ghost" icon="flash-outline" title={t('attFlag.fixOt')} onPress={() => fix('overtime')} /></View>}
        </View>
      )}
    </View>
  )
}
