import { useTranslation } from 'react-i18next'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import { PageBanner } from '../../components/PageBanner'
import { Tabs } from 'antd'
import { Moderation } from './FeedPage'
import { TopicAdmin } from './TopicAdmin'

/** Kiểm duyệt diễn đàn (quản trị): nội dung bị báo cáo, ảnh / video mới đăng, nội dung đã ẩn. */
export default function FeedModerationPage() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <PageBanner avatar={<SafetyCertificateOutlined />} title={t('nav.feedModeration')} subtitle={t('nav.feedModerationDesc')} />
      <div style={{ maxWidth: 940 }}>
        <Tabs items={[{ key: 'mod', label: t('forum.tabModeration'), children: <Moderation /> }, { key: 'topics', label: t('forum.tabTopics'), children: <TopicAdmin /> }]} />
      </div>
    </div>
  )
}
