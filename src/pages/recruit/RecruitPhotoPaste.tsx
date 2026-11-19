import { useEffect, useRef, useState } from 'react'
import { Button, Tooltip, Typography } from 'antd'
import { SnippetsOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

const MAX_SIDE = 800   // ảnh dán (thường là ảnh chụp màn hình rất lớn) thu về tối đa 800 điểm ảnh cạnh dài trước khi gửi; máy chủ còn thu tiếp về 300
const MIN_SIDE = 20    // giống ngưỡng máy chủ (CvPhoto.Normalize)
const MAX_BYTES = 3_000_000   // giống RecruitService.MaxPhoto

/** Ô đang gõ chữ: dán ở đó là dán chữ / ảnh vào ô đó, không phải đổi ảnh ứng viên. */
const editable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')

/** Đọc ảnh, thu nhỏ nếu cần, nền trắng, xuất JPEG. Lỗi: 'bad' (không đọc được) hoặc 'small' (quá nhỏ). */
function toJpeg(blob: Blob): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w0 = img.naturalWidth, h0 = img.naturalHeight
      if (w0 < MIN_SIDE || h0 < MIN_SIDE) { reject(new Error('small')); return }
      const k = Math.min(1, MAX_SIDE / Math.max(w0, h0))
      const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const g = c.getContext('2d')
      if (!g) { reject(new Error('bad')); return }
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h)   // PNG trong suốt: nền trắng
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, 0, 0, w, h)
      c.toBlob((b) => (b && b.size <= MAX_BYTES ? resolve(new File([b], 'pasted-photo.jpg', { type: 'image/jpeg' })) : reject(new Error(b ? 'size' : 'bad'))), 'image/jpeg', 0.9)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')) }
    img.src = url
  })
}

/**
 * Dán ảnh ứng viên từ bộ nhớ tạm: khi modal hồ sơ đang mở, sao chép một ảnh (ảnh chụp màn hình, ảnh trong CV, ảnh trên web…) rồi Ctrl+V
 * ở bất kỳ chỗ nào không phải ô nhập chữ → hiện xem trước → bấm Lưu mới gửi lên, dùng đúng API "Đổi ảnh" (onSave).
 * Nút "Dán ảnh" đọc bộ nhớ tạm bằng Clipboard API (trình duyệt có thể hỏi quyền; bị chặn thì nhắc dùng Ctrl+V).
 */
export function PhotoPasteButton({ name, busy, onSave }: { name: string; busy?: boolean; onSave: (f: File) => Promise<unknown> }) {
  const { t } = useTranslation()
  const toast = useToast()
  const anchor = useRef<HTMLSpanElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const take = async (blob: Blob) => {
    try { setFile(await toJpeg(blob)) }
    catch (e) { toast.error(t(`rec.photo.paste.${(e as Error).message === 'small' ? 'small' : (e as Error).message === 'size' ? 'size' : 'bad'}`)) }
  }

  // Lưu hàm mới nhất để listener gắn một lần vẫn dùng đúng state
  const takeRef = useRef(take)
  takeRef.current = take
  const openRef = useRef(false)
  openRef.current = file !== null

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (openRef.current || editable(e.target)) return
      // Đang ở modal khác chồng lên (soạn mail, đặt lịch…) thì bỏ qua
      const modal = e.target instanceof Element ? e.target.closest('.ant-modal') : null
      if (modal && anchor.current && !modal.contains(anchor.current)) return
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      const blob = item?.getAsFile()
      if (!blob) return
      e.preventDefault()
      void takeRef.current(blob)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  const readClipboard = async () => {
    const clip = navigator.clipboard as Clipboard | undefined
    if (!clip?.read) { toast.info(t('rec.photo.paste.useKeys')); return }
    try {
      for (const it of await clip.read()) {
        const type = it.types.find((x) => x.startsWith('image/'))
        if (type) { await take(await it.getType(type)); return }
      }
      toast.warning(t('rec.photo.paste.none'))
    } catch {
      toast.info(t('rec.photo.paste.useKeys'))
    }
  }

  const save = async () => {
    if (!file) return
    try { await onSave(file); setFile(null) } catch { /* lỗi đã báo qua onError của mutation; giữ modal để thử lại */ }
  }

  return (
    <>
      <Tooltip title={t('rec.photo.paste.hint')}>
        <span ref={anchor}><Button size="small" icon={<SnippetsOutlined />} onClick={readClipboard} disabled={busy}>{t('rec.photo.paste.btn')}</Button></span>
      </Tooltip>
      <AppModal open={file !== null} onClose={() => setFile(null)} size="sm" icon={<SnippetsOutlined />} title={t('rec.photo.paste.title')} subtitle={name}
        okText={t('rec.photo.paste.ok')} okLoading={busy} onOk={save}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {preview && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <img src={preview} alt={name} style={{ maxWidth: 260, maxHeight: 320, borderRadius: 6, border: '1px solid var(--c-border, #e5e7eb)', display: 'block' }} />
              <img src={preview} alt="" aria-hidden style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--c-border, #e5e7eb)', display: 'block' }} />
            </div>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>{t('rec.photo.paste.previewHint')}</Typography.Text>
        </div>
      </AppModal>
    </>
  )
}
