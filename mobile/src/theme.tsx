/*
 * 2026-11-26 - Mobile app: theme (palette like the web Settings › Appearance + light / dark / system mode)
 * Palettes come from the web tokens (CMS_UI/src/theme/tokens.ts) so both apps offer the same colors.
 * Choice is per device (SecureStore). Components read colors / styles with useTheme() so a change re-renders at once.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, useColorScheme, type ViewStyle } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { PALETTES, type PaletteKey } from '@web/theme/tokens'

export type ThemeMode = 'light' | 'dark' | 'system'
export const PALETTE_KEYS = Object.keys(PALETTES) as PaletteKey[]
export type { PaletteKey }

const K = { palette: 'cms.palette', mode: 'cms.themeMode' } as const

/** Bảng màu của app theo bảng màu web + chế độ sáng / tối. */
export function buildColors(key: PaletteKey, dark: boolean) {
  const p = PALETTES[key] ?? PALETTES.green
  if (dark) {
    return {
      dark: true as boolean,
      brand: p.accent, brandStrong: p.primary, accent: p.accent, deep: p.rail, onBrand: '#0B0F14',
      brandSoft: `${p.accent}24`, unread: `${p.accent}14`,
      bg: '#0D1117', card: '#161B22', cardAlt: '#1C222B', text: '#E8ECF1', muted: '#9AA5B1', faint: '#6B7684', border: '#252C36', input: '#11161D',
      danger: '#F97066', dangerSoft: '#F9706622', warn: '#FDB022', warnSoft: '#FDB02222', info: '#53B1FD', purple: '#A48AFB', teal: '#2ED3B7', pink: '#F670C7',
      overlay: 'rgba(0,0,0,0.6)',
    }
  }
  return {
    dark: false as boolean,
    brand: p.primary, brandStrong: p.deep, accent: p.accent, deep: p.deep, onBrand: '#FFFFFF',
    brandSoft: p.selected, unread: p.hover,
    bg: '#F4F6F8', card: '#FFFFFF', cardAlt: '#F8FAFB', text: '#101828', muted: '#5B6675', faint: '#98A2B3', border: '#E4E7EC', input: '#F8FAFB',
    danger: '#D92D20', dangerSoft: '#FEE4E2', warn: '#B54708', warnSoft: '#FEF0C7', info: '#1570EF', purple: '#6941C6', teal: '#0E9384', pink: '#C11574',
    overlay: 'rgba(16,24,40,0.45)',
  }
}
export type Colors = ReturnType<typeof buildColors>

export function buildStyles(C: Colors) {
  const shadow: ViewStyle = C.dark
    ? {}
    : { shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    content: { paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: 32 },
    card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, ...shadow },
    shadow,
    h1: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    h2: { fontSize: 16, fontWeight: '700', color: C.text },
    h3: { fontSize: 13, fontWeight: '700', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
    body: { fontSize: 15, color: C.text, lineHeight: 21 },
    muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
    error: { fontSize: 14, color: C.danger, textAlign: 'center' },
    center: { padding: 24, alignItems: 'center', gap: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    input: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: C.input, color: C.text },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  })
}
export type Styles = ReturnType<typeof buildStyles>

interface ThemeValue {
  C: Colors
  s: Styles
  /** Gradient thương hiệu (thẻ tổng quan, màn đăng nhập). */
  grad: readonly [string, string, string]
  palette: PaletteKey
  mode: ThemeMode
  setPalette: (k: PaletteKey) => void
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [palette, setPaletteState] = useState<PaletteKey>('green')
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [p, m] = await Promise.all([SecureStore.getItemAsync(K.palette), SecureStore.getItemAsync(K.mode)])
        if (p && p in PALETTES) setPaletteState(p as PaletteKey)
        if (m === 'light' || m === 'dark' || m === 'system') setModeState(m)
      } catch { /* giữ mặc định */ }
      setReady(true)
    })()
  }, [])

  const setPalette = useCallback((k: PaletteKey) => { setPaletteState(k); void SecureStore.setItemAsync(K.palette, k).catch(() => undefined) }, [])
  const setMode = useCallback((m: ThemeMode) => { setModeState(m); void SecureStore.setItemAsync(K.mode, m).catch(() => undefined) }, [])

  const dark = mode === 'dark' || (mode === 'system' && system === 'dark')
  const value = useMemo<ThemeValue>(() => {
    const C = buildColors(palette, dark)
    const p = PALETTES[palette]
    const grad = (dark ? [p.rail, p.deep, p.primary] : [p.deep, p.primary, p.accent]) as unknown as readonly [string, string, string]
    return { C, s: buildStyles(C), grad, palette, mode, setPalette, setMode }
  }, [palette, dark, mode, setPalette, setMode])

  // Chờ đọc lựa chọn đã lưu (vài ms) để không loé màu mặc định
  if (!ready) return null
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const v = useContext(ThemeContext)
  if (!v) throw new Error('useTheme must be used inside ThemeProvider')
  return v
}
