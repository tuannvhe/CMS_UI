import { useEffect, useState } from 'react'
import { Result, Spin, Switch, message } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { monthReview } from '../../api/monthReview'
import type { BadgeProgress, MonthRef, MonthReview, MonthStat } from '../../api/monthReview'
import { yearReview } from '../../api/yearReview'
import { badges } from '../../api/badges'
import { useAuth } from '../../auth/AuthContext'
import { landing } from '../../config/landing.config'
import { BADGE_ICON, SLIDE_BG } from './yearReviewCard'
import { Avatar, Confetti } from './YearReviewPage'
import { MONTH_BADGE_ICON, markSeen, periodKey } from './monthSeen'
import './yearReview.css'
import { trData } from '../../utils/dataText'

/** Ảnh nền đầu trang đổi theo tháng cho đỡ nhàm. */
const HERO_BG = [SLIDE_BG.intro, SLIDE_BG.days, SLIDE_BG.ot, SLIDE_BG.night, SLIDE_BG.top, SLIDE_BG.att, SLIDE_BG.hy, SLIDE_BG.tenure, SLIDE_BG.badges, SLIDE_BG.thanks]

export default function MonthReviewPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [pick, setPick] = useState<MonthRef | null>(null)
  const q = useQuery({
    queryKey: ['month-review', 'me', pick ? periodKey(pick) : 'latest'],
    queryFn: () => monthReview.mine(pick ?? undefined),
    retry: false, staleTime: 10 * 60_000,
  })
  const yr = useQuery({ queryKey: ['year-review', 'status'], queryFn: yearReview.status, retry: false, staleTime: 10 * 60_000 })
  const d = q.data
  const qc = useQueryClient()
  const prefsQ = useQuery({ queryKey: ['badges', 'prefs', 'me'], queryFn: badges.myPrefs, retry: false, staleTime: 60_000 })
  const prefs = prefsQ.data
  const save = useMutation({
    mutationFn: badges.saveMyPrefs,
    onSuccess: (p) => { qc.setQueryData(['badges', 'prefs', 'me'], p); qc.invalidateQueries({ queryKey: ['badge'] }); message.success(t('badgePub.saved')) },
    onError: () => { message.error(t('badgePub.saveErr')) },
  })

  useEffect(() => { if (d) markSeen(d) }, [d])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate('/') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const close = (
    <button type="button" className="yr-x mr-close" aria-label={t('yr.close')} onClick={() => navigate('/')}><CloseOutlined /></button>
  )

  if (q.isLoading) return <div className="mr-shell mr-center">{close}<Spin size="large" /><p>{t('mr.loading')}</p></div>
  if (!d) {
    const status = (q.error as { response?: { status?: number } } | null)?.response?.status
    return <div className="mr-shell mr-center">{close}<Result status={status === 404 ? 'info' : 'warning'} title={<span style={{ color: '#fff' }}>{status === 404 ? t('mr.noData') : t('mr.error')}</span>} /></div>
  }

  const lang = i18n.language
  const nf = (v: number, dec = 0) => v.toLocaleString(lang, { maximumFractionDigits: dec })
  const c = d.current
  const earned = d.shelf.filter((s) => s.earned).length
  const celebrate = d.newBadges.length > 0 || d.monthBadges.length >= 2

  return (
    <div className="mr-shell">
      {celebrate && <Confetti />}
      <div className="mr-wrap">
        <header className="mr-top">
          <span className="yr-brand"><img src={landing.logoUrl} alt="" />VINATECH · {t('mr.title')}</span>
          {close}
        </header>

        {d.available.length > 1 && (
          <div className="mr-chips" role="tablist">
            {d.available.map((a) => {
              const on = a.year === d.year && a.month === d.month
              return (
                <button key={periodKey(a)} type="button" role="tab" aria-selected={on} className={on ? 'on' : ''} onClick={() => setPick(a)}>
                  {t('mr.period', { m: a.month, y: a.year })}
                </button>
              )
            })}
          </div>
        )}

        <section className="mr-hero" style={{ backgroundImage: `url(${HERO_BG[(d.month - 1) % HERO_BG.length]})` }}>
          <div className="mr-hero-in">
            <Avatar name={d.name} url={user?.avatarUrl ?? null} size="md" />
            <div>
              <div className="mr-hero-period">{t('mr.period', { m: d.month, y: d.year })}</div>
              <div className="mr-hero-name">{d.name}</div>
              {d.department && <div className="mr-hero-dept">{trData(d.department)}</div>}
            </div>
          </div>
        </section>

        {d.newBadges.length > 0 && (
          <section className="mr-unlock yr-pop">
            <div className="mr-unlock-h">🎉 {t('mr.unlocked')}</div>
            <div className="mr-unlock-list">
              {d.newBadges.map((b) => { const lv = d.shelf.find((x) => x.key === b)?.level ?? 1; return <span key={b} className={`lv${lv}`}><i>{BADGE_ICON[b] ?? '⭐'}</i>{t(`yr.badge.${b}`)} · {t(`mr.tier.${lv}`)}</span> })}
            </div>
          </section>
        )}

        {c ? (
          <>
            <section className="mr-stats">
              <Stat label={t('mr.stat.days')} value={c.workDays} prev={d.previous?.workDays} pm={d.previous?.month} t={t} nf={nf} />
              <Stat label={t('mr.stat.ot')} value={c.otHours} prev={d.previous?.otHours} pm={d.previous?.month} t={t} nf={nf} dec={1} />
              <Stat label={t('mr.stat.night')} value={c.nightHours} prev={d.previous?.nightHours} pm={d.previous?.month} t={t} nf={nf} dec={1} neutral />
              <Stat label={t('mr.stat.leave')} value={c.leaveDays} prev={d.previous?.leaveDays} pm={d.previous?.month} t={t} nf={nf} dec={1} neutral />
            </section>
            {(d.otPercentile != null && d.otPercentile >= 50) || (d.workPercentile != null && d.workPercentile >= 50) ? (
              <section className="mr-pct">
                {d.workPercentile != null && d.workPercentile >= 50 && <div>💼 {t('mr.workPct', { p: d.workPercentile })}</div>}
                {d.otPercentile != null && d.otPercentile >= 50 && <div>⚡ {t('mr.otPct', { p: d.otPercentile })}</div>}
              </section>
            ) : null}
            <MonthBadges d={d} c={c} t={t} />
          </>
        ) : (
          <section className="mr-card mr-muted">{t('mr.noRow')}</section>
        )}

        <section className="mr-card">
          <div className="mr-shelf-h">
            <h2>{t('mr.shelfTitle', { y: d.year })}</h2>
            <span className="mr-shelf-count">{earned}/{d.shelf.length}</span>
          </div>
          <p className="mr-sub">{t('mr.shelfSub', { m: d.month })}</p>
          {prefs && (prefs.ready ? (
            <div className="mr-pub">
              <label><Switch size="small" checked={!prefs.hidden} loading={save.isPending} onChange={(v) => save.mutate({ pinned: prefs.pinned, hidden: !v })} /> {t('badgePub.show')}</label>
              <p>{t('badgePub.showHint')} {t('badgePub.privateHint')}{!prefs.hidden && !prefs.pinned ? ` ${t('badgePub.autoPin')}` : ''}</p>
            </div>
          ) : <p className="mr-sub">{t('badgePub.notReady')}</p>)}
          <div className="mr-shelf">
            {d.shelf.map((s) => (
              <Shelf key={s.key} s={s} isNew={d.newBadges.includes(s.key)} t={t} nf={nf}
                pin={prefs?.ready && !prefs.hidden && s.earned && prefs.earned.includes(s.key)
                  ? { on: prefs.pinned === s.key, toggle: () => save.mutate({ pinned: prefs.pinned === s.key ? null : s.key, hidden: prefs.hidden }) }
                  : undefined} />
            ))}
          </div>
        </section>

        {(yr.data?.open || yr.data?.preview) && (
          <button type="button" className="yr-banner mr-year" onClick={() => navigate('/year-review')}>
            <span className="yr-banner-ic" aria-hidden>🎉</span>
            <span className="yr-banner-tx">{t('mr.yearLink', { y: yr.data.year })}</span>
            <span className="yr-banner-go">{t('yr.open')}</span>
          </button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, prev, pm, t, nf, dec = 0, neutral }: {
  label: string; value: number; prev?: number; pm?: number; t: TFunction; nf: (v: number, d?: number) => string; dec?: number; neutral?: boolean
}) {
  let delta = null
  if (prev != null && pm != null) {
    const diff = Math.round((value - prev) * 10 ** dec) / 10 ** dec
    delta = diff === 0
      ? <span className="mr-delta eq">= {t('mr.same', { m: pm })}</span>
      : <span className={`mr-delta ${neutral ? 'eq' : diff > 0 ? 'up' : 'down'}`}>{diff > 0 ? '▲ +' : '▼ '}{nf(diff, dec)} {t('mr.vsPrev', { m: pm })}</span>
  }
  return (
    <div className="mr-stat">
      <b>{nf(value, dec)}</b>
      <span>{label}</span>
      {delta}
    </div>
  )
}

function MonthBadges({ d, c, t }: { d: MonthReview; c: MonthStat; t: TFunction }) {
  return (
    <section className="mr-card">
      <h2>{t('mr.monthTitle')}</h2>
      {d.monthBadges.length > 0 ? (
        <div className="mr-mbadges">
          {d.monthBadges.map((b) => (
            <div key={b} className="mr-mbadge yr-pop">
              <i>{MONTH_BADGE_ICON[b] ?? '⭐'}</i>
              <div><b>{t(`mr.mbadge.${b}`)}</b><span>{t(`mr.mbadgeDesc.${b}`)}</span></div>
            </div>
          ))}
        </div>
      ) : <p className="mr-sub">{t('mr.monthNone')}</p>}
      {!c.attendanceBonus && d.monthBadges.length > 0 && <p className="mr-sub">{t('mr.attLost')}</p>}
    </section>
  )
}

function Shelf({ s, isNew, t, nf, pin }: {
  s: BadgeProgress; isNew: boolean; t: TFunction; nf: (v: number, d?: number) => string; pin?: { on: boolean; toggle: () => void }
}) {
  const levels = s.levels?.length ? s.levels : [s.target]
  const maxed = s.level >= levels.length
  const from = s.level > 0 ? levels[s.level - 1] : 0
  // thanh tiến độ trong cấp hiện tại: từ mốc vừa đạt đến mốc kế tiếp
  const pct = maxed ? 100 : Math.max(0, Math.min(100, ((s.current - from) / Math.max(1, s.target - from)) * 100))
  const left = Math.max(0, Math.ceil(s.target - s.current))
  const unit = t(`mr.unit.${s.key}`)
  return (
    <div className={`mr-badge lv${s.level}${s.earned ? ' on' : ''}${isNew ? ' new' : ''}`}>
      <i aria-hidden>{BADGE_ICON[s.key] ?? '⭐'}</i>
      <div className="mr-badge-b">
        <div className="mr-badge-t"><b>{t(`yr.badge.${s.key}`)}</b><span className={`mr-tier lv${s.level}`}>{s.level > 0 ? t(`mr.tier.${s.level}`) : t('mr.notYet')}</span></div>
        <span className="mr-badge-d">{t(`mr.shelfDesc.${s.key}`)}</span>
        <div className="mr-ladder" aria-hidden>
          {levels.map((v, i) => <span key={v} className={i < s.level ? `on lv${i + 1}` : ''}>{t(`mr.tier.${i + 1}`)} {nf(v)}</span>)}
        </div>
        <div className="mr-bar"><i style={{ width: `${pct}%` }} /></div>
        <span className="mr-badge-p">
          {maxed ? `💎 ${t('mr.maxed')}` : t('mr.left', { tier: t(`mr.tier.${s.level + 1}`), n: nf(left), unit })}
          <em>{nf(s.current)} {unit}</em>
        </span>
        {pin && <button type="button" className={`mr-pin${pin.on ? ' on' : ''}`} onClick={pin.toggle}>📌 {pin.on ? t('badgePub.pinned') : t('badgePub.pin')}</button>}
      </div>
    </div>
  )
}
