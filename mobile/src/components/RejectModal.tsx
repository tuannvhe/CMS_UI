/* 2026-11-23 [Truong] - Mobile app: reject reason dialog (max 100 chars, same rule as the web) */
import { useEffect, useState } from 'react'
import { Modal, Text, TextInput, View } from 'react-native'
import { KeyboardView } from '../keyboard'
import { useTranslation } from 'react-i18next'
import { Button, useTheme } from '../ui'

export function RejectModal({ open, subtitle, busy, onClose, onSubmit }: {
  open: boolean; subtitle?: string; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void
}) {
  const { C, s } = useTheme()
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  useEffect(() => { if (!open) setReason('') }, [open])

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardView style={{ justifyContent: 'center', backgroundColor: C.overlay, padding: 24 }}>
        <View style={[s.card, { gap: 12 }]}>
          <Text style={[s.h2, { color: C.danger }]}>{t('apr.rejectTitle')}</Text>
          {!!subtitle && <Text style={s.muted}>{subtitle}</Text>}
          <TextInput style={[s.input, { minHeight: 96, textAlignVertical: 'top' }]} multiline maxLength={100} autoFocus
            value={reason} onChangeText={setReason} placeholder={t('apr.reasonPlaceholder')} editable={!busy} />
          <Text style={[s.muted, { textAlign: 'right' }]}>{reason.length}/100</Text>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Button title={t('req.cancel')} kind="ghost" onPress={onClose} disabled={busy} />
            <Button title={t('apr.reject')} kind="danger" onPress={() => onSubmit(reason.trim())} disabled={busy || !reason.trim()} />
          </View>
        </View>
      </KeyboardView>
    </Modal>
  )
}
