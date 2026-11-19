import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { yearReview } from '../../api/yearReview'
import './yearReview.css'

/** Băng rôn ở trang chủ: hiện khi "Năm của tôi" đang mở (hoặc quản trị đang xem trước). Lỗi hay máy chủ chưa có API thì không hiện gì. */
export function YearReviewBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const st = useQuery({ queryKey: ['year-review', 'status'], queryFn: yearReview.status, retry: false, staleTime: 10 * 60_000 })
  if (!st.data || (!st.data.open && !st.data.preview)) return null
  const year = st.data.year
  return (
    <button type="button" className="yr-banner" onClick={() => navigate('/year-review')}>
      <span className="yr-banner-ic" aria-hidden>🎉</span>
      <span className="yr-banner-tx">{st.data.open ? t('yr.banner', { year }) : t('yr.bannerPreview', { year })}</span>
      <span className="yr-banner-go">{t('yr.open')}</span>
    </button>
  )
}
