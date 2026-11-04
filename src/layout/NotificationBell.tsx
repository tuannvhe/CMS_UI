import { useEffect, useState } from 'react'
import { Badge, Button, Empty, Modal, Popover, Spin, Tooltip } from 'antd'
import { AuditOutlined, BellOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined, SendOutlined, TeamOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Notice } from '../api/notifications'
import { useMarkNotificationsRead, useNotifications } from '../hooks/useNotifications'
import { fireBirthdayBurst } from '../components/birthdayBurst'
import { playBirthdaySong, stopBirthdaySong } from '../components/birthdaySong'
import { useAuth } from '../auth/AuthContext'

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

// Đã tự mở lời chúc sinh nhật trong ngày cho tài khoản này chưa (lưu trên trình duyệt; không đọc được bộ nhớ thì nhớ tạm trong phiên).
const autoShown = new Set<string>()
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
function claimAutoShow(uid: string) {
  const k = `cms.bdAuto:${uid}:${dayKey(new Date())}`
  if (autoShown.has(k)) return false
  autoShown.add(k)
  try { if (localStorage.getItem(k)) return false; localStorage.setItem(k, '1') } catch { /* chế độ riêng tư: chỉ nhớ trong phiên */ }
  return true
}

// Bấm bằng bàn phím (Enter) không có toạ độ chuột: để pháo hoa phụt từ giữa cạnh dưới màn hình.
const at = (e: React.MouseEvent) => (e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : undefined)

function Row({ n, onOpen }: { n: Notice; onOpen: (n: Notice, e: React.MouseEvent) => void }) {
  const { t } = useTranslation()
  const k = KIND_ICON[n.kind] ?? { icon: <TeamOutlined />, color: '#64748b' }
  return (
    <button type="button" className={`notif-row${n.read ? '' : ' unread'}`} data-kind={n.kind} onClick={(e) => onOpen(n, e)}>
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

/**
 * Chuông thông báo kiểu Facebook: chấm xanh = chưa đọc, bấm vào để mở đúng màn xử lý và tự đánh dấu đã đọc.
 * Riêng lời chúc sinh nhật: bấm vào thì bắn pháo hoa, phát nhạc Happy Birthday và mở hộp thoại hiện đủ lời chúc (đóng thì tắt nhạc).
 * Đúng ngày sinh nhật, lần đầu vào hệ thống trong ngày thì tự mở lời chúc; các lần sau mở qua chuông.
 */
export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [wish, setWish] = useState<Notice | null>(null)
  const [take, setTake] = useState(PAGE)
  const q = useNotifications(take)
  const markRead = useMarkNotificationsRead()
  const items = q.data?.items ?? []
  const unread = q.data?.unread ?? 0
  const uid = useAuth().user?.userId

  // Lời chúc sinh nhật gửi hôm nay: tự mở một lần trong ngày.
  const todayWish = items.find((n) => n.kind === 'birthday' && dayKey(new Date(n.at)) === dayKey(new Date()))
  useEffect(() => {
    if (!uid || !todayWish || !claimAutoShow(uid)) return
    if (!todayWish.read) void markRead(todayWish.id)
    setWish(todayWish)
    fireBirthdayBurst()
    playBirthdaySong()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi có lời chúc hôm nay lần đầu
  }, [uid, todayWish?.id])

  // Cuộn gần cuối danh sách thì tải thêm (như Facebook); hết dữ liệu khi số dòng trả về ít hơn số đã yêu cầu.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && !q.isFetching && items.length >= take && take < MAX_TAKE) setTake((v) => v + PAGE)
  }

  const openNotice = (n: Notice, e: React.MouseEvent) => {
    if (!n.read) void markRead(n.id)
    setOpen(false)
    if (n.kind === 'birthday') {
      setWish(n)
      fireBirthdayBurst(at(e))
      playBirthdaySong()
      return
    }
    if (n.link) navigate(n.link)
  }

  const closeWish = () => { setWish(null); stopBirthdaySong() }

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
    <>
      <Popover trigger="click" placement="rightTop" open={open} onOpenChange={setOpen} content={content} styles={{ container: { padding: 0 } }} arrow={false}>
        <span>
          <Tooltip title={t('common.notifications')} placement="right" mouseEnterDelay={0.3}>
            <button type="button" aria-label={t('common.notifications')} className="rail-btn">
              <Badge count={unread} size="small" overflowCount={99} offset={[4, -2]}><BellOutlined style={{ fontSize: 'inherit', color: 'inherit' }} /></Badge>
            </button>
          </Tooltip>
        </span>
      </Popover>
      <Modal open={!!wish} onCancel={() => closeWish()} title={null} footer={null} width={480} centered className="bd-wish-modal">
        {wish && (
          <div className="bdw">
            <div className="bdw-hero" aria-hidden>
              <div className="bdw-bunting">{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
              <span className="bdw-balloon b1" /><span className="bdw-balloon b2" /><span className="bdw-balloon b3" />
              <span className="bdw-spark s1">✦</span><span className="bdw-spark s2">✧</span><span className="bdw-spark s3">✦</span><span className="bdw-spark s4">✧</span>
              <div className="bdw-cake">🎂</div>
              <div className="bdw-script">Happy Birthday</div>
            </div>
            <div className="bdw-body">
              <h3>{wish.title}</h3>
              <div className="bdw-card"><p>{wish.body}</p></div>
              <em>{ago(wish.at, t)}</em>
              <button type="button" className="bdw-btn" onClick={() => closeWish()}>{t('notif.thanks')} ❤</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
