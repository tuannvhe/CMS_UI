/* 2026-11-23 [Truong] - Mobile app: change payslip PIN (current → new → confirm), keeps the biometric copy in sync */
import { useState } from 'react'
import { Alert, Modal, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { payslip } from '@web/api/payslip'
import { bioEnable, bioEnabled } from '../payslipBio'
import { Button, useTheme } from '../ui'
import { usePinError } from './PayslipGate'
import { PinPad } from './PinPad'

export function PinChangeModal({ open, userId, onClose }: { open: boolean; userId: string; onClose: () => void }) {
  const { C, s } = useTheme()
  const { t } = useTranslation()
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
    try {
      await payslip.pinChange(oldPin, newPin)
      // Đang mở bằng vân tay: cập nhật mã lưu trong máy (hỏi vân tay); không được thì lần sau nhập mã mới rồi bật lại
      if (await bioEnabled(userId)) await bioEnable(userId, newPin, t('mobile.bio.prompt'))
      Alert.alert(t('pay.pin.changed'))
      close()
    } catch (e) { setErr(pinError(e)); setOldPin(null); setNewPin(null); again() } finally { setBusy(false) }
  }

  const step = oldPin === null ? 'old' : newPin === null ? 'new' : 'confirm'
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.overlay, padding: 24 }}>
        <View style={[s.card, { gap: 14, alignItems: 'center' }]}>
          <Text style={s.h2}>{t('pay.pin.changeTitle')}</Text>
          <Text style={s.body}>{t(`pay.pin.step.${step}`)}</Text>
          {open && <PinPad reset={reset} disabled={busy} onDone={(p) => void submit(p)} />}
          {!!err && <Text style={s.error}>{err}</Text>}
          <Button kind="ghost" title={t('req.cancel')} onPress={close} disabled={busy} />
        </View>
      </View>
    </Modal>
  )
}
