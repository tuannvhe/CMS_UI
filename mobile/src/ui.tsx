/* 2026-11-23 [Truong] - Mobile app: shared colors and small building blocks
 * 2026-11-26: giao diện mới — màu theo bảng màu đã chọn (như web) + sáng / tối (theme.tsx), header gọn trên nền sáng,
 * thẻ phẳng viền mảnh, nút đặc một màu, ảnh đại diện mở màn Cài đặt. */
import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { absUrl, api, errorCode } from './api/client'
import { useAuth } from './auth/AuthProvider'
import { useTheme } from './theme'

export { useTheme, type Colors } from './theme'

export type IconName = keyof typeof Ionicons.glyphMap
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const { C } = useTheme()
  return <Ionicons name={name} size={size} color={(color ?? C.text) as string} />
}

/** Ô bo tròn có icon trên nền nhạt cùng màu. */
export function IconBadge({ name, color, size = 36 }: { name: IconName; color?: string; size?: number }) {
  const { C } = useTheme()
  const c = color ?? C.brand
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${c}1F`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.52} color={c} />
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { s } = useTheme()
  return <View style={[s.card, style]}>{children}</View>
}

/** Tiêu đề nhóm nhỏ (chữ in hoa, xám) phía trên một nhóm thẻ. */
export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  const { s } = useTheme()
  return (
    <View style={[s.row, { marginTop: 6, paddingHorizontal: 2 }]}>
      <Text style={s.h3}>{title}</Text>
      {right}
    </View>
  )
}

export function Button({ title, onPress, disabled, kind = 'primary', small, icon, loading }: {
  title: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'ghost' | 'danger' | 'outline'; small?: boolean; icon?: IconName; loading?: boolean
}) {
  const { C } = useTheme()
  const color = kind === 'primary' ? C.onBrand : kind === 'danger' ? C.danger : C.brand
  const bg = kind === 'primary' ? C.brand : kind === 'danger' ? C.dangerSoft : kind === 'ghost' ? C.brandSoft : 'transparent'
  const off = disabled || loading
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [{
        borderRadius: 14, backgroundColor: bg, minHeight: small ? 40 : 50, paddingHorizontal: small ? 14 : 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: kind === 'outline' ? 1 : 0, borderColor: C.border,
      }, off && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}>
      {loading ? <ActivityIndicator color={color} size="small" /> : icon ? <Ionicons name={icon} size={small ? 17 : 19} color={color} /> : null}
      {!!title && <Text style={{ color, fontSize: small ? 14 : 16, fontWeight: '700' }} numberOfLines={1}>{title}</Text>}
    </Pressable>
  )
}

/** Nút tròn chỉ có icon (đổi tháng, đóng…), vùng bấm 44px. */
export function IconButton({ name, onPress, disabled, label, tone = 'soft' }: { name: IconName; onPress: () => void; disabled?: boolean; label: string; tone?: 'soft' | 'plain' | 'onBrand' }) {
  const { C } = useTheme()
  const bg = tone === 'soft' ? C.brandSoft : tone === 'onBrand' ? 'rgba(255,255,255,0.16)' : 'transparent'
  const fg = tone === 'onBrand' ? '#fff' : C.brand
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, disabled && { opacity: 0.3 }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={name} size={20} color={fg} />
    </Pressable>
  )
}

/** Nhãn nhỏ dạng viên thuốc (cấp duyệt, trạng thái). */
export function Tag({ text, color }: { text: string; color?: string }) {
  const { C } = useTheme()
  const c = color ?? C.brand
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: `${c}1C`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  )
}

/** Chip chọn (loại đơn, kỳ lương…); count > 0 hiện số tròn. */
export function Chip({ label, on, onPress, count, icon }: { label: string; on: boolean; onPress: () => void; count?: number; icon?: IconName }) {
  const { C } = useTheme()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 38, borderRadius: 999,
        backgroundColor: on ? C.brand : C.card, borderWidth: 1, borderColor: on ? C.brand : C.border,
      }, pressed && { opacity: 0.8 }]}>
      {icon && <Ionicons name={icon} size={16} color={on ? C.onBrand : C.muted} />}
      <Text style={{ color: on ? C.onBrand : C.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      {!!count && count > 0 && (
        <View style={{ minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: on ? C.onBrand : C.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: on ? C.brand : '#fff', fontSize: 11, fontWeight: '800' }}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  )
}

/** Hàng chip cuộn ngang. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
}

/** Hai / ba lựa chọn dạng thanh trượt (Nháp / Đã gửi…). */
export function Segmented<T extends string>({ items, value, onChange }: { items: { key: T; label: string; icon?: IconName }[]; value: T; onChange: (k: T) => void }) {
  const { C, s } = useTheme()
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.dark ? C.cardAlt : '#E9EDF1', borderRadius: 14, padding: 4 }}>
      {items.map((it) => {
        const on = it.key === value
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[{ flex: 1, minHeight: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }, on && { backgroundColor: C.card, ...s.shadow }]}>
            {it.icon && <Ionicons name={it.icon} size={16} color={on ? C.brand : C.muted} />}
            <Text style={{ color: on ? C.brand : C.muted, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{it.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Trạng thái rỗng có icon. */
export function EmptyState({ text, icon = 'file-tray-outline' }: { text: string; icon?: IconName }) {
  const { C, s } = useTheme()
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 48 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={32} color={C.brand} />
      </View>
      <Text style={[s.muted, { textAlign: 'center', maxWidth: 260, fontSize: 14 }]}>{text}</Text>
    </View>
  )
}

export const initials = (name?: string | null) => (name ?? '').trim().split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase() || '?'

/** Ảnh đại diện chữ cái đầu trên nền màu chủ đạo. */
/** Ảnh đại diện; uri = đường dẫn ảnh máy chủ (/api/avatar/...), không có / tải lỗi thì hiện chữ cái đầu. */
export function Avatar({ name, size = 42, uri }: { name?: string | null; size?: number; uri?: string | null }) {
  const { C } = useTheme()
  const [failed, setFailed] = useState<string | null>(null)
  const box = { width: size, height: size, borderRadius: size / 2 }
  if (uri && failed !== uri) {
    return <Image source={{ uri: absUrl(uri) }} style={[box, { backgroundColor: C.cardAlt }]} onError={() => setFailed(uri)} accessibilityLabel={name ?? undefined} />
  }
  return (
    <View style={[box, { backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: C.onBrand, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  )
}

/** Ảnh đại diện của chính mình (GET /avatar/me: ảnh tự tải > ảnh nhân sự tải > ảnh hệ thống cũ). */
export function useMyAvatar() {
  const { user, status } = useAuth()
  return useQuery({
    queryKey: ['avatar', 'me', user?.userId],
    queryFn: () => api.get<{ url: string | null }>('/avatar/me').then((r) => r.data.url),
    enabled: status === 'signedIn',
    staleTime: 10 * 60_000,
  }).data ?? null
}

/** Header đầu mỗi tab: tiêu đề lớn, dòng phụ, ảnh đại diện (bấm mở Cài đặt) và nội dung thêm (đổi tháng, chip…). */
export function TabHero({ title, subtitle, children, right }: { title: string; subtitle?: string; children?: ReactNode; right?: ReactNode }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { C, s } = useTheme()
  const insets = useSafeAreaInsets()
  const myAvatar = useMyAvatar()
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, gap: 12, backgroundColor: C.bg }}>
      <View style={[s.row, { gap: 12 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.h1} numberOfLines={1} accessibilityRole="header">{title}</Text>
          {!!subtitle && <Text style={[s.muted, { fontSize: 14, marginTop: 2 }]} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
        <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('mobile.settings.title')}
          style={({ pressed }) => pressed && { opacity: 0.7 }}>
          <Avatar name={user?.fullName} uri={myAvatar} />
        </Pressable>
      </View>
      {children}
    </View>
  )
}

/** Trạng thái tải / lỗi chung cho màn hình dùng react-query. */
export function QueryState({ loading, error, onRetry }: { loading: boolean; error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  const { C, s } = useTheme()
  if (loading) return <View style={s.center}><ActivityIndicator color={C.brand} /></View>
  if (!error) return null
  const code = errorCode(error)
  const denied = code === 'forbidden'
  return (
    <View style={s.center}>
      <IconBadge name={denied ? 'lock-closed-outline' : code === 'network' ? 'cloud-offline-outline' : 'alert-circle-outline'} color={denied ? C.muted : C.danger} size={52} />
      <Text style={[s.error, denied && { color: C.muted }]}>{t(`mobile.err.${code}`, t('mobile.err.generic'))}</Text>
      {!denied && <Button title={t('mobile.retry')} onPress={onRetry} kind="ghost" icon="refresh" small />}
    </View>
  )
}

/** Thanh nút cố định dưới màn hình (gửi đơn, đăng ký…). */
export function BottomBar({ children }: { children: ReactNode }) {
  const { C } = useTheme()
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
      {children}
    </View>
  )
}

/** yyyy-MM-dd theo giờ máy. */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const monthRange = () => { const now = new Date(); return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) } }
