/* 2026-11-23 [Truong] - Mobile app: shared colors and small building blocks
 * 2026-11-25: bộ giao diện mới — màu thương hiệu như web, thẻ bo tròn đổ bóng, nút gradient có icon, chip, header gradient cho từng tab. */
import type { ReactNode } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { errorCode } from './api/client'
import { useAuth } from './auth/AuthProvider'

/** Màu dùng chung (cùng họ màu với web: --c-primary, --c-accent, --c-deep, --c-rail). */
export const C = {
  brand: '#0F6B3E', brand2: '#178A4D', accent: '#5FA830', deep: '#0A3B24',
  brandSoft: '#E8F3EC', bg: '#F2F5F3', card: '#FFFFFF', text: '#14201A', muted: '#66736D', faint: '#98A39E', border: '#E3E9E5',
  danger: '#D92D20', dangerSoft: '#FDECEA', warn: '#B54708', info: '#1570EF', purple: '#6D5BD0', teal: '#0E9384', unread: '#EEF7F1',
}
/** Gradient thương hiệu: header, nút chính, màn đăng nhập. */
export const GRAD = [C.deep, C.brand, C.accent] as const

export const shadow: ViewStyle = { shadowColor: '#0A3B24', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 }

export type IconName = keyof typeof Ionicons.glyphMap
export function Icon({ name, size = 20, color = C.text }: { name: IconName; size?: number; color?: ColorValue }) {
  return <Ionicons name={name} size={size} color={color as string} />
}

/** Ô tròn có icon trên nền nhạt cùng màu. */
export function IconBadge({ name, color = C.brand, size = 36 }: { name: IconName; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.52} color={color} />
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>
}

export function Button({ title, onPress, disabled, kind = 'primary', small, icon }: {
  title: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'ghost' | 'danger'; small?: boolean; icon?: IconName
}) {
  const color = kind === 'primary' ? '#fff' : kind === 'danger' ? C.danger : C.brand
  const inner = (
    <View style={[s.btnInner, small && s.btnSmall]}>
      {icon && <Ionicons name={icon} size={small ? 16 : 18} color={color} />}
      <Text style={[s.btnText, { color }, small && { fontSize: 14 }]} numberOfLines={1}>{title}</Text>
    </View>
  )
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [s.btn, kind === 'ghost' && s.btnGhost, kind === 'danger' && s.btnDanger, (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85, transform: [{ scale: 0.98 }] }]}>
      {kind === 'primary'
        ? <LinearGradient colors={[C.brand, C.brand2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14 }}>{inner}</LinearGradient>
        : inner}
    </Pressable>
  )
}

/** Nhãn nhỏ dạng viên thuốc (cấp duyệt, trạng thái). */
export function Tag({ text, color = C.brand }: { text: string; color?: string }) {
  return <Text style={{ alignSelf: 'flex-start', color, backgroundColor: `${color}17`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, fontWeight: '700', overflow: 'hidden' }}>{text}</Text>
}

/** Chip chọn (loại đơn, kỳ lương…); count > 0 hiện số tròn. */
export function Chip({ label, on, onPress, count }: { label: string; on: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.8 }]}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
      {!!count && count > 0 && (
        <View style={[s.chipCount, on && { backgroundColor: '#fff' }]}><Text style={[s.chipCountText, on && { color: C.brand }]}>{count > 99 ? '99+' : count}</Text></View>
      )}
    </Pressable>
  )
}

/** Hai / ba lựa chọn dạng thanh trượt (Nháp / Đã gửi…). */
export function Segmented<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <View style={s.seg}>
      {items.map((it) => {
        const on = it.key === value
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && { color: C.brand }]} numberOfLines={1}>{it.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Trạng thái rỗng có icon. */
export function EmptyState({ text, icon = 'file-tray-outline' }: { text: string; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={C.brand} />
      </View>
      <Text style={[s.muted, { textAlign: 'center', maxWidth: 260 }]}>{text}</Text>
    </View>
  )
}

const initials = (name?: string | null) => (name ?? '').trim().split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase() || '?'

/** Header gradient đầu mỗi tab: tiêu đề lớn, dòng phụ, avatar (bấm để đăng xuất) và nội dung thêm (đổi tháng…). */
export function TabHero({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const insets = useSafeAreaInsets()
  const ask = () => Alert.alert(user?.fullName ?? t('mobile.logout'), t('mobile.logoutAsk'), [
    { text: t('mobile.cancel'), style: 'cancel' },
    { text: t('mobile.logout'), style: 'destructive', onPress: () => void signOut() },
  ])
  return (
    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1.2 }} style={[s.hero, { paddingTop: insets.top + 10 }]}>
      <View style={s.heroRing} pointerEvents="none" />
      <View style={[s.row, { gap: 12 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.heroTitle} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.heroSub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <Pressable onPress={ask} hitSlop={8} accessibilityLabel={t('mobile.logout')} style={({ pressed }) => [s.avatar, pressed && { opacity: 0.8 }]}>
          <Text style={s.avatarText}>{initials(user?.fullName)}</Text>
        </Pressable>
      </View>
      {children}
    </LinearGradient>
  )
}

/** Trạng thái tải / lỗi chung cho màn hình dùng react-query. */
export function QueryState({ loading, error, onRetry }: { loading: boolean; error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  if (loading) return <View style={s.center}><ActivityIndicator color={C.brand} /></View>
  if (!error) return null
  const code = errorCode(error)
  const denied = code === 'forbidden'
  return (
    <View style={s.center}>
      <IconBadge name={denied ? 'lock-closed-outline' : code === 'network' ? 'cloud-offline-outline' : 'alert-circle-outline'} color={denied ? C.muted : C.danger} size={48} />
      <Text style={[s.error, denied && { color: C.muted }]}>{t(`mobile.err.${code}`, t('mobile.err.generic'))}</Text>
      {!denied && <Button title={t('mobile.retry')} onPress={onRetry} kind="ghost" icon="refresh" />}
    </View>
  )
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, ...shadow },
  h1: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  h2: { fontSize: 16, fontWeight: '700', color: C.text },
  body: { fontSize: 15, color: C.text, lineHeight: 21 },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  error: { fontSize: 14, color: C.danger, textAlign: 'center' },
  center: { padding: 24, alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: '#F7F9F8', color: C.text },
  btn: { borderRadius: 14, overflow: 'hidden' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16 },
  btnGhost: { backgroundColor: C.brandSoft },
  btnDanger: { backgroundColor: C.dangerSoft },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stat: { flex: 1, minWidth: '45%', backgroundColor: C.brandSoft, borderRadius: 14, padding: 12, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: C.brand },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { color: C.text, fontWeight: '600', fontSize: 14 },
  chipCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  seg: { flexDirection: 'row', backgroundColor: '#E6ECE8', borderRadius: 14, padding: 4 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  segOn: { backgroundColor: C.card, ...shadow, shadowOpacity: 0.06 },
  segText: { color: C.muted, fontWeight: '700', fontSize: 14 },
  hero: { paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', gap: 14 },
  heroRing: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', right: -80, top: -110 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13.5, marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})

/** yyyy-MM-dd theo giờ máy. */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const monthRange = () => { const now = new Date(); return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) } }
