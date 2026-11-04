import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Button, Image, Segmented, Space, Switch } from 'antd'
import { ClearOutlined, EditOutlined, ExpandAltOutlined, ShrinkOutlined, UndoOutlined, UpOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { inkUrl, type InkField } from '../../api/recruit'

/** Khung viết tay bằng bút (hoặc ngón tay) trên tablet: nét vẽ lưu theo toạ độ 1000 × H nên co giãn theo chiều ngang màn hình mà không lệch. */
const W = 1000
const SCALE = 2          // điểm ảnh thật trên mỗi đơn vị toạ độ (nét sắc trên màn hình cao điểm)
const H_SMALL = 320, H_BIG = 640
const MAX_BYTES = 700_000
const COLORS = ['#111827', '#1d4ed8', '#dc2626']

type Pt = [number, number]
interface Stroke { color: string; width: number; erase: boolean; pts: Pt[] }

export interface InkPadHandle {
  /** Ảnh PNG nền trắng; null nếu chưa viết gì. */
  png: () => Promise<Blob | null>
  clear: () => void
}

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], h: number) {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, h)
  for (const s of strokes) {
    ctx.strokeStyle = s.erase ? '#fff' : s.color
    ctx.fillStyle = s.erase ? '#fff' : s.color
    ctx.lineWidth = s.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (s.pts.length === 1) {
      ctx.beginPath(); ctx.arc(s.pts[0][0], s.pts[0][1], s.width / 2, 0, Math.PI * 2); ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(s.pts[0][0], s.pts[0][1])
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1])
    ctx.stroke()
  }
}

export const InkPad = forwardRef<InkPadHandle, { onChange?: (hasInk: boolean) => void }>(function InkPad({ onChange }, ref) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const pointer = useRef<number | null>(null)
  const penSeen = useRef(false)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [big, setBig] = useState(false)
  const [penOnly, setPenOnly] = useState(false)
  const [, tick] = useState(0)
  const h = big ? H_BIG : H_SMALL

  const redraw = useCallback(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (c && ctx) paint(ctx, strokes.current, h)
  }, [h])
  const changed = useCallback(() => { tick((n) => n + 1); onChange?.(strokes.current.length > 0) }, [onChange])

  // Đổi chiều cao khung thì canvas bị xoá: vẽ lại toàn bộ nét
  useEffect(() => { redraw() }, [redraw])

  useImperativeHandle(ref, () => ({
    clear: () => { strokes.current = []; redraw(); changed() },
    png: async () => {
      if (strokes.current.length === 0) return null
      const encode = (scale: number) => new Promise<Blob | null>((resolve) => {
        const off = document.createElement('canvas')
        off.width = Math.round(W * SCALE * scale); off.height = Math.round(h * SCALE * scale)
        const ctx = off.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.scale(scale, scale)
        paint(ctx, strokes.current, h)
        off.toBlob((b) => resolve(b), 'image/png')
      })
      let blob = await encode(1)
      if (blob && blob.size > MAX_BYTES) blob = await encode(0.5)
      return blob && blob.size <= MAX_BYTES ? blob : null
    },
  }), [h, redraw, changed])

  const at = (e: React.PointerEvent | PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) * W) / r.width * 10) / 10, Math.round(((e.clientY - r.top) * h) / r.height * 10) / 10]
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen' && !penSeen.current) { penSeen.current = true; setPenOnly(true) }   // có bút: tự bỏ qua lòng bàn tay / ngón tay
    if (pointer.current !== null) return
    if (e.pointerType === 'touch' && (penOnly || penSeen.current)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointer.current = e.pointerId
    const erase = tool === 'eraser'
    current.current = { color, width: erase ? 28 : e.pointerType === 'pen' ? 3 : 4, erase, pts: [at(e)] }
    strokes.current.push(current.current)
    redraw()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = current.current
    if (!s || pointer.current !== e.pointerId) return
    e.preventDefault()
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []).length > 0 ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent]
    const ctx = canvas.current?.getContext('2d')
    for (const ev of events) {
      const p = at(ev)
      const last = s.pts[s.pts.length - 1]
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 0.6) continue
      s.pts.push(p)
      if (ctx) {
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
        ctx.strokeStyle = s.erase ? '#fff' : s.color; ctx.lineWidth = s.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke()
      }
    }
  }
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current !== e.pointerId) return
    pointer.current = null
    current.current = null
    changed()
  }

  const undo = () => { strokes.current.pop(); redraw(); changed() }
  const empty = strokes.current.length === 0

  return (
    <div className="ink-pad">
      <Space wrap size={[8, 6]} style={{ marginBottom: 6 }}>
        <Segmented size="large" value={tool} onChange={(v) => setTool(v as 'pen' | 'eraser')} options={[{ value: 'pen', label: t('rec.ink.pen') }, { value: 'eraser', label: t('rec.ink.eraser') }]} />
        {COLORS.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => { setColor(c); setTool('pen') }}
            style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: color === c && tool === 'pen' ? '3px solid var(--c-primary, #1677ff)' : '2px solid #d1d5db', cursor: 'pointer', padding: 0 }} />
        ))}
        <Button size="large" icon={<UndoOutlined />} onClick={undo} disabled={empty}>{t('rec.ink.undo')}</Button>
        <Button size="large" icon={<ClearOutlined />} onClick={() => { strokes.current = []; redraw(); changed() }} disabled={empty}>{t('rec.ink.clear')}</Button>
        <Button size="large" icon={big ? <ShrinkOutlined /> : <ExpandAltOutlined />} onClick={() => setBig((v) => !v)}>{big ? t('rec.ink.small') : t('rec.ink.big')}</Button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Switch checked={penOnly} onChange={(v) => { penSeen.current = v; setPenOnly(v) }} />{t('rec.ink.penOnly')}</label>
      </Space>
      <canvas
        ref={canvas}
        width={W * SCALE}
        height={h * SCALE}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={(e) => e.preventDefault()}
        style={{ width: '100%', aspectRatio: `${W} / ${h}`, touchAction: 'none', background: '#fff', border: '1px solid var(--c-border, #d9d9d9)', borderRadius: 8, display: 'block', cursor: 'crosshair', backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #e5e7eb 39px, #e5e7eb 40px)' }}
      />
      <div className="cell-muted" style={{ marginTop: 4 }}>{t('rec.ink.hint')}</div>
    </div>
  )
})

