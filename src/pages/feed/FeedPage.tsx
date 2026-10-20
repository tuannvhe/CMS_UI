import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Card, Collapse, Empty, Image, Input, Modal, Popconfirm, Popover, Select, Skeleton, Tabs, Tag, Tooltip } from 'antd'
import type { InputRef } from 'antd'
import {
  CheckOutlined, ClockCircleOutlined, CloseOutlined, CommentOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, FlagOutlined, PictureOutlined,
  BulbOutlined, ReloadOutlined, SendOutlined, SafetyCertificateOutlined, SmileOutlined, UndoOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ALL_PAGES, canSee } from '../../config/navigation'
import { feed, feedError, FEED_ACCEPT, FEED_LIMITS, FEED_REACTIONS, FEED_REFRESH_MS, type FeedComment, type FeedMedia, type FeedPost, type FeedTerm } from '../../api/feed'
import { useAuth } from '../../auth/AuthContext'
import { UserAvatar } from '../../components/UserAvatar'
import { PersonLink } from './PersonCard'
import { useToast } from '../../hooks/useToast'

/** Mã lỗi của bảng tin → câu thông báo (máy chủ không trả từ cụ thể bị lọc, chỉ trả nhóm chung). */
export function useFeedError() {
  const { t } = useTranslation()
  return (e: unknown) => {
    const { code, detail } = feedError(e)
    if (code === 'blocked') return t('feed.err.blocked')
    if (code === 'too_many_requests') return t('feed.err.tooMany')
    if (code === 'invalid_input') return t(`feed.err.${detail}`, { defaultValue: t('feed.err.generic') })
    if (code === 'forbidden') return detail === 'media_locked' ? t('feed.err.media_locked') : t('feed.err.forbidden')
    if (code === 'not_found') return t('feed.err.notFound')
    return t('feed.err.generic')
  }
}

export function useTimeAgo() {
  const { t, i18n } = useTranslation()
  return (iso: string) => {
    const d = new Date(iso)
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
    if (s < 60) return t('notif.justNow')
    if (s < 3600) return t('notif.minutes', { n: Math.floor(s / 60) })
    if (s < 86400) return t('notif.hours', { n: Math.floor(s / 3600) })
    if (s < 86400 * 7) return t('notif.days', { n: Math.floor(s / 86400) })
    return d.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
}

/** Ngày giờ đầy đủ (giờ:phút ngày/tháng/năm) của bài / bình luận. */
export function fmtTime(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Người đăng: họ tên, mã nhân viên và bộ phận. */
export function WhoLine({ id, dept }: { id: string; dept: string | null }) {
  return <span className="who-line">{[id.trim(), dept].filter(Boolean).join(' · ')}</span>
}

type ReactionState = { counts: Record<string, number>; mine: string | null }

/** Số người theo từng cảm xúc sau khi đổi từ cảm xúc cũ sang cảm xúc mới (null = bỏ). */
function applyReaction(counts: Record<string, number>, from: string | null, to: string | null): Record<string, number> {
  const next = { ...counts }
  if (from) { next[from] = Math.max(0, (next[from] ?? 0) - 1); if (next[from] === 0) delete next[from] }
  if (to) next[to] = (next[to] ?? 0) + 1
  return next
}

/** Cảm xúc của một bài / bình luận: đổi trên màn hình NGAY khi bấm (không chờ máy chủ), có lỗi thì trả lại như cũ; dữ liệu tải lại sau đó sẽ thay thế. */
function useReaction(target: 'post' | 'comment', id: number, counts: Record<string, number>, mine: string | null, onChanged: () => void) {
  const toast = useToast()
  const errText = useFeedError()
  const [ov, setOv] = useState<{ base: Record<string, number>; value: ReactionState } | null>(null)
  const current: ReactionState = ov && ov.base === counts ? ov.value : { counts, mine }
  const mutation = useMutation({
    mutationFn: (reaction: string | null) => feed.react(target, id, reaction),
    onSuccess: (r) => { setOv({ base: counts, value: { counts: r.reactions, mine: r.myReaction } }); onChanged() },
    onError: (e) => { setOv(null); toast.error(errText(e)) },
  })
  const set = (r: string | null) => {
    setOv({ base: counts, value: { counts: applyReaction(current.counts, current.mine, r), mine: r } })
    mutation.mutate(r)
  }
  return { ...current, set }
}

/** Danh sách ai đã thả cảm xúc gì (như Facebook): tab "Tất cả" và từng loại cảm xúc. */
function ReactorsModal({ target, id, counts, open, onClose }: { target: 'post' | 'comment'; id: number; counts: Record<string, number>; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['feed', 'reactors', target, id], queryFn: () => feed.reactors(target, id), enabled: open, retry: false })
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const list = q.data ?? []
  const render = (rows: typeof list) => (
    <div className="rx-list">
      {q.isLoading ? <Skeleton active paragraph={{ rows: 3 }} title={false} /> : rows.map((r) => (
        <div key={r.userId} className="rx-row">
          <span className="rx-av"><UserAvatar name={r.name} src={r.avatarUrl} size={38} /><i>{FEED_REACTIONS.find((x) => x.key === r.reaction)?.emoji}</i></span>
          <div className="rx-who"><b>{r.name}</b><WhoLine id={r.userId} dept={r.department} /></div>
        </div>
      ))}
    </div>
  )
  const types = FEED_REACTIONS.filter((r) => counts[r.key] > 0)
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={440} title={t('feed.reactorsTitle')} destroyOnHidden>
      <Tabs items={[
        { key: 'all', label: `${t('feed.all')} ${total}`, children: render(list) },
        ...types.map((r) => ({ key: r.key, label: `${r.emoji} ${counts[r.key]}`, children: render(list.filter((x) => x.reaction === r.key)) })),
      ]} />
    </Modal>
  )
}

