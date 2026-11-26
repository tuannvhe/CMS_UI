/*
 * 2026-11-23 [Truong] - Mobile app: payslip lock screen
 * Same rules as the web PayslipPinGate (set a 4-digit PIN twice / enter it; 5 wrong tries = server-side lockout), plus fingerprint / Face ID.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { payslip } from '@web/api/payslip'
import { apiErrorCode } from '@web/api/requests'
import { bioAvailable, bioDisable, bioEnable, bioEnabled, bioReadPin } from '../payslipBio'
import { Button, Card, QueryState, useTheme, IconBadge } from '../ui'
import { PinPad } from './PinPad'

/** Thông báo lỗi PIN (cùng mã lỗi với web). */
export function usePinError() {
  const { t, i18n } = useTranslation()
  const time = (iso: string) => (iso ? new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) : '')
  return (e: unknown) => {
    const { code, detail } = apiErrorCode(e)
    if (code === 'pin_wrong') return t('pay.pin.wrong', { n: detail })
    if (code === 'pin_locked') return t('pay.pin.locked', { time: time(detail) })
    if (code === 'pin_not_set' || code === 'pin_already_set') return t('pay.pin.stateChanged')
    return t('mobile.err.generic')
  }
}

/** Sau khi nhập đúng mã: hỏi một lần có muốn mở bằng vân tay / Face ID lần sau không. */
async function offerBiometric(userId: string, pin: string, t: (k: string) => string) {
  if (!(await bioAvailable()) || (await bioEnabled(userId))) return
  Alert.alert(t('mobile.bio.enableTitle'), t('mobile.bio.enableAsk'), [
    { text: t('mobile.cancel'), style: 'cancel' },
    {
      text: t('mobile.bio.enable'),
      onPress: () => void bioEnable(userId, pin, t('mobile.bio.prompt')).then((ok) => Alert.alert(ok ? t('mobile.bio.enabled') : t('mobile.bio.failed'))),
    },
  ])
}

export function PayslipGate({ userId, onUnlocked }: { userId: string; onUnlocked: () => void }) {
  const { C, s } = useTheme()
  const { t, i18n } = useTranslation()
  const pinError = usePinError()
  const state = useQuery({ queryKey: ['payslip', 'pin'], queryFn: payslip.pinState, staleTime: 0, gcTime: 0 })
  const [first, setFirst] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState(0)
  const [bio, setBio] = useState(false)
  const autoTried = useRef(false)
  const again = () => setReset((n) => n + 1)
  const hasPin = !!state.data?.hasPin

  useEffect(() => { void (async () => setBio((await bioAvailable()) && (await bioEnabled(userId))))() }, [userId])

  const unlockWithBio = useCallback(async () => {
    setErr(null)
    const pin = await bioReadPin(userId, t('mobile.bio.prompt'))
    if (!pin) return
    setBusy(true)
    try { await payslip.pinVerify(pin); onUnlocked() } catch (e) {
      const code = apiErrorCode(e).code
      // Mã đã đổi ở web / bị quản trị đặt lại: mã lưu trong máy không còn đúng → tắt mở bằng sinh trắc học, nhập mã mới
      if (code === 'pin_wrong' || code === 'pin_not_set') { await bioDisable(userId); setBio(false); setErr(t('mobile.bio.stale')); void state.refetch() } else setErr(pinError(e))
    } finally { setBusy(false) }
  }, [userId, t, onUnlocked, pinError, state])

  // Đã bật sinh trắc học: tự hỏi vân tay một lần khi mở màn khoá
  useEffect(() => {
    if (bio && hasPin && !autoTried.current) { autoTried.current = true; void unlockWithBio() }
  }, [bio, hasPin, unlockWithBio])

  const submit = async (pin: string) => {
    setErr(null)
    if (!hasPin && first === null) { setFirst(pin); again(); return }
    if (!hasPin && first !== pin) { setFirst(null); setErr(t('pay.pin.mismatch')); again(); return }
    setBusy(true)
    try {
      if (hasPin) await payslip.pinVerify(pin); else await payslip.pinSetup(pin)
      onUnlocked()
      void offerBiometric(userId, pin, t)
    } catch (e) {
      setErr(pinError(e)); setFirst(null)
      const code = apiErrorCode(e).code
      if (code === 'pin_not_set' || code === 'pin_already_set') void state.refetch()
      again()
    } finally { setBusy(false) }
  }

  if (state.isLoading) return <View style={s.center}><ActivityIndicator color={C.brand} /></View>
  // Lỗi tải trạng thái PIN: dùng khung lỗi chung (không có quyền xem phiếu lương → ổ khoá + lời nhắn, không có nút thử lại)
  if (state.isError) return <QueryState loading={false} error={state.error} onRetry={() => void state.refetch()} />

  const title = hasPin ? t('pay.pin.enterTitle') : first === null ? t('pay.pin.setupTitle') : t('pay.pin.confirmTitle')
  const sub = hasPin ? t('pay.pin.enterSub') : first === null ? t('pay.pin.setupSub') : t('pay.pin.confirmSub')
  const lockedUntil = state.data?.lockedUntilUtc && new Date(state.data.lockedUntilUtc) > new Date()
    ? new Date(state.data.lockedUntilUtc).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <Card style={{ gap: 14, alignItems: 'center', paddingVertical: 28 }}>
      <IconBadge name="lock-closed" size={60} />
      <Text style={s.h1}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center' }]}>{sub}</Text>
      {lockedUntil && !err && <Text style={s.error}>{t('pay.pin.locked', { time: lockedUntil })}</Text>}
      <PinPad reset={reset} disabled={busy} onDone={(p) => void submit(p)} />
      {busy && <ActivityIndicator color={C.brand} />}
      {!!err && <Text style={s.error}>{err}</Text>}
      {hasPin && bio && <Button kind="ghost" title={t('mobile.bio.unlock')} onPress={() => void unlockWithBio()} disabled={busy} />}
      {!hasPin && first !== null && <Button kind="ghost" title={t('pay.pin.restart')} onPress={() => { setFirst(null); again() }} />}
      <Text style={[s.muted, { textAlign: 'center', fontSize: 12 }]}>{hasPin ? t('pay.pin.forgot') : t('pay.pin.setupNote')}</Text>
    </Card>
  )
}
