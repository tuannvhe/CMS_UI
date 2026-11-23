import { Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { badges } from '../api/badges'
import { BADGE_ICON } from '../pages/yearReview/yearReviewCard'

/** Huy hiệu nhỏ cạnh tên (mã tài khoản hoặc mã nhân viên). Chưa có huy hiệu, đã ẩn hay lỗi thì không hiện gì. */
export function BadgeMark({ id }: { id?: string | null }) {
  const { t } = useTranslation()
  const key = (id ?? '').trim()
  const q = useQuery({ queryKey: ['badge', key.toUpperCase()], queryFn: () => badges.one(key), enabled: !!key, staleTime: 30 * 60_000, retry: false })
  const b = q.data
  if (!b) return null
  const name = `${t(`yr.badge.${b.key}`)} · ${t(`mr.tier.${b.level}`)}`
  const title = b.count > 1 ? t('badgePub.more', { name, n: b.count - 1 }) : name
  return (
    <Tooltip title={title}>
      <span className={`badge-mark lv${b.level}`} role="img" aria-label={title}>{BADGE_ICON[b.key] ?? '⭐'}</span>
    </Tooltip>
  )
}

/** Dãy huy hiệu công khai của một người (thẻ hồ sơ). */
export function BadgeRow({ id }: { id?: string | null }) {
  const { t } = useTranslation()
  const key = (id ?? '').trim()
  const q = useQuery({ queryKey: ['badge', 'person', key.toUpperCase()], queryFn: () => badges.person(key), enabled: !!key, staleTime: 30 * 60_000, retry: false })
  if (!q.data?.length) return null
  return (
    <div className="badge-row" aria-label={t('badgePub.rowTitle')}>
      {q.data.map((b) => <span key={b.key} className={`lv${b.level}`}><i aria-hidden>{BADGE_ICON[b.key] ?? '⭐'}</i>{t(`yr.badge.${b.key}`)} · {t(`mr.tier.${b.level}`)}</span>)}
    </div>
  )
}
