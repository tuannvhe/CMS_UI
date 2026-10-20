import { isValidElement, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { UserAvatar } from './UserAvatar'

interface Props {
  /** Biểu tượng hoặc avatar bên trái */
  avatar?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Các thẻ thông tin nhỏ (mã NV, bộ phận…) */
  chips?: ReactNode[]
  /** Nút thao tác bên phải */
  extra?: ReactNode
}

/** Banner đầu trang báo cáo: nền gradient thương hiệu, tiêu đề lớn, các thẻ thông tin và nút thao tác. */
export function PageBanner({ avatar, title, subtitle, chips, extra }: Props) {
  const { user } = useAuth()
  // Banner của mọi màn hiện ảnh đại diện của người đang đăng nhập (chưa có ảnh thì chữ cái đầu); trang tự truyền UserAvatar (ví dụ Bảng công) thì giữ nguyên
  const shown = avatar && user && !(isValidElement(avatar) && avatar.type === UserAvatar) ? <UserAvatar name={user.fullName} src={user.avatarUrl} size={64} /> : avatar
  return (
    <section className="page-banner">
      {shown && <div className="pb-avatar">{shown}</div>}
      <div className="pb-main">
        <h1 className="pb-title">{title}</h1>
        {subtitle && <div className="pb-sub">{subtitle}</div>}
        {chips && chips.length > 0 && (
          <div className="pb-chips">
            {chips.map((c, i) => <span key={i} className="pb-chip">{c}</span>)}
          </div>
        )}
      </div>
      {extra && <div className="pb-extra">{extra}</div>}
    </section>
  )
}
