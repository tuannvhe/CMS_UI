import type { ReactNode } from 'react'
import { Button, Tag } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import 'dayjs/locale/ko'
import 'dayjs/locale/en'
import type { OjtDay } from '../../api/ojt'
import './ojt.css'

export const ojtLocale = (lng: string) => (lng === 'ko' ? 'ko' : lng === 'en' ? 'en' : 'vi')

/** Ô nhận xét của mentor (chỉ đọc) dùng chung cho màn nhân viên mới và màn theo dõi. */
export function MentorNote({ note, children }: { note?: string | null; children?: ReactNode }) {
  const { t } = useTranslation()
  if (!note && !children) return null
  return (
    <div className="ojt-note">
      <label>{t('ojt.mentorNote')}</label>
      {children ?? <p>{note}</p>}
    </div>
  )
}

/**
 * Một ngày nhật ký: ô ngày bên trái (viền màu theo trạng thái) + thẻ nội dung bên phải với hai khối "đã làm / học được" và "khó khăn".
 * footer = khu nhận xét của mentor (chỉ đọc hoặc ô nhập), onEdit = nút Viết / Sửa của nhân viên mới.
 */
export function OjtDayCard({ day, today, onEdit, footer }: { day: OjtDay; today: string; onEdit?: () => void; footer?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const dd = dayjs(day.date).locale(ojtLocale(i18n.language))
  const isToday = day.date === today
  const state = day.log ? 'done' : day.onLeave ? 'leave' : isToday ? 'today' : 'miss'
  return (
    <div className={`ojt-day ojt-day-${state}`} id={`ojt-day-${day.date}`}>
      <div className="ojt-rail" aria-hidden><small>{dd.format('ddd')}</small><b>{dd.format('DD')}</b></div>
      <article className="ojt-card">
        <header className="ojt-card-head">
          <div className="ojt-card-title"><b>{dd.format('dddd, DD/MM/YYYY')}</b>{isToday && <Tag color="blue">{t('ojt.today')}</Tag>}</div>
          <div className="ojt-card-actions">
            {state === 'done' && <Tag color="green">{t('ojt.written')}</Tag>}
            {day.log?.vi && <Tag color="red" title={t('ojt.viTagTip')}>VI</Tag>}
            {state === 'leave' && <Tag color="gold">{t('ojt.onLeave')}</Tag>}
            {state === 'miss' && <Tag color="red">{t('ojt.missing')}</Tag>}
            {onEdit && day.canWrite && day.log && <Button size="small" icon={<EditOutlined />} onClick={onEdit}>{t('ojt.edit')}</Button>}
          </div>
        </header>
        {day.log && (
          <div className="ojt-blocks">
            <div className="ojt-block"><label>{t('ojt.blockDid')}</label><p>{day.log.content}</p></div>
            {day.log.difficulty && <div className="ojt-block ojt-block-warn"><label>{t('ojt.blockHard')}</label><p>{day.log.difficulty}</p></div>}
          </div>
        )}
        {!day.log && !day.onLeave && onEdit && day.canWrite && (
          <button type="button" className="ojt-write-slot" onClick={onEdit}><EditOutlined /> {t('ojt.tapToWrite')}</button>
        )}
        {footer}
      </article>
    </div>
  )
}
