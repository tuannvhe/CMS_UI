import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Empty, Pagination, Segmented, Skeleton } from 'antd'
import { EditOutlined, PushpinFilled, RightOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { feed, FEED_REFRESH_MS, FEED_TABLE_SQL, type FeedPost } from '../../api/feed'
import { AppModal } from '../../components/AppModal'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useAuth } from '../../auth/AuthContext'
import { UserAvatar } from '../../components/UserAvatar'
import { fmtTime, ThreadComposer, useTimeAgo, WhoLine } from './FeedPage'

/** Tiêu đề hiển thị của bài: tiêu đề nếu có, bài cũ (chưa có tiêu đề) lấy dòng đầu của nội dung. */
export const threadTitle = (p: FeedPost) => (p.title?.trim() || p.body.split('\n')[0] || '…').slice(0, 150)

/** Một dòng bài viết kiểu voz: tiêu đề + người đăng ở bên trái; số trả lời, lượt xem và lần trả lời cuối ở bên phải. */
export function ThreadRow({ post, showTopic }: { post: FeedPost; showTopic?: boolean }) {
  const { t } = useTranslation()
  const ago = useTimeAgo()
  const nav = useNavigate()
  const last = post.lastActivity ?? post.createdAt
  return (
    <div className={`thread-row${post.pinned ? ' pinned' : ''}`} onClick={(e) => { if (!(e.target as HTMLElement).closest('a')) nav(`/feed/post/${post.id}`) }}>
      <UserAvatar name={post.authorName} src={post.avatarUrl} size={40} />
      <div className="tr-main">
        <Link to={`/feed/post/${post.id}`} className="tr-title">
          {post.pinned && <PushpinFilled className="tr-pin" title={t('forum.pinned')} />}
          {threadTitle(post)}
        </Link>
        <div className="tr-meta">
          {showTopic && post.topicName && post.topicId && <Link to={`/feed/topic/${post.topicId}`} className="tr-topic">{post.topicName}</Link>}
          <b>{post.authorName}</b>
          <WhoLine id={post.authorId} dept={post.department} />
          <span title={fmtTime(post.createdAt)}>· {ago(post.createdAt)}</span>
        </div>
      </div>
      <div className="tr-stat"><b>{post.commentCount}</b><span>{t('forum.replies')}</span></div>
      <div className="tr-stat"><b>{post.views ?? 0}</b><span>{t('forum.views')}</span></div>
      <div className="tr-last" title={fmtTime(last)}>{ago(last)}<RightOutlined className="tr-go" /></div>
    </div>
  )
}

/** Hộp soạn bài (chọn chủ đề, tiêu đề, nội dung, ảnh / video) mở từ mọi nút "Tạo bài viết". */
function ComposeModal({ open, onClose, topicId }: { open: boolean; onClose: () => void; topicId?: number }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const qc = useQueryClient()
  const topics = useQuery({ queryKey: ['feed', 'topics'], queryFn: feed.topics, enabled: open, staleTime: 60_000 })
  return (
    <AppModal open={open} onClose={onClose} size="lg" icon={<EditOutlined />} title={t('forum.newThread')} subtitle={t('forum.newThreadHint')} footer={null}>
      {open && (
        <ThreadComposer topicId={topicId} topics={(topics.data?.topics ?? []).filter((x) => x.active).map((x) => ({ id: x.id, name: x.name, group: x.group }))}
          onPosted={(id) => { onClose(); qc.invalidateQueries({ queryKey: ['feed'] }); nav(`/feed/post/${id}`) }} />
      )}
    </AppModal>
  )
}

/** Nút nổi cố định ở góc phải dưới: luôn thấy, ở mọi trang của Cộng đồng. */
export function NewThreadFab({ topicId }: { topicId?: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="forum-fab" onClick={() => setOpen(true)} aria-label={t('forum.newThread')}><EditOutlined /><span>{t('forum.newThread')}</span></button>
      <ComposeModal open={open} onClose={() => setOpen(false)} topicId={topicId} />
    </>
  )
}

/** Thẻ mời đăng bài ở đầu danh sách (như ô "Bạn đang nghĩ gì?"): bấm vào đâu trên thẻ cũng mở hộp soạn bài. */
export function ComposePrompt({ topicId }: { topicId?: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="compose-prompt" role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(true) }}>
        <UserAvatar name={user?.fullName} src={user?.avatarUrl} size={42} />
        <span className="cp-text">{t('forum.promptText', { name: user?.fullName?.split(' ').slice(-1)[0] ?? '' })}</span>
        <Button type="primary" icon={<EditOutlined />}>{t('forum.newThread')}</Button>
      </div>
      <ComposeModal open={open} onClose={() => setOpen(false)} topicId={topicId} />
    </>
  )
}

/** Danh sách bài theo trang (newsfeed khi không có topicId). Mỗi 10 phút tự tải lại khi còn ở trang. */
export function ThreadList({ topicId, header }: { topicId?: number; header?: ReactNode }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<'new' | 'active'>(topicId ? 'active' : 'new')
  const q = useQuery({ queryKey: ['feed', 'threads', topicId ?? 0, sort, page], queryFn: () => feed.threads({ topicId, sort, page }), retry: false, refetchInterval: FEED_REFRESH_MS, placeholderData: (p) => p })
  const d = q.data
  if (q.isError) return <Empty description={t('feed.err.generic')} />
  if (d && !d.ready) return <SqlNotReady title={t('feed.notReady')} sql={FEED_TABLE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} />
  return (
    <>
    <ComposePrompt topicId={topicId} />
    <section className="thread-list">
      <div className="tl-head">
        <div className="tl-title">{header}</div>
        <Segmented size="small" value={sort} onChange={(v) => { setSort(v as 'new' | 'active'); setPage(1) }}
          options={[{ value: 'new', label: t('forum.sortNew') }, { value: 'active', label: t('forum.sortActive') }]} />
      </div>
      <div className="tl-cols"><span>{t('forum.thread')}</span><span>{t('forum.replies')}</span><span>{t('forum.views')}</span><span>{t('forum.lastActivity')}</span></div>
      {!d ? <Skeleton active paragraph={{ rows: 6 }} /> : d.rows.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('forum.noThreads')} /> : d.rows.map((p) => <ThreadRow key={p.id} post={p} showTopic={!topicId} />)}
      {d && d.total > d.pageSize && (
        <div className="tl-pager"><Pagination current={d.page} pageSize={d.pageSize} total={d.total} showSizeChanger={false} onChange={setPage} /></div>
      )}
    </section>
    </>
  )
}
