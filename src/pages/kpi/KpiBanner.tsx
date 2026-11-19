import { ToolOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { KPI_CSS } from './kpiUi'

/** Dải báo "đang trong quá trình xây dựng" dùng chung cho mọi tab Demo KPI (viền sọc cảnh báo kiểu công trường). */
export default function KpiBanner({ dev }: { dev?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="kpi-wip" role="status">
      <ToolOutlined style={{ color: '#B45309' }} />
      <span>{t(dev ? 'kpi.wipDev' : 'kpi.wip')}</span>
      <style>{KPI_CSS}</style>
    </div>
  )
}
