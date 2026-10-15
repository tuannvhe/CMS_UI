import { Card, Descriptions, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { UserAvatar } from './UserAvatar'

/** Thẻ thông tin tài khoản dùng ở Trang chủ và Cài đặt. */
export function AccountInfo() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user) return null

  const rows = [
    { label: t('home.userId'), value: user.userId },
    { label: t('home.group'), value: user.groupName },
    { label: t('home.email'), value: user.email },
    { label: t('home.factory'), value: user.factoryCode },
  ].filter((r) => r.value)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <UserAvatar name={user.fullName} size={56} />
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>{user.fullName}</Typography.Title>
          <Typography.Text type="secondary">{user.userId}</Typography.Text>
        </div>
      </div>
      <Descriptions column={{ xs: 1, sm: 2 }} colon={false} layout="vertical" size="small">
        {rows.map((r) => (
          <Descriptions.Item key={r.label} label={r.label}>{r.value}</Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  )
}
