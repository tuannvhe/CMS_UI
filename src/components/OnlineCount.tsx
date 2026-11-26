import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { online } from '../api/online'
import { hnApi } from '../api/hn'

/** Cuối trang tổng quan: số người đang trực tuyến (hoạt động trong vài phút gần nhất). Tự cập nhật mỗi phút. */
/* 2026-11-26 [Truong] - hn: HN sessions are counted separately (/api/hn/home/online) */
export function OnlineCount({ hn = false }: { hn?: boolean }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: hn ? ['hn', 'online'] : ['online'], queryFn: hn ? hnApi.homeOnline : online.get, refetchInterval: 60_000, retry: false })
  if (!q.data) return null
  return (
    <div className="online-count" title={t('home.online.hint', { n: q.data.windowMinutes })}>
      <span className="oc-dot" />
      <span>{t('home.online.label')}: <b>{q.data.online}</b></span>
    </div>
  )
}
