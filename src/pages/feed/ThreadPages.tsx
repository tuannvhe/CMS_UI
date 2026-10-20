import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Dropdown, Empty, Select, Skeleton } from 'antd'
import type { MenuProps } from 'antd'
import { ArrowLeftOutlined, CommentOutlined, HomeOutlined, MessageOutlined, MoreOutlined, PushpinOutlined, RightOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { feed, feedError } from '../../api/feed'
import { useAuth } from '../../auth/AuthContext'
import { PageBanner } from '../../components/PageBanner'
import { PersonProvider } from './PersonCard'
import { useToast } from '../../hooks/useToast'
import { FeedAside, PostCard } from './FeedPage'
import { NewThreadFab, ThreadList, threadTitle } from './ForumParts'

/** Đường dẫn trang (Cộng đồng › Chủ đề › Bài): mỗi mục trước là nút bấm được, mục cuối là trang hiện tại. */
function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="forum-crumbs" aria-label="breadcrumb">
      <HomeOutlined className="fc-home" />
      {items.map((x, i) => (
        <span key={i} className="fc-item">
          {i > 0 && <RightOutlined className="fc-sep" />}
          {x.to ? <Link to={x.to} className="fc-link">{x.label}</Link> : <span className="fc-current" title={x.label}>{x.label}</span>}
        </span>
      ))}
    </nav>
  )
}

/** Trang một chủ đề: các bài trong chủ đề (bài ghim lên đầu) và nút tạo bài mới vào chủ đề này. */
export function TopicPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const nav = useNavigate()
  const { id } = useParams()
  const topicId = Number(id)
  const info = useQuery({ queryKey: ['feed', 'threads', topicId, 'active', 1], queryFn: () => feed.threads({ topicId, sort: 'active', page: 1 }), retry: false })
  const topic = info.data?.topic
  useEffect(() => { window.scrollTo({ top: 0 }) }, [topicId])
  if (!Number.isFinite(topicId)) return <Empty description={t('feed.err.notFound')} />
  if (info.isError) return <div className="page page-wide"><Empty description={t('feed.err.notFound')}><Link to="/feed">{t('forum.backHome')}</Link></Empty></div>
  return (
    <div className="page page-wide">
      <PageBanner avatar={<MessageOutlined />} title={topic?.name ?? '…'} subtitle={topic?.description} />
      <Crumbs items={[{ label: t('forum.title'), to: '/feed' }, ...(topic?.group ? [{ label: topic.group, to: '/feed?tab=topics' }] : []), { label: topic?.name ?? '…' }]} />
      <div className="thread-sub"><Button icon={<ArrowLeftOutlined />} onClick={() => nav('/feed?tab=topics')}>{t('forum.back')}</Button></div>
      <div className="forum-layout">
        <div className="forum-main"><ThreadList topicId={topicId} header={topic?.name} /></div>
        <FeedAside admin={!!user?.isAdmin} modCount={0} />
      </div>
      <NewThreadFab topicId={topicId} />
    </div>
  )
}

/** Trang một bài viết: nội dung bài, cảm xúc và toàn bộ trả lời; quản trị có thể ghim hoặc chuyển chủ đề. */
export function ThreadPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const nav = useNavigate()
  const { id } = useParams()
  const postId = Number(id)
  const admin = !!user?.isAdmin
  const q = useQuery({ queryKey: ['feed', 'thread', postId], queryFn: () => feed.thread(postId), retry: false, enabled: Number.isFinite(postId) })
  const topics = useQuery({ queryKey: ['feed', 'topics'], queryFn: feed.topics, enabled: admin, staleTime: 60_000 })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['feed'] }) }
  const err = (e: unknown) => toast.error(feedError(e).code === 'not_found' ? t('feed.err.notFound') : t('feed.err.generic'))
  const pin = useMutation({ mutationFn: (pinned: boolean) => feed.pin(postId, pinned), onSuccess: refresh, onError: err })
  const move = useMutation({ mutationFn: (topicId: number) => feed.movePost(postId, topicId), onSuccess: () => { toast.success(t('forum.moved')); refresh() }, onError: err })
  useEffect(() => { window.scrollTo({ top: 0 }); if (Number.isFinite(postId)) feed.view(postId).catch(() => undefined) }, [postId])

  const p = q.data
  if (q.isError) return <div className="page page-wide"><Empty description={t('feed.err.notFound')}><Link to="/feed">{t('forum.backHome')}</Link></Empty></div>
  if (!p) return <div className="page page-wide"><Skeleton active avatar paragraph={{ rows: 6 }} /></div>
  const menu: MenuProps['items'] = [
    { key: 'pin', icon: <PushpinOutlined />, label: p.pinned ? t('forum.unpin') : t('forum.pin'), onClick: () => pin.mutate(!p.pinned) },
  ]
  return (
    <PersonProvider><div className="page page-wide">
      <PageBanner avatar={<CommentOutlined />} title={threadTitle(p)} subtitle={`${p.topicName ?? ''}${p.topicName ? ' · ' : ''}${t('forum.viewsN', { n: p.views ?? 0 })} · ${t('forum.repliesN', { n: p.commentCount })}`} />
      <Crumbs items={[{ label: t('forum.title'), to: '/feed' }, ...(p.topicId ? [{ label: p.topicName ?? '', to: `/feed/topic/${p.topicId}` }] : []), { label: threadTitle(p) }]} />
      <div className="forum-layout">
        <div className="forum-main">
          <div className="thread-sub">
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav(p.topicId ? `/feed/topic/${p.topicId}` : '/feed')}>{t('forum.back')}</Button>
            {admin && (
              <span className="thread-admin">
                <Select size="small" style={{ minWidth: 200 }} placeholder={t('forum.moveTo')} value={p.topicId ?? undefined} loading={move.isPending}
                  options={(topics.data?.topics ?? []).map((x) => ({ value: x.id, label: x.group ? `${x.group} › ${x.name}` : x.name }))} onChange={(v) => move.mutate(v)} />
                <Dropdown menu={{ items: menu }} trigger={['click']}><Button size="small" icon={<MoreOutlined />} /></Dropdown>
              </span>
            )}
          </div>
          <PostCard post={p} admin={admin} onChanged={refresh} defaultOpen hideTitle />
        </div>
        <FeedAside admin={admin} modCount={0} />
      </div>
      <NewThreadFab topicId={p.topicId ?? undefined} />
    </div></PersonProvider>
  )
}

