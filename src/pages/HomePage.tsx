import { Col, Row, Skeleton, Typography } from 'antd'
import { CalendarOutlined, NotificationOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AccountInfo } from '../components/AccountInfo'
import { ModuleCard } from '../components/ModuleCard'
import { BirthdayCard } from '../components/BirthdayCard'
import { OnlineCount } from '../components/OnlineCount'
import { OccasionBanner } from '../components/OccasionBanner'
import { MonthCalendarCard } from '../components/MonthCalendarCard'
import { PageHeader } from '../components/PageHeader'
import { PageTabs, usePageTab } from '../components/PageTabs'
import { announcements } from '../api/announcements'
import { useAuth } from '../auth/AuthContext'
import { ALL_PAGES, WORKSPACES, canSee, homeOf } from '../config/navigation'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const tabs = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'shortcuts', label: t('tabs.shortcuts') },
    { key: 'account', label: t('tabs.account') },
  ]
  const [tab, setTab] = usePageTab(tabs)

  const now = new Date()
  const weekday = now.toLocaleDateString(i18n.language, { weekday: 'long' })
  const fullDate = now.toLocaleDateString(i18n.language, { day: '2-digit', month: 'long', year: 'numeric' })
  const notice = useQuery({ queryKey: ['announcements'], queryFn: () => announcements.recent(5), staleTime: 5 * 60 * 1000, retry: false })
  // Phân hệ nghiệp vụ (bỏ Trang chủ và Cài đặt)
  const modules = WORKSPACES.filter((w) => !['home', 'settings'].includes(w.key))
  // Lối tắt nhanh ở đầu trang: những việc nhân viên làm nhiều nhất (chỉ hiện trang được phép xem)
  const quick = ['feed', 'attendance', 'overtime', 'leave', 'annualLeave', 'closedAttendance', 'approvalFinger'].map((k) => ALL_PAGES.find((p) => p.key === k)).filter((p): p is (typeof ALL_PAGES)[number] => !!p && canSee(p, user))

  return (
    <>
      <PageTabs items={tabs} active={tab} onChange={setTab} />
      <div className="page wide">
        {tab === 'overview' && (
          <>
            <OccasionBanner />
            <section className="lp-hero">
              <div className="lp-hero-main">
                <span className="lp-eyebrow"><CalendarOutlined /> {weekday}</span>
                <h1 className="lp-date">{fullDate}</h1>
                <p className="lp-sub">{t('home.subtitle')}</p>
                <div className="lp-actions">
                  {quick.map((p) => (
                    <button key={p.key} type="button" className="lp-action" onClick={() => navigate(p.path)}>
                      <span className="la-icon">{p.icon}</span><span>{t(p.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="lp-daybadge" aria-hidden>
                <b>{now.getDate()}</b>
                <span>{now.toLocaleDateString(i18n.language, { month: 'long' })}</span>
              </div>
            </section>

            <div className="lp-grid">
              <section className="home-notice">
                <div className="hn-head"><NotificationOutlined /><b>{t('home.noticeTitle')}</b></div>
                {notice.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : notice.data?.length ? (
                  <div className="hn-scroll">
                    {notice.data.map((n, i) => (
                      <article key={`${n.createdAt}-${i}`} className={`hn-item${i === 0 ? ' first' : ''}`}>
                        <div className="hn-title">{n.title}</div>
                        <div className="hn-meta">
                          {n.type && <span className="org-chip ok">{n.type}</span>}
                          <span>{new Date(n.createdAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                        {/* html đã được máy chủ lọc (thẻ định dạng cơ bản, không script / sự kiện) */}
                        {i === 0
                          ? <div className="hn-body" dangerouslySetInnerHTML={{ __html: n.html }} />
                          : <details><summary>{t('home.noticeRead')}</summary><div className="hn-body" dangerouslySetInnerHTML={{ __html: n.html }} /></details>}
                      </article>
                    ))}
                  </div>
                ) : <Typography.Text type="secondary">{notice.isError ? t('home.noticeError') : t('home.noticeNone')}</Typography.Text>}
              </section>
              <BirthdayCard />
            </div>
            <div className="lp-cal"><MonthCalendarCard compact /></div>

            <div className="lp-section-head">
              <h2>{t('home.modules')}</h2>
              <span>{t('home.guideText')}</span>
            </div>
            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
              {modules.map((w) => (
                <Col key={w.key} xs={24} sm={12} xl={8}>
                  <ModuleCard
                    icon={w.icon}
                    title={t(w.labelKey)}
                    description={w.pages.filter((p) => canSee(p, user)).map((p) => t(p.labelKey)).join(' · ')}
                    tag={t('common.screensN', { n: w.pages.filter((p) => canSee(p, user)).length })}
                    onClick={() => navigate(homeOf(w, user))}
                  />
                </Col>
              ))}
            </Row>
            <OnlineCount />
          </>
        )}

        {tab === 'shortcuts' && (
          <>
            <PageHeader title={t('tabs.shortcuts')} subtitle={t('home.subtitle')} />
            {WORKSPACES.filter((w) => w.key !== 'home').map((w) => (
              <div key={w.key} style={{ marginBottom: 28 }}>
                <Typography.Title level={5} style={{ marginTop: 0, color: 'var(--c-muted)' }}>{t(w.labelKey)}</Typography.Title>
                <Row gutter={[16, 16]}>
                  {w.pages.filter((p) => canSee(p, user)).map((p) => (
                    <Col key={p.key} xs={24} sm={12} xl={8}>
                      <ModuleCard icon={p.icon} title={t(p.labelKey)} description={t(p.descKey)} onClick={() => navigate(p.path)} />
                    </Col>
                  ))}
                </Row>
              </div>
            ))}
          </>
        )}

        {tab === 'account' && (
          <>
            <PageHeader title={t('nav.account')} subtitle={t('nav.accountDesc')} />
            <AccountInfo />
          </>
        )}
      </div>
    </>
  )
}
