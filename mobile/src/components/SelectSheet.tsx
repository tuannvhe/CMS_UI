/* 2026-11-23 [Truong] - Mobile app: field that opens a bottom sheet list with accent-insensitive search (replaces antd Select) */
import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { foldText } from '@web/utils/search'
import { useTheme } from '../ui'
import { KeyboardView } from '../keyboard'

export interface SheetOption { value: string; label: string; hint?: string; disabled?: boolean }

export function SelectField({ label, value, options, onChange, disabled, allowClear, searchable = true, loading }: {
  label: string; value?: string; options: SheetOption[]; onChange: (v: string | undefined) => void
  disabled?: boolean; allowClear?: boolean; searchable?: boolean; loading?: boolean
}) {
  const { C, s } = useTheme()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const current = options.find((o) => o.value === value)
  const list = useMemo(() => {
    const f = foldText(q.trim())
    return f ? options.filter((o) => foldText(`${o.label} ${o.hint ?? ''}`).includes(f)) : options
  }, [options, q])

  return (
    <>
      <Pressable onPress={() => { setQ(''); setOpen(true) }} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
        style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: disabled ? 0.5 : 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.muted, { fontSize: 11 }]}>{label}</Text>
          <Text style={[s.body, !current && { color: C.muted }]} numberOfLines={1}>{current?.label ?? (loading ? t('mobile.loading') : '—')}</Text>
        </View>
        {allowClear && !!value && !disabled ? (
          <Pressable onPress={() => onChange(undefined)} hitSlop={10} accessibilityRole="button" accessibilityLabel="clear"><Ionicons name="close-circle" size={20} color={C.faint} /></Pressable>
        ) : <Ionicons name="chevron-down" size={18} color={C.muted} />}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardView>
        <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={() => setOpen(false)} />
        <SafeAreaView edges={['bottom']} style={{ maxHeight: '75%', backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={s.h2}>{label}</Text>
            {searchable && options.length > 8 && <TextInput style={s.input} value={q} onChangeText={setQ} placeholder={t('mobile.search')} autoCorrect={false} />}
          </View>
          <FlatList
            data={list}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', padding: 16 }]}>{t('mobile.empty')}</Text>}
            renderItem={({ item }) => (
              <Pressable disabled={item.disabled} onPress={() => { onChange(item.value); setOpen(false) }}
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: C.border, backgroundColor: item.value === value ? C.unread : C.card, opacity: item.disabled ? 0.45 : 1 }}>
                <Text style={[s.body, item.value === value && { color: C.brand, fontWeight: '700' }]}>{item.label}</Text>
                {!!item.hint && <Text style={s.muted}>{item.hint}</Text>}
              </Pressable>
            )}
          />
        </SafeAreaView>
        </KeyboardView>
      </Modal>
    </>
  )
}
