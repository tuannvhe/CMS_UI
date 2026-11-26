import { useRef } from 'react'
import { ArrowDownOutlined, PhoneOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { AccountInfo } from '../components/AccountInfo'
import { OccasionBanner } from '../components/OccasionBanner'
import { YearReviewBanner } from './yearReview/YearReviewBanner'
import { MonthReviewBanner } from './yearReview/MonthReviewBanner'
import { usePageTab } from '../components/PageTabs'
import { useAuth } from '../auth/AuthContext'
import { HomeBottom, HomeTop } from '../components/landing/HomeInternal'
import { LandingNav, LandingSections } from '../components/landing/LandingSections'
import { HeroSlides } from '../components/landing/HeroSlides'
import { useHeroScroll, useScrollReveal } from '../hooks/useScrollReveal'
import { useLanding } from '../hooks/useLanding'
import { isHnUser } from '../config/navigation'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const landing = useLanding()   // nội dung landing theo ngôn ngữ đang chọn
  const { user } = useAuth()
  const hn = isHnUser(user)   // cơ sở Ninh Bình: cùng giao diện; sinh nhật / lịch / online lấy từ CMS_HN, bỏ các khối chỉ VINA có dữ liệu (vinh danh, năm/tháng của tôi, tài khoản)

  const tabs = hn ? [{ key: 'overview', label: t('tabs.overview') }] : [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'account', label: t('tabs.account') },
  ]
  const [tab, setTab] = usePageTab(tabs)
  // Trang chủ dạng landing: banner trôi chậm khi cuộn, các khối bên dưới trượt lên lần lượt khi cuộn tới
  const pageRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  useHeroScroll(heroRef)
  useScrollReveal(pageRef, '.ls-head, .lp-rv, .lp-sc-title, .lp-sc .ant-col, .lp-acc > *', [tab])

  const now = new Date()
  const weekday = now.toLocaleDateString(i18n.language, { weekday: 'long' })
  // Lời chào theo buổi + tên gọi (chữ cuối của họ tên, bỏ hậu tố "_V2"…), dạng nhỏ phía trên tên công ty
  const hour = now.getHours()
  const part: keyof typeof landing.greeting = hour < 11 ? 'morning' : hour < 13 ? 'noon' : hour < 18 ? 'afternoon' : 'evening'
  const given = (user?.fullName ?? '').split('_')[0].trim().split(/\s+/).pop() ?? ''
  const callName = given ? given.charAt(0).toLocaleUpperCase('vi') + given.slice(1).toLocaleLowerCase('vi') : ''
  // Nút trên hero cuộn tới một phần của landing (ở tab Tổng quan; đang ở tab khác thì chuyển tab rồi cuộn)
  const goTo = (id: string) => {
    const run = () => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    if (tab !== 'overview') { setTab('overview'); setTimeout(run, 80) } else run()
  }
  return (
    <>
      <div className="page wide" ref={pageRef}>
        <OccasionBanner />
        {!hn && (
          <div className="home-pills">
            <YearReviewBanner />
            <MonthReviewBanner />
          </div>
        )}
        {/* Thông báo, vinh danh, sinh nhật lên đầu; banner công ty chuyển xuống dưới */}
        {tab === 'overview' && <HomeTop hn={hn} />}
        <section className="lp-hero lp-hero-brand" ref={heroRef}>
          <HeroSlides slides={landing.heroSlides} />
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
        <LandingNav tab={tab} onTab={setTab} labels={{ overview: t('tabs.overview'), account: t('tabs.account') }} />
        {tab === 'overview' && (
          <>
            <HomeBottom hn={hn} />
            <LandingSections hn={hn} />
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
