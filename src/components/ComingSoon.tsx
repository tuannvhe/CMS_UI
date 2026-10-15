import { Button, Card, Result } from 'antd'
import { RocketOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentNav } from '../config/navigation'
import { PageHeader } from './PageHeader'

/** Trang giữ chỗ cho phân hệ chưa làm – lấy tên & mô tả từ cấu hình điều hướng. */
export function ComingSoon() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { page } = useCurrentNav()

  return (
    <div className="page">
      <PageHeader title={t(page.labelKey)} subtitle={t(page.descKey)} />
      <Card>
        <Result
          icon={<RocketOutlined style={{ color: 'var(--c-primary)' }} />}
          title={t('common.comingSoon')}
          subTitle={t('common.comingSoonDesc')}
          extra={<Button type="primary" onClick={() => navigate('/')}>{t('common.backHome')}</Button>}
        />
      </Card>
    </div>
  )
}
