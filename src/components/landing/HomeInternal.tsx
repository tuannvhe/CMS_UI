import { useMemo, useState, type ReactNode } from 'react'
import { Image, Skeleton, Typography } from 'antd'
import { NotificationOutlined, RightOutlined, ClockCircleOutlined, TranslationOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { announcements } from '../../api/announcements'
import { hnApi } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { htmlToText } from '../../utils/htmlText'
import { AnnouncementBody } from '../AnnouncementBody'
import { BirthdayCard } from '../BirthdayCard'
import { MonthCalendarCard } from '../MonthCalendarCard'
import { HonorCard } from '../HonorCard'
import { trData } from '../../utils/dataText'

const FRESH_MS = 3 * 24 * 60 * 60 * 1000   // thông báo đăng trong 3 ngày gần đây được gắn nhãn "Mới"

/**
 * Đầu tab Tổng quan, ngay dưới banner (giữ bố cục cũ): Thông báo + Sinh nhật, hàng dưới là Lịch đi làm / nghỉ.
 * Khung Thông báo: dải đầu màu thương hiệu (chuông lắc nhẹ + chấm đỏ khi có bản mới), bản mới nhất là thẻ nổi bật mở sẵn,
 * các bản trước là thẻ thu gọn (ô ngày + tiêu đề), bấm cả thẻ để mở nội dung. Phần giới thiệu công ty nằm bên dưới (LandingSections).
 */
/** Đầu trang chủ: Thông báo (trái), Sinh nhật + Vinh danh (phải). Nằm trên banner công ty. */
export function HomeTop({ hn = false }: { hn?: boolean }) {
  if (hn) return <div className="lp-grid"><HnHomeNotice /></div>
  return (
    <div className="lp-grid">
      <HomeNotice />
      <div className="lp-side">
        <BirthdayCard />
        <HonorCard />
      </div>
    </div>
  )
}

/** Lịch tháng, dưới banner công ty. */
export function HomeBottom() {
  return <div className="lp-bottom"><div className="lp-cal"><MonthCalendarCard compact /></div></div>
}

/** Thông báo cơ sở Ninh Bình: cùng khung, dữ liệu từ /api/hn/home (HTML cũ đổi sang chữ thuần). */
function HnHomeNotice() {
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['hn', 'home', user?.userId], queryFn: hnApi.home, staleTime: 60_000, retry: false })
  const items: NoticeItem[] = useMemo(() => {
    const n = q.data?.notice
    return n ? [{ title: n.title, type: n.type, createdAt: String(n.createdAt ?? ''), html: n.contents ?? '' }] : []
  }, [q.data])
  return <NoticeCard items={items} loading={q.isLoading} error={q.isError} renderBody={(n) => <div className="hn-body" style={{ whiteSpace: 'pre-wrap' }}>{htmlToText(n.html)}</div>} />
}

/** Khung Thông báo (.hn-v2). Trên điện thoại được đưa lên đầu trang chủ. */
export function HomeNotice() {
  const { i18n } = useTranslation()
  // theo ngôn ngữ: máy chủ trả bản dịch tiếng Anh / Hàn của thông báo (nếu đã dịch)
  const notice = useQuery({ queryKey: ['announcements', i18n.language], queryFn: () => announcements.recent(5), staleTime: 5 * 60 * 1000, retry: false })
  return (
    <NoticeCard
      items={notice.data ?? []}
      loading={notice.isLoading}
      error={notice.isError}
      renderBody={(n) => <AnnouncementBody html={n.html} />}
    />
  )
}

/** Mục thông báo hiển thị trong khung: dùng chung cho mọi cơ sở (nguồn dữ liệu do nơi gọi cấp). */
export interface NoticeItem { title: string; type?: string; createdAt: string; html: string; id?: number; origTitle?: string | null; origHtml?: string | null; translation?: string | null }

