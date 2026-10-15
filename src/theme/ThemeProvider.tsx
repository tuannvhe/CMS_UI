import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { App as AntApp, ConfigProvider, theme as antd, type ThemeConfig } from 'antd'
import viVN from 'antd/locale/vi_VN'
import enUS from 'antd/locale/en_US'
import koKR from 'antd/locale/ko_KR'
import { useTranslation } from 'react-i18next'
import { ToastProvider } from '../components/ToastHost'
import { brand, fontFamily, radius } from './tokens'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'cmsvn_theme'
const LOCALES = { vi: viVN, en: enUS, ko: koKR } as const

function readInitialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* bỏ qua */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function buildTheme(mode: ThemeMode): ThemeConfig {
  const dark = mode === 'dark'
  return {
    algorithm: dark ? antd.darkAlgorithm : antd.defaultAlgorithm,
    token: {
      colorPrimary: brand.primary,
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
        headerBg: dark ? '#1A261F' : '#F8FAF9',
        headerColor: dark ? '#98A2B3' : '#667085',
        headerSplitColor: 'transparent',
        rowHoverBg: dark ? '#1C2A23' : '#F2F8F4',
        rowSelectedBg: dark ? '#1F3328' : '#E6F3EB',
        rowSelectedHoverBg: dark ? '#23392C' : '#DCEEE3',
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

interface ThemeState { mode: ThemeMode; toggle: () => void }
const ThemeContext = createContext<ThemeState | null>(null)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const [mode, setMode] = useState<ThemeMode>(readInitialMode)

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* bỏ qua */ }
  }, [mode])

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [])
  const themeConfig = useMemo(() => buildTheme(mode), [mode])
  const locale = LOCALES[i18n.language as keyof typeof LOCALES] ?? viVN
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle])

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
