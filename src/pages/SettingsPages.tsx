import { Card, Segmented, Select, Switch, Typography } from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { AccountInfo } from '../components/AccountInfo'
import { PageHeader } from '../components/PageHeader'
import { LANGUAGES, setLanguage } from '../i18n'
import { useThemeMode } from '../theme/ThemeProvider'
import { PALETTES, type PaletteKey } from '../theme/tokens'
import { occasionName } from '../theme/occasions'

export function AccountPage() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <PageHeader title={t('nav.account')} subtitle={t('nav.accountDesc')} />
      <AccountInfo />
    </div>
  )
}

export function AppearancePage() {
  const { t, i18n } = useTranslation()
  const { mode, toggle, palette, setPalette, occasion, autoOccasion, setAutoOccasion, preview, setPreview, occasions } = useThemeMode()

  return (
    <div className="page">
      <PageHeader title={t('nav.appearance')} subtitle={t('nav.appearanceDesc')} />
      <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <Typography.Text strong style={{ fontSize: 15 }}>{t('settings.theme')}</Typography.Text>
              <div><Typography.Text type="secondary">{t('settings.themeDesc')}</Typography.Text></div>
            </div>
            <Switch
              checked={mode === 'dark'}
              onChange={toggle}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              aria-label={t('settings.theme')}
            />
          </div>
        </Card>
        <Card>
          <Typography.Text strong style={{ fontSize: 15 }}>{t('settings.palette')}</Typography.Text>
          <div style={{ marginBottom: 14 }}><Typography.Text type="secondary">{t('settings.paletteDesc')}</Typography.Text></div>
          <div className="palette-picker" role="radiogroup" aria-label={t('settings.palette')}>
            {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={palette === k} className={`palette-opt${palette === k ? ' on' : ''}`} onClick={() => setPalette(k)}>
                <div className="sw" style={{ background: `linear-gradient(135deg, ${PALETTES[k].deep}, ${PALETTES[k].primary} 55%, ${PALETTES[k].accent})` }} />
                <span>{t(`settings.palettes.${k}`)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <Typography.Text strong style={{ fontSize: 15 }}>{t('settings.occasion')}</Typography.Text>
              <div><Typography.Text type="secondary">{t('settings.occasionDesc')}</Typography.Text></div>
            </div>
            <Switch checked={autoOccasion} onChange={setAutoOccasion} aria-label={t('settings.occasion')} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Typography.Text type="secondary">{t('settings.occasionPreview')}:</Typography.Text>
            <Select allowClear style={{ minWidth: 260 }} placeholder={t('settings.occasionNone')} value={preview ?? undefined} onChange={(v) => setPreview(v ?? null)}
              options={occasions.map((o) => ({ value: o.key, label: `${o.emoji[0]} ${occasionName(o, t)}` }))} />
            {occasion && <Typography.Text>{occasion.emoji[0]} {occasionName(occasion, t)}</Typography.Text>}
          </div>
        </Card>
        <Card>
          <Typography.Text strong style={{ fontSize: 15 }}>{t('common.language')}</Typography.Text>
          <div style={{ marginBottom: 14 }}><Typography.Text type="secondary">{t('settings.languageDesc')}</Typography.Text></div>
          <Segmented
            value={i18n.language}
            onChange={(v) => setLanguage(String(v))}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          />
        </Card>
      </div>
    </div>
  )
}
