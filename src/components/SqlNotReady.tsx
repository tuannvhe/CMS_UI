import { Button, Card, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useToast } from '../hooks/useToast'

/** Chưa tạo bảng riêng của hệ thống mới: hiện script để chạy một lần, rồi kiểm tra lại. */
export function SqlNotReady({ title, sql, onRetry, loading }: { title: string; sql: string; onRetry: () => void; loading?: boolean }) {
  const { t } = useTranslation()
  const msg = useToast()
  return (
    <Card title={title}>
      <Typography.Paragraph>{t('org.notReadyText')}</Typography.Paragraph>
      <pre className="org-sql">{sql}</pre>
      <Space>
        <Button onClick={() => navigator.clipboard?.writeText(sql).then(() => msg.success(t('org.copied')))}>{t('org.copy')}</Button>
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={onRetry}>{t('org.recheck')}</Button>
      </Space>
    </Card>
  )
}
