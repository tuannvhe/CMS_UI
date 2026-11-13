import { useState } from 'react'
import { Image, Skeleton, Typography } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { announcements } from '../../api/announcements'
import { AnnouncementBody } from '../AnnouncementBody'
import { BirthdayCard } from '../BirthdayCard'
import { MonthCalendarCard } from '../MonthCalendarCard'

/**
 * Đầu tab Tổng quan, ngay dưới banner (giữ bố cục cũ): Thông báo (bản mới nhất mở sẵn, các bản sau bấm "Xem nội dung") + Sinh nhật,
 * hàng dưới là Lịch đi làm / nghỉ. Phần giới thiệu công ty nằm bên dưới (LandingSections).
 */
export function HomeInternal() {
  const { t, i18n } = useTranslation()
  const [zoom, setZoom] = useState<string | null>(null)   // ảnh trong thông báo đang xem phóng to
  const notice = useQuery({ queryKey: ['announcements'], queryFn: () => announcements.recent(5), staleTime: 5 * 60 * 1000, retry: false })
  return (
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
    </>
  )
}
