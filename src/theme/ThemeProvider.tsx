import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { App as AntApp, ConfigProvider, theme as antd, type ThemeConfig } from 'antd'
import viVN from 'antd/locale/vi_VN'
import enUS from 'antd/locale/en_US'
import koKR from 'antd/locale/ko_KR'
import { useTranslation } from 'react-i18next'
import { ToastProvider } from '../components/ToastHost'
import { fontFamily, PALETTES, radius, type PaletteKey } from './tokens'
import { buildOccasions, occasionByKey, occasionOn, type Occasion } from './occasions'
import { occasionsApi, type OccasionSettings } from '../api/occasions'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'cmsvn_theme'
const PALETTE_KEY = 'cmsvn_palette'
const AUTO_KEY = 'cmsvn_auto_occasion'
const PREVIEW_KEY = 'cmsvn_occasion_preview'
const LOCALES = { vi: viVN, en: enUS, ko: koKR } as const

function readInitialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* bỏ qua */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readInitialPalette(): PaletteKey {
  try {
    const saved = localStorage.getItem(PALETTE_KEY)
    if (saved && saved in PALETTES) return saved as PaletteKey
  } catch { /* bỏ qua */ }
  return 'green'
}

function readFlag(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); if (v === '1') return true; if (v === '0') return false } catch { /* bỏ qua */ }
  return fallback
}

function readPreview(): string | null {
  try { return sessionStorage.getItem(PREVIEW_KEY) } catch { return null }
}

function buildTheme(mode: ThemeMode, paletteKey: PaletteKey, occasion?: Occasion): ThemeConfig {
  const dark = mode === 'dark'
  const p = occasion ? { ...occasion.palette, accent: occasion.palette.dark.primary } : PALETTES[paletteKey]
  return {
    algorithm: dark ? antd.darkAlgorithm : antd.defaultAlgorithm,
    token: {
      colorPrimary: dark ? p.accent : p.primary,
      colorInfo: '#2F6FB0',
      colorSuccess: '#2E9E4F',
      colorWarning: '#D48806',
      colorError: '#D92D20',
      borderRadius: radius,
      fontFamily,
      fontSize: 14,
      controlHeight: 38,
      colorBgLayout: dark ? '#0E1512' : '#F4F6F5',
      colorBgContainer: dark ? '#17211C' : '#FFFFFF',
      colorBorderSecondary: dark ? '#26332C' : '#E4E9E6',
      wireframe: false,
    },
    components: {
      Menu: { itemHeight: 44, itemBorderRadius: 10, itemMarginInline: 8, iconSize: 17 },
      Table: {
        headerBg: dark ? '#1A261F' : p.headerBg,
        headerColor: dark ? '#98A2B3' : '#667085',
        headerSplitColor: 'transparent',
        rowHoverBg: dark ? '#1C2A23' : p.hover,
        rowSelectedBg: dark ? '#1F3328' : p.selected,
        rowSelectedHoverBg: dark ? '#23392C' : p.selectedHover,
        borderColor: dark ? '#26332C' : '#EDF1EE',
        cellPaddingBlock: 14,
        cellPaddingInline: 16,
        headerBorderRadius: 0,
      },
      Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
      Tag: { borderRadiusSM: 999 },
      Card: { headerFontSize: 15, headerHeight: 52, borderRadiusLG: 12 },
      Alert: { borderRadiusLG: 10 },
      Tabs: { horizontalMargin: '0 0 14px 0' },
    },
  }
}

