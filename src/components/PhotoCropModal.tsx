import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button, Modal, Slider, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

/** Vùng hiển thị ảnh theo cỡ cửa sổ: lớn nhất có thể (tối đa 900 x 620), chừa chỗ cho tiêu đề, thanh trượt và nút. */
const stageSize = () => (typeof window === 'undefined' ? { w: 560, h: 420 } : { w: Math.max(280, Math.min(900, window.innerWidth - 96)), h: Math.max(240, Math.min(620, window.innerHeight - 300)) })
const MIN = 48        // cạnh nhỏ nhất của khung cắt
const OUT = 512       // cạnh ảnh xuất ra tối đa
type Box = { x: number; y: number; s: number }
type Corner = 'nw' | 'ne' | 'sw' | 'se'
const SIGN: Record<Corner, [number, number]> = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] }

/**
 * Modal cắt ảnh kiểu Zalo: hiện nguyên ảnh, phủ mờ phần ngoài khung; kéo khung để dời, kéo 4 góc để đổi cỡ khung (luôn vuông),
 * thanh trượt / phím + − để đổi cỡ, phím mũi tên để nhích. Không dùng thư viện ngoài. round = khung tròn (ảnh đại diện).
 */
export function PhotoCropModal({ file, title, round, busy, onCancel, onDone }: {
  file: File | null; title?: string; round?: boolean; busy?: boolean; onCancel: () => void; onDone: (cropped: File) => void
}) {
  const { t } = useTranslation()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [box, setBox] = useState<Box>({ x: 0, y: 0, s: 100 })
  const stage = useRef<HTMLDivElement>(null)
  const [{ w: STAGE_W, h: STAGE_H }] = useState(stageSize)   // chốt lúc mở, không đổi khi kéo
  const drag = useRef<{ mode: 'move' | Corner; px: number; py: number; box: Box } | null>(null)

  // Ảnh hiển thị vừa khung STAGE (không phóng to quá cỡ gốc gấp đôi)
  const d = img ? Math.min(STAGE_W / img.naturalWidth, STAGE_H / img.naturalHeight, 3) : 1
  const dw = img ? Math.round(img.naturalWidth * d) : STAGE_W
  const dh = img ? Math.round(img.naturalHeight * d) : STAGE_H
  const maxS = Math.min(dw, dh)

  useEffect(() => {
    if (!file) { setImg(null); return }
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      setImg(el)
      const k = Math.min(STAGE_W / el.naturalWidth, STAGE_H / el.naturalHeight, 3)
      const w = Math.round(el.naturalWidth * k), h = Math.round(el.naturalHeight * k)
      const s = Math.max(MIN, Math.round(Math.min(w, h) * 0.8))
      setBox({ x: Math.round((w - s) / 2), y: Math.round((h - s) / 2), s })
    }
    el.onerror = () => setImg(null)
    el.src = url
    return () => URL.revokeObjectURL(url)
  }, [file, STAGE_W, STAGE_H])

  const fit = (b: Box): Box => {
    const s = Math.max(Math.min(MIN, maxS), Math.min(b.s, maxS))
    return { s, x: Math.min(dw - s, Math.max(0, b.x)), y: Math.min(dh - s, Math.max(0, b.y)) }
  }
  const local = (e: PointerEvent) => { const r = stage.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const start = (mode: 'move' | Corner) => (e: PointerEvent) => {
    e.stopPropagation(); e.preventDefault()
    stage.current?.setPointerCapture(e.pointerId)
    const p = local(e)
    drag.current = { mode, px: p.x, py: p.y, box }
  }
  const move = (e: PointerEvent) => {
    const g = drag.current
    if (!g) return
    const p = local(e)
    if (g.mode === 'move') { setBox(fit({ ...g.box, x: g.box.x + p.x - g.px, y: g.box.y + p.y - g.py })); return }
    const [sx, sy] = SIGN[g.mode]
    // Góc đối diện đứng yên; cạnh mới = khoảng cách lớn hơn từ góc đó tới con trỏ, không vượt biên ảnh
    const ax = sx > 0 ? g.box.x : g.box.x + g.box.s, ay = sy > 0 ? g.box.y : g.box.y + g.box.s
    const room = Math.min(sx > 0 ? dw - ax : ax, sy > 0 ? dh - ay : ay)
    const s = Math.max(Math.min(MIN, room), Math.min(room, Math.max((p.x - ax) * sx, (p.y - ay) * sy)))
    setBox({ s, x: sx > 0 ? ax : ax - s, y: sy > 0 ? ay : ay - s })
  }
  const end = () => { drag.current = null }
  const resize = (s: number) => setBox((b) => fit({ s, x: b.x + (b.s - s) / 2, y: b.y + (b.s - s) / 2 }))   // đổi cỡ quanh tâm khung
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 6
    const m = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : e.key === 'ArrowDown' ? [0, step] : null
    if (m) { e.preventDefault(); setBox((b) => fit({ ...b, x: b.x + m[0], y: b.y + m[1] })) }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); resize(box.s + 12) }
    else if (e.key === '-') { e.preventDefault(); resize(box.s - 12) }
  }

  const ok = () => {
    if (!img || !file) return
    const side = box.s / d   // cạnh vùng cắt trên ảnh gốc
    const out = Math.max(16, Math.min(OUT, Math.round(side)))
    const c = document.createElement('canvas')
    c.width = out; c.height = out
    const g = c.getContext('2d')
    if (!g) return
    g.fillStyle = '#fff'; g.fillRect(0, 0, out, out)   // PNG trong suốt: nền trắng
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, box.x / d, box.y / d, side, side, 0, 0, out, out)
    c.toBlob((b) => { if (b) onDone(new File([b], (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg', { type: 'image/jpeg' })) }, 'image/jpeg', 0.9)
  }

  const handle = (c: Corner) => {
    const [sx, sy] = SIGN[c]
    return (
      <div key={c} onPointerDown={start(c)} aria-hidden
        style={{ position: 'absolute', width: 28, height: 28, [sx > 0 ? 'right' : 'left']: -14, [sy > 0 ? 'bottom' : 'top']: -14, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 12, height: 12, background: '#fff', borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.45)' }} />
      </div>
    )
  }

  return (
    <Modal open={!!file} title={title ?? t('idc.crop.title')} width={STAGE_W + 56} onCancel={onCancel} destroyOnHidden maskClosable={false}
      footer={[<Button key="c" onClick={onCancel} disabled={busy}>{t('idc.crop.cancel')}</Button>, <Button key="o" type="primary" onClick={ok} loading={busy} disabled={!img}>{t('idc.crop.ok')}</Button>]}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div ref={stage} role="application" tabIndex={0} aria-label={t('idc.crop.hint')} onKeyDown={onKey} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
          style={{ position: 'relative', width: dw, height: dh, overflow: 'hidden', background: '#222', borderRadius: 6, touchAction: 'none', userSelect: 'none', outlineOffset: 2 }}>
          {img && <img src={img.src} alt="" draggable={false} style={{ width: dw, height: dh, display: 'block', maxWidth: 'none', pointerEvents: 'none' }} />}
          {img && (
            <div onPointerDown={start('move')}
              style={{ position: 'absolute', left: box.x, top: box.y, width: box.s, height: box.s, cursor: 'move', touchAction: 'none', boxSizing: 'border-box',
                border: '2px solid #fff', borderRadius: round ? '50%' : 2, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                backgroundImage: round ? undefined : 'linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)),linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)),linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)),linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35))',
                backgroundSize: round ? undefined : '1px 100%, 1px 100%, 100% 1px, 100% 1px',
                backgroundPosition: round ? undefined : '33.3% 0, 66.6% 0, 0 33.3%, 0 66.6%', backgroundRepeat: 'no-repeat' }}>
              {(['nw', 'ne', 'sw', 'se'] as Corner[]).map(handle)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: Math.min(dw, STAGE_W) }}>
          <Button size="small" aria-label="−" onClick={() => resize(box.s - 12)} disabled={box.s <= MIN}>−</Button>
          <Slider style={{ flex: 1, margin: '0 4px' }} min={Math.min(MIN, maxS)} max={maxS} step={1} value={Math.round(box.s)} onChange={resize} aria-label={t('idc.crop.zoom')} tooltip={{ open: false }} />
          <Button size="small" aria-label="+" onClick={() => resize(box.s + 12)} disabled={box.s >= maxS}>+</Button>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>{t('idc.crop.hint')}</Typography.Text>
      </div>
    </Modal>
  )
}
