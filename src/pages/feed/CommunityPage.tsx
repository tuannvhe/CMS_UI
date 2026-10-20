import { useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Empty, Skeleton } from 'antd'
import { MessageOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { feed, FEED_REFRESH_MS, FEED_TABLE_SQL, type FeedTopic } from '../../api/feed'
import { useAuth } from '../../auth/AuthContext'
import { PersonProvider } from './PersonCard'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { UserAvatar } from '../../components/UserAvatar'
import { FeedAside, fmtTime, useTimeAgo } from './FeedPage'
import { NewThreadFab, ThreadList } from './ForumParts'

/** Danh sách chủ đề gom theo nhóm (như các box của voz): tên, mô tả, số bài, số trả lời và bài hoạt động gần nhất. */
export function TopicList({ topics }: { topics: FeedTopic[] }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const ago = useTimeAgo()
  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, FeedTopic[]>()
    for (const x of topics) {
      const g = x.group ?? ''
      if (!map.has(g)) { map.set(g, []); order.push(g) }
      map.get(g)!.push(x)
    }
    return order.map((g) => ({ group: g, items: map.get(g)! }))
  }, [topics])
  if (topics.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('forum.noTopics')} />
  return (
    <div className="topic-groups">
      {groups.map(({ group, items }) => (
        <section key={group} className="topic-group">
          <h2 className="tg-title">{group || t('forum.otherGroup')}</h2>
          {items.map((x) => (
            <div key={x.id} className={`topic-row${x.active ? '' : ' off'}`} onClick={(e) => { if (!(e.target as HTMLElement).closest('a')) nav(`/feed/topic/${x.id}`) }}>
              <div className="tpc-ic"><MessageOutlined /></div>
              <div className="tpc-main">
                <Link to={`/feed/topic/${x.id}`} className="tpc-name">{x.name}<RightOutlined className="tpc-go" /></Link>
                {x.description && <div className="tpc-desc">{x.description}</div>}
              </div>
              <div className="tpc-stat"><b>{x.threads}</b><span>{t('forum.threads')}</span></div>
              <div className="tpc-stat"><b>{x.replies}</b><span>{t('forum.replies')}</span></div>
              <div className="tpc-last">
                {x.last ? (
                  <>
                    <UserAvatar name={x.last.authorName} src={x.last.avatarUrl} size={28} />
                    <div>
                      <Link to={`/feed/post/${x.last.id}`} className="tpc-last-title">{x.last.title.split('\n')[0].slice(0, 60)}</Link>
                      <div className="tpc-last-meta"><b>{x.last.authorName}</b> · <span title={fmtTime(x.last.at)}>{ago(x.last.at)}</span></div>
                    </div>
                  </>
                ) : <span className="tpc-last-meta">{t('forum.noThreadsShort')}</span>}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** Cộng đồng (diễn đàn): "Newsfeed" là các bài viết mới nhất của mọi chủ đề, "Chủ đề" là danh sách chủ đề; vào chủ đề để xem các bài, vào bài để xem trả lời. */
export default function CommunityPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const legacy = params.get('post')
  const tab = params.get('tab') === 'topics' ? 'topics' : 'newsfeed'
  const topics = useQuery({ queryKey: ['feed', 'topics'], queryFn: feed.topics, retry: false, refetchInterval: FEED_REFRESH_MS })
  const pending = useQuery({ queryKey: ['feed', 'queue'], queryFn: feed.queue, enabled: !!user?.isAdmin, retry: false, refetchInterval: FEED_REFRESH_MS })
  const modCount = (pending.data?.pendingPosts.length ?? 0) + (pending.data?.pendingComments.length ?? 0) + (pending.data?.reportedPosts.length ?? 0) + (pending.data?.reportedComments.length ?? 0)
  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])

  if (legacy && /^\d+$/.test(legacy)) return <Navigate to={`/feed/post/${legacy}`} replace />   // đường dẫn cũ từ thông báo: /feed?post=ID

  const header = <PageBanner avatar={<TeamOutlined />} title={t('forum.title')} subtitle={t('forum.subtitle')} />
  return (
    <PersonProvider><div className="page page-wide">
      {header}
      <div className="forum-layout">
        <div className="forum-main">
          <h3 className="forum-sec">{t('forum.topics')}</h3>
          {topics.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : topics.isError ? <Empty description={t('feed.err.generic')} /> : topics.data && topics.data.topics.length === 0
            ? <SqlNotReady title={t('feed.notReady')} sql={FEED_TABLE_SQL} onRetry={() => topics.refetch()} loading={topics.isFetching} />
            : <TopicList topics={topics.data?.topics ?? []} />}
          <h3 className="forum-sec">{t('forum.latest')}</h3>
          <ThreadList header={t('forum.latest')} />
        </div>
        <FeedAside admin={!!user?.isAdmin} modCount={modCount} />
      </div>
      <NewThreadFab />
    </div></PersonProvider>
  )
}
