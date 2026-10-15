import { Avatar } from 'antd'
import { ScheduleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { PageBanner } from '../../components/PageBanner'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import LeaveRegisterTab from './LeaveRegisterTab'
import LeaveSubmittedTab from './LeaveSubmittedTab'

/** Nghỉ phép: tab "Đăng ký" (tạo nháp → gửi duyệt 4 cấp) và tab "Đơn đã gửi" (xem trạng thái duyệt). */
export default function LeavePage() {
  const { t } = useTranslation()
  const tabs = [
    { key: 'register', label: t('req.tabRegister') },
    { key: 'submitted', label: t('req.tabSubmitted') },
  ]
  const [tab, setTab] = usePageTab(tabs)

  return (
    <>
      <PageTabs items={tabs} active={tab} onChange={setTab} />
      <div className="page wide">
        <PageBanner
          avatar={<Avatar size={56} icon={<ScheduleOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
          title={t('nav.leave')}
          subtitle={t('nav.leaveDesc')}
          chips={[`1 · ${t('req.sectionEmployees')}`, `2 · ${t('leave.sectionPeriod')}`, `3 · ${t('req.sectionApprovers')}`, `4 · ${t('req.submit')}`]}
        />
        {tab === 'register' ? <LeaveRegisterTab /> : <LeaveSubmittedTab />}
      </div>
    </>
  )
}
