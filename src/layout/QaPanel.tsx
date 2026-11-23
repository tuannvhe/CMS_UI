import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Tooltip } from 'antd'
import { ExpandOutlined, MessageOutlined, MinusOutlined, MutedOutlined, SoundOutlined, UpOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { QaChannel, QaMode } from '../api/qa'
import { QA_EVENT, type QaEvent } from '../hooks/useNotifications'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../auth/AuthContext'
import { QaWorkspace } from '../components/QaWorkspace'
import { useQaDots } from '../hooks/useQaDots'
import { niceName } from '../utils/names'
import { chimeEnabled, playChime, setChimeEnabled } from '../utils/chime'

/**
 * Hỏi đáp mở được ở bất kỳ màn / tab nào: thanh "Hỏi đáp" luôn nằm ở góc dưới bên phải (kiểu chat Messenger trên Facebook).
 * Bấm thanh = mở cửa sổ chat lên phía trên; thu nhỏ = về lại thanh (vẫn giữ chủ đề và chữ đang gõ); phóng to = sang màn đầy đủ.
 * Đổi màn hay đổi tab thì cửa sổ vẫn giữ nguyên.
 * Quyền giữ như menu: ai thấy màn Hỏi đáp thì hỏi được (chỉ câu của mình); ai thấy màn Trả lời hỏi đáp (HR / được cấp qaManage) có thêm tab trả lời.
 * HR thấy số chủ đề đang chờ trả lời trên thanh; nhân viên thấy chấm đỏ khi có trả lời mới chưa xem.
 */
export function QaPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { reply, pendingCount, canAsk, canManage } = useQaDots()
  const [mounted, setMounted] = useState(false)   // đã mở lần nào (giữ trạng thái khi thu nhỏ)
  const [shown, setShown] = useState(false)       // cửa sổ đang mở
  const [mode, setMode] = useState<QaMode>('mine')
  const [target, setTarget] = useState<{ channel: QaChannel; group: string; n: number } | null>(null)
  const toast = useToast()
  const me = useAuth().user?.employeeId?.trim().toUpperCase() ?? ''
  const [sound, setSound] = useState(chimeEnabled)
  const soundRef = useRef(sound)
  soundRef.current = sound
  const toggleSound = () => setSound((v) => { setChimeEnabled(!v); return !v })

  // Mở cửa sổ đúng chủ đề (hoặc danh sách nếu không có chủ đề): nhân sự ở tab trả lời, nhân viên ở câu hỏi của mình
  const openAt = useRef<(channel?: QaChannel, group?: string, as?: QaMode) => void>(() => undefined)
  openAt.current = (channel, group, as = 'manage') => {
    // Đang ở màn Hỏi đáp (thanh nổi bị ẩn): mở chủ đề ngay trên màn đó
    const base = as === 'manage' ? '/qa/manage' : '/qa'
    if (pathname === '/qa' || pathname === '/qa/manage') { navigate(channel && group ? `${base}?channel=${channel}&group=${encodeURIComponent(group)}` : base); return }
    setMode(as)
    setMounted(true)
    setShown(true)
    setTarget(channel && group ? { channel, group, n: Date.now() } : null)
  }

  // Tin nhắn đến (của người khác): âm báo nhỏ. Nhân sự: thông báo nổi khi có lượt hỏi mới (tin dồn dập trong 2 giây gộp thành "n câu hỏi mới").
  // Nhân viên: thông báo nổi khi nhân sự trả lời câu hỏi của mình.
  const buf = useRef<QaEvent[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!canManage && !canAsk) return
    const flush = () => {
      timer.current = undefined
      const list = buf.current
      buf.current = []
      if (list.length === 0) return
      const one = list.length === 1 ? list[0] : null
      const open = (
        <button type="button" className="qa-toast-open" onClick={() => openAt.current(one?.channel, one?.groupId)}>
          {t(one ? 'qa.toast.open' : 'qa.toast.openList')}
        </button>
      )
      toast.info({
        title: one ? t('qa.toast.one', { name: one.name ? niceName(one.name) : '' }) : t('qa.toast.many', { n: list.length }),
        description: <span className="qa-toast">{one && <><b>{one.title}</b>{one.preview && <span>{one.preview}</span>}</>}{open}</span>,
        duration: 8,
      })
    }
    const onQa = (ev: Event) => {
      const e = (ev as CustomEvent<QaEvent>).detail
      if (!e) return
      const askerIsMe = !!me && e.employeeId?.trim().toUpperCase() === me
      if (canManage) {
        if (e.byStaff || askerIsMe) return   // tin do nhân sự gửi / câu hỏi của chính mình: không báo
        if (soundRef.current) playChime()
        if (!e.notify) return
        if (!buf.current.some((x) => x.groupId === e.groupId)) buf.current.push(e)
        if (!timer.current) timer.current = setTimeout(flush, 2000)
        return
      }
      if (!e.byStaff || !askerIsMe) return   // nhân viên: chỉ báo khi nhân sự trả lời câu hỏi của mình
      if (soundRef.current) playChime()
      toast.info({
        title: t('qa.toast.reply', { name: e.name ? niceName(e.name) : 'HR' }),
        description: <span className="qa-toast"><b>{e.title}</b>{e.preview && <span>{e.preview}</span>}
          <button type="button" className="qa-toast-open" onClick={() => openAt.current(e.channel, e.groupId, 'mine')}>{t('qa.toast.view')}</button></span>,
        duration: 8,
      })
    }
    window.addEventListener(QA_EVENT, onQa)
    return () => { window.removeEventListener(QA_EVENT, onQa); if (timer.current) clearTimeout(timer.current); timer.current = undefined; buf.current = [] }
  }, [canManage, canAsk, me, t, toast])

  if (!canAsk && !canManage) return null
  // Đang ở chính màn Hỏi đáp (đã có chat đầy đủ): ẩn thanh nổi để không đè ô nhập tin, nhất là trên điện thoại
  if (pathname === '/qa' || pathname === '/qa/manage') return null

  const show = () => {
    if (!mounted) setMode(canManage ? 'manage' : 'mine')   // người được trả lời hỏi đáp (nhân sự) chỉ dùng tab trả lời
    setMounted(true)
    setShown(true)
  }
  const label = pendingCount > 0 ? `${t('qa.panel')} · ${t('qa.pendingN', { n: pendingCount })}` : t('qa.panel')

  return (
    <section className={`qa-pop${shown ? '' : ' min'}`} role={shown ? 'dialog' : undefined} aria-label={label}>
      <header className="qa-pop-head" onClick={() => { if (!shown) show() }}>
        <span className="qm-logo" aria-hidden>
          <Badge dot={!pendingCount && reply} offset={[-2, 2]}><MessageOutlined style={{ color: '#fff' }} /></Badge>
        </span>
        <b>{t('qa.panel')}</b>
        {pendingCount > 0 && (!shown || !canAsk) && <span className="qm-count">{pendingCount > 99 ? '99+' : pendingCount}</span>}
        <span className="qa-pop-tools" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t(sound ? 'qa.soundOn' : 'qa.soundOff')}><Button type="text" shape="circle" size="small" icon={sound ? <SoundOutlined /> : <MutedOutlined />} aria-label={t(sound ? 'qa.soundOn' : 'qa.soundOff')} aria-pressed={sound} onClick={toggleSound} /></Tooltip>
          <Tooltip title={t('qa.openFull')}><Button type="text" shape="circle" size="small" icon={<ExpandOutlined />} aria-label={t('qa.openFull')} onClick={() => { setShown(false); navigate(mode === 'manage' ? '/qa/manage' : '/qa') }} /></Tooltip>
          {shown
            ? <Tooltip title={t('qa.minimize')}><Button type="text" shape="circle" size="small" icon={<MinusOutlined />} aria-label={t('qa.minimize')} onClick={() => setShown(false)} /></Tooltip>
            : <Tooltip title={t('qa.restore')}><Button type="text" shape="circle" size="small" icon={<UpOutlined />} aria-label={t('qa.restore')} aria-haspopup="dialog" onClick={show} /></Tooltip>}
        </span>
      </header>
      {mounted && (
        <div className="qa-pop-body" hidden={!shown}>
          <QaWorkspace key={mode} mode={mode} popup onMode={(m) => { setTarget(null); setMode(m) }} paused={!shown} target={target} />
        </div>
      )}
    </section>
  )
}
