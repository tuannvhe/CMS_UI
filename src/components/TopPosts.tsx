import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Segmented, Skeleton, Typography } from 'antd'
import { CommentOutlined, EyeOutlined, FireOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { feed } from '../api/feed'
import { threadTitle } from '../pages/feed/ForumParts'
import { UserAvatar } from './UserAvatar'

/** Trang chủ: top 15 bài viết ở Cộng đồng, đặt cạnh lịch làm / nghỉ. Hai tab: nhiều lượt xem nhất / có hoạt động mới nhất. */
export function TopPosts() {
  const { t } = useTranslation()
  const [by, setBy] = useState<'views' | 'active'>('views')
  const q = useQuery({ queryKey: ['feed', 'top', by], queryFn: () => feed.top(by), staleTime: 2 * 60 * 1000, retry: false })
  const rows = q.data?.rows ?? []
  return (
    <section className="top-posts">
      <header className="tp-head">
        <div className="tp-title"><FireOutlined /><b>{t('home.top.title')}</b></div>
        <Segmented size="small" value={by} onChange={(v) => setBy(v as 'views' | 'active')}
          options={[{ value: 'views', label: t('home.top.views') }, { value: 'active', label: t('home.top.active') }]} />
      </header>
      {q.isLoading ? <Skeleton active paragraph={{ rows: 8 }} title={false} /> : rows.length === 0
        ? <Typography.Text type="secondary">{q.isError || q.data?.ready === false ? t('home.top.error') : t('home.top.empty')}</Typography.Text> : (
          <ol className="tp-list">
            {rows.map((p, i) => (
              <li key={p.id}>
                <span className={`tp-rank${i < 3 ? ' top' : ''}`}>{i + 1}</span>
                <UserAvatar name={p.authorName} src={p.avatarUrl} size={30} />
                <div className="tp-main">
                  <Link to={`/feed/post/${p.id}`} className="tp-link" title={threadTitle(p)}>{threadTitle(p)}</Link>
                  <div className="tp-meta">{[p.topicName, p.authorName].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="tp-num" title={t('forum.views')}><EyeOutlined /> {p.views ?? 0}</span>
                <span className="tp-num" title={t('forum.replies')}><CommentOutlined /> {p.commentCount}</span>
              </li>
            ))}
          </ol>
        )}
    </section>
  )
}