/** Nút "Viết tay" dưới một ô chữ: bấm mở khung viết bằng bút; khung vẫn giữ nét khi thu gọn. */
export const InkToggle = forwardRef<InkPadHandle, { onChange?: (hasInk: boolean) => void }>(function InkToggle({ onChange }, ref) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)   // chỉ dựng canvas khi mở lần đầu
  const [has, setHas] = useState(false)
  return (
    <div>
      <Button size="large" type={has ? 'primary' : 'default'} icon={open ? <UpOutlined /> : <EditOutlined />} onClick={() => { setShown(true); setOpen((v) => !v) }}>
        {open ? t('rec.ink.hide') : has ? t('rec.ink.edit') : t('rec.ink.write')}
      </Button>
      {shown && <div style={{ display: open ? 'block' : 'none', marginTop: 8 }}><InkPad ref={ref} onChange={(v) => { setHas(v); onChange?.(v) }} /></div>}
    </div>
  )
})

/** Bản viết tay đã nộp ở một ô của phiếu (chỉ chính người viết và HR xem được); không có thì không hiện gì. */
export function InkImage({ interviewId, interviewerId, field, label }: { interviewId: number; interviewerId: string; field: InkField; label: string }) {
  const [bad, setBad] = useState(false)
  if (bad) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div className="cell-muted">{label}</div>
      <Image src={inkUrl(interviewId, interviewerId, field)} alt="" onError={() => setBad(true)} style={{ maxWidth: '100%', maxHeight: 360, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6 }} />
    </div>
  )
}

/** Bản viết tay của cả ba ô (điểm mạnh, điểm yếu, nhận xét). */
export function InkImages({ interviewId, interviewerId }: { interviewId: number; interviewerId: string }) {
  const { t } = useTranslation()
  return (
    <>
      <InkImage interviewId={interviewId} interviewerId={interviewerId} field="strengths" label={`${t('rec.strengths')} (${t('rec.ink.title').toLowerCase()})`} />
      <InkImage interviewId={interviewId} interviewerId={interviewerId} field="weaknesses" label={`${t('rec.weaknesses')} (${t('rec.ink.title').toLowerCase()})`} />
      <InkImage interviewId={interviewId} interviewerId={interviewerId} field="comment" label={`${t('rec.comment')} (${t('rec.ink.title').toLowerCase()})`} />
    </>
  )
}
