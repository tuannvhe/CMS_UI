import { useState } from 'react'
import { Badge, Button, Empty, Popover, Spin, Tooltip } from 'antd'
import { AuditOutlined, BellOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined, SendOutlined, TeamOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Notice } from '../api/notifications'
import { useMarkNotificationsRead, useNotifications } from '../hooks/useNotifications'

const PAGE = 30
const MAX_TAKE = 500

const KIND_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  approval: { icon: <FileTextOutlined />, color: '#1677ff' },
  approved: { icon: <CheckCircleOutlined />, color: '#2E9E4F' },
  rejected: { icon: <CloseCircleOutlined />, color: '#D92D20' },
  evaluation: { icon: <AuditOutlined />, color: '#6D5BD0' },
  sent: { icon: <SendOutlined />, color: '#0EA5E9' },
  birthday: { icon: <span aria-hidden>🎂</span>, color: '#D6336C' },
}

function ago(iso: string, t: (k: string, o?: Record<string, unknown>) => string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return t('notif.justNow')
  if (s < 3600) return t('notif.minutes', { n: Math.floor(s / 60) })
  if (s < 86400) return t('notif.hours', { n: Math.floor(s / 3600) })
  return t('notif.days', { n: Math.floor(s / 86400) })
}

function Row({ n, onOpen }: { n: Notice; onOpen: (n: Notice) => void }) {
  const { t } = useTranslation()
  const k = KIND_ICON[n.kind] ?? { icon: <TeamOutlined />, color: '#64748b' }
  return (
    <button type="button" className={`notif-row${n.read ? '' : ' unread'}`} data-kind={n.kind} onClick={() => onOpen(n)}>
      <span className="notif-ico" style={{ background: k.color }}>{k.icon}</span>
      <span className="notif-txt">
        <b>{n.title}</b>
        <span>{n.body}</span>
        <em style={{ color: n.read ? 'var(--c-muted)' : k.color }}>{ago(n.at, t)}</em>
      </span>
      {!n.read && <span className="notif-dot" aria-hidden />}
    </button>
  )
}

/** Chuông thông báo kiểu Facebook: chấm xanh = chưa đọc, bấm vào để mở đúng màn xử lý và tự đánh dấu đã đọc. */
export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [take, setTake] = useState(PAGE)
  const q = useNotifications(take)
  const markRead = useMarkNotificationsRead()
  const items = q.data?.items ?? []
  const unread = q.data?.unread ?? 0

  // Cuộn gần cuối danh sách thì tải thêm (như Facebook); hết dữ liệu khi số dòng trả về ít hơn số đã yêu cầu.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && !q.isFetching && items.length >= take && take < MAX_TAKE) setTake((v) => v + PAGE)
  }

  const openNotice = (n: Notice) => {
    if (!n.read) void markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const content = (
    <div className="notif-pop">
      <div className="notif-head">
        <strong>{t('common.notifications')}</strong>
        <Button type="link" size="small" disabled={unread === 0} onClick={() => void markRead()}>{t('notif.markAll')}</Button>
      </div>
      <div className="notif-list" onScroll={onScroll}>
        {q.isLoading ? <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
          : items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noNotifications')} />
          : <>{items.map((n) => <Row key={n.id} n={n} onOpen={openNotice} />)}
              {q.isFetching && items.length >= take && <div style={{ padding: 10, textAlign: 'center' }}><Spin size="small" /></div>}</>}
      </div>
    </div>
  )

  return (
    <Popover trigger="click" placement="rightTop" open={open} onOpenChange={setOpen} content={content} styles={{ container: { padding: 0 } }} arrow={false}>
      <span>
        <Tooltip title={t('common.notifications')} placement="right" mouseEnterDelay={0.3}>
          <button type="button" aria-label={t('common.notifications')} className="rail-btn">
            <Badge count={unread} size="small" overflowCount={99} offset={[4, -2]}><BellOutlined style={{ fontSize: 'inherit', color: 'inherit' }} /></Badge>
          </button>
        </Tooltip>
      </span>
    </Popover>
  )
}
