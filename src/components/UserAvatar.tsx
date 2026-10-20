import { Avatar } from 'antd'

/** Chữ cái đầu của họ và tên cuối: "NGUYỄN VĂN TUÂN" → "NT". */
export function initialsOf(fullName?: string) {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export function UserAvatar({ name, size = 36, src }: { name?: string; size?: number; src?: string | null }) {
  return (
    <Avatar
      size={size}
      src={src || undefined}
      style={{
        background: 'linear-gradient(135deg, var(--c-accent), var(--c-primary))',
        color: '#fff', fontWeight: 700, fontSize: size * 0.4, flex: 'none',
      }}
    >
      {initialsOf(name)}
    </Avatar>
  )
}
