import { Link } from 'react-router-dom'
import { Skeleton, Typography } from 'antd'
import { GiftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { birthdays, type BirthdayPerson } from '../api/birthdays'
import { UserAvatar } from './UserAvatar'

const pad = (n: number) => String(n).padStart(2, '0')

/** Sinh nhật hôm nay (nổi bật) và trong 7 ngày tới. Chỉ hiện ngày và tháng, không năm sinh / tuổi. */
export function BirthdayCard() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['birthdays'], queryFn: birthdays.get, staleTime: 5 * 60 * 1000, retry: false })
  const today = q.data?.today ?? []
  const upcoming = q.data?.upcoming ?? []
  const row = (p: BirthdayPerson, isToday: boolean) => (
    <li key={p.employeeId} className={`bd-row${isToday ? ' today' : ''}`}>
      <UserAvatar name={p.name} src={p.avatarUrl} size={isToday ? 42 : 34} />
      <div className="bd-who"><b>{p.name}</b><span>{p.department ?? p.employeeId}</span></div>
      <span className={`bd-date${isToday ? ' cake' : ''}`}>{isToday ? <span className="bd-cake" role="img" aria-label={t('home.bd.today')} title={t('home.bd.today')}>🎂</span> : `${pad(p.day)}/${pad(p.month)}`}</span>
    </li>
  )
  return (
    <section className="home-birthday">
      <div className="hn-head"><GiftOutlined /><b>{t('home.bd.title')}</b></div>
      {q.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : q.isError ? <Typography.Text type="secondary">{t('home.bd.error')}</Typography.Text> : today.length === 0 && upcoming.length === 0 ? (
        <Typography.Text type="secondary">{t('home.bd.none')}</Typography.Text>
      ) : (
        <div className="bd-scroll">
          {today.length > 0 && (
            <>
              <div className="bd-sub">🎂 {t('home.bd.todayTitle', { n: today.length })}</div>
              <ul className="bd-list">{today.map((p) => row(p, true))}</ul>
              <Link to="/feed" className="bd-wish">{t('home.bd.wish')}</Link>
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <div className="bd-sub">{t('home.bd.upcomingTitle')}</div>
              <ul className="bd-list">{upcoming.map((p) => row(p, false))}</ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
