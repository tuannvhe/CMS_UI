import { useState } from 'react'
import { Select, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { ojt, type OjtPerson, type OjtStatus } from '../../api/ojt'

export const dmy = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')
const COLORS: Record<OjtStatus, string> = { pending: 'orange', active: 'blue', done: 'green', cancelled: 'default' }

export function OjtStatusTag({ status }: { status: OjtStatus }) {
  const { t } = useTranslation()
  return <Tag color={COLORS[status]}>{t(`ojt.status.${status}`)}</Tag>
}

/** Ô chọn nhân viên: gõ từ 2 ký tự (mã hoặc tên) để tìm. Giá trị là mã nhân viên. */
export function PersonSelect({ value, onChange, placeholder }: { value?: string; onChange?: (v: string, p?: OjtPerson) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const q = useQuery({ queryKey: ['ojt-people', text], queryFn: () => ojt.people(text), enabled: text.trim().length >= 2, staleTime: 30_000 })
  return (
    <Select
      showSearch
      allowClear
      filterOption={false}
      value={value}
      placeholder={placeholder}
      onSearch={setText}
      onChange={(v) => onChange?.(v, q.data?.find((p) => p.id === v))}
      loading={q.isFetching}
      notFoundContent={null}
      style={{ width: '100%' }}
      options={(q.data ?? []).map((p) => ({ value: p.id, label: `${p.id} · ${p.name}${p.department ? ` · ${p.department}` : ''}${p.position ? ` (${p.position})` : ''}` }))}
    />
  )
}

/** Chọn nhiều nhân viên (người được báo khi lập OJT): gõ từ 2 ký tự để tìm, giá trị là danh sách mã nhân viên. */
export function PeopleSelect({ value, onChange, placeholder }: { value?: string[]; onChange?: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const q = useQuery({ queryKey: ['ojt-people', text], queryFn: () => ojt.people(text), enabled: text.trim().length >= 2, staleTime: 30_000 })
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
