/* 2026-11-23 [Truong] - Mobile app: shared colors and small building blocks */
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { errorCode } from './api/client'

export const C = {
  brand: '#0F6B3E', brandSoft: '#E7F2EC', bg: '#F4F6F5', card: '#FFFFFF', text: '#1B2420', muted: '#5F6B66', border: '#DDE3E0', danger: '#B42318', unread: '#F0F7F3',
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>
}

export function Button({ title, onPress, disabled, kind = 'primary', small }: {
  title: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'ghost' | 'danger'; small?: boolean
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [s.btn, kind === 'ghost' && s.btnGhost, kind === 'danger' && s.btnDanger, small && s.btnSmall, (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[s.btnText, kind === 'ghost' && { color: C.brand }, kind === 'danger' && { color: C.danger }, small && { fontSize: 14 }]}>{title}</Text>
    </Pressable>
  )
}

/** Nhãn nhỏ có nền (cấp duyệt, trạng thái). */
export function Tag({ text, color = C.brand }: { text: string; color?: string }) {
  return <Text style={{ alignSelf: 'flex-start', color, backgroundColor: `${color}1A`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, fontWeight: '600', overflow: 'hidden' }}>{text}</Text>
}

/** Trạng thái tải / lỗi chung cho màn hình dùng react-query. */
export function QueryState({ loading, error, onRetry }: { loading: boolean; error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  if (loading) return <View style={s.center}><ActivityIndicator color={C.brand} /></View>
  if (!error) return null
  return (
    <View style={s.center}>
      <Text style={s.error}>{t(`mobile.err.${errorCode(error)}`, t('mobile.err.generic'))}</Text>
      <Button title={t('mobile.retry')} onPress={onRetry} kind="ghost" />
    </View>
  )
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  h1: { fontSize: 22, fontWeight: '700', color: C.text },
  h2: { fontSize: 16, fontWeight: '600', color: C.text },
  body: { fontSize: 15, color: C.text },
  muted: { fontSize: 13, color: C.muted },
  error: { fontSize: 14, color: C.danger, textAlign: 'center' },
  center: { padding: 24, alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: C.card, color: C.text },
  btn: { backgroundColor: C.brand, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.brand, paddingHorizontal: 16 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.danger, paddingHorizontal: 16 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stat: { flex: 1, minWidth: '45%', backgroundColor: C.brandSoft, borderRadius: 10, padding: 12, gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: C.brand },
})

/** yyyy-MM-dd theo giờ máy. */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const monthRange = () => { const now = new Date(); return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) } }
