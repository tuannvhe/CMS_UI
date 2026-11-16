import { useState } from 'react'
import { Image, Skeleton, Typography } from 'antd'
import { NotificationOutlined, TranslationOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { announcements } from '../../api/announcements'
import { AnnouncementBody } from '../AnnouncementBody'
import { BirthdayCard } from '../BirthdayCard'
import { MonthCalendarCard } from '../MonthCalendarCard'
import { trData } from '../../utils/dataText'

/**
 * Đầu tab Tổng quan, ngay dưới banner (giữ bố cục cũ): Thông báo (bản mới nhất mở sẵn, các bản sau bấm "Xem nội dung") + Sinh nhật,
 * hàng dưới là Lịch đi làm / nghỉ. Phần giới thiệu công ty nằm bên dưới (LandingSections).
 */
export function HomeInternal() {
  const { t, i18n } = useTranslation()
  const [zoom, setZoom] = useState<string | null>(null)   // ảnh trong thông báo đang xem phóng to
  // theo ngôn ngữ: máy chủ trả bản dịch tiếng Anh / Hàn của thông báo (nếu đã dịch)
  const notice = useQuery({ queryKey: ['announcements', i18n.language], queryFn: () => announcements.recent(5), staleTime: 5 * 60 * 1000, retry: false })
  const [origOf, setOrigOf] = useState<Set<number>>(new Set())   // thông báo đang xem bản gốc thay vì bản dịch
  const flip = (i: number) => setOrigOf((s) => { const x = new Set(s); if (x.has(i)) x.delete(i); else x.add(i); return x })
  return (
    <>
      <div className="lp-grid">
        <section className="home-notice" onClick={(e) => { const el = e.target as HTMLElement; if (el.tagName === 'IMG' && el.closest('.hn-body')) setZoom((el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src) }}>
          <div className="hn-head"><NotificationOutlined /><b>{t('home.noticeTitle')}</b></div>
          {notice.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : notice.data?.length ? (
            <div className="hn-scroll">
              {notice.data.map((raw, i) => {
                const n = raw.translation && origOf.has(i) ? { ...raw, title: raw.origTitle ?? raw.title, html: raw.origHtml ?? raw.html } : raw
                return (
                <article key={`${n.createdAt}-${i}`} className={`hn-item${i === 0 ? ' first' : ''}`}>
                  <div className="hn-title">{n.title}</div>
                  <div className="hn-meta">
                    {n.type && <span className="org-chip ok">{trData(n.type)}</span>}
                    {raw.translation && (
                      <span className="hn-tr">
                        <span className="org-chip" title={t(raw.translation === 'ok' ? 'ctr.tagHrHint' : 'ctr.tagAiHint')}><TranslationOutlined /> {t(raw.translation === 'ok' ? 'ctr.tagHr' : 'ctr.tagAi')}</span>
                        <button type="button" className="hn-tr-btn" onClick={() => flip(i)}>{t(origOf.has(i) ? 'ctr.showTr' : 'ctr.showOrig')}</button>
                      </span>
                    )}
                    <span>{new Date(n.createdAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  {i === 0
                    ? <AnnouncementBody html={n.html} />
                    : <details><summary>{t('home.noticeRead')}</summary><AnnouncementBody html={n.html} /></details>}
                </article>
                )
              })}
            </div>
          ) : <Typography.Text type="secondary">{notice.isError ? t('home.noticeError') : t('home.noticeNone')}</Typography.Text>}
        </section>
        <BirthdayCard />
        {zoom && <Image style={{ display: 'none' }} src={zoom} alt="" preview={{ open: true, src: zoom, onOpenChange: (v) => { if (!v) setZoom(null) } }} />}
      </div>
      <div className="lp-bottom"><div className="lp-cal"><MonthCalendarCard compact /></div></div>
    </>
  )
}
