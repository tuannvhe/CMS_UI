import type { ReactNode } from 'react'
import KpiBanner from './KpiBanner'

/** Bọc một màn để hiện dải "Đang trong quá trình xây dựng / phát triển" phía trên (dev: nhãn "phát triển"). */
export default function WipNotice({ children, dev }: { children: ReactNode; dev?: boolean }) {
  return (
    <div className="kpi-page">
      <KpiBanner dev={dev} />
      {children}
    </div>
  )
}
