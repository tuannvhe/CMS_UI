import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, Result, Spin, message } from 'antd'
import { CloseOutlined, DownloadOutlined, ReloadOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { yearReview } from '../../api/yearReview'
import type { YearReview } from '../../api/yearReview'
import { BADGE_ICON, SLIDE_BG, drawSummary, tenureText } from './yearReviewCard'
import { useAuth } from '../../auth/AuthContext'
import { landing } from '../../config/landing.config'
import './yearReview.css'
import { trData } from '../../utils/dataText'

/** Thời gian mỗi trang tự chuyển (ms). */
const SLIDE_MS = 6500

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Số chạy từ 0 lên giá trị cuối (tắt hiệu ứng thì hiện ngay). */
function CountUp({ value, decimals = 0, run }: { value: number; decimals?: number; run: boolean }) {
  const { i18n } = useTranslation()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) { setV(0); return }
    if (reduceMotion() || value <= 0) { setV(value); return }
    let raf = 0
    const start = performance.now(), dur = 1600
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      setV(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, run])
  return <>{v.toLocaleString(i18n.language, { minimumFractionDigits: 0, maximumFractionDigits: decimals })}</>
}

interface Slide { key: string; theme: string; confetti?: boolean; body: (active: boolean) => ReactNode }

function buildSlides(d: YearReview, t: TFunction, lang: string, avatar: ReactNode): Slide[] {
  const s: Slide[] = []
  const given = d.name.split('_')[0].trim().split(/\s+/).pop() ?? d.name
  s.push({
    key: 'intro', theme: 'yr-t1', confetti: true, body: () => (
      <>
        <div className="yr-pop">{avatar}</div>
        <h1 className="yr-big yr-up">{t('yr.intro.hi', { name: given })}</h1>
        <p className="yr-sub yr-up2">{t('yr.intro.line', { year: d.year })}</p>
      </>
    ),
  })
  s.push({
    key: 'days', theme: 'yr-t2', body: (on) => d.monthsWithData === 0 ? (
      <><div className="yr-emoji yr-pop">📅</div><p className="yr-sub yr-up">{t('yr.days.noData')}</p></>
    ) : (
      <>
        <p className="yr-pre yr-up">{t('yr.days.pre')}</p>
        <div className="yr-num yr-pop"><CountUp value={d.workDays} run={on} /></div>
        <p className="yr-unit yr-up2">{t('yr.days.unit')}</p>
        <p className="yr-sub yr-up3">{t('yr.days.hours', { h: Math.round(d.workHours).toLocaleString(lang) })}</p>
        {d.workPercentile != null && d.workPercentile >= 50 && <span className="yr-chip yr-up3">{t('yr.days.pct', { p: d.workPercentile })}</span>}
      </>
    ),
  })
  if (d.monthsWithData > 0) s.push({
    key: 'ot', theme: 'yr-t3', body: (on) => d.otHours > 0 ? (
      <>
        <p className="yr-pre yr-up">{t('yr.ot.pre')}</p>
        <div className="yr-num yr-pop"><CountUp value={Math.round(d.otHours)} run={on} /></div>
        <p className="yr-unit yr-up2">{t('yr.ot.unit')}</p>
        {d.otPercentile != null && d.otPercentile >= 50 && <span className="yr-chip yr-up3">{t('yr.ot.pct', { p: d.otPercentile })}</span>}
      </>
    ) : (
      <><div className="yr-emoji yr-pop">⚖️</div><p className="yr-sub yr-up">{t('yr.ot.none')}</p></>
    ),
  })
  if (d.nightHours >= 50) s.push({
    key: 'night', theme: 'yr-t4', body: (on) => (
      <>
        <div className="yr-stars" aria-hidden />
        <div className="yr-emoji yr-pop">🌙</div>
        <p className="yr-pre yr-up">{t('yr.night.pre')}</p>
        <div className="yr-num yr-pop"><CountUp value={d.nightHours} run={on} /></div>
        <p className="yr-unit yr-up2">{t('yr.night.unit')}</p>
      </>
    ),
  })
  if (d.topMonth != null && d.months.length >= 2) {
    const max = Math.max(...d.months.map((m) => m.workHours + m.otHours), 1)
    const top = d.months.find((m) => m.month === d.topMonth)
    s.push({
      key: 'top', theme: 'yr-t5', body: () => (
        <>
          <p className="yr-pre yr-up">{t('yr.top.pre')}</p>
          <div className="yr-big yr-pop">{t('yr.top.month', { m: d.topMonth })}</div>
          {top && <p className="yr-sub yr-up2">{t('yr.top.hours', { h: Math.round(top.workHours + top.otHours) })}</p>}
          <div className="yr-bars yr-up3">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const x = d.months.find((k) => k.month === m)
              const h = x ? ((x.workHours + x.otHours) / max) * 100 : 0
              return (
                <div key={m} className={`yr-bar${m === d.topMonth ? ' top' : ''}`}>
                  <i style={{ height: `${Math.max(h, x ? 4 : 0)}%`, animationDelay: `${m * 60}ms` }} />
                  <span>{t('yr.monthShort', { m })}</span>
                </div>
              )
            })}
          </div>
        </>
      ),
    })
  }
  if (d.monthsWithData > 0) s.push({
    key: 'att', theme: 'yr-t6', body: (on) => (
      <>
        <div className="yr-emoji yr-pop">🏆</div>
        <p className="yr-pre yr-up">{t('yr.att.pre')}</p>
        <div className="yr-num yr-pop"><CountUp value={d.attendanceMonths} run={on} /><small>/{d.monthsWithData}</small></div>
        <p className="yr-unit yr-up2">{t('yr.att.unit')}</p>
        {d.lateEarly === 0 && d.forgot === 0 && d.monthsWithData >= 3
          ? <p className="yr-sub yr-up3">{t('yr.att.perfect')}</p>
          : <p className="yr-sub yr-up3">{t('yr.att.clean', { n: d.cleanMonths })}</p>}
        {d.attendanceStreak >= 2 && <span className="yr-chip yr-up3">{t('yr.att.streak', { n: d.attendanceStreak })}</span>}
      </>
    ),
  })
  if (d.hungYenTrips > 0) s.push({
    key: 'hy', theme: 'yr-t7', body: (on) => (
      <>
        <div className="yr-emoji yr-pop">🚌</div>
        <p className="yr-pre yr-up">{t('yr.hy.pre')}</p>
        <div className="yr-num yr-pop"><CountUp value={d.hungYenTrips} run={on} /></div>
        <p className="yr-unit yr-up2">{t('yr.hy.unit')}</p>
      </>
    ),
  })
  s.push({
    key: 'tenure', theme: 'yr-t8', body: () => (
      <>
        <div className="yr-emoji yr-pop">{d.joinedThisYear ? '🌱' : '🤝'}</div>
        {d.joinedThisYear ? <h1 className="yr-big yr-up">{t('yr.tenure.newcomer', { year: d.year })}</h1> : (
          <>
            <p className="yr-pre yr-up">{t('yr.tenure.pre')}</p>
            <div className="yr-big yr-pop">{tenureText(t, d.tenureMonths)}</div>
          </>
        )}
        {d.startWork && <p className="yr-sub yr-up2">{t('yr.tenure.since', { d: new Date(d.startWork).toLocaleDateString(lang) })}</p>}
      </>
    ),
  })
  s.push({
    key: 'badges', theme: 'yr-t9', confetti: true, body: () => (
      <>
        <p className="yr-pre yr-up">{t('yr.badges.title')}</p>
        {d.badges.length === 0 ? <p className="yr-sub yr-up2">{t('yr.badges.none')}</p> : (
          <div className="yr-badges">
            {d.badges.map((b, i) => (
              <div key={b} className="yr-badge yr-pop" style={{ animationDelay: `${200 + i * 180}ms` }}>
                <span className="yr-badge-ic">{BADGE_ICON[b] ?? '⭐'}</span>
                <b>{t(`yr.badge.${b}`)}</b>
                <small>{t(`yr.badgeDesc.${b}`)}</small>
              </div>
            ))}
          </div>
        )}
      </>
    ),
  })
  s.push({ key: 'thanks', theme: 'yr-t10', confetti: true, body: () => null })
  return s
}

