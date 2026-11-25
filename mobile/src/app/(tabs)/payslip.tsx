/*
 * 2026-11-23 [Truong] - Mobile app: payslip tab
 * Mirrors the web PayslipPage: locked by PIN (or fingerprint / Face ID), pick a period (provisional periods first), amounts hidden until toggled.
 * Re-locks when the server unlock ticket expires (10 min), when the server asks for the PIN again, and whenever the app goes to the background.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { payslip, payslipPin, type PayslipExplainLine } from '@web/api/payslip'
import { apiErrorCode } from '@web/api/requests'
import { useAuth } from '../../auth/AuthProvider'
import { PayslipGate } from '../../components/PayslipGate'
import { PinChangeModal } from '../../components/PinChangeModal'
import { bioAvailable, bioDisable, bioEnabled } from '../../payslipBio'
import { Button, C, Card, s, Chip, TabHero } from '../../ui'

/** Khoản không hiện cho nhân viên (giống web: Tạm ứng, Còn lại sau tạm ứng). */
const HIDDEN_KEYS = new Set(['advance', 'remaining'])

/** Số tiền của từng dòng "cách tính" (cùng cách lấy với PayslipHow của web khi ẩn công thức). */
function lineValue(l: PayslipExplainLine): number {
  const a = l.args
  switch (l.key) {
    case 'hours': return a.hours
    case 'allow': return (a.living ?? 0) + (a.travel ?? 0)
    case 'rate': return a.rate
    case 'overtime': return a.pay
    case 'deduction': return a.total
    case 'net': return a.net
    default: return a.amount ?? 0
  }
}

