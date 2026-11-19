import { useEffect, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Alert, Button, Input, Modal, Spin, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiError } from '../../api/healthLeave'
import { payslip } from '../../api/payslip'
import { useToast } from '../../hooks/useToast'

type OtpRef = ComponentRef<typeof Input.OTP>

/** Ô nhập 4 chữ số (ẩn ký tự, bàn phím số trên điện thoại); đủ 4 số thì tự gửi như khoá Zalo. Đổi `reset` để xoá ô và đặt lại con trỏ. */
function PinBoxes({ reset, disabled, onDone }: { reset: number; disabled?: boolean; onDone: (pin: string) => void }) {
  const ref = useRef<OtpRef>(null)
  useEffect(() => { if (!disabled) ref.current?.focus() }, [reset, disabled])
  return (
    <Input.OTP key={reset} ref={ref} length={4} mask="●" type="tel" autoComplete="off" size="large" disabled={disabled}
      formatter={(s) => s.replace(/\D/g, '')} onChange={(v) => { if (/^\d{4}$/.test(v)) onDone(v) }} style={{ justifyContent: 'center' }} />
  )
}

function useLockTime() {
  const { i18n } = useTranslation()
  return (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) : '')
}

/** Lỗi khi nhập mã: sai (còn n lần), đang khoá đến giờ nào, hoặc trạng thái mã vừa đổi (đã có / đã bị đặt lại). */
function usePinError() {
  const { t } = useTranslation()
  const time = useLockTime()
  return (e: unknown) => {
    const { code, detail } = apiError(e)
    if (code === 'pin_wrong') return t('pay.pin.wrong', { n: detail })
    if (code === 'pin_locked') return t('pay.pin.locked', { time: time(detail) })
    if (code === 'pin_not_set' || code === 'pin_already_set') return t('pay.pin.stateChanged')
    return t('usr.err.generic')
  }
}

/**
 * Màn khoá phiếu lương: chưa có mã thì đặt mã 4 số (nhập 2 lần), đã có thì nhập mã để mở. Sai 5 lần bị khoá 15 phút (máy chủ đếm).
 * Quên mã: quản trị đặt lại ở trang Người dùng, lần vào sau đặt mã mới.
 */
export function PayslipPinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const { t } = useTranslation()
  const time = useLockTime()
  const pinError = usePinError()
  const state = useQuery({ queryKey: ['payslip', 'pin'], queryFn: payslip.pinState, retry: false, staleTime: 0, gcTime: 0 })
  const [first, setFirst] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState(0)
  const again = () => setReset((n) => n + 1)
  const hasPin = !!state.data?.hasPin

  const submit = async (pin: string) => {
    setErr(null)
    if (!hasPin && first === null) { setFirst(pin); again(); return }
    if (!hasPin && first !== pin) { setFirst(null); setErr(t('pay.pin.mismatch')); again(); return }
    setBusy(true)
    try {
      if (hasPin) await payslip.pinVerify(pin); else await payslip.pinSetup(pin)
      onUnlocked()
    } catch (e) {
      setErr(pinError(e)); setFirst(null)
      const code = apiError(e).code
      if (code === 'pin_not_set' || code === 'pin_already_set') state.refetch()
      again()
    } finally { setBusy(false) }
  }

  if (state.isLoading) return <div className="pay-pin"><Spin /></div>
  if (state.isError) return <Alert type="error" showIcon title={t('usr.err.generic')} />
  const title = hasPin ? t('pay.pin.enterTitle') : first === null ? t('pay.pin.setupTitle') : t('pay.pin.confirmTitle')
  const sub = hasPin ? t('pay.pin.enterSub') : first === null ? t('pay.pin.setupSub') : t('pay.pin.confirmSub')
  return (
    <section className="pay-card pay-pin" style={{ maxWidth: 420, margin: '24px auto', textAlign: 'center', padding: 24 }}>
      <LockOutlined style={{ fontSize: 36, color: 'var(--c-primary, #1677ff)' }} />
      <Typography.Title level={4} style={{ marginTop: 12 }}>{title}</Typography.Title>
      <Typography.Paragraph type="secondary">{sub}</Typography.Paragraph>
      {state.data?.lockedUntilUtc && !err && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('pay.pin.locked', { time: time(state.data.lockedUntilUtc) })} />}
      <PinBoxes reset={reset} disabled={busy} onDone={submit} />
      {err && <Alert type="error" showIcon style={{ marginTop: 12 }} title={err} />}
      {!hasPin && first !== null && <Button type="link" onClick={() => { setFirst(null); again() }}>{t('pay.pin.restart')}</Button>}
      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>{hasPin ? t('pay.pin.forgot') : t('pay.pin.setupNote')}</Typography.Paragraph>
    </section>
  )
}

/** Đổi mã PIN: mã hiện tại → mã mới → nhập lại mã mới. */
export function PayslipPinChange({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const message = useToast()
  const pinError = usePinError()
  const [oldPin, setOldPin] = useState<string | null>(null)
  const [newPin, setNewPin] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState(0)
  const again = () => setReset((n) => n + 1)
  const close = () => { setOldPin(null); setNewPin(null); setErr(null); onClose() }

  const submit = async (pin: string) => {
    setErr(null)
    if (oldPin === null) { setOldPin(pin); again(); return }
    if (newPin === null) { setNewPin(pin); again(); return }
    if (pin !== newPin) { setNewPin(null); setErr(t('pay.pin.mismatch')); again(); return }
    setBusy(true)
    try { await payslip.pinChange(oldPin, newPin); message.success(t('pay.pin.changed')); close() }
    catch (e) { setErr(pinError(e)); setOldPin(null); setNewPin(null); again() }
    finally { setBusy(false) }
  }

  const step = oldPin === null ? 'old' : newPin === null ? 'new' : 'confirm'
  return (
    <Modal open={open} onCancel={close} footer={null} title={t('pay.pin.changeTitle')} destroyOnHidden width={400}>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <Typography.Paragraph>{t(`pay.pin.step.${step}`)}</Typography.Paragraph>
        {open && <PinBoxes reset={reset} disabled={busy} onDone={submit} />}
        {err && <Alert type="error" showIcon style={{ marginTop: 12 }} title={err} />}
      </div>
    </Modal>
  )
}
