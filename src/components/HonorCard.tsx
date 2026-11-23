import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { badges } from '../api/badges'
import { BADGE_ICON } from '../pages/yearReview/yearReviewCard'
import { AppModal } from './AppModal'
import { UserAvatar } from './UserAvatar'

/** Bảng vinh danh trang chủ: những người vừa mở khóa huy hiệu ở kỳ chốt công mới nhất. Không xếp hạng; chưa có ai thì không hiện. */
export function HonorCard() {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['badges', 'honor'], queryFn: badges.honor, staleTime: 30 * 60_000, retry: false })
  const h = q.data
  if (!h || !Array.isArray(h.groups) || h.people === 0) return null
  const faces = h.groups.flatMap((g) => g.people).filter((p, i, a) => a.findIndex((x) => x.employeeId === p.employeeId) === i).slice(0, 6)
  const group = h.groups.find((g) => g.key === open)
  return (
    <section className="home-honor">
      <div className="hn-head"><span aria-hidden>🏆</span><b>{t('badgePub.honorTitle', { m: h.month, y: h.year })}</b></div>
      <p className="ho-sub">{t('badgePub.honorSub', { n: h.people })}</p>
      <div className="ho-faces">{faces.map((p) => <UserAvatar key={p.employeeId} name={p.name} src={p.avatarUrl} size={34} preview={false} />)}</div>
      <div className="ho-groups">
        {h.groups.map((g) => (
          <button key={g.key} type="button" className="ho-group" onClick={() => setOpen(g.key)}>
            <i aria-hidden>{BADGE_ICON[g.key] ?? '⭐'}</i>
            <span>{t(`yr.badge.${g.key}`)}</span>
            <b>{g.count}</b>
          </button>
        ))}
      </div>
      <Link to="/my-month" className="ho-mine">{t('badgePub.mine')}</Link>
      <AppModal open={!!group} onClose={() => setOpen(null)} size="sm"
        title={group ? `${BADGE_ICON[group.key] ?? '⭐'} ${t(`yr.badge.${group.key}`)} · ${t('mr.period', { m: h.month, y: h.year })}` : ''}>
        {group && (
          <>
            <p className="ho-sub">{t(`mr.shelfDesc.${group.key}`)}</p>
            <ul className="ho-list">
              {group.people.map((p) => (
                <li key={p.employeeId}><UserAvatar name={p.name} src={p.avatarUrl} size={32} preview={false} /><div><b>{p.name}</b><span>{p.department ?? ''}</span></div><em className={`mr-tier lv${p.level}`}>{t(`mr.tier.${p.level}`)}</em></li>
              ))}
            </ul>
            {group.count > group.people.length && <p className="ho-sub">{t('badgePub.andMore', { n: group.count - group.people.length })}</p>}
          </>
        )}
      </AppModal>
    </section>
  )
}