export default function YearReviewPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: ['year-review', 'me'], queryFn: yearReview.mine, retry: false, staleTime: 10 * 60_000 })
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number>()

  const { user } = useAuth()
  const avatarUrl = user?.avatarUrl ?? null
  const slides = useMemo(() => (q.data ? buildSlides(q.data, t, i18n.language, <Avatar name={q.data.name} url={avatarUrl} size="lg" />) : []), [q.data, t, i18n.language, avatarUrl])
  const last = slides.length - 1
  const close = useCallback(() => (window.history.length > 1 ? navigate(-1) : navigate('/')), [navigate])
  const next = useCallback(() => setIdx((i) => Math.min(i + 1, last)), [last])
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    if (!slides.length || paused || idx >= last) return
    timer.current = window.setTimeout(next, SLIDE_MS)
    return () => window.clearTimeout(timer.current)
  }, [idx, paused, slides.length, last, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, close])

  const makeImage = async () => {
    if (!q.data) return null
    return drawSummary(q.data, t, i18n.language, avatarUrl)
  }
  const fileName = () => `VINATECH_${q.data?.year}_${q.data?.employeeId}.png`
  const save = async () => {
    setBusy(true)
    try {
      const blob = await makeImage()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fileName(); a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      message.success(t('yr.saved'))
    } finally { setBusy(false) }
  }
  const share = async () => {
    setBusy(true)
    try {
      const blob = await makeImage()
      if (!blob) return
      const file = new File([blob], fileName(), { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('yr.summary.title', { year: q.data?.year }) }).catch(() => undefined)
      else await save()
    } finally { setBusy(false) }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  if (q.isLoading) return <div className="yr-shell yr-t1"><div className="yr-center"><Spin size="large" /><p className="yr-sub">{t('yr.loading')}</p></div></div>
  if (q.isError || !q.data) {
    const title = (q.error as { response?: { data?: { title?: string } } } | null)?.response?.data?.title
    return (
      <div className="page">
        <Result status={title === 'closed' ? 'info' : 'warning'} title={t(title === 'closed' ? 'yr.closed' : title === 'no_profile' ? 'yr.noProfile' : 'yr.error')}
          extra={<Button type="primary" onClick={() => navigate('/')}>{t('yr.close')}</Button>} />
      </div>
    )
  }

  const d = q.data
  const slide = slides[idx]
  const isLast = idx === last
  return (
    <div className={`yr-shell ${slide.theme}`} role="dialog" aria-label={t('yr.title', { year: d.year })}>
      <div className="yr-bg" key={`bg-${slide.key}`} style={{ backgroundImage: `url(${SLIDE_BG[slide.key] ?? SLIDE_BG.intro})` }} aria-hidden />
      <div className="yr-veil" aria-hidden />
      <div className="yr-glow" aria-hidden />
      {slide.confetti && <Confetti key={`cf-${slide.key}`} />}
      <div className="yr-progress">
        {slides.map((s, i) => (
          <span key={s.key} className={i < idx ? 'done' : i === idx ? `on${paused ? ' paused' : ''}` : ''}>
            <i style={i === idx && !isLast ? { animationDuration: `${SLIDE_MS}ms` } : undefined} />
          </span>
        ))}
      </div>
      <div className="yr-top">
        <span className="yr-brand"><img src={landing.logoUrl} alt="" />VINATECH · {t('yr.title', { year: d.year })}</span>
        <button type="button" className="yr-x" onClick={close} aria-label={t('yr.close')}><CloseOutlined /></button>
      </div>
      {!isLast && (
        <>
          <button type="button" className="yr-tap left" aria-label="prev" onClick={prev}
            onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)} />
          <button type="button" className="yr-tap right" aria-label="next" onClick={next}
            onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)} />
        </>
      )}
      <div className="yr-stage" key={slide.key}>
        {isLast ? (
          <div className="yr-final">
            <h1 className="yr-big yr-up">{t('yr.thanks.title')}</h1>
            <p className="yr-msg yr-up2">{d.message ?? t('yr.thanks.default', { year: d.year })}</p>
            <p className="yr-by yr-up2">— {d.messageBy ?? t('yr.thanks.by')}</p>
            <div className="yr-card yr-pop">
              <div className="yr-card-photo" style={{ backgroundImage: `url(${SLIDE_BG.thanks})` }}>
                <span>{d.year}</span>
              </div>
              <div className="yr-card-who">
                <Avatar name={d.name} url={avatarUrl} size="md" />
                <div>
                  <div className="yr-card-h">{t('yr.summary.title', { year: d.year })}</div>
                  <div className="yr-card-name">{d.name}</div>
                  {d.department && <div className="yr-card-dept">{trData(d.department)}</div>}
                </div>
              </div>
              <div className="yr-card-grid">
                <div><b>{d.workDays}</b><span>{t('yr.summary.days')}</span></div>
                <div><b>{Math.round(d.otHours)}</b><span>{t('yr.summary.ot')}</span></div>
                <div><b>{d.attendanceMonths}</b><span>{t('yr.summary.att')}</span></div>
                <div><b>{tenureText(t, d.tenureMonths)}</b><span>{t('yr.summary.tenure')}</span></div>
              </div>
              {d.badges.length > 0 && <div className="yr-card-badges">{d.badges.map((b) => <span key={b}>{BADGE_ICON[b] ?? '⭐'} {t(`yr.badge.${b}`)}</span>)}</div>}
            </div>
            <div className="yr-actions yr-up3">
              <Button size="large" shape="round" icon={<DownloadOutlined />} loading={busy} onClick={save}>{t('yr.save')}</Button>
              {canShare && <Button size="large" shape="round" type="primary" icon={<ShareAltOutlined />} loading={busy} onClick={share}>{t('yr.share')}</Button>}
              <Button size="large" shape="round" type="text" className="yr-replay" icon={<ReloadOutlined />} onClick={() => setIdx(0)}>{t('yr.replay')}</Button>
            </div>
          </div>
        ) : (
          <div className="yr-center">{slide.body(true)}</div>
        )}
      </div>
      {!isLast && idx === 0 && <div className="yr-hint">{t('yr.tapHint')}</div>}
      <PreviewTag />
    </div>
  )
}

