import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Image } from 'antd'
import {
  AimOutlined, AuditOutlined, BulbOutlined, CarOutlined, CheckCircleOutlined, ClockCircleOutlined, DeploymentUnitOutlined, EnvironmentOutlined,
  ExperimentOutlined, EyeOutlined, GlobalOutlined, HeartOutlined, MailOutlined, PhoneOutlined, RightOutlined, RocketOutlined,
  SafetyCertificateOutlined, StarOutlined, TeamOutlined, ThunderboltOutlined, ToolOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ALL_PAGES, canSee } from '../../config/navigation'
import { landing, type LandingIcon } from '../../config/landing.config'
import { OnlineCount } from '../OnlineCount'

const ICONS: Record<LandingIcon, ReactNode> = {
  thunder: <ThunderboltOutlined />, experiment: <ExperimentOutlined />, safety: <SafetyCertificateOutlined />, team: <TeamOutlined />,
  global: <GlobalOutlined />, rocket: <RocketOutlined />, tool: <ToolOutlined />, check: <CheckCircleOutlined />, heart: <HeartOutlined />,
  bulb: <BulbOutlined />, eye: <EyeOutlined />, aim: <AimOutlined />, star: <StarOutlined />, deploymentUnit: <DeploymentUnitOutlined />,
  audit: <AuditOutlined />, car: <CarOutlined />,
}

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Số chạy từ 0 tới giá trị khi khối vào màn hình (một lần); máy bật giảm chuyển động thì hiện ngay số cuối. */
function CountUp({ value, plain, suffix }: { value: number; plain?: boolean; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotion() || typeof IntersectionObserver === 'undefined') { setN(value); return }
    let frame = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now(), dur = 1400
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur)
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))))   // chậm dần về cuối
        if (p < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(frame) }
  }, [value])
  return <span ref={ref}>{plain ? n : n.toLocaleString('vi-VN')}{suffix}</span>
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <header className="ls-head">
      <span className="ls-eyebrow">{eyebrow}</span>
      <h2 className="ls-title">{title}</h2>
      {text && <p className="ls-text">{text}</p>}
    </header>
  )
}