/** Các biểu tượng cảm xúc đang có (nhiều nhất trước) kèm tổng số người; bấm để xem ai đã thả gì. */
function ReactionSummary({ counts, target, id }: { counts: Record<string, number>; target: 'post' | 'comment'; id: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const top = FEED_REACTIONS.filter((r) => counts[r.key] > 0).sort((a, b) => counts[b.key] - counts[a.key]).slice(0, 3)
  const detail = FEED_REACTIONS.filter((r) => counts[r.key] > 0).map((r) => `${r.emoji} ${t(`feed.react.${r.key}`)}: ${counts[r.key]}`).join('\n')
  return (
    <>
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{detail}</span>}>
        <button type="button" className="rx-sum" onClick={() => setOpen(true)}><span className="rx-icons">{top.map((r) => <i key={r.key}>{r.emoji}</i>)}</span><span key={total} className="rx-num">{total}</span></button>
      </Tooltip>
      {open && <ReactorsModal target={target} id={id} counts={counts} open={open} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Nút Thích: bấm để thích / bỏ thích, rê chuột (hoặc bấm giữ trên điện thoại) để chọn cảm xúc khác như Facebook. */
function ReactionButton({ mine, onPick, small }: { mine: string | null; onPick: (r: string | null) => void; small?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const cur = FEED_REACTIONS.find((r) => r.key === mine)
  const pick = (r: string | null) => { setOpen(false); onPick(r) }
  return (
    <Popover trigger={['hover']} open={open} onOpenChange={setOpen} mouseEnterDelay={0.3} mouseLeaveDelay={0.25} placement="topLeft" arrow={false} classNames={{ root: 'rx-pop' }} content={(
      <div className="rx-picker">
        {FEED_REACTIONS.map((r, i) => (
          <button key={r.key} type="button" title={t(`feed.react.${r.key}`)} style={{ ['--i' as string]: i }} className={mine === r.key ? 'on' : ''} onClick={() => pick(mine === r.key ? null : r.key)}>{r.emoji}</button>
        ))}
      </div>
    )}>
      <button type="button" className={`rx-btn${mine ? ' on' : ''}${small ? ' small' : ''}`} onClick={() => pick(mine ? null : 'like')}>
        {cur ? <><span key={cur.key} className="rx-emoji pop">{cur.emoji}</span> {t(`feed.react.${cur.key}`)}</> : <><span className="rx-emoji off">👍</span> {t('feed.react.like')}</>}
      </button>
    </Popover>
  )
}

/** Ảnh / video của bài hoặc bình luận. Tệp quá 2 tháng đã bị dọn khỏi máy chủ nên chỉ hiện ghi chú. */
export function MediaGrid({ media, compact }: { media: FeedMedia[]; compact?: boolean }) {
  const { t } = useTranslation()
  const live = media.filter((m) => !m.purged && m.url)
  const images = live.filter((m) => m.kind === 'image')
  const videos = live.filter((m) => m.kind === 'video')
  const purged = media.length - live.length
  return (
    <div className={`feed-media-wrap${compact ? ' compact' : ''}`}>
      {images.length > 0 && (
        <Image.PreviewGroup>
          <div className={`feed-media n${Math.min(images.length, 4)}`}>
            {images.map((m) => <Image key={m.id} src={m.url!} alt="" loading="lazy" />)}
          </div>
        </Image.PreviewGroup>
      )}
      {videos.map((m) => <video key={m.id} className="feed-video" src={m.url!} controls preload="metadata" playsInline />)}
      {purged > 0 && <div className="feed-purged"><PictureOutlined /> {t('feed.purged', { n: purged })}</div>}
    </div>
  )
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🙏', '👏', '🎉', '🔥', '💪', '😊', '😍', '🤝', '👌', '✅', '🌸', '☕', '🍀', '⭐']

function CommentReaction({ c, onChanged }: { c: FeedComment; onChanged: () => void }) {
  const r = useReaction('comment', c.id, c.reactions, c.myReaction, onChanged)
  return <><ReactionButton mine={r.mine} onPick={r.set} small /><ReactionSummary counts={r.counts} target="comment" id={c.id} /></>
}

function Comments({ post, admin }: { post: FeedPost; admin: boolean }) {
  const { t } = useTranslation()
  const toast = useToast()
  const errText = useFeedError()
  const ago = useTimeAgo()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null)
  const [attach, setAttach] = useState<{ file: File; url: string } | null>(null)
  const input = useRef<InputRef>(null)
  const pick = useRef<HTMLInputElement>(null)
  const clearAttach = () => { if (attach) URL.revokeObjectURL(attach.url); setAttach(null) }
  useEffect(() => () => { if (attach) URL.revokeObjectURL(attach.url) }, [attach])
  const choose = (list: FileList | null) => {
    const f = list?.[0]
    if (pick.current) pick.current.value = ''
    if (!f) return
    const video = f.type.startsWith('video/')
    if (!FEED_ACCEPT.split(',').includes(f.type)) { toast.error(t('feed.err.media_type')); return }
    if (f.size > (video ? FEED_LIMITS.commentVideo : FEED_LIMITS.commentImage)) { toast.error(t(video ? 'feed.err.comment_video_too_large' : 'feed.err.comment_image_too_large')); return }
    setAttach({ file: f, url: URL.createObjectURL(f) })
  }

  const list = useQuery({ queryKey: ['feed', 'comments', post.id], queryFn: () => feed.comments(post.id), retry: false, refetchInterval: FEED_REFRESH_MS })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['feed', 'comments', post.id] }); qc.invalidateQueries({ queryKey: ['feed'], exact: true }) }
  const send = useMutation({
    mutationFn: () => feed.comment(post.id, text.trim(), replyTo?.id, attach?.file),
    onSuccess: (c) => {
      setText(''); setReplyTo(null); clearAttach(); refresh()
      if (c.status === 'pending') toast.success(t('feed.commentPending'))
      if (c.status === 'hidden') toast.warning(t('feed.hiddenTermToast'))
    },
    onError: (e) => toast.error(errText(e)),
  })
  const del = useMutation({ mutationFn: (id: number) => feed.removeComment(id), onSuccess: refresh, onError: (e) => toast.error(errText(e)) })
  const report = useMutation({
    mutationFn: (id: number) => feed.report('comment', id),
    onSuccess: () => { toast.success(t('feed.reported')); refresh() },
    onError: (e) => toast.error(errText(e)),
  })
  const hide = useMutation({ mutationFn: (id: number) => feed.setComment(id, 'hidden', 'admin'), onSuccess: refresh, onError: (e) => toast.error(errText(e)) })
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
  const saveEdit = useMutation({
    mutationFn: () => feed.editComment(editing!.id, editing!.text.trim()),
    onSuccess: (c) => { setEditing(null); refresh(); if (c.status === 'hidden') toast.warning(t('feed.hiddenTermToast')) },
    onError: (e) => toast.error(errText(e)),
  })

  const tops = (list.data ?? []).filter((c) => c.parentId === null)
  const repliesOf = (id: number) => (list.data ?? []).filter((c) => c.parentId === id)

  const row = (c: FeedComment, isReply: boolean) => (
    <div key={c.id} className={`fc-row${isReply ? ' reply' : ''}${c.status !== 'published' ? ' hidden' : ''}`}>
      <PersonLink id={c.authorId}><UserAvatar name={c.authorName} src={c.avatarUrl} size={isReply ? 26 : 32} /></PersonLink>
      <div className="fc-main">
        <div className="fc-bubble">
          <div className="fp-name"><PersonLink id={c.authorId}><b>{c.authorName}</b></PersonLink><WhoLine id={c.authorId} dept={c.department} /></div>
          {editing?.id === c.id ? (
            <div className="fc-edit">
              <Input.TextArea autoFocus autoSize={{ minRows: 1, maxRows: 6 }} maxLength={FEED_LIMITS.comment} value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} />
              <div className="fc-edit-actions">
                <Button size="small" onClick={() => setEditing(null)}>{t('req.cancel')}</Button>
                <Button size="small" type="primary" loading={saveEdit.isPending} disabled={!editing.text.trim() && c.media.length === 0} onClick={() => saveEdit.mutate()}>{t('feed.save')}</Button>
              </div>
            </div>
          ) : c.body && <div className="fc-text">{c.body}</div>}
          {c.status === 'hidden' && <Tag color="warning" variant="filled" title={c.hiddenReason === 'term' ? t('feed.hiddenTermNote') : undefined}>{t('feed.hiddenTag')}</Tag>}
          {c.status === 'pending' && <Tag icon={<ClockCircleOutlined />} color="processing" variant="filled">{t('feed.pendingTag')}</Tag>}
        </div>
        {c.media.length > 0 && <MediaGrid media={c.media} compact />}
        <div className="fc-meta">
          <span title={fmtTime(c.createdAt)}>{ago(c.createdAt)}</span>
          {c.status === 'published' && <CommentReaction c={c} onChanged={refresh} />}
          {c.status === 'published' && <button type="button" onClick={() => { setReplyTo(c); input.current?.focus() }}>{t('feed.reply')}</button>}
          {!c.mine && c.status === 'published' && (
            <Popconfirm title={t('feed.reportAsk')} okText={t('feed.report')} cancelText={t('req.cancel')} onConfirm={() => report.mutate(c.id)}>
              <button type="button">{t('feed.report')}</button>
            </Popconfirm>
          )}
          {c.mine && editing?.id !== c.id && <button type="button" onClick={() => setEditing({ id: c.id, text: c.body })}>{t('feed.edit')}</button>}
          {admin && c.status === 'published' && <button type="button" onClick={() => hide.mutate(c.id)}>{t('feed.hide')}</button>}
          {(c.mine || admin) && (
            <Popconfirm title={t('feed.deleteAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => del.mutate(c.id)}>
              <button type="button">{t('req.delete')}</button>
            </Popconfirm>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="feed-comments">
      {list.isLoading ? <Skeleton active paragraph={{ rows: 2 }} title={false} /> : (
        tops.length === 0 ? <div className="fc-empty">{t('feed.noComments')}</div> : tops.map((c) => (
          <div key={c.id}>
            {row(c, false)}
            {repliesOf(c.id).map((r) => row(r, true))}
          </div>
        ))
      )}
      <div className="fc-input">
        {replyTo && (
          <div className="fc-replying">
            {t('feed.replyingTo', { name: replyTo.authorName })}
            <button type="button" aria-label={t('req.cancel')} onClick={() => setReplyTo(null)}><CloseOutlined /></button>
          </div>
        )}
        {attach && (
          <div className="fcmp-previews">
            <div className="fcmp-prev">
              {attach.file.type.startsWith('video/') ? <video src={attach.url} muted playsInline preload="metadata" /> : <img src={attach.url} alt="" />}
              <button type="button" aria-label={t('req.delete')} onClick={clearAttach}><CloseOutlined /></button>
            </div>
            <span className="fcmp-hint">{t('feed.commentMediaNote')}</span>
          </div>
        )}
        <input ref={pick} type="file" hidden accept={FEED_ACCEPT} onChange={(e) => choose(e.target.files)} />
        <div className="fc-compose">
          <Input ref={input} value={text} maxLength={FEED_LIMITS.comment} placeholder={replyTo ? t('feed.replyPh') : t('feed.commentPh')}
            onChange={(e) => setText(e.target.value)} onPressEnter={() => (text.trim() || attach) && !send.isPending && send.mutate()}
            suffix={(
              <span className="fc-tools">
                <Popover trigger="click" placement="topRight" content={(
                  <div className="emoji-grid">
                    {EMOJIS.map((em) => <button key={em} type="button" onClick={() => { setText((v) => (v + em).slice(0, FEED_LIMITS.comment)); input.current?.focus() }}>{em}</button>)}
                  </div>
                )}>
                  <button type="button" aria-label={t('feed.emoji')} title={t('feed.emoji')}><SmileOutlined /></button>
                </Popover>
                <button type="button" aria-label={t('feed.attachPhoto')} title={t('feed.attachPhoto')} onClick={() => pick.current?.click()}><PictureOutlined /></button>
              </span>
            )} />
          <Button type="primary" icon={<SendOutlined />} loading={send.isPending} disabled={!text.trim() && !attach} onClick={() => send.mutate()} aria-label={t('feed.send')} />
        </div>
      </div>
    </div>
  )
}

export function PostCard({ post, admin, onChanged, defaultOpen, hideTitle }: { post: FeedPost; admin: boolean; onChanged: () => void; defaultOpen?: boolean; hideTitle?: boolean }) {
  const { t } = useTranslation()
  const toast = useToast()
  const errText = useFeedError()
  const ago = useTimeAgo()
  const [params] = useSearchParams()
  const focus = params.get('post') === String(post.id)
  const [open, setOpen] = useState(focus || !!defaultOpen)
  const card = useRef<HTMLElement>(null)
  useEffect(() => { if (focus) card.current?.scrollIntoView({ block: 'start' }) }, [focus])
  const rx = useReaction('post', post.id, post.reactions, post.myReaction, onChanged)
  const del = useMutation({ mutationFn: () => feed.remove(post.id), onSuccess: () => { toast.success(t('feed.deleted')); onChanged() }, onError: (e) => toast.error(errText(e)) })
  const report = useMutation({
    mutationFn: () => feed.report('post', post.id),
    onSuccess: () => { toast.success(t('feed.reported')); onChanged() },
    onError: (e) => toast.error(errText(e)),
  })
  const hide = useMutation({ mutationFn: () => feed.setPost(post.id, 'hidden', 'admin'), onSuccess: onChanged, onError: (e) => toast.error(errText(e)) })
  const [editing, setEditing] = useState<{ title: string; body: string } | null>(null)
  const save = useMutation({
    mutationFn: () => feed.edit(post.id, post.title === null ? null : editing!.title.trim(), editing!.body.trim()),
    onSuccess: (p) => { setEditing(null); if (p.status === 'hidden') toast.warning(t('feed.hiddenTermToast')); onChanged() },
    onError: (e) => toast.error(errText(e)),
  })

  return (
    <article ref={card} className={`feed-card feed-post${post.status !== 'published' ? ' not-published' : ''}`}>
      <header className="fp-head">
        <PersonLink id={post.authorId}><UserAvatar name={post.authorName} src={post.avatarUrl} size={42} /></PersonLink>
        <div className="fp-who">
          <div className="fp-name"><PersonLink id={post.authorId}><b>{post.authorName}</b></PersonLink><WhoLine id={post.authorId} dept={post.department} /></div>
          <span title={fmtTime(post.createdAt)}>{ago(post.createdAt)}</span>
        </div>
        {post.status === 'pending' && <Tag icon={<ClockCircleOutlined />} color="processing" variant="filled">{t('feed.pendingTag')}</Tag>}
        {post.status === 'hidden' && <Tag icon={<EyeInvisibleOutlined />} color="warning" variant="filled">{t('feed.hiddenTag')}</Tag>}
      </header>
      {post.status === 'hidden' && post.mine && post.hiddenReason === 'term' && <div className="fp-note"><EyeInvisibleOutlined /> {t('feed.hiddenTermNote')}</div>}
      {editing ? (
        <div className="fp-edit">
          {post.title !== null && <Input maxLength={FEED_LIMITS.title} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={t('forum.titlePh')} />}
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 12 }} maxLength={FEED_LIMITS.body} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
          <div className="fc-edit-actions">
            <Button onClick={() => setEditing(null)}>{t('req.cancel')}</Button>
            <Button type="primary" loading={save.isPending} disabled={(post.title !== null && editing.title.trim().length < 3) || (!editing.body.trim() && post.media.length === 0)} onClick={() => save.mutate()}>{t('feed.save')}</Button>
          </div>
        </div>
      ) : (
        <>
          {post.title && !hideTitle && <h3 className="fp-title">{post.title}</h3>}
          {post.body && <div className="fp-body">{post.body}</div>}
        </>
      )}
      {post.media.length > 0 && <MediaGrid media={post.media} />}
      {(post.status === 'published') && (Object.keys(rx.counts).length > 0 || post.commentCount > 0) && (
        <div className="fp-stats">
          <ReactionSummary counts={rx.counts} target="post" id={post.id} />
          <span className="spacer" />
          {post.commentCount > 0 && <button type="button" onClick={() => setOpen((v) => !v)}>{t('feed.commentsN', { n: post.commentCount })}</button>}
        </div>
      )}
      <footer className="fp-actions">
        {post.status === 'published' && <ReactionButton mine={rx.mine} onPick={rx.set} />}
        <button type="button" className={open ? 'on' : ''} onClick={() => setOpen((v) => !v)} disabled={post.status !== 'published'}><CommentOutlined /> {t('feed.comment')}</button>
        <span className="spacer" />
        {!post.mine && post.status === 'published' && (
          <Popconfirm title={t('feed.reportAsk')} okText={t('feed.report')} cancelText={t('req.cancel')} onConfirm={() => report.mutate()}>
            <button type="button"><FlagOutlined /> {t('feed.report')}</button>
          </Popconfirm>
        )}
        {post.mine && !editing && <button type="button" onClick={() => setEditing({ title: post.title ?? '', body: post.body })}><EditOutlined /> {t('feed.edit')}</button>}
        {admin && post.status === 'published' && <button type="button" onClick={() => hide.mutate()}><EyeInvisibleOutlined /> {t('feed.hide')}</button>}
        {(post.mine || admin) && (
          <Popconfirm title={t('feed.deleteAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => del.mutate()}>
            <button type="button"><DeleteOutlined /> {t('req.delete')}</button>
          </Popconfirm>
        )}
      </footer>
      {open && <Comments post={post} admin={admin} />}
    </article>
  )
}

/** Soạn bài mới: chọn chủ đề, nhập tiêu đề và nội dung, đính kèm ảnh / video. */
export function ThreadComposer({ topics: topicList, topicId, onPosted }: { topics: { id: number; name: string; group: string | null }[]; topicId?: number; onPosted: (id: number) => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const errText = useFeedError()
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState<number | undefined>(topicId)
  const [files, setFiles] = useState<{ file: File; url: string }[]>([])
  const pick = useRef<HTMLInputElement>(null)
  const [topicAt, setTopicAt] = useState(() => Math.floor(Date.now() / 86400000))
  const topics = t('feed.topics', { returnObjects: true }) as unknown as { label: string; text: string }[]   // gợi ý nội dung bài

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [])   // eslint-disable-line react-hooks/exhaustive-deps

  const add = (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      const video = f.type.startsWith('video/')
      if (!FEED_ACCEPT.split(',').includes(f.type)) { toast.error(t('feed.err.media_type')); continue }
      if (f.size > (video ? FEED_LIMITS.video : FEED_LIMITS.image)) { toast.error(t(video ? 'feed.err.video_too_large' : 'feed.err.image_too_large')); continue }
      if (video && next.some((x) => x.file.type.startsWith('video/'))) { toast.error(t('feed.err.one_video')); continue }
      if (next.length >= FEED_LIMITS.media) { toast.error(t('feed.err.too_many_media')); break }
      next.push({ file: f, url: URL.createObjectURL(f) })
    }
    setFiles(next)
    if (pick.current) pick.current.value = ''
  }
  const remove = (i: number) => { URL.revokeObjectURL(files[i].url); setFiles(files.filter((_, k) => k !== i)) }

  const post = useMutation({
    mutationFn: () => feed.create(body.trim(), files.map((f) => f.file), topic, title.trim()),
    onSuccess: (p) => {
      files.forEach((f) => URL.revokeObjectURL(f.url))
      setBody(''); setTitle(''); setFiles([])
      if (p.status === 'hidden') toast.warning(t('feed.hiddenTermToast'))
      else toast.success(p.status === 'pending' ? t('feed.postedPending') : t('feed.posted'))
      onPosted(p.id)
    },
    onError: (e) => toast.error(errText(e)),
  })

  const needTopic = topicList.length > 0
  const canPost = title.trim().length >= 3 && (!needTopic || !!topic) && (!!body.trim() || files.length > 0)

  return (
    <section className="feed-composer forum-composer">
      {needTopic && (
        <Select className="fcmp-topic" showSearch optionFilterProp="label" value={topic} onChange={setTopic} placeholder={t('forum.topicPh')}
          options={topicList.map((x) => ({ value: x.id, label: x.group ? `${x.group} › ${x.name}` : x.name }))} />
      )}
      <Input className="fcmp-title" maxLength={FEED_LIMITS.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('forum.titlePh')} />
      <div className="fcmp-row">
        <UserAvatar name={user?.fullName} src={user?.avatarUrl} size={44} />
        <Input.TextArea className="fcmp-input" autoSize={{ minRows: 2, maxRows: 8 }} maxLength={FEED_LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={t('feed.placeholder', { name: user?.fullName?.split(' ').slice(-1)[0] ?? '' })} />
      </div>
      {Array.isArray(topics) && topics.length > 0 && (
        <div className="fcmp-topics">
          <span className="fcmp-topics-label"><BulbOutlined /> {t('feed.topicHint')}</span>
          {[0, 1, 2, 3].map((k) => topics[(topicAt + k) % topics.length]).map((tp) => (
            <button key={tp.label} type="button" onClick={() => setBody((v) => (v.trim() ? v + '\n' : '') + tp.text)}>{tp.label}</button>
          ))}
          <button type="button" className="more" aria-label={t('feed.topicMore')} title={t('feed.topicMore')} onClick={() => setTopicAt((v) => v + 4)}><ReloadOutlined /></button>
        </div>
      )}
      {files.length > 0 && (
        <div className="fcmp-previews">
          {files.map((f, i) => (
            <div key={f.url} className="fcmp-prev">
              {f.file.type.startsWith('video/') ? <video src={f.url} muted playsInline preload="metadata" /> : <img src={f.url} alt="" />}
              <button type="button" aria-label={t('req.delete')} onClick={() => remove(i)}><CloseOutlined /></button>
            </div>
          ))}
        </div>
      )}
      <div className="fcmp-foot">
        <input ref={pick} type="file" hidden multiple accept={FEED_ACCEPT} onChange={(e) => add(e.target.files)} />
        <Button icon={<PictureOutlined />} onClick={() => pick.current?.click()}>{t('feed.addMedia')}</Button>
        <span className="fcmp-hint"><SafetyCertificateOutlined /> {t('feed.rules')}</span>
        <span className="spacer" />
        {body.length > 1500 && <span className="fcmp-hint">{body.length} / {FEED_LIMITS.body}</span>}
        <Button type="primary" icon={<SendOutlined />} loading={post.isPending} disabled={!canPost} onClick={() => post.mutate()}>{t('forum.postThread')}</Button>
      </div>
    </section>
  )
}

/** Bảng kiểm soát ngôn từ: bài / bình luận chứa các từ này tự bị ẩn chờ quản trị xem (hoặc bị từ chối ngay nếu chọn "Chặn"). */
function TermsCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const errText = useFeedError()
  const qc = useQueryClient()
  const [term, setTerm] = useState('')
  const [action, setAction] = useState<'hide' | 'block'>('hide')
  const list = useQuery({ queryKey: ['feed', 'terms'], queryFn: feed.terms, retry: false })
  const refresh = () => qc.invalidateQueries({ queryKey: ['feed', 'terms'] })
  const add = useMutation({ mutationFn: () => feed.addTerm(term.trim(), action), onSuccess: () => { setTerm(''); refresh() }, onError: (e) => toast.error(errText(e)) })
  const del = useMutation({ mutationFn: (id: number) => feed.removeTerm(id), onSuccess: refresh, onError: (e) => toast.error(errText(e)) })
  const rows: FeedTerm[] = list.data ?? []
  return (
    <Card size="small" className="terms-card" title={<span className="fa-title"><SafetyCertificateOutlined /> {t('feed.termsTitle')}</span>}>
      <p className="fm-note">{t('feed.termsNote')}</p>
      <div className="terms-add">
        <Input value={term} maxLength={60} placeholder={t('feed.termPh')} onChange={(e) => setTerm(e.target.value)} onPressEnter={() => term.trim().length >= 2 && add.mutate()} />
        <Select value={action} onChange={setAction} style={{ width: 190 }} options={[{ value: 'hide', label: t('feed.termHide') }, { value: 'block', label: t('feed.termBlock') }]} />
        <Button type="primary" loading={add.isPending} disabled={term.trim().length < 2} onClick={() => add.mutate()}>{t('feed.termAdd')}</Button>
      </div>
      <div className="terms-list">
        {rows.length === 0 ? <span className="fa-text">{t('feed.termsEmpty')}</span> : rows.map((r) => (
          <Tag key={r.id} closable color={r.action === 'block' ? 'error' : 'warning'} variant="filled" onClose={(e) => { e.preventDefault(); del.mutate(r.id) }}
            title={r.action === 'block' ? t('feed.termBlock') : t('feed.termHide')}>{r.term}</Tag>
        ))}
      </div>
    </Card>
  )
}

/** Kiểm duyệt (quản trị): bài chờ duyệt, nội dung bị báo cáo, nội dung đã ẩn. */
export function Moderation() {
  const { t } = useTranslation()
  const ago = useTimeAgo()
  const toast = useToast()
  const errText = useFeedError()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['feed', 'queue'], queryFn: feed.queue, retry: false })
  const done = () => { qc.invalidateQueries({ queryKey: ['feed'] }) }
  const run = useMutation({ mutationFn: (fn: () => Promise<void>) => fn(), onSuccess: done, onError: (e) => toast.error(errText(e)) })
  const d = q.data
  const postRow = (p: FeedPost, actions: React.ReactNode) => (
    <div key={p.id} className="fm-item">
      <PostPreview post={p} />
      <div className="fm-actions">{actions}</div>
    </div>
  )
  const commentRow = (c: FeedComment, actions: React.ReactNode) => (
    <div key={c.id} className="fm-item">
      <div className="fm-comment"><b>{c.authorName}</b> <WhoLine id={c.authorId} dept={c.department} /> <span className="who-line" title={fmtTime(c.createdAt)}>{ago(c.createdAt)}</span>: {c.body}{c.media.length > 0 && <MediaGrid media={c.media} compact />}{c.reports > 0 && <Tag color="error" variant="filled">{t('feed.reportsN', { n: c.reports })}</Tag>}{c.hiddenReason && <Tag>{c.hiddenReason}</Tag>}</div>
      <div className="fm-actions">{actions}</div>
    </div>
  )
  const delPost = (id: number) => (
    <Popconfirm title={t('feed.deleteAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => run.mutate(() => feed.remove(id))}>
      <Button size="small" danger icon={<DeleteOutlined />}>{t('req.delete')}</Button>
    </Popconfirm>
  )
  const delComment = (id: number) => (
    <Popconfirm title={t('feed.deleteAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => run.mutate(() => feed.removeComment(id))}>
      <Button size="small" danger icon={<DeleteOutlined />}>{t('req.delete')}</Button>
    </Popconfirm>
  )
  const empty = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('feed.modEmpty')} />
  const sec = (key: string, label: string, n: number, content: React.ReactNode) => ({ key, label: <span>{label} <Tag>{n}</Tag></span>, children: n ? content : empty })

  if (q.isLoading || !d) return <Skeleton active paragraph={{ rows: 6 }} />
  return (
    <div className="feed-mod">
      <TermsCard />
      <p className="fm-note">{t('feed.modNote')}</p>
      <Collapse defaultActiveKey={['pending', 'pendingComments', 'reported', 'recent']} items={[
        sec('pending', t('feed.modPending'), d.pendingPosts.length, d.pendingPosts.map((p) => postRow(p, (
          <>
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => run.mutate(() => feed.setPost(p.id, 'published'))}>{t('feed.approve')}</Button>
            <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => run.mutate(() => feed.setPost(p.id, 'hidden', 'admin'))}>{t('feed.reject')}</Button>
            {delPost(p.id)}
          </>)))),
        sec('pendingComments', t('feed.modPendingComments'), d.pendingComments.length, d.pendingComments.map((c) => commentRow(c, (
          <>
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => run.mutate(() => feed.setComment(c.id, 'published'))}>{t('feed.approve')}</Button>
            <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => run.mutate(() => feed.setComment(c.id, 'hidden', 'admin'))}>{t('feed.reject')}</Button>
            {delComment(c.id)}
          </>)))),
        sec('reported', t('feed.modReported'), d.reportedPosts.length + d.reportedComments.length, (
          <>
            {d.reportedPosts.map((p) => postRow(p, (
              <>
                <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => run.mutate(() => feed.setPost(p.id, 'hidden', 'reported'))}>{t('feed.hide')}</Button>
                <Button size="small" icon={<CheckOutlined />} onClick={() => run.mutate(() => feed.dismiss('posts', p.id))}>{t('feed.keep')}</Button>
                {delPost(p.id)}
              </>)))}
            {d.reportedComments.map((c) => commentRow(c, (
              <>
                <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => run.mutate(() => feed.setComment(c.id, 'hidden', 'reported'))}>{t('feed.hide')}</Button>
                <Button size="small" icon={<CheckOutlined />} onClick={() => run.mutate(() => feed.dismiss('comments', c.id))}>{t('feed.keep')}</Button>
                {delComment(c.id)}
              </>)))}
          </>)),
        sec('recent', t('feed.modRecent'), d.recentPosts.length + d.recentComments.length, (
          <>
            <p className="fm-note">{t('feed.modRecentNote')}</p>
            {d.recentPosts.map((p) => postRow(p, (
              <>
                <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => run.mutate(() => feed.setPost(p.id, 'hidden', 'admin'))}>{t('feed.hide')}</Button>
                {delPost(p.id)}
              </>)))}
            {d.recentComments.map((c) => commentRow(c, (
              <>
                <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => run.mutate(() => feed.setComment(c.id, 'hidden', 'admin'))}>{t('feed.hide')}</Button>
                {delComment(c.id)}
              </>)))}
          </>)),
        sec('hidden', t('feed.modHidden'), d.hiddenPosts.length + d.hiddenComments.length, (
          <>
            {d.hiddenPosts.map((p) => postRow(p, (
              <>
                <Button size="small" icon={<UndoOutlined />} onClick={() => run.mutate(() => feed.setPost(p.id, 'published'))}>{t('feed.restore')}</Button>
                {delPost(p.id)}
              </>)))}
            {d.hiddenComments.map((c) => commentRow(c, (
              <>
                <Button size="small" icon={<UndoOutlined />} onClick={() => run.mutate(() => feed.setComment(c.id, 'published'))}>{t('feed.restore')}</Button>
                {delComment(c.id)}
              </>)))}
          </>)),
      ]} />
    </div>
  )
}

