/* 2026-11-23 [Truong] - Mobile app: native date / time fields (dd/MM/yyyy, HH:mm) */
import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useTranslation } from 'react-i18next'
import { dmy, fromYmd, hm, toYmd } from '../requests'
import { Button, C, s } from '../ui'

/** Android mở hộp chọn của hệ thống rồi tự đóng; iOS hiện bộ chọn ngay dưới ô kèm nút Xong. */
function Picker({ mode, value, onPick, onClose, minuteInterval }: {
  mode: 'date' | 'time'; value: Date; onPick: (d: Date) => void; onClose: () => void; minuteInterval?: 5
}) {
  const { t, i18n } = useTranslation()
  const change = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') { onClose(); if (e.type === 'set' && d) onPick(d) } else if (d) onPick(d)
  }
  return (
    <View>
      <DateTimePicker value={value} mode={mode} is24Hour display={Platform.OS === 'ios' ? (mode === 'date' ? 'inline' : 'spinner') : 'default'}
        minuteInterval={minuteInterval} locale={i18n.language} onChange={change} accentColor={C.brand} />
      {Platform.OS === 'ios' && <Button small kind="ghost" title={t('mobile.done')} onPress={onClose} />}
    </View>
  )
}

/** Giá trị yyyy-MM-dd (đúng định dạng API). */
export function DateField({ label, value, onChange, allowClear }: { label: string; value?: string | null; onChange: (v: string | undefined) => void; allowClear?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={[s.input, { flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.muted, { fontSize: 11 }]}>{label}</Text>
          <Text style={[s.body, !value && { color: C.muted }]}>{value ? dmy(value) : '—'}</Text>
        </View>
        {allowClear && value ? <Pressable onPress={() => onChange(undefined)} hitSlop={10}><Text style={{ color: C.muted, fontSize: 18 }}>✕</Text></Pressable> : <Text>📅</Text>}
      </Pressable>
      {open && <Picker mode="date" value={fromYmd(value) ?? new Date()} onPick={(d) => onChange(toYmd(d))} onClose={() => setOpen(false)} />}
    </View>
  )
}

/** Giá trị HH:mm, bước 5 phút như TimePicker của web. */
export function TimeField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const base = new Date()
  if (value && /^\d{2}:\d{2}$/.test(value)) base.setHours(Number(value.slice(0, 2)), Number(value.slice(3)), 0, 0)
  else base.setMinutes(Math.floor(base.getMinutes() / 5) * 5, 0, 0)
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={[s.input, { flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.muted, { fontSize: 11 }]}>{label}</Text>
          <Text style={[s.body, !value && { color: C.muted }]}>{value || '--:--'}</Text>
        </View>
        <Text>🕑</Text>
      </Pressable>
      {open && <Picker mode="time" value={base} minuteInterval={5} onPick={(d) => onChange(hm(d))} onClose={() => setOpen(false)} />}
    </View>
  )
}