interface ThemeState {
  mode: ThemeMode; toggle: () => void; setMode: (m: ThemeMode) => void; palette: PaletteKey; setPalette: (p: PaletteKey) => void
  /** Dịp lễ đang áp dụng (tự động theo ngày, hoặc đang xem thử); undefined = giao diện thường */
  occasion?: Occasion
  /** Tự đổi giao diện theo dịp lễ (mặc định bật) */
  autoOccasion: boolean; setAutoOccasion: (v: boolean) => void
  /** Xem thử một dịp lễ bất kỳ (chỉ trong phiên này); null = bỏ xem thử */
  preview: string | null; setPreview: (k: string | null) => void
  /** Mọi dịp đang áp dụng (có sẵn chưa bị tắt + tự thêm), để chọn xem thử */
  occasions: Occasion[]
  /** Tải lại cấu hình dịp từ máy chủ (sau khi quản trị lưu) */
  reloadOccasions: () => void
}
const ThemeContext = createContext<ThemeState | null>(null)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const [mode, setMode] = useState<ThemeMode>(readInitialMode)
  const [palette, setPalette] = useState<PaletteKey>(readInitialPalette)
  const [autoOccasion, setAuto] = useState(() => readFlag(AUTO_KEY, true))
  const [preview, setPreviewState] = useState<string | null>(readPreview)
  const [settings, setSettings] = useState<OccasionSettings | null>(null)
  const reloadOccasions = useCallback(() => { occasionsApi.get().then(setSettings).catch(() => undefined) }, [])   // lỗi thì dùng các dịp có sẵn
  useEffect(() => { reloadOccasions() }, [reloadOccasions])
  const occasions = useMemo(() => buildOccasions(settings), [settings])
  const [today, setToday] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setToday(new Date()), 30 * 60 * 1000); return () => clearInterval(id) }, [])   // qua nửa đêm tự đổi giao diện
  const setAutoOccasion = useCallback((v: boolean) => { setAuto(v); try { localStorage.setItem(AUTO_KEY, v ? '1' : '0') } catch { /* bỏ qua */ } }, [])
  const setPreview = useCallback((k: string | null) => { setPreviewState(k); try { if (k) sessionStorage.setItem(PREVIEW_KEY, k); else sessionStorage.removeItem(PREVIEW_KEY) } catch { /* bỏ qua */ } }, [])
  const occasion = useMemo(() => (preview ? occasionByKey(preview, occasions) : autoOccasion ? occasionOn(today, occasions) : undefined), [preview, autoOccasion, today, occasions])

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* bỏ qua */ }
  }, [mode])

  useEffect(() => {
    document.documentElement.dataset.palette = palette
    try { localStorage.setItem(PALETTE_KEY, palette) } catch { /* bỏ qua */ }
  }, [palette])

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [])
  const themeConfig = useMemo(() => buildTheme(mode, palette, occasion), [mode, palette, occasion])

  // Dịp lễ: ghi đè các biến màu của giao diện (cả ngoài Ant Design); hết dịp thì trả về bảng màu thường
  useEffect(() => {
    const el = document.documentElement
    const names = ['--c-primary', '--c-accent', '--c-rail', '--c-deep', '--c-tint', '--c-tint-strong', '--c-surface-2', '--c-border', '--c-bg', '--c-surface']
    const bgNames = ['--occ-bg', '--occ-veil']
    if (!occasion) { [...names, ...bgNames].forEach((n) => el.style.removeProperty(n)); delete el.dataset.occasion; delete el.dataset.occBg; return }
    const p = occasion.palette
    const dark = mode === 'dark'
    const set = (n: string, v: string) => el.style.setProperty(n, v)
    set('--c-primary', dark ? p.dark.primary : p.primary); set('--c-accent', dark ? p.dark.primary : p.accent); set('--c-rail', p.rail); set('--c-deep', p.deep)
    set('--c-tint', `rgba(${dark ? p.dark.tint : p.tint}, 0.12)`); set('--c-tint-strong', `rgba(${dark ? p.dark.tint : p.tint}, 0.22)`)
    set('--c-surface-2', dark ? p.dark.surface2 : p.surface2); set('--c-border', dark ? p.dark.border : p.border)
    if (dark) { set('--c-bg', p.dark.bg); set('--c-surface', p.dark.surface) } else { el.style.removeProperty('--c-bg'); el.style.removeProperty('--c-surface') }
    el.dataset.occasion = occasion.key
    // Nền tuỳ chỉnh của dịp (hai màu hoặc ảnh): dùng cho màn đăng nhập, vùng nội dung và dải lời chúc
    const bg = occasion.background
    if (bg && bg.kind === 'gradient' && bg.color1 && bg.color2) { set('--occ-bg', `linear-gradient(${bg.angle}deg, ${bg.color1}, ${bg.color2})`); set('--occ-veil', `${bg.veil}%`); el.dataset.occBg = '1' }
    else if (bg && bg.kind === 'image' && bg.imageUrl) { set('--occ-bg', `url("${bg.imageUrl}") center / cover no-repeat`); set('--occ-veil', `${bg.veil}%`); el.dataset.occBg = '1' }
    else { bgNames.forEach((n) => el.style.removeProperty(n)); delete el.dataset.occBg }
    return () => { [...names, ...bgNames].forEach((n) => el.style.removeProperty(n)); delete el.dataset.occasion; delete el.dataset.occBg }
  }, [occasion, mode])
  const locale = LOCALES[i18n.language as keyof typeof LOCALES] ?? viVN
  const value = useMemo(() => ({ mode, toggle, setMode, palette, setPalette, occasion, autoOccasion, setAutoOccasion, preview, setPreview, occasions, reloadOccasions }), [mode, toggle, palette, occasion, autoOccasion, setAutoOccasion, preview, setPreview, occasions, reloadOccasions])

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider locale={locale} theme={themeConfig}>
        <AntApp><ToastProvider>{children}</ToastProvider></AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode phải dùng bên trong AppThemeProvider')
  return ctx
}
