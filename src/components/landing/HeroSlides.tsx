import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LandingImage } from '../../config/landing.config'

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Ảnh nền chạy của banner đầu trang chủ (nhà máy Bắc Ninh, Hưng Yên): chuyển mờ dần mỗi `interval` ms, dừng khi rê chuột vào banner.
 * Máy bật giảm chuyển động thì chỉ hiện ảnh đầu. Chấm chọn ảnh và tên nhà máy hiện ở góc dưới bên phải.
 */
export function HeroSlides({ slides, interval = 5000 }: { slides: LandingImage[]; interval?: number }) {
  const { t: tr } = useTranslation()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const auto = slides.length > 1 && !reducedMotion()

  useEffect(() => {
    if (!auto || paused) return
    const t = window.setInterval(() => setI((x) => (x + 1) % slides.length), interval)
    return () => window.clearInterval(t)
  }, [auto, paused, slides.length, interval])

  // Dừng khi rê chuột vào banner (lắng nghe trên phần tử cha là thẻ <section> của banner)
  useEffect(() => {
    const host = document.querySelector('.lp-hero-brand')
    if (!host) return
    const on = () => setPaused(true), off = () => setPaused(false)
    host.addEventListener('mouseenter', on); host.addEventListener('mouseleave', off)
    return () => { host.removeEventListener('mouseenter', on); host.removeEventListener('mouseleave', off) }
  }, [])

  if (!slides.length) return null
  return (
    <>
      <div className="lp-hero-slides" aria-hidden>
        {slides.map((s, k) => (
          <img key={s.src} src={s.src} alt="" className={k === i ? 'on' : undefined} decoding="async" loading={k === 0 ? 'eager' : 'lazy'}
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
        ))}
      </div>
      <div className="lp-hero-slidebar">
        <span className="lp-hero-slidecap">{slides[i].alt}</span>
        {slides.length > 1 && (
          <span className="lp-hero-dots" role="tablist" aria-label={tr('home.heroPhotos')}>
            {slides.map((s, k) => (
              <button key={s.src} type="button" role="tab" aria-selected={k === i} aria-label={s.alt} className={k === i ? 'on' : undefined} onClick={() => setI(k)} />
            ))}
          </span>
        )}
      </div>
    </>
  )
}
