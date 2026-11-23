/* 2026-11-23 [Truong] - Mobile app: 4-digit PIN entry (masked, number pad, auto-submit like the web PinBoxes) */
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { C } from '../ui'

/** Đổi `reset` để xoá ô và mở lại bàn phím. */
export function PinPad({ reset, disabled, onDone }: { reset: number; disabled?: boolean; onDone: (pin: string) => void }) {
  const [value, setValue] = useState('')
  const ref = useRef<ComponentRef<typeof TextInput>>(null)
  useEffect(() => { setValue(''); if (!disabled) setTimeout(() => ref.current?.focus(), 50) }, [reset, disabled])

  const change = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4)
    setValue(digits)
    if (digits.length === 4) onDone(digits)
  }

  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 48, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: i === value.length ? C.brand : C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card }}>
            <Text style={{ fontSize: 26, color: C.text }}>{i < value.length ? '●' : ''}</Text>
          </View>
        ))}
      </View>
      {/* Ô nhập thật nằm ẩn phía sau 4 ô hiển thị */}
      <TextInput ref={ref} value={value} onChangeText={change} keyboardType="number-pad" maxLength={4} editable={!disabled}
        secureTextEntry autoComplete="off" textContentType="oneTimeCode" caretHidden
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
    </Pressable>
  )
}
