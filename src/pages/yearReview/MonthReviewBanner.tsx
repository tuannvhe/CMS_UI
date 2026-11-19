import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { monthReview } from '../../api/monthReview'
import { periodKey, seenPeriod } from './monthSeen'
import './yearReview.css'

/** Băng rôn "Tháng của tôi" ở trang chủ: kỳ mới chưa xem thì nổi bật kèm chữ MỚI, đã xem thì gọn lại. Lỗi hay chưa có dữ liệu thì không hiện. */
export function MonthReviewBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: ['month-review', 'me', 'latest'], queryFn: () => monthReview.mine(), retry: false, staleTime: 10 * 60_000 })
  const d = q.data
  if (!d || !Array.isArray(d.shelf)) return null
  const fresh = periodKey(d) > seenPeriod()
  const n = d.shelf.filter((s) => s.earned).length
  return (
    <button type="button" className={`yr-banner mr-banner${fresh ? ' fresh' : ''}`} onClick={() => navigate('/my-month')}>
      <span className="yr-banner-ic" aria-hidden>{fresh ? '📬' : '🏆'}</span>
      <span className="yr-banner-tx">
        {fresh && <em className="mr-new">{t('mr.isNew')}</em>}
        {fresh ? t('mr.bannerNew', { m: d.month, y: d.year }) : t('mr.banner', { m: d.month, y: d.year, n, total: d.shelf.length })}
      </span>
      <span className="yr-banner-go">{t('mr.open')}</span>
    </button>
  )
}
