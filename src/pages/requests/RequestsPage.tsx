import { useTranslation } from 'react-i18next'
import type { RequestKind } from '../../api/requests'
import { Avatar, Tabs } from 'antd'
import { EditOutlined, FieldTimeOutlined } from '@ant-design/icons'
import { PageBanner } from '../../components/PageBanner'
import { useSearchParams } from 'react-router-dom'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import RegisterTab from './RegisterTab'
import SubmittedTab from './SubmittedTab'
import OvertimeExcelTab from './OvertimeExcelTab'

/** Trang đơn từ: tab "Đăng ký" (tạo nháp → gửi duyệt) và tab "Đơn đã gửi" (xem trạng thái duyệt). */
export default function RequestsPage({ kind }: { kind: RequestKind }) {
  const { t } = useTranslation()
  const tabs = [
    { key: 'register', label: t('req.tabRegister') },
    { key: 'submitted', label: t('req.tabSubmitted') },
  ]
  const [tab, setTab] = usePageTab(tabs)
  // Tăng ca: dưới biểu ngữ có 3 tab — nhập tay, Excel ca ngày, Excel ca đêm (?mode=...)
  const [params, setParams] = useSearchParams()
  const mode = ['excelDay', 'excelNight'].includes(params.get('mode') ?? '') ? params.get('mode')! : 'manual'
  const setMode = (m: string) => setParams((p) => { const n = new URLSearchParams(p); if (m === 'manual') n.delete('mode'); else n.set('mode', m); return n }, { replace: true })
  const title = kind === 'finger' ? t('nav.fingerForm') : t('nav.overtime')
  const sub = kind === 'finger' ? t('nav.fingerFormDesc') : t('nav.overtimeDesc')

  return (
    <>
      <PageTabs items={tabs} active={tab} onChange={setTab} />
      <div className="page wide">
        <PageBanner
          avatar={<Avatar size={56} icon={kind === 'finger' ? <EditOutlined /> : <FieldTimeOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
          title={title}
          subtitle={sub}
          chips={[`1 · ${t('req.sectionEmployees')}`, `2 · ${t('req.sectionTime')}`, `3 · ${t('req.sectionApprovers')}`, `4 · ${t('req.submit')}`]}
        />
        {tab !== 'register' ? <SubmittedTab kind={kind} /> : kind !== 'overtime' ? <RegisterTab kind={kind} /> : (
          <Tabs activeKey={mode} onChange={setMode} destroyOnHidden
            items={[
              { key: 'manual', label: t('oti.tabManual'), children: <RegisterTab kind={kind} /> },
              { key: 'excelDay', label: t('oti.tabDay'), children: <OvertimeExcelTab night={false} onGoRegister={() => setMode('manual')} /> },
              { key: 'excelNight', label: t('oti.tabNight'), children: <OvertimeExcelTab night onGoRegister={() => setMode('manual')} /> },
            ]} />
        )}
      </div>
    </>
  )
}
