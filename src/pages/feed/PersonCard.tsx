import { createContext, useContext, useState, type ReactNode } from 'react'
import { Skeleton } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { feed } from '../../api/feed'
import { AppModal } from '../../components/AppModal'
import { UserAvatar } from '../../components/UserAvatar'

const Ctx = createContext<(id: string) => void>(() => undefined)

/** Bấm vào tên / ảnh của một người trong Cộng đồng thì mở hồ sơ ngắn (ảnh, tên, mã nhân viên, bộ phận, số bài, bình luận, cảm xúc). */
export function PersonProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null)
  return <Ctx.Provider value={setId}>{children}<PersonModal id={id} onClose={() => setId(null)} /></Ctx.Provider>
}

/** Bao quanh tên / ảnh: bấm để xem hồ sơ người đó. */
export function PersonLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const open = useContext(Ctx)
  return <span role="button" tabIndex={0} className={`person-link${className ? ' ' + className : ''}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(id.trim()) }}
    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); open(id.trim()) } }}>{children}</span>
}

function PersonModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['feed', 'person', id], queryFn: () => feed.person(id!), enabled: !!id, retry: false, staleTime: 60_000 })
  const p = q.data
  return (
    <AppModal open={!!id} onClose={onClose} title={t('forum.person.title')} size="sm">
      {q.isLoading ? <Skeleton active avatar paragraph={{ rows: 3 }} /> : q.isError || !p ? <div>{t('feed.err.generic')}</div> : (
        <div className="person-card">
          <UserAvatar name={p.name} src={p.avatarUrl} size={84} />
          <h3>{p.name}</h3>
          <div className="pc-sub">{p.userId}{p.department ? ` · ${p.department}` : ''}</div>
          {p.position && <div className="pc-sub">{p.position}</div>}
          <div className="pc-stats">
            <div><b>{p.posts}</b><span>{t('forum.person.posts')}</span></div>
            <div><b>{p.comments}</b><span>{t('forum.person.comments')}</span></div>
            <div><b>{p.reactionsReceived}</b><span>{t('forum.person.received')}</span></div>
            <div><b>{p.reactionsGiven}</b><span>{t('forum.person.given')}</span></div>
          </div>
        </div>
      )}
    </AppModal>
  )
}
