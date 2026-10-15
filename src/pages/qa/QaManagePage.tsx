import { Avatar } from 'antd'
import { CustomerServiceOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { PageBanner } from '../../components/PageBanner'
import { QaWorkspace } from '../../components/QaWorkspace'

/** Nhân sự trả lời hỏi đáp: mọi chủ đề, ưu tiên các chủ đề chưa được trả lời. */
export default function QaManagePage() {
  const { t } = useTranslation()
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CustomerServiceOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.qaManage')} subtitle={t('nav.qaManageDesc')} />
      <QaWorkspace mode="manage" />
    </div>
  )
}
