import { useEffect, useRef, useState } from 'react'
import { Select, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { meetingRooms, personLabel, type MeetingPerson } from '../../api/meetingRooms'

interface Props {
  /** Form.Item truyền id để nhãn gắn đúng ô */
  id?: string
  value?: string[]
  onChange?: (v: string[]) => void
  /** Người đã có (khi sửa lượt đặt) để hiện đúng tên ngay từ đầu */
  initial?: MeetingPerson[]
}

/** Chọn nhiều người dự họp: gõ họ tên / tài khoản / mã nhân viên (từ 2 ký tự) để tìm trong các tài khoản đang hoạt động. */
export function PeoplePicker({ id, value, onChange, initial }: Props) {
  const { t } = useTranslation()
  const [known, setKnown] = useState<Record<string, string>>({})
  const [hits, setHits] = useState<MeetingPerson[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const seq = useRef(0)

  useEffect(() => {
    if (initial?.length) setKnown((k) => ({ ...k, ...Object.fromEntries(initial.map((p) => [p.userId, personLabel(p)])) }))
  }, [initial])

  const search = (q: string) => {
    window.clearTimeout(timer.current)
    if (q.trim().length < 2) { setHits([]); return }
    timer.current = window.setTimeout(() => {
      const mine = ++seq.current
      setLoading(true)
      meetingRooms.people(q.trim())
        .then((r) => { if (mine === seq.current) { setHits(r); setKnown((k) => ({ ...k, ...Object.fromEntries(r.map((p) => [p.userId, personLabel(p)])) })) } })
        .catch(() => { if (mine === seq.current) setHits([]) })
        .finally(() => { if (mine === seq.current) setLoading(false) })
    }, 300)
  }

  const selected = (value ?? []).filter((id) => !hits.some((h) => h.userId === id))
  const options = [
    ...selected.map((id) => ({ value: id, label: known[id] ?? id })),
    ...hits.map((p) => ({ value: p.userId, label: personLabel(p) })),
  ]

  return (
    <Select
      id={id} mode="multiple" value={value} onChange={onChange} options={options} showSearch filterOption={false} onSearch={search}
      onBlur={() => setHits([])} maxCount={50} allowClear placeholder={t('mtg.attendeesPh')}
      notFoundContent={loading ? <Spin size="small" /> : t('mtg.attendeesHint')}
    />
  )
}
