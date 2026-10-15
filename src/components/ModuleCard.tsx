import type { ReactNode } from 'react'
import { Card, Tag, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'

interface Props {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  tag?: ReactNode
  onClick?: () => void
}

/** Thẻ phân hệ: biểu tượng + tên + mô tả ngắn. Dùng ở Trang chủ, Lối tắt, Cài đặt… */
export function ModuleCard({ icon, title, description, tag, onClick }: Props) {
  return (
    <Card
      className="module-card"
      styles={{ body: { padding: 20, display: 'flex', flexDirection: 'column', height: '100%' } }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
    >
      <div className="mc-icon">{icon}</div>
      <Typography.Text strong style={{ fontSize: 16 }}>{title}</Typography.Text>
      {description && <Typography.Text type="secondary" style={{ marginTop: 4, flex: 1 }}>{description}</Typography.Text>}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {tag ? <Tag color="green" variant="filled">{tag}</Tag> : <span />}
        <ArrowRightOutlined style={{ color: 'var(--c-primary)' }} />
      </div>
    </Card>
  )
}
