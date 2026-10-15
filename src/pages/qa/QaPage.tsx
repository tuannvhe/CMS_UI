import { Avatar } from 'antd'
import { MessageOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { PageBanner } from '../../components/PageBanner'
import { QaWorkspace } from '../../components/QaWorkspace'

/** Hỏi đáp của nhân viên: đặt câu hỏi về lương / công cho nhân sự và xem trả lời. */
export default function QaPage() {
  const { t } = useTranslation()
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<MessageOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.qa')} subtitle={t('nav.qaDesc')} />
      <QaWorkspace mode="mine" />
    </div>
  )
}