/** Các phần giới thiệu công ty ở tab Tổng quan, nằm dưới Thông báo / Sinh nhật / Lịch (HomeInternal). Toàn bộ chữ và số liệu lấy từ landing.config.ts. */
export function LandingSections() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const recruitPage = ALL_PAGES.find((p) => p.key === 'recruitManage' && canSee(p, user))   // nút Tuyển dụng chỉ hiện với người vào được trang đó
  const c = landing.contact
  const s = landing.sections
  const nav: [string, string][] = [['lp-about', s.about], ['lp-stats', s.stats], ['lp-products', s.products], ['lp-quality', s.quality], ['lp-culture', s.culture],
    ['lp-recruit', s.recruit], ['lp-contact', s.contact]]
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })

  return (
    <div className="landing">
      <nav className="ls-nav" aria-label="Mục lục trang chủ">
        {nav.map(([id, label]) => <button key={id} type="button" onClick={() => jump(id)}>{label}</button>)}
      </nav>

      {/* Giới thiệu: đoạn mở đầu + mốc lịch sử, tầm nhìn / sứ mệnh, giá trị cốt lõi */}
      <section id="lp-about" className="ls-section">
        <SectionHead eyebrow={landing.about.eyebrow} title={landing.about.title} text={landing.about.lead} />
        <div className="ls-about">
          <ol className="ls-history">
            {landing.about.history.map((h) => <li key={h.year} className="lp-rv"><b>{h.year}</b><span>{h.text}</span></li>)}
          </ol>
          <div className="ls-vm">
            {[landing.about.vision, landing.about.mission].map((x, i) => (
              <article key={x.title} className="ls-card lp-rv"><span className="ls-icon">{i === 0 ? <EyeOutlined /> : <AimOutlined />}</span><h3>{x.title}</h3><p>{x.text}</p></article>
            ))}
          </div>
        </div>
        <div className="ls-grid four">
          {landing.about.values.map((v) => (
            <article key={v.title} className="ls-card lp-rv"><span className="ls-icon">{ICONS[v.icon]}</span><h3>{v.title}</h3><p>{v.text}</p></article>
          ))}
        </div>
      </section>

      {/* Số liệu nổi bật: số chạy khi cuộn tới */}
      <section id="lp-stats" className="ls-section ls-stats-wrap">
        <SectionHead eyebrow={landing.stats.eyebrow} title={landing.stats.title} />
        <div className="ls-stats">
          {landing.stats.items.map((x) => (
            <div key={x.label} className="ls-stat lp-rv"><b><CountUp value={x.value} plain={x.plain} suffix={x.suffix} /></b><span>{x.label}</span></div>
          ))}
        </div>
      </section>

      {/* Lĩnh vực hoạt động / sản phẩm */}
      <section id="lp-products" className="ls-section">
        <SectionHead eyebrow={landing.products.eyebrow} title={landing.products.title} />
        <div className="ls-grid four">
          {landing.products.items.map((p) => (
            <article key={p.title} className="ls-card ls-product lp-rv"><span className="ls-icon big">{ICONS[p.icon]}</span><h3>{p.title}</h3><p>{p.text}</p></article>
          ))}
        </div>
      </section>

      {/* Quy trình sản xuất (timeline) và chứng nhận chất lượng */}
      <section id="lp-quality" className="ls-section">
        <SectionHead eyebrow={landing.quality.eyebrow} title={landing.quality.title} />
        <ol className="ls-steps">
          {landing.quality.steps.map((st, i) => (
            <li key={st.title} className="lp-rv"><span className="ls-step-no">{i + 1}</span><b>{st.title}</b><span>{st.text}</span></li>
          ))}
        </ol>
        <div className="ls-certs">
          {landing.quality.certs.map((ct) => (
            <div key={ct.name} className="ls-cert lp-rv"><SafetyCertificateOutlined /><div><b>{ct.name}</b><span>{ct.text}</span></div></div>
          ))}
        </div>
      </section>

      {/* Văn hóa và đời sống: lưới ảnh, bấm để xem lớn và chuyển ảnh */}
      <section id="lp-culture" className="ls-section">
        <SectionHead eyebrow={landing.culture.eyebrow} title={landing.culture.title} text={landing.culture.text} />
        <Image.PreviewGroup>
          <div className="ls-gallery">
            {landing.culture.gallery.map((g, i) => (
              <figure key={g.src} className={`ls-photo lp-rv${i === 0 ? ' wide' : ''}`}>
                <Image src={g.src} alt={g.alt} loading="lazy" decoding="async" />
                <figcaption>{g.alt}</figcaption>
              </figure>
            ))}
          </div>
        </Image.PreviewGroup>
      </section>

      {/* Tuyển dụng: banner + nút tới mục Tuyển dụng (chỉ người có quyền mới thấy nút) */}
      <section id="lp-recruit" className="ls-section">
        <div className="ls-recruit lp-rv">
          <img src={landing.recruit.image.src} alt={landing.recruit.image.alt} loading="lazy" decoding="async" />
          <div className="ls-recruit-body">
            <h2>{landing.recruit.title}</h2>
            <p>{landing.recruit.text}</p>
            {recruitPage && <button type="button" className="lp-btn primary" onClick={() => navigate(recruitPage.path)}>{landing.recruit.button} <RightOutlined /></button>}
          </div>
        </div>
      </section>

      {/* Liên hệ: thông tin nhà máy + bản đồ */}
      <section id="lp-contact" className="ls-section">
        <SectionHead eyebrow={c.eyebrow} title={c.title} />
        <div className="ls-contact">
          <ul className="ls-contact-list lp-rv">
            <li><EnvironmentOutlined /><div><span>{c.labels.address}</span><b>{c.address}</b></div></li>
            <li><PhoneOutlined /><div><span>{c.labels.hotline}</span><a href={`tel:${c.hotline.replace(/\s+/g, '')}`}>{c.hotline}</a></div></li>
            <li><MailOutlined /><div><span>{c.labels.email}</span><a href={`mailto:${c.email}`}>{c.email}</a></div></li>
            <li><ClockCircleOutlined /><div><span>{c.labels.hours}</span><b>{c.hours}</b></div></li>
            <li><GlobalOutlined /><div><span>{c.labels.website}</span><a href={c.website} target="_blank" rel="noreferrer">{c.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></div></li>
          </ul>
          <div className="ls-map lp-rv">
            <iframe title={c.labels.map} src={c.mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          </div>
        </div>
      </section>

      <div className="lp-rv"><OnlineCount /></div>

      <footer className="ls-footer">
        <span className="lp-logo small"><img src={landing.logoUrl} alt="VINATECH" /></span>
        <div><b>{landing.companyName}</b><span>{landing.footer.note}</span></div>
        <small>{landing.footer.copyright(new Date().getFullYear())}</small>
      </footer>
    </div>
  )
}
