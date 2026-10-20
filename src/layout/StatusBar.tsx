import { useEffect, useState } from 'react'
import { Dropdown } from 'antd'
import { BgColorsOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { LANGUAGES, setLanguage } from '../i18n'
import { useThemeMode } from '../theme/ThemeProvider'
import { PALETTES, type PaletteKey } from '../theme/tokens'
import { Flag } from '../components/Flag'

const APP_VERSION = '2.0.0'

function useClock(locale: string) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/** Thanh trạng thái phía dưới: tình trạng kết nối máy chủ, người dùng, giờ, ngôn ngữ, giao diện. */
export function StatusBar() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { mode, toggle, palette, setPalette, occasion, autoOccasion, setAutoOccasion, preview, setPreview } = useThemeMode()
  const time = useClock(i18n.language)

  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 0,
    retry: false,
  })
  const state = health.isError ? 'bad' : health.data ? 'ok' : 'checking'
  const text = state === 'ok' ? t('common.online') : state === 'bad' ? t('common.offline') : t('common.checking')
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  return (
    <footer className="app-status">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span role="status"><span className={`status-dot ${state === 'checking' ? '' : state}`} />{text}</span>
        <span style={{ opacity: 0.8 }}>{user?.userId}{user?.factoryCode ? ` · ${user.factoryCode}` : ''}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <span style={{ marginRight: 8 }}>{time}</span>
        <Dropdown
          trigger={['click']}
          placement="topRight"
          menu={{
            selectedKeys: [i18n.language],
            items: LANGUAGES.map((l) => ({ key: l.code, label: <span className="lang-opt"><Flag code={l.code} width={20} />{l.label}</span> })),
            onClick: ({ key }) => setLanguage(key),
          }}
        >
          <button type="button" className="status-btn" aria-label={t('common.language')}><Flag code={current.code} width={16} /> {current.short}</button>
        </Dropdown>
        {occasion && (
          <button type="button" className="status-btn" title={t('settings.occasionOff')} aria-label={t('settings.occasionOff')}
            onClick={() => { if (preview) setPreview(null); else setAutoOccasion(!autoOccasion) }}>{occasion.emoji[0]}</button>
        )}
        <Dropdown
          trigger={['click']}
          placement="topRight"
          menu={{
            selectedKeys: [palette],
            items: (Object.keys(PALETTES) as PaletteKey[]).map((k) => ({
              key: k,
              label: <span className="lang-opt"><i className="pal-dot" style={{ background: `linear-gradient(135deg, ${PALETTES[k].deep}, ${PALETTES[k].primary} 55%, ${PALETTES[k].accent})` }} />{t(`settings.palettes.${k}`)}</span>,
            })),
            onClick: ({ key }) => { setPalette(key as PaletteKey); if (occasion) { setPreview(null); setAutoOccasion(false) } },   // tự chọn màu thì thôi giao diện dịp lễ
          }}
        >
          <button type="button" className="status-btn" aria-label={t('settings.palette')} title={t('settings.palette')}><BgColorsOutlined /></button>
        </Dropdown>
        <button
          type="button"
          className="status-btn"
          onClick={toggle}
          aria-label={mode === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          title={mode === 'dark' ? t('common.lightMode') : t('common.darkMode')}
        >
          {mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
        </button>
        <span style={{ marginLeft: 8, opacity: 0.7 }}>v{APP_VERSION}</span>
      </div>
    </footer>
  )
}
