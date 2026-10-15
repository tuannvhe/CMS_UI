import { useState } from 'react'
import { Button, Skeleton, Typography } from 'antd'
import { CalendarOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { calendarApi, type CalendarDay, type DayKind } from '../api/calendar'

const pad = (n: number) => String(n).padStart(2, '0')
const isOff = (k: DayKind) => k !== 'work' && k !== 'swap'

/** Lịch tháng: ô màu theo loại ngày (đi làm / nghỉ / lễ / làm bù) kèm danh sách ngày nghỉ và ngày làm bù của tháng. */
export function MonthCalendarCard({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const now = new Date()
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const q = useQuery({ queryKey: ['calendar', ym.year, ym.month], queryFn: () => calendarApi.month(ym.year, ym.month), staleTime: 10 * 60 * 1000, retry: false })

  const move = (delta: number) => setYm((c) => { const d = new Date(c.year, c.month - 1 + delta, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  const title = new Date(ym.year, ym.month - 1, 1).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'short' }))   // 01/01/2024 là thứ Hai
  const days = q.data?.days ?? []
  const lead = days.length ? (new Date(days[0].date + 'T00:00:00').getDay() + 6) % 7 : 0
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const label = (d: CalendarDay) => d.note || t(`home.cal.kind.${d.kind}`)
  const fmt = (d: CalendarDay) => new Date(d.date + 'T00:00:00').toLocaleDateString(i18n.language, { weekday: 'short', day: '2-digit', month: '2-digit' })
  const offList = days.filter((d) => isOff(d.kind))
  const swapList = days.filter((d) => d.kind === 'swap')

  return (
    <section className={`month-cal${compact ? ' compact' : ''}`}>
      <header className="mc-head">
        <div className="mc-title"><CalendarOutlined /><b>{t('home.cal.title')}</b><span>{title}</span></div>
        <div className="mc-nav">
          <Button size="small" icon={<LeftOutlined />} onClick={() => move(-1)} aria-label={t('home.cal.prev')} />
          <Button size="small" onClick={() => setYm({ year: now.getFullYear(), month: now.getMonth() + 1 })}>{t('home.cal.today')}</Button>
          <Button size="small" icon={<RightOutlined />} onClick={() => move(1)} aria-label={t('home.cal.next')} />
        </div>
      </header>
      {q.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : q.isError ? <Typography.Text type="secondary">{t('home.cal.error')}</Typography.Text> : (
        <div className="mc-body">
          <div>
            <div className="mc-grid">
              {weekdays.map((w, i) => <div key={w} className={`mc-wd${i >= 5 ? ' we' : ''}`}>{w}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
              {days.map((d) => (
                <div key={d.date} className={`mc-day k-${d.kind}${d.date === todayKey ? ' today' : ''}`} title={label(d)}>{Number(d.date.slice(8))}</div>
              ))}
            </div>
            <div className="mc-legend">
              {(['work', 'swap', 'sunday', 'biweekly', 'holiday'] as DayKind[]).map((k) => <span key={k}><i className={`k-${k}`} />{t(`home.cal.kind.${k}`)}</span>)}
            </div>
          </div>
          <div className="mc-side">
            <div className="mc-stats">
              <div><b>{q.data!.workDays}</b><span>{t('home.cal.workDays')}</span></div>
              <div><b>{q.data!.offDays}</b><span>{t('home.cal.offDays')}</span></div>
            </div>
            {(offList.length > 0 || swapList.length > 0) && (
              <ul className="mc-list">
                {[...offList, ...swapList].sort((x, y) => x.date.localeCompare(y.date)).map((d) => <li key={d.date}><i className={`k-${d.kind}`} /><b>{fmt(d)}</b><span>{label(d)}</span></li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
