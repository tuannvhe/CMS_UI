import { useState } from 'react'
import { Select, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { UserAvatar } from '../../components/UserAvatar'
import { ojt, type OjtPerson, type OjtStatus } from '../../api/ojt'
import { useDebouncedValue } from '../../hooks/useDebounce'

export const dmy = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')
const COLORS: Record<OjtStatus, string> = { pending: 'orange', active: 'blue', done: 'green', cancelled: 'default' }

/** Avatar: có ảnh thì hiện ảnh thật, chưa có thì hình tròn chữ cái đầu của họ tên (màu theo tên, ổn định giữa các lần hiển thị). */
export function OjtAvatar({ name, size = 40, src }: { name?: string | null; size?: number; src?: string | null }) {
  if (src) return <UserAvatar name={name ?? undefined} src={src} size={size} preview={false} />
  const words = (name ?? '?').trim().split(/\s+/).filter(Boolean)
  const ini = ((words.length > 1 ? words[words.length - 2][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2)) || '?').toUpperCase()
  let h = 0
  for (const c of name ?? '') h = (h * 31 + c.charCodeAt(0)) % 360
  return <span className="ojt-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `hsl(${h} 42% 40%)` }}>{ini}</span>
}

/** Ảnh đại diện của một nhóm mã nhân viên (một lần gọi cho cả bảng); trả về bản đồ mã → đường dẫn ảnh, người chưa có ảnh không có trong bản đồ. */
export function useOjtAvatars(ids: (string | null | undefined)[]): Record<string, string> {
  const list = [...new Set(ids.filter((x): x is string => !!x))].sort()
  const q = useQuery({ queryKey: ['ojt-avatars', list.join(',')], queryFn: () => ojt.avatars(list), enabled: list.length > 0, staleTime: 5 * 60_000 })
  return q.data ?? {}
}

export function OjtStatusTag({ status }: { status: OjtStatus }) {
  const { t } = useTranslation()
  return <Tag color={COLORS[status]}>{t(`ojt.status.${status}`)}</Tag>
}

/** Ô chọn nhân viên: gõ từ 2 ký tự (mã hoặc tên) để tìm. Giá trị là mã nhân viên. */
export function PersonSelect({ value, onChange, placeholder, seed }: { value?: string; onChange?: (v: string, p?: OjtPerson) => void; placeholder?: string; seed?: OjtPerson[] }) {
  const [text, setText] = useState('')
  const dText = useDebouncedValue(text)   // chỉ gọi API khi ngừng gõ
  const q = useQuery({ queryKey: ['ojt-people', dText], queryFn: () => ojt.people(dText), enabled: dText.trim().length >= 2, staleTime: 30_000 })
  return (
    <Select
      showSearch
      allowClear
      filterOption={false}
      value={value}
      placeholder={placeholder}
      onSearch={setText}
      onChange={(v) => onChange?.(v, [...(q.data ?? []), ...(seed ?? [])].find((p) => p.id === v))}
      loading={q.isFetching}
      notFoundContent={null}
      style={{ width: '100%' }}
      options={[...(q.data ?? []), ...(seed ?? []).filter((x) => !q.data?.some((p) => p.id === x.id))].map((p) => ({ value: p.id, label: `${p.id} · ${p.name}${p.department ? ` · ${p.department}` : ''}${p.position ? ` (${p.position})` : ''}` }))}
    />
  )
}

/** Chọn nhiều nhân viên (người được báo khi lập OJT): gõ từ 2 ký tự để tìm, giá trị là danh sách mã nhân viên. */
export function PeopleSelect({ value, onChange, placeholder }: { value?: string[]; onChange?: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const dText = useDebouncedValue(text)   // chỉ gọi API khi ngừng gõ
  const q = useQuery({ queryKey: ['ojt-people', dText], queryFn: () => ojt.people(dText), enabled: dText.trim().length >= 2, staleTime: 30_000 })
  return (
    <Select
      mode="multiple"
      showSearch
      allowClear
      filterOption={false}
      value={value}
      placeholder={placeholder}
      onSearch={setText}
      onChange={(v) => { onChange?.(v); setText('') }}
      loading={q.isFetching}
      notFoundContent={null}
      maxCount={5}
      style={{ width: '100%' }}
      options={(q.data ?? []).map((p) => ({ value: p.id, label: `${p.id} · ${p.name}${p.department ? ` · ${p.department}` : ''}${p.position ? ` (${p.position})` : ''}` }))}
    />
  )
}
