import { useState } from 'react'
import { Avatar, Image } from 'antd'

/** Chữ cái đầu của họ và tên cuối: "NGUYỄN VĂN TUÂN" → "NT". */
export function initialsOf(fullName?: string) {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Có `src` thì bấm vào avatar sẽ mở xem ảnh phóng to; chưa có ảnh thì giữ nguyên (không mở).
 *  `preview={false}` khi avatar nằm trong nút khác (vd nút tài khoản ở thanh bên mở khung đăng xuất) để cú bấm đi tới nút đó. */
export function UserAvatar({ name, size = 36, src, preview = true }: { name?: string; size?: number; src?: string | null; preview?: boolean }) {
  const [open, setOpen] = useState(false)
  const url = src || undefined
  const canView = preview && !!url
  const avatar = (
    <Avatar
      size={size}
      src={url}
      onClick={canView ? (e) => { e?.stopPropagation(); e?.preventDefault(); setOpen(true) } : undefined}
      style={{
        background: 'linear-gradient(135deg, var(--c-accent), var(--c-primary))',
        color: '#fff', fontWeight: 700, fontSize: size * 0.4, flex: 'none',
        cursor: canView ? 'zoom-in' : undefined,
      }}
    >
      {initialsOf(name)}
    </Avatar>
  )
  if (!canView) return avatar
  // Một phần tử gốc duy nhất (không thêm phần tử anh em) để không làm lệch flex / grid của nơi dùng avatar; lớp xem ảnh nằm trong portal.
  return (
    <span style={{ display: 'inline-flex', flex: 'none' }}>
      {avatar}
      <span style={{ display: 'none' }}>
        <Image src={url} alt={name} preview={{ visible: open, onVisibleChange: setOpen, src: url }} />
      </span>
    </span>
  )
}
