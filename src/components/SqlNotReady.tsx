import { Button, Card, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

/**
 * Chưa tạo bảng riêng của hệ thống mới. Không hiện script cho người dùng (script là việc của người quản trị CSDL, làm ngoài màn hình):
 * chỉ báo chức năng chưa sẵn sàng và cho kiểm tra lại.
 */
export function SqlNotReady({ title, onRetry, loading }: { title: string; onRetry: () => void; loading?: boolean }) {
  const { t } = useTranslation()
  return (
    <Card title={title}>
      <Typography.Paragraph>{t('org.notReadyPublic')}</Typography.Paragraph>
      <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={onRetry}>{t('org.recheck')}</Button>
    </Card>
  )
}
