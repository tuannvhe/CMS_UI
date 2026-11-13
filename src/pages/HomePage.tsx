import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Col, Image, Row, Skeleton, Typography } from 'antd'
import { ArrowDownOutlined, NotificationOutlined, PhoneOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AccountInfo } from '../components/AccountInfo'
import { ModuleCard } from '../components/ModuleCard'
import { BirthdayCard } from '../components/BirthdayCard'
import { OnlineCount } from '../components/OnlineCount'
import { OccasionBanner } from '../components/OccasionBanner'
import { MonthCalendarCard } from '../components/MonthCalendarCard'
import { COMMUNITY_UI } from '../config/features'
import { PageTabs, usePageTab } from '../components/PageTabs'
import { announcements } from '../api/announcements'
import { useAuth } from '../auth/AuthContext'
import { ALL_PAGES, WORKSPACES, canSee, homeOf } from '../config/navigation'
import { AnnouncementBody } from '../components/AnnouncementBody'
import { useHeroScroll, useScrollReveal } from '../hooks/useScrollReveal'
import { landing } from '../config/landing.config'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [zoom, setZoom] = useState<string | null>(null)   // ảnh trong thông báo đang xem phóng to

  const tabs = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'shortcuts', label: t('tabs.shortcuts') },
    { key: 'account', label: t('tabs.account') },
  ]
  const [tab, setTab] = usePageTab(tabs)
  // Trang chủ dạng landing: banner trôi chậm khi cuộn, các khối bên dưới trượt lên lần lượt khi cuộn tới
  const pageRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  useHeroScroll(heroRef)
  useScrollReveal(pageRef, '.lp-grid > section, .lp-grid > div, .lp-bottom > *, .lp-rv, .lp-sc-title, .lp-sc .ant-col, .lp-acc > *', [tab])

  const now = new Date()
  const weekday = now.toLocaleDateString(i18n.language, { weekday: 'long' })
  // Lời chào theo buổi + tên gọi (chữ cuối của họ tên, bỏ hậu tố "_V2"…), dạng nhỏ phía trên tên công ty
  const hour = now.getHours()
  const part: keyof typeof landing.greeting = hour < 11 ? 'morning' : hour < 13 ? 'noon' : hour < 18 ? 'afternoon' : 'evening'
  const given = (user?.fullName ?? '').split('_')[0].trim().split(/\s+/).pop() ?? ''
  const callName = given ? given.charAt(0).toLocaleUpperCase('vi') + given.slice(1).toLocaleLowerCase('vi') : ''
  const notice = useQuery({ queryKey: ['announcements'], queryFn: () => announcements.recent(5), staleTime: 5 * 60 * 1000, retry: false })
  // Nút trên hero cuộn tới một phần của landing (ở tab Tổng quan; đang ở tab khác thì chuyển tab rồi cuộn)
  const goTo = (id: string) => {
    const run = () => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    if (tab !== 'overview') { setTab('overview'); setTimeout(run, 80) } else run()
  }
  // Thanh "Truy cập nhanh" ngay dưới hero. Mỗi mục chỉ hiện khi người dùng được phép vào trang đó, nên Chốt lương và Tuyển dụng (trang của HR / quản trị)
  // tự ẩn với nhân viên thường. Các trang khác (Bảng công, Phép năm, Tăng ca…) vẫn có ở tab Lối tắt và thanh bên.
  const quick: { key: string; label: string; icon: ReactNode; path: string }[] = []
  const addPage = (pageKey: string, labelKey?: string) => {
    const p = ALL_PAGES.find((x) => x.key === pageKey && canSee(x, user))
    if (p) quick.push({ key: p.key, label: t(labelKey ?? p.labelKey), icon: p.icon, path: p.path })
  }
  if (COMMUNITY_UI) addPage('feed')
  const forms = WORKSPACES.find((w) => w.key === 'forms')   // "Đơn từ": cửa vào chung của nhóm Đăng ký đơn (tăng ca, nghỉ phép, quên vân tay, ra ngoài…)
  if (forms && forms.pages.some((p) => canSee(p, user))) quick.push({ key: forms.key, label: t('home.quickRequests'), icon: forms.icon, path: homeOf(forms, user) })
  addPage('closedAttendance')
  addPage('payroll', 'home.quickPayroll')
  addPage('meetingRooms', 'home.quickMeeting')
  addPage('recruitManage', 'home.quickRecruit')

  return (
    <>
      <div className="page wide" ref={pageRef}>
        <OccasionBanner />
        <section className="lp-hero lp-hero-brand" ref={heroRef}>
          {landing.heroImage.src && <img className="lp-hero-bg" src={landing.heroImage.src} alt="" aria-hidden decoding="async" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
          <div className="lp-hero-main">
            <span className="lp-eyebrow">{landing.greeting[part]}{callName ? `, ${callName}` : ''}</span>
            <div className="lp-brand">
              <span className="lp-logo"><img src={landing.logoUrl} alt="VINATECH" /></span>
              <h1 className="lp-title">{landing.companyName}</h1>
            </div>
            <p className="lp-slogan">{landing.slogan}</p>
            <div className="lp-cta">
              <button type="button" className="lp-btn primary" onClick={() => goTo('lp-about')}><ArrowDownOutlined /> {landing.cta.learnMore}</button>
              <button type="button" className="lp-btn ghost" onClick={() => goTo('lp-contact')}><PhoneOutlined /> {landing.cta.contact}</button>
            </div>
          </div>
          <div className="lp-daybadge" aria-hidden>
            <b>{now.getDate()}</b>
            <span>{now.toLocaleDateString(i18n.language, { month: 'long' })}</span>
            <small>{weekday}</small>
          </div>
        </section>
        {quick.length > 0 && (
          <nav className="lp-quick" aria-label={landing.quickTitle}>
            <span className="lp-quick-title">{landing.quickTitle}</span>
            <div className="lp-quick-list">
              {quick.map((p) => (
                <button key={p.key} type="button" className="lp-quick-item" onClick={() => navigate(p.path)}>
                  <span className="lq-icon">{p.icon}</span><span>{p.label}</span>
                </button>
              ))}
            </div>
          </nav>
        )}
        <PageTabs items={tabs} active={tab} onChange={setTab} />
        {tab === 'overview' && (
          <>
            <div className="lp-grid">
              <section className="home-notice" onClick={(e) => { const el = e.target as HTMLElement; if (el.tagName === 'IMG' && el.closest('.hn-body')) setZoom((el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src) }}>
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
                        {i === 0
                          ? <AnnouncementBody html={n.html} />
                          : <details><summary>{t('home.noticeRead')}</summary><AnnouncementBody html={n.html} /></details>}
                      </article>
                    ))}
                  </div>
                ) : <Typography.Text type="secondary">{notice.isError ? t('home.noticeError') : t('home.noticeNone')}</Typography.Text>}
              </section>
              <BirthdayCard />
            {zoom && <Image style={{ display: 'none' }} src={zoom} alt="" preview={{ open: true, src: zoom, onOpenChange: (v) => { if (!v) setZoom(null) } }} />}
            </div>
            <div className="lp-bottom"><div className="lp-cal"><MonthCalendarCard compact /></div></div>

            <div className="lp-rv"><OnlineCount /></div>
          </>
        )}

        {tab === 'shortcuts' && (
          <>
            {WORKSPACES.filter((w) => w.key !== 'home').map((w) => (
              <div key={w.key} className="lp-sc" style={{ marginBottom: 28 }}>
                <Typography.Title level={5} className="lp-sc-title" style={{ marginTop: 0, color: 'var(--c-muted)' }}>{t(w.labelKey)}</Typography.Title>
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
          <div className="lp-acc">
            <AccountInfo />
          </div>
        )}
      </div>
    </>
  )
}
