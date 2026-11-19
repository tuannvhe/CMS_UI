import { useEffect, useState } from 'react'
import { Badge, Empty, Popover, Spin, Tooltip } from 'antd'
import { BellOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { hnApi, type HnNotification, type HnNotificationList } from '../api/hn'
import { useAuth } from '../auth/AuthContext'

const POLL_MS = 60_000

/** Chỉ cho mở đường dẫn nội bộ của cơ sở HN (/hn, /hn/...): chặn link ngoài, //host, scheme, "..". */
export function safeHnLink(link: string | null | undefined): string | null {
  if (!link) return null
  const s = link.trim()
  if (!/^\/hn(?:[/?#][A-Za-z0-9_\-./?=&%#:+]*)?$/.test(s) || s.includes('..') || s.includes('//')) return null
  return s
}

function ago(iso: string, t: (k: string, o?: Record<string, unknown>) => string) {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 60) return t('notif.justNow')
  if (s < 3600) return t('notif.minutes', { n: Math.floor(s / 60) })
  if (s < 86400) return t('notif.hours', { n: Math.floor(s / 3600) })
  return t('notif.days', { n: Math.floor(s / 86400) })
}

/**
 * Chuông thông báo của cơ sở HN (cùng kiểu NotificationBell của VINA). Backend HN chỉ có polling nên hỏi lại mỗi 60 giây khi tab đang hiện
 * (và khi quay lại tab); không dùng SignalR. Bấm một mục: đánh dấu đã đọc, rồi mở link nếu là đường dẫn /hn/... hợp lệ.
 */
export function HnNotificationBell({ className = 'rail-btn', placement = 'rightTop', tipPlacement = 'right' }: { className?: string; placement?: 'rightTop' | 'bottomRight'; tipPlacement?: 'right' | 'bottom' } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const uid = useAuth().user?.userId
  const [open, setOpen] = useState(false)
  const key = ['hn', 'notifications', uid] as const
  const q = useQuery({ queryKey: key, queryFn: () => hnApi.notifications(30), enabled: !!uid, staleTime: 30_000, retry: false, refetchOnWindowFocus: true })
  const refetch = q.refetch

  useEffect(() => {
    if (!uid) return
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void refetch() }, POLL_MS)
    return () => window.clearInterval(id)
  }, [uid, refetch])

  const items = q.data?.items ?? []
  const unread = q.data?.unread ?? 0

  const openItem = async (n: HnNotification) => {
    setOpen(false)
    if (!n.read) {
      qc.setQueryData<HnNotificationList>(key, (old) => old ? { items: old.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unread: Math.max(0, old.unread - 1) } : old)
      try { await hnApi.markRead(n.id) } catch { /* 404 / lỗi mạng: tải lại bên dưới để hiện đúng trạng thái thật */ }
      void qc.invalidateQueries({ queryKey: key })
    }
    const to = safeHnLink(n.link)
    if (to) navigate(to)
  }

  const content = (
    <div className="notif-pop">
      <div className="notif-head"><strong>{t('common.notifications')}</strong></div>
      <div className="notif-list">
        {q.isLoading ? <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
          : q.isError && items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.bell.refreshFail')} />
          : items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noNotifications')} />
          : items.map((n) => (
            <button key={n.id} type="button" className={`notif-row${n.read ? '' : ' unread'}`} data-kind={n.type} aria-label={t('hn.bell.open')} onClick={() => void openItem(n)}>
              <span className="notif-ico" style={{ background: '#64748b' }}><TeamOutlined /></span>
              <span className="notif-txt">
                <b>{n.title}</b>
                <span>{n.description}</span>
                <em style={{ color: n.read ? 'var(--c-muted)' : '#64748b' }}>{ago(n.timestamp, t)}</em>
              </span>
              {!n.read && <span className="notif-dot" aria-hidden />}
            </button>
          ))}
      </div>
    </div>
  )

  return (
    <Popover trigger="click" placement={placement} open={open} onOpenChange={setOpen} content={content} styles={{ container: { padding: 0 } }} arrow={false}>
      <span>
        <Tooltip title={t('common.notifications')} placement={tipPlacement} mouseEnterDelay={0.3}>
          <button type="button" aria-label={t('common.notifications')} className={className}>
            <Badge count={unread} size="small" overflowCount={99} offset={[4, -2]}><BellOutlined style={{ fontSize: 'inherit', color: 'inherit' }} /></Badge>
          </button>
        </Tooltip>
      </span>
    </Popover>
  )
}