export default function PayslipTab() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const userId = user?.userId ?? ''
  const qc = useQueryClient()
  const [unlocked, setUnlocked] = useState(payslipPin.unlocked)
  const [show, setShow] = useState(false)
  const [changing, setChanging] = useState(false)
  const [bio, setBio] = useState<{ available: boolean; on: boolean }>({ available: false, on: false })

  const lock = useCallback(() => {
    payslipPin.lock(); setUnlocked(false); setShow(false)
    for (const k of ['mine', 'provisional', 'explain']) qc.removeQueries({ queryKey: ['payslip', k] })
  }, [qc])

  // Vé mở khoá hết hạn → khoá; app chuyển xuống nền → khoá ngay (không để số tiền trên màn hình đa nhiệm)
  useEffect(() => {
    if (!unlocked) return
    const id = setInterval(() => { if (!payslipPin.unlocked()) lock() }, 15_000)
    // Chỉ "background": hộp thoại Face ID / vân tay làm app thành "inactive" trong chốc lát, không được khoá lúc đó
    const sub = AppState.addEventListener('change', (st) => { if (st === 'background') lock() })
    return () => { clearInterval(id); sub.remove() }
  }, [unlocked, lock])

  useEffect(() => {
    if (!unlocked || !userId) return
    void (async () => setBio({ available: await bioAvailable(), on: await bioEnabled(userId) }))()
  }, [unlocked, userId])

  const periods = useQuery({ queryKey: ['payslip', 'periods'], queryFn: payslip.periods, enabled: unlocked })
  const prov = useQuery({ queryKey: ['payslip', 'provisional'], queryFn: payslip.provisional, enabled: unlocked, staleTime: 60_000 })
  const provList = useMemo(() => prov.data ?? [], [prov.data])
  const list = useMemo(() => [...provList.map((p) => p.period), ...(periods.data ?? []).map((p) => p.period)], [provList, periods.data])
  const [period, setPeriod] = useState<string>()
  const [picked, setPicked] = useState(false)
  useEffect(() => { if (!picked && list.length) setPeriod(list[0]) }, [list, picked])

  const isProv = !!period && provList.some((p) => p.period === period)
  const provItem = provList.find((p) => p.period === period)
  const real = useQuery({ queryKey: ['payslip', 'mine', period], queryFn: () => payslip.mine(period!), enabled: unlocked && !!period && !isProv, staleTime: 0, gcTime: 0 })
  const slip = isProv ? provItem?.slip ?? undefined : real.data
  const explain = useQuery({
    queryKey: ['payslip', 'explain', period], queryFn: () => payslip.explain(period!),
    enabled: unlocked && !!period && show && !(isProv && !provItem?.slip), staleTime: 0, gcTime: 0,
  })

  // Máy chủ đòi nhập lại mã (vé hết hạn / mã bị đặt lại / đổi ở máy khác) → về màn khoá
  const pinNeeded = [prov.error, real.error, explain.error].some((e) => e && apiErrorCode(e).code === 'pin_required')
  useEffect(() => { if (pinNeeded && unlocked) lock() }, [pinNeeded, unlocked, lock])

  const fmt = (n: number) => n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 2 })
  const notFound = !isProv && real.isError && apiErrorCode(real.error).code === 'not_found'
  const provMissing = isProv && !provItem?.slip
  const none = periods.isSuccess && prov.isFetched && list.length === 0

  if (!unlocked) {
    return (
      <View style={s.screen}>
        <TabHero title={t('mobile.tab.payslip')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {!!userId && <PayslipGate userId={userId} onUnlocked={() => setUnlocked(true)} />}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={s.screen}>
    <TabHero title={t('mobile.tab.payslip')} subtitle={period ?? undefined} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={real.isRefetching || prov.isRefetching} onRefresh={() => { void periods.refetch(); void prov.refetch(); void real.refetch() }} tintColor={C.brand} />}>
      {/* Kỳ lương: kỳ tạm tính (chưa có phiếu HR nhập) xếp đầu */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {list.map((p) => {
          const on = p === period
          const provTag = provList.some((x) => x.period === p)
          return (
            <Chip key={p} label={`${p}${provTag ? ` · ${t('pay.provTag')}` : ''}`} on={on} onPress={() => { setPicked(true); setPeriod(p) }} />
          )
        })}
      </ScrollView>
      {prov.isLoading && <Text style={s.muted}>{t('pay.provLoading')}</Text>}

      <View style={[s.row, { gap: 8 }]}>
        <Text style={s.body}>{t(show ? 'pay.hide' : 'pay.show')}</Text>
        <Switch value={show} onValueChange={setShow} trackColor={{ true: C.brand }} />
      </View>

      {none ? <Text style={[s.muted, { textAlign: 'center' }]}>{t('pay.none')}</Text>
        : real.isLoading || periods.isLoading ? <Text style={[s.muted, { textAlign: 'center' }]}>{t('mobile.loading')}</Text>
        : provMissing ? <Card style={{ gap: 4 }}><Text style={s.h2}>{t('pay.provMissing')}</Text><Text style={s.muted}>{t(`pay.provReason.${provItem?.reason ?? 'calc_error'}`)}</Text></Card>
        : notFound ? <Text style={[s.muted, { textAlign: 'center' }]}>{t('pay.notFound')}</Text>
        : real.isError && !pinNeeded ? <Text style={s.error}>{t('mobile.err.generic')}</Text>
        : slip && (
          <>
            {isProv && <Card style={{ backgroundColor: '#FFF7E6', borderColor: '#F5C46B' }}><Text style={s.body}>{t('pay.provNote')}</Text></Card>}
            <Card style={{ gap: 4 }}>
              <View style={s.row}>
                <Text style={[s.h2, { flex: 1 }]}>{slip.fullName}</Text>
                <Text style={[s.h2, { color: C.brand }]}>{slip.period}</Text>
              </View>
              <Text style={s.muted}>{slip.employeeId} · {slip.department}{slip.title ? ` · ${slip.title}` : ''}</Text>
            </Card>
            <Card style={{ gap: 10 }}>
              <Text style={s.h2}>{t('pay.how.title')}</Text>
              {!show ? <Text style={s.muted}>{t('pay.show')}</Text>
                : explain.isLoading ? <Text style={s.muted}>{t('mobile.loading')}</Text>
                : (explain.data ?? []).filter((l) => !HIDDEN_KEYS.has(l.key)).map((l) => {
                  const net = l.key === 'net'
                  const label = l.key === 'otType' ? t(`pay.how.ot.${l.args.idx}`) : t(`pay.how.t.${l.key}`, { defaultValue: t(`pay.f.${l.key}`, { defaultValue: l.key }) })
                  const value = l.key === 'hours' ? `${fmt(l.args.hours)} ${t('pay.how.unit.hours')}` : fmt(lineValue(l))
                  return (
                    <View key={l.key === 'otType' ? `ot${l.args.idx}` : l.key}
                      style={[s.row, { paddingLeft: l.key === 'otType' ? 16 : 0 }, net && { borderTopWidth: 1, borderColor: C.border, paddingTop: 10 }]}>
                      <Text style={[net ? s.h2 : s.body, { flex: 1 }]}>{label}</Text>
                      <Text style={[net ? { fontSize: 20, fontWeight: '800', color: C.brand } : s.body, { fontVariant: ['tabular-nums'] }]}>{value}</Text>
                    </View>
                  )
                })}
            </Card>
            <Text style={[s.muted, { textAlign: 'center' }]}>{t('pay.foot')}</Text>
          </>
        )}

      <Card style={{ gap: 10 }}>
        {bio.available && (
          <View style={s.row}>
            <Text style={[s.body, { flex: 1 }]}>{t('mobile.bio.toggle')}</Text>
            <Switch value={bio.on} trackColor={{ true: C.brand }} onValueChange={(v) => {
              // Bật: cần mã PIN để lưu → khoá lại, lần nhập mã đúng tiếp theo app sẽ hỏi bật
              if (v) lock(); else void bioDisable(userId).then(() => setBio((b) => ({ ...b, on: false })))
            }} />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button small kind="ghost" title={t('pay.pin.change')} onPress={() => setChanging(true)} /></View>
          <View style={{ flex: 1 }}><Button small kind="ghost" title={t('pay.pin.lock')} onPress={lock} /></View>
        </View>
      </Card>

      <PinChangeModal open={changing} userId={userId} onClose={() => setChanging(false)} />
    </ScrollView>
    </View>
  )
}
