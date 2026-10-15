import type { ReactNode } from 'react'
import { Typography } from 'antd'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  /** Vùng nút thao tác bên phải (vd. "Tạo mới") */
  extra?: ReactNode
}

/** Tiêu đề trang chuẩn: dùng ở đầu mọi trang để các màn hình đồng nhất. */
export function PageHeader({ title, subtitle, extra }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
      <div style={{ minWidth: 0 }}>
        <Typography.Title level={2} style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</Typography.Title>
        {subtitle && <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 15 }}>{subtitle}</Typography.Text>}
      </div>
      {extra && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{extra}</div>}
    </div>
  )
}
