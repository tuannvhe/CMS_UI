import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Avatar, Button, Dropdown, Empty, Image, Input, List, Skeleton, Tag, Tooltip } from 'antd'
import { ArrowLeftOutlined, CloseOutlined, CommentOutlined, EditOutlined, MessageOutlined, PictureOutlined, SearchOutlined, SendOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useQaDots } from '../hooks/useQaDots'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { qa, QA_DEFAULT_CHANNEL, type QaChannel, type QaImage, type QaMode, type QaPost, type QaThread } from '../api/qa'
import { adminError } from '../api/userAdmin'
import { useToast } from '../hooks/useToast'
import { EmojiPicker } from './EmojiPicker'
import { QaTemplatesModal } from './QaTemplatesModal'
import { SearchBox } from './SearchBox'
import { emojify, isJumboEmoji } from '../utils/emoticons'
import { niceName } from '../utils/names'

const MAX_IMAGES = 4
const MAX_IMAGE_MB = 10

/** Ảnh chờ gửi kèm một bài: tải lên ngay khi chọn / dán, gửi bài thì đưa danh sách khóa ảnh theo. */
function useQaUploads(mode: QaMode, onError: (e: unknown) => void, tooMany: () => void, tooBig: () => void) {
  const [items, setItems] = useState<QaImage[]>([])
  const [busy, setBusy] = useState(0)
  const count = useRef(0)
  const add = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    for (const f of imgs) {
      if (count.current >= MAX_IMAGES) { tooMany(); break }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) { tooBig(); continue }
      count.current += 1
      setBusy((n) => n + 1)
      try { const r = await qa.uploadImage(mode, f); setItems((x) => [...x, r]) }
      catch (e) { count.current -= 1; onError(e) }
      finally { setBusy((n) => n - 1) }
    }
  }, [mode, onError, tooMany, tooBig])
  const remove = (key: string) => { count.current -= 1; setItems((x) => x.filter((i) => i.key !== key)) }
  const clear = useCallback(() => { count.current = 0; setItems([]) }, [])
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
    if (files.length) { e.preventDefault(); add(files) }
  }
  return { items, busy: busy > 0, add, remove, clear, onPaste, keys: items.map((i) => i.key) }
}

type Uploads = ReturnType<typeof useQaUploads>

