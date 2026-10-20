import { Button, Segmented, Switch, Typography } from 'antd'
import { LogoutOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { UserAvatar } from '../components/UserAvatar'
import { LANGUAGES, setLanguage } from '../i18n'
import { useThemeMode } from '../theme/ThemeProvider'

/** Nội dung menu người dùng: thông tin, ngôn ngữ, giao diện sáng/tối, đăng xuất. Dùng ở rail và drawer mobile. */
export function UserPanel() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const navigate = useNavigate()

  return (
    <div style={{ width: 268 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
        <UserAvatar name={user?.fullName} src={user?.avatarUrl} size={44} />
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong style={{ display: 'block' }} ellipsis>{user?.fullName}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{user?.userId} · {user?.groupName}</Typography.Text>
        </div>
      </div>

      <div style={{ padding: '14px 0', display: 'grid', gap: 14 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{t('common.language')}</Typography.Text>
          <Segmented
            block
            value={i18n.language}
            onChange={(v) => setLanguage(String(v))}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.short }))}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mode === 'dark' ? <MoonOutlined /> : <SunOutlined />}
            {mode === 'dark' ? t('common.darkMode') : t('common.lightMode')}
          </span>
          <Switch checked={mode === 'dark'} onChange={toggle} aria-label={t('settings.theme')} />
        </div>
      </div>

      <Button
        block
        danger
        icon={<LogoutOutlined />}
        onClick={() => { logout(); navigate('/login') }}
      >
        {t('common.logout')}
      </Button>
    </div>
  )
}