function PreviewTag() {
  const { t } = useTranslation()
  const st = useQuery({ queryKey: ['year-review', 'status'], queryFn: yearReview.status, staleTime: 10 * 60_000 })
  return st.data?.preview ? <div className="yr-preview">{t('yr.preview')}</div> : null
}

/** Ảnh đại diện tròn có viền phát sáng; chưa có ảnh thì hiện chữ cái đầu của tên gọi. */
export function Avatar({ name, url, size }: { name: string; url: string | null; size: 'lg' | 'md' }) {
  const [broken, setBroken] = useState(false)
  const given = name.split('_')[0].trim().split(/\s+/).pop() ?? name
  return (
    <span className={`yr-avatar ${size}`}>
      {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : <b>{given.charAt(0).toLocaleUpperCase('vi')}</b>}
    </span>
  )
}

const CONFETTI_COLORS = ['#fde047', '#f472b6', '#60a5fa', '#34d399', '#fb923c', '#ffffff', '#c084fc']

/** Giấy màu rơi (thuần CSS, vị trí cố định theo chỉ số để không đổi giữa các lần vẽ). Tắt khi người dùng chọn giảm chuyển động. */
export function Confetti() {
  if (reduceMotion()) return null
  return (
    <div className="yr-confetti" aria-hidden>
      {Array.from({ length: 36 }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${(i % 9) * 0.35}s`, animationDuration: `${3.2 + (i % 5) * 0.6}s`,
          width: `${6 + (i % 3) * 3}px`, height: `${10 + (i % 4) * 3}px`, '--r': `${i * 29}deg`,
        } as CSSProperties} />
      ))}
    </div>
  )
}