function PostPreview({ post }: { post: FeedPost }) {
  const ago = useTimeAgo()
  const { t } = useTranslation()
  return (
    <div className="fm-post">
      <div className="fp-head">
        <UserAvatar name={post.authorName} src={post.avatarUrl} size={34} />
        <div className="fp-who"><div className="fp-name"><b>{post.authorName}</b><WhoLine id={post.authorId} dept={post.department} /></div><span title={fmtTime(post.createdAt)}>{ago(post.createdAt)}</span></div>
        {post.reports > 0 && <Tag color="error" variant="filled">{t('feed.reportsN', { n: post.reports })}</Tag>}
        {post.hiddenReason && <Tag>{post.hiddenReason}</Tag>}
      </div>
      {post.body && <div className="fp-body">{post.body}</div>}
      {post.media.length > 0 && <MediaGrid media={post.media} />}
    </div>
  )
}

/** Cột trái: thẻ cá nhân và lối tắt tới các màn thường dùng (như cột lối tắt của Facebook). */
export function FeedSide() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const quick = ['overview', 'attendance', 'overtime', 'leave', 'annualLeave', 'closedAttendance', 'payslip', 'approvalFinger', 'qa']
    .map((k) => ALL_PAGES.find((p) => p.key === k)).filter((p): p is (typeof ALL_PAGES)[number] => !!p && canSee(p, user))
  return (
    <aside className="feed-side">
      <div className="fs-me">
        <UserAvatar name={user?.fullName} src={user?.avatarUrl} size={48} />
        <div><b>{user?.fullName}</b><span>{user?.userId}</span></div>
      </div>
      <div className="fs-title">{t('feed.shortcuts')}</div>
      <nav className="fs-links">
        {quick.map((p) => (
          <Link key={p.key} to={p.path}><span className="fs-ic">{p.icon}</span><span>{t(p.labelKey)}</span></Link>
        ))}
      </nav>
    </aside>
  )
}