/** Nút chọn ảnh (ẩn ô chọn tệp). type = text: nút tròn không viền trong ô soạn tin kiểu Messenger. */
function QaImageButton({ up, label, type }: { up: Uploads; label: string; type?: 'text' }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { up.add(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      <Tooltip title={label}><Button type={type} shape={type ? 'circle' : undefined} className={type ? 'qc-tool' : undefined} icon={<PictureOutlined />} loading={up.busy} disabled={up.items.length >= MAX_IMAGES} onClick={() => input.current?.click()} aria-label={label} /></Tooltip>
    </>
  )
}

/** Hàng ảnh chờ gửi (bấm X để bỏ). */
function QaThumbs({ up }: { up: Uploads }) {
  if (up.items.length === 0) return null
  return (
    <div className="qa-thumbs">
      {up.items.map((i) => (
        <span key={i.key} className="qa-thumb"><img src={i.url} alt="" /><button type="button" onClick={() => up.remove(i.key)} aria-label="x"><CloseOutlined /></button></span>
      ))}
    </div>
  )
}

/** Chữ cái đại diện: tên tiếng Việt lấy chữ đầu của tên (từ cuối). */
const initial = (name: string) => (name.trim().split(/\s+/).pop() ?? '?').charAt(0).toUpperCase() || '?'
const AVATAR_COLORS = ['#0F6B3E', '#2563EB', '#9333EA', '#C2410C', '#0E7490', '#BE185D', '#4D7C0F', '#B45309']
const avatarColor = (key: string) => AVATAR_COLORS[[...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length]
function PersonAvatar({ name, id, size = 28, soft, src }: { name: string; id: string; size?: number; /** nền nhạt, chữ màu (danh sách chủ đề) */ soft?: boolean; /** ảnh đại diện thật (có thì hiện ảnh, không thì chữ cái đầu) */ src?: string | null }) {
  const c = avatarColor(id || name)
  if (src) return <Avatar size={size} src={src} alt={name} style={{ flex: 'none' }} />
  return <Avatar size={size} style={soft ? { background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, flex: 'none', fontSize: size * 0.4, fontWeight: 700 } : { background: c, flex: 'none', fontSize: size * 0.42 }}>{initial(name)}</Avatar>
}

const GROUP_GAP = 5 * 60_000      // tin cùng người cách nhau dưới 5 phút: gom một cụm như Messenger
const TIME_GAP = 30 * 60_000      // cách tin trước trên 30 phút: hiện mốc giờ ở giữa

interface Bubble { post: QaPost; mine: boolean; first: boolean; last: boolean; stamp: boolean }

/** Xếp tin thành cụm: first / last để bo góc và hiện tên / ảnh đại diện, stamp = hiện mốc giờ phía trên. */
function toBubbles(posts: QaPost[], isMine: (p: QaPost) => boolean): Bubble[] {
  const at = (p: QaPost) => new Date(p.createdAt).getTime()
  const same = (a: QaPost | undefined, b: QaPost | undefined) => !!a && !!b && a.employeeId === b.employeeId && Math.abs(at(b) - at(a)) < GROUP_GAP
  return posts.map((p, i) => {
    const prev = posts[i - 1], next = posts[i + 1]
    const stamp = !prev || at(p) - at(prev) > TIME_GAP
    const nextStamp = !!next && at(next) - at(p) > TIME_GAP
    return { post: p, mine: isMine(p), stamp, first: stamp || !same(prev, p), last: nextStamp || !same(p, next) }
  })
}

/**
 * Hỏi đáp hai khung: danh sách chủ đề bên trái, cuộc trò chuyện bên phải. mode = mine (nhân viên: chỉ chủ đề của mình, được đặt câu hỏi mới)
 * hoặc manage (nhân sự: mọi chủ đề, lọc "chưa trả lời", trả lời). Kênh và chủ đề đang mở nằm trên địa chỉ (?channel=&group=) để mở thẳng từ thông báo.
 * Từ 12/11/2026 không chia tab Lương / Công, phép nữa: một danh sách chung cho cả hai kênh, câu hỏi mới vào kênh chung. Hỏi và trả lời gửi kèm được ảnh (chọn hoặc dán).
 */
/** Tiêu đề tự tạo từ tin nhắn đầu tiên (nhắn thẳng, không bắt nhập tiêu đề): dòng đầu, gọn khoảng trắng, tối đa 80 ký tự; quá ngắn thì kèm ngày giờ. */
function autoTitle(text: string, hasImg: boolean, lang: string) {
  const line = (text.split('\n').find((l) => l.trim()) ?? '').replace(/\s+/g, ' ').trim()
  const s = line.length > 80 ? `${line.slice(0, 79)}…` : line
  if (s.length >= 3) return s
  const at = new Date().toLocaleString(lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return `${s || (hasImg ? '📷' : '…')} ${at}`.trim()
}

export function QaWorkspace({ mode, popup, onMode, paused, target }: {
  mode: QaMode
  /** Trong cửa sổ chat nổi (mở từ top bar ở bất kỳ màn nào): chủ đề đang mở giữ trong bộ nhớ thay vì trên địa chỉ, một khung một lúc. */
  popup?: boolean
  /** Cửa sổ nổi đang thu nhỏ: ngừng tải / tự làm mới (kể cả khi có tin realtime) để không tốn truy vấn cho màn không ai nhìn; mở lại thì tải mới. */
  paused?: boolean
  /** Cửa sổ nổi: mở thẳng chủ đề này (bấm thông báo nổi). n đổi mỗi lần bấm để mở lại cả khi trùng chủ đề. */
  target?: { channel: QaChannel; group: string; n: number } | null
  /** Cửa sổ nổi: đổi tab Câu hỏi của tôi / Trả lời nhân viên tại chỗ thay vì chuyển màn. */
  onMode?: (m: QaMode) => void
}) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [local, setLocal] = useState<{ channel: QaChannel; group: string | null }>({ channel: 'common', group: null })
  const channel: QaChannel = popup ? local.channel : params.get('channel') === 'salary' ? 'salary' : 'common'
  const group = popup ? local.group : params.get('group')
  useEffect(() => { if (popup && target) setLocal({ channel: target.channel, group: target.group }) }, [popup, target])
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(mode === 'manage')
  const [composing, setComposing] = useState(false)   // nhân viên đang soạn tin mới (chưa có chủ đề)
  const [draft, setDraft] = useState('')
  const [tplOpen, setTplOpen] = useState(false)

  const list = useQuery({ queryKey: ['qa', mode, 'all', search, pendingOnly], queryFn: () => qa.allThreads(mode, mode === 'manage' ? { search: search || undefined, pendingOnly } : undefined), retry: false, refetchInterval: 30_000, enabled: !paused })
  const conv = useQuery({ queryKey: ['qa', 'conv', mode, channel, group], queryFn: () => qa.conversation(mode, channel, group!), enabled: !!group && !paused, retry: false,
    // Dự phòng khi mất realtime (SignalR rớt, máy chủ chưa gửi sự kiện cho người này): cuộc trò chuyện đang mở tự tải lại mỗi 15 giây khi tab đang hiện
    refetchInterval: 15_000 })
  // Mở lại cửa sổ sau khi thu nhỏ: lấy ngay dữ liệu mới nhất
  const wasPaused = useRef(paused)
  useEffect(() => { if (wasPaused.current && !paused) void qc.invalidateQueries({ queryKey: ['qa'] }); wasPaused.current = paused }, [paused, qc])
  const tpls = useQuery({ queryKey: ['qa-templates', 'all'], queryFn: () => qa.templates(), enabled: mode === 'manage', retry: false, staleTime: 60_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['qa'] })
  // Đang mở màn Hỏi đáp thì coi như đã thấy các trả lời mới nhất: tắt chấm trên menu.
  const dots = useQaDots()
  const { markSeen, markStaffSeen, latestAsk } = dots
  // Nhân sự đang mở màn Trả lời hỏi đáp thì tắt chấm trên menu; chỉ sáng lại khi nhân viên gửi câu hỏi / tin nhắn mới.
  useEffect(() => { if (mode === 'manage' && latestAsk) markStaffSeen() }, [mode, latestAsk, markStaffSeen])
  const latestReply = mode === 'mine' ? (list.data ?? []).filter((x) => !x.awaitingStaff).map((x) => x.lastAt).sort().pop() : undefined
  useEffect(() => { if (latestReply) markSeen(latestReply) }, [latestReply, markSeen])
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`qa.err.${code === 'too_many' ? (detail ? `too_many_${detail}` : 'too_many') : detail}`, { defaultValue: t('usr.err.generic') }) }
  const upErr = useCallback((e: unknown) => { const { detail } = adminError(e); msg.error(t(`qa.err.${detail}`, { defaultValue: t('usr.err.generic') })) }, [msg, t])
  const tooMany = useCallback(() => msg.warning(t('qa.img.max', { n: MAX_IMAGES })), [msg, t])
  const tooBig = useCallback(() => msg.warning(t('qa.img.big', { n: MAX_IMAGE_MB })), [msg, t])
  const replyImgs = useQaUploads(mode, upErr, tooMany, tooBig)

  const open = (g: string | null, ch: QaChannel = channel) => (popup ? setLocal({ channel: ch, group: g }) : setParams(g ? { channel: ch, group: g } : { channel: ch }, { replace: true }))
  const clearReplyImgs = replyImgs.clear
  useEffect(() => { setDraft(''); clearReplyImgs() }, [group, clearReplyImgs])

  // Nhắn thẳng: tin đầu tiên tự tạo chủ đề (tiêu đề lấy từ dòng đầu của tin), rồi mở luôn cuộc trò chuyện đó
  const ask = useMutation({
    mutationFn: () => qa.ask(QA_DEFAULT_CHANNEL, { title: autoTitle(draft, replyImgs.items.length > 0, i18n.language), content: draft.trim(), images: replyImgs.keys }),
    onSuccess: (r) => { setDraft(''); replyImgs.clear(); setComposing(false); refresh(); open(r.groupId, QA_DEFAULT_CHANNEL) },
    onError: (e) => msg.error(errText(e)),
  })
  const reply = useMutation({
    mutationFn: () => qa.reply(mode, conv.data?.thread.channel ?? channel, group!, draft, replyImgs.keys),
    onSuccess: () => { setDraft(''); replyImgs.clear(); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const when = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
  // Giờ gọn như Messenger: hôm nay = giờ:phút, trong 6 ngày = thứ, xa hơn = ngày/tháng
  const shortWhen = (v: string) => {
    const d = new Date(v), now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString(i18n.language, { weekday: 'short' })
    return d.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' })
  }
  // Bên phải = tin của chính người đang xem: nhân viên thấy tin mình gửi bên phải, nhân sự thấy tin nhân sự trả lời bên phải.
  const bubbles = useMemo(() => toBubbles(conv.data?.posts ?? [], (p) => (mode === 'mine' ? p.isAsker : !p.isAsker)), [conv.data?.posts, mode])
  const scroller = useRef<HTMLDivElement>(null)
  const lastId = bubbles.length ? bubbles[bubbles.length - 1].post.id : 0
  // Luôn bám đáy như Messenger: khi mở chủ đề / có tin mới thì cuộn xuống cuối; ảnh tải xong làm cao thêm thì vẫn giữ ở đáy
  // (trừ khi người dùng đã tự cuộn lên đọc tin cũ).
  const stick = useRef(true)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => { stick.current = true; const el = scroller.current; if (el) el.scrollTop = el.scrollHeight }, [group, lastId, bubbles.length])
  useEffect(() => {
    const el = scroller.current, inner = content.current
    if (!el || !inner || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [group, conv.data])
  const onScroll = () => { const el = scroller.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }
  // Khung soạn tin mới cho nhân viên: màn đầy đủ thì luôn hiện bên phải khi chưa chọn chủ đề; cửa sổ nổi thì khi bấm "Nhắn tin cho nhân sự" hoặc chưa có chủ đề nào
  const newChat = mode === 'mine' && !group && (composing || !popup || (list.isSuccess && (list.data ?? []).length === 0))
  const canSend = !replyImgs.busy && !reply.isPending && !ask.isPending && (draft.trim().length >= 2 || replyImgs.items.length > 0)
  const send = () => { if (!canSend) return; if (newChat) ask.mutate(); else reply.mutate() }
  // Enter để gửi, Shift+Enter xuống dòng (bỏ qua khi bộ gõ tiếng Việt đang ghép chữ)
  // Vị trí con trỏ trong ô nhập, để chèn biểu tượng cảm xúc đúng chỗ đang gõ
  const caret = useRef<{ start: number; end: number } | null>(null)
  const keepCaret = (e: { currentTarget: HTMLTextAreaElement }) => { caret.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd } }
  const insertEmoji = (emo: string) => setDraft((d) => {
    const c = caret.current && caret.current.end <= d.length ? caret.current : { start: d.length, end: d.length }
    caret.current = { start: c.start + emo.length, end: c.start + emo.length }
    return d.slice(0, c.start) + emo + d.slice(c.end)
  })
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    send()
  }
  const state = (th: QaThread) => (th.awaitingStaff ? <Tag color="orange" variant="filled">{t(mode === 'manage' ? 'qa.needsReply' : 'qa.waitingHr')}</Tag> : <Tag color="green" variant="filled">{t('qa.answered')}</Tag>)

  // Danh sách chủ đề một dòng kiểu Messenger: ảnh đại diện, tên + giờ, xem trước + chấm "cần xử lý"
  const preview = (th: QaThread) => {
    const text = emojify(th.lastText || th.title)
    const who = th.awaitingStaff ? (mode === 'manage' ? '' : `${t('qa.youAsked')}: `) : `${th.lastByName ? niceName(th.lastByName) : 'HR'}: `
    return who + text
  }
  const item = (th: QaThread) => (
    <List.Item title={th.title} className={`qm-item${th.groupId === group ? ' on' : ''}${th.awaitingStaff && mode === 'manage' ? ' unread' : ''}`} onClick={() => { setComposing(false); open(th.groupId, th.channel) }}>
      <PersonAvatar soft name={mode === 'manage' ? th.employeeName : (th.awaitingStaff ? th.employeeName : th.lastByName ?? 'HR')} id={mode === 'manage' ? th.employeeId : th.groupId} size={44} src={mode === 'manage' || th.awaitingStaff ? th.avatarUrl : th.lastByAvatarUrl} />
      <div className="qm-main">
        <div className="qm-top"><b>{mode === 'manage' ? niceName(th.employeeName) : th.title}</b><time dateTime={th.lastAt} title={when(th.lastAt)}>{shortWhen(th.lastAt)}</time></div>
        <div className="qm-sub">
          <span className="qm-preview">{preview(th)}</span>
          {th.posts > 1 && <span className="qm-n">{th.posts}</span>}
          {th.awaitingStaff && <span className={`qm-dot${mode === 'manage' ? '' : ' wait'}`} aria-label={t(mode === 'manage' ? 'qa.needsReply' : 'qa.waitingHr')} />}
        </div>
      </div>
    </List.Item>
  )
  // Người vừa hỏi vừa trả lời được: hai tab chuyển giữa màn /qa và /qa/manage
  const tabs = [
    ...(dots.canAsk && !dots.canManage ? [{ key: 'mine' as const, path: '/qa', label: t('qa.tabMine'), count: 0, dot: dots.reply }] : []),
    ...(dots.canManage ? [{ key: 'manage' as const, path: '/qa/manage', label: t('qa.tabStaff'), count: dots.pendingCount, dot: false }] : []),
  ]

  const composer = (
    <footer className="qc-reply">
      <QaThumbs up={replyImgs} />
      <div className="qc-compose">
        <QaImageButton up={replyImgs} label={t('qa.img.add')} type="text" />
        {mode === 'manage' && (
          <Dropdown trigger={['click']} menu={{
            items: [
              ...(tpls.data?.items ?? []).map((x) => ({ key: String(x.id), label: x.title })),
              { type: 'divider' as const },
              { key: 'manage', icon: <SettingOutlined />, label: t('qa.tpl.manage') },
            ],
            onClick: ({ key }) => {
              if (key === 'manage') { setTplOpen(true); return }
              const tpl = tpls.data?.items.find((x) => String(x.id) === key)
              if (tpl) setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n` : '') + tpl.content.split('{ten}').join(conv.data?.thread.employeeName ?? ''))
            },
          }}>
            <Tooltip title={t('qa.tpl.use')}><Button type="text" shape="circle" className="qc-tool" icon={<ThunderboltOutlined />} aria-label={t('qa.tpl.use')} /></Tooltip>
          </Dropdown>
        )}
        <EmojiPicker className="qc-tool" onPick={insertEmoji} />
        <Input.TextArea className="qc-text" variant="borderless" autoSize={{ minRows: 1, maxRows: 6 }} maxLength={4000} value={draft} onChange={(e) => { setDraft(e.target.value); keepCaret(e) }} onSelect={keepCaret} onKeyDown={onKey} onPaste={replyImgs.onPaste}
          placeholder={t(newChat ? 'qa.newChatPh' : mode === 'manage' ? 'qa.replyStaff' : 'qa.replyMine')} aria-label={t(newChat ? 'qa.newChatPh' : mode === 'manage' ? 'qa.replyStaff' : 'qa.replyMine')} autoFocus={newChat} />
        <Tooltip title={t('qa.sendHint')}><Button type={canSend ? 'primary' : 'text'} shape="circle" className="qc-send" icon={<SendOutlined />} disabled={!canSend} loading={reply.isPending || ask.isPending} onClick={send} aria-label={t('qa.send')} /></Tooltip>
      </div>
    </footer>
  )

  return (
    <div className={`qa chat${popup ? ' popup' : ''}${group || (newChat && (popup || composing)) ? ' has-conv' : ''}`}>
      <div className="qa-body">
        <aside className="qa-list">
          {!popup && (
            <div className="qm-head">
              <span className="qm-logo" aria-hidden><MessageOutlined /></span>
              <h2>{t('qa.panel')}</h2>
            </div>
          )}
          {tabs.length > 1 && (
            <div className="qm-tabs" role="tablist">
              {tabs.map((x) => (
                <button key={x.key} type="button" role="tab" aria-selected={mode === x.key} className={`qm-tab${mode === x.key ? ' on' : ''}`} onClick={() => { if (mode === x.key) return; if (popup) onMode?.(x.key); else navigate(x.path) }}>
                  {x.label}
                  {x.count > 0 && <span className="qm-count">{x.count > 99 ? '99+' : x.count}</span>}
                  {!x.count && x.dot && mode !== x.key && <span className="qm-tabdot" aria-hidden />}
                </button>
              ))}
            </div>
          )}
          <div className="qm-bar">
            {mode === 'mine' ? (
              <Button type="primary" shape="round" size="large" block icon={<EditOutlined />} onClick={() => { setComposing(true); open(null) }}>{t('qa.newChatBtn')}</Button>
            ) : (
              <>
                <SearchBox allowClear className="qm-search" prefix={<SearchOutlined />} placeholder={t('qa.searchPh')} onSearch={setSearch} />
                <div className="qm-chips" role="radiogroup">
                  <button type="button" role="radio" aria-checked={!pendingOnly} className={`qm-chip${!pendingOnly ? ' on' : ''}`} onClick={() => setPendingOnly(false)}>{t('qa.filterAll')}</button>
                  <button type="button" role="radio" aria-checked={pendingOnly} className={`qm-chip${pendingOnly ? ' on' : ''}`} onClick={() => setPendingOnly(true)}>
                    {t('qa.filterPending')}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="qm-scroll">
            {list.isLoading ? <Skeleton active avatar paragraph={{ rows: 2 }} style={{ padding: 12 }} /> : (
              <List dataSource={list.data ?? []} locale={{ emptyText: <Empty description={t(mode === 'manage' ? 'qa.emptyManage' : 'qa.empty')} /> }} renderItem={item} />
            )}
          </div>
        </aside>
        <section className="qa-conv">
          {newChat ? (
            <>
              <header className="qc-head">
                {!!list.data?.length && <Button type="text" shape="circle" className="qc-back" icon={<ArrowLeftOutlined />} onClick={() => setComposing(false)} aria-label={t('qa.back')} />}
                <PersonAvatar soft name="HR" id="hr" size={40} />
                <div className="qc-head-text">
                  <h3>{t('qa.newChatTitle')}</h3>
                  <span>{t('qa.newChatSub')}</span>
                </div>
              </header>
              <div className="qc-posts">
                <div className="qc-newhint"><span className="qe-icon"><CommentOutlined /></span><span>{t('qa.newChatHint')}</span></div>
              </div>
              {composer}
            </>
          ) : !group ? (
            <div className="qc-empty">
              <span className="qe-icon"><CommentOutlined /></span>
              <b>{t('qa.pick')}</b>
              <span>{t(mode === 'manage' ? 'qa.pickHintStaff' : 'qa.pickHintMine')}</span>
            </div>
          ) : conv.isLoading ? <Skeleton active /> : conv.isError ? <Empty description={t('qa.gone')} /> : conv.data && (
            <>
              <header className="qc-head">
                <Button type="text" shape="circle" className="qc-back" icon={<ArrowLeftOutlined />} onClick={() => open(null)} aria-label={t('qa.back')} />
                <PersonAvatar soft name={conv.data.thread.employeeName} id={conv.data.thread.employeeId} size={40} src={conv.data.thread.avatarUrl} />
                <div className="qc-head-text">
                  <h3>{conv.data.thread.title}</h3>
                  <span>{niceName(conv.data.thread.employeeName)} · {conv.data.thread.employeeId}{conv.data.thread.department ? ` · ${conv.data.thread.department}` : ''}</span>
                </div>
                <span className="qc-head-state">{state(conv.data.thread)}</span>
              </header>
              <div className="qc-posts" ref={scroller} onScroll={onScroll}>
                <div className="qc-flow" ref={content}>
                {bubbles.map(({ post: p, mine, first, last, stamp }) => (
                  <Fragment key={p.id}>
                    {stamp && <div className="qc-stamp">{when(p.createdAt)}</div>}
                    <div className={`qc-row ${mine ? 'me' : 'them'}${first ? ' first' : ''}${last ? ' last' : ''}`}>
                      {!mine && <span className="qc-av">{last && <PersonAvatar name={p.name} id={p.employeeId} src={p.avatarUrl} />}</span>}
                      <div className="qc-col">
                        {!mine && first && <div className="qc-name">{niceName(p.name)}</div>}
                        {p.content && (() => {
                          // Mặt cười gõ bằng chữ (":)", ":v", "<3"...) hiện thành emoji; tin chỉ có 1–3 emoji thì hiện to, không khung (như Messenger)
                          const text = emojify(p.content)
                          return <Tooltip title={when(p.createdAt)} placement={mine ? 'left' : 'right'} mouseEnterDelay={0.6}><div className={`qc-bubble${isJumboEmoji(text) ? ' jumbo' : ''}`}>{text}</div></Tooltip>
                        })()}
                        {!!p.images?.length && (
                          <div className={`qc-imgs n${Math.min(p.images.length, 4)}`}><Image.PreviewGroup>{p.images.map((u) => <Image key={u} src={u} alt="" loading="lazy" />)}</Image.PreviewGroup></div>
                        )}
                      </div>
                    </div>
                  </Fragment>
                ))}
                </div>
              </div>
              {composer}
            </>
          )}
        </section>
      </div>

      {mode === 'manage' && <QaTemplatesModal open={tplOpen} onClose={() => { setTplOpen(false); tpls.refetch() }} />}
    </div>
  )
}
