import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { online } from '../api/online'

/** Cuối trang tổng quan: số người đang trực tuyến (hoạt động trong vài phút gần nhất). Tự cập nhật mỗi phút. */
export function OnlineCount() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['online'], queryFn: online.get, refetchInterval: 60_000, retry: false })
  if (!q.data) return null
  return (
    <div className="online-count" title={t('home.online.hint', { n: q.data.windowMinutes })}>
      <span className="oc-dot" />
      <span>{t('home.online.label')}: <b>{q.data.online}</b></span>
    </div>
  )
}