/** Cột phải: quy định, cách dọn ảnh / video cũ và (quản trị) lối vào kiểm duyệt. */
export function FeedAside({ admin, modCount }: { admin: boolean; modCount: number }) {
  const { t } = useTranslation()
  return (
    <aside className="feed-aside">
      <Card size="small" title={<span className="fa-title"><SafetyCertificateOutlined /> {t('feed.asideRules')}</span>}>
        <ul className="fa-list">
          {['rule1', 'rule2', 'rule3', 'rule4'].map((k) => <li key={k}>{t(`feed.${k}`)}</li>)}
        </ul>
      </Card>
      <Card size="small" title={<span className="fa-title"><PictureOutlined /> {t('feed.asideMedia')}</span>}>
        <p className="fa-text">{t('feed.asideMediaText')}</p>
      </Card>
      {admin && (
        <Card size="small" title={<span className="fa-title"><EyeInvisibleOutlined /> {t('nav.feedModeration')}</span>}>
          <p className="fa-text">{modCount > 0 ? t('feed.asideModTodo', { n: modCount }) : t('feed.asideModClear')}</p>
          <Link to="/feed/moderation"><Button block type={modCount > 0 ? 'primary' : 'default'}>{t('nav.feedModeration')}{modCount > 0 && <Tag color="error" variant="filled" style={{ marginLeft: 8, marginRight: 0 }}>{modCount}</Tag>}</Button></Link>
        </Card>
      )}
    </aside>
  )
}