/** Khung Thông báo dùng chung: nguồn dữ liệu và cách vẽ nội dung do nơi gọi truyền vào. */
export function NoticeCard({ items: list, loading, error, renderBody }: { items: NoticeItem[]; loading: boolean; error: boolean; renderBody: (n: NoticeItem) => ReactNode }) {
  const { t, i18n } = useTranslation()
  const [zoom, setZoom] = useState<string | null>(null)   // ảnh trong thông báo đang xem phóng to
  const [origOf, setOrigOf] = useState<Set<string>>(new Set())   // thông báo đang xem bản gốc (thay vì bản dịch)
  const keyOf = (n: NoticeItem, i: number) => `${n.id ?? ''}-${n.createdAt}-${i}`
  const view = (n: NoticeItem, i: number): NoticeItem => (n.translation && origOf.has(keyOf(n, i)) ? { ...n, title: n.origTitle ?? n.title, html: n.origHtml ?? n.html } : n)
  const flip = (n: NoticeItem, i: number) => setOrigOf((s) => { const k = keyOf(n, i); const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x })
  /** Nhãn "bản dịch" + nút xem bản gốc / bản dịch (chỉ khi máy chủ trả bản dịch). */
  const trBar = (n: NoticeItem, i: number) => !n.translation ? null : (
    <span className="hn-tr" onClick={(e) => e.stopPropagation()}>
      <span className="hn-tag type" title={t(n.translation === 'ok' ? 'ctr.tagHrHint' : 'ctr.tagAiHint')}><TranslationOutlined /> {t(n.translation === 'ok' ? 'ctr.tagHr' : 'ctr.tagAi')}</span>
      <button type="button" className="hn-tr-btn" onClick={(e) => { e.preventDefault(); flip(n, i) }}>{t(origOf.has(keyOf(n, i)) ? 'ctr.showTr' : 'ctr.showOrig')}</button>
    </span>
  )
  const now = Date.now()
  const isFresh = (iso: string) => { const d = new Date(iso).getTime(); return Number.isFinite(d) && now - d < FRESH_MS }
  const hasNew = list.some((n) => isFresh(n.createdAt))
  const fmt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) }
  const [rawFirst, ...rawOlder] = list
  const first = rawFirst ? view(rawFirst, 0) : rawFirst
  const older = rawOlder.map((n, i) => view(n, i + 1))
  return (
    <>
      <section className="home-notice hn-v2" aria-labelledby="hn-heading" onClick={(e) => { const el = e.target as HTMLElement; if (el.tagName === 'IMG' && el.closest('.hn-body')) setZoom((el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src) }}>
        <header className="hn-hero">
          <span className={`hn-icon${hasNew ? ' ring' : ''}`} aria-hidden><NotificationOutlined />{hasNew && <i className="hn-ping" />}</span>
          <div className="hn-htext">
            <b id="hn-heading">{t('home.noticeTitle')}</b>
            <small>{list.length ? t('home.noticeSub', { n: list.length }) : t('home.noticeSubEmpty')}</small>
          </div>
          {list.length > 0 && <span className="hn-count" aria-label={t('home.noticeSub', { n: list.length })}>{list.length}</span>}
        </header>
        {loading ? <div className="hn-scroll"><Skeleton active paragraph={{ rows: 4 }} /></div> : first ? (
          <div className="hn-scroll">
            <article className="hn-item first hn-feature">
              <div className="hn-tags">
                <span className="hn-tag latest">{t('home.noticeLatest')}</span>
                {isFresh(first.createdAt) && <span className="hn-tag new">{t('home.noticeNew')}</span>}
                {first.type && <span className="hn-tag type">{trData(first.type)}</span>}
                {trBar(rawFirst, 0)}
              </div>
              <h3 className="hn-title">{first.title}</h3>
              <div className="hn-meta"><ClockCircleOutlined /><span>{fmt(first.createdAt)}</span></div>
              {renderBody(first)}
            </article>
            {older.length > 0 && <div className="hn-older-title">{t('home.noticeOlder')}</div>}
            {older.map((n, i) => {
              const d = new Date(n.createdAt)
              return (
                <details key={`${n.createdAt}-${i}`} className="hn-item">
                  <summary>
                    <span className="hn-date" aria-hidden>
                      <b>{d.getDate()}</b>
                      <span>{d.toLocaleDateString(i18n.language, { month: 'short' })}</span>
                    </span>
                    <span className="hn-sum">
                      <span className="hn-title">{n.title}</span>
                      <span className="hn-meta">
                        {isFresh(n.createdAt) && <span className="hn-tag new">{t('home.noticeNew')}</span>}
                        {n.type && <span className="hn-tag type">{trData(n.type)}</span>}
                        {trBar(rawOlder[i], i + 1)}
                        <span>{fmt(n.createdAt)}</span>
                      </span>
                    </span>
                    <RightOutlined className="hn-chev" aria-hidden />
                  </summary>
                  <div className="hn-detail">{renderBody(n)}</div>
                </details>
              )
            })}
          </div>
        ) : (
          <div className="hn-scroll hn-empty">
            <NotificationOutlined aria-hidden />
            <Typography.Text type="secondary">{error ? t('home.noticeError') : t('home.noticeNone')}</Typography.Text>
          </div>
        )}
      </section>
      {zoom && <Image style={{ display: 'none' }} src={zoom} alt="" preview={{ open: true, src: zoom, onOpenChange: (v) => { if (!v) setZoom(null) } }} />}
    </>
  )
}
