import { Card, Segmented, Switch, Typography } from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { AccountInfo } from '../components/AccountInfo'
import { PageHeader } from '../components/PageHeader'
import { LANGUAGES, setLanguage } from '../i18n'
import { useThemeMode } from '../theme/ThemeProvider'

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
  const { mode, toggle } = useThemeMode()

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
