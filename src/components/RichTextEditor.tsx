import { useEffect, useRef, useState } from 'react'
import { Button, Space, Tooltip } from 'antd'
import { useToast } from '../hooks/useToast'
import { BoldOutlined, ClearOutlined, ItalicOutlined, PictureOutlined, LinkOutlined, OrderedListOutlined, UnderlineOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

const COLORS = ['#101828', '#D92D20', '#2F6FB0', '#2E9E4F', '#D48806']

/**
 * Trình soạn văn bản gọn (đậm, nghiêng, gạch chân, màu chữ, danh sách, liên kết). Dán vào luôn là chữ thường để không kéo theo định dạng lạ;
 * máy chủ còn lọc HTML một lần nữa khi lưu nên không cần tin nội dung từ đây.
 * `value` chỉ nạp vào khi `resetKey` đổi (mở bản ghi khác) để con trỏ không nhảy khi đang gõ.
 */
export function RichTextEditor({ value, onChange, resetKey, onUploadImages }: { value: string; onChange: (html: string) => void; resetKey: string | number; onUploadImages?: (files: File[]) => Promise<string[]> }) {
  const { t } = useTranslation()
  const message = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (ref.current) ref.current.innerHTML = value }, [resetKey])   // eslint-disable-line react-hooks/exhaustive-deps

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }
  // Tải nhiều ảnh lên máy chủ rồi chèn từng ảnh tại con trỏ (lọc bỏ tệp không phải ảnh)
  const insertImages = async (picked: File[]) => {
    const files = picked.filter((f) => f.type.startsWith('image/'))
    if (!onUploadImages || files.length === 0) return
    setBusy(true)
    try {
      const urls = await onUploadImages(files)
      ref.current?.focus()
      for (const u of urls) document.execCommand('insertHTML', false, `<img src="${u}" alt=""><br>`)
      onChange(ref.current?.innerHTML ?? '')
      message.success(t('rte.imageDone', { n: urls.length }))
    } catch { message.error(t('rte.imageFail')) } finally { setBusy(false) }
  }
  const link = () => {
    const url = window.prompt(t('rte.linkPrompt'), 'https://')
    if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) run('createLink', url.trim())
  }

  return (
    <div className="rte">
      <div className="rte-bar">
        <Space size={2} wrap>
          <Tooltip title={t('rte.bold')}><Button size="small" type="text" icon={<BoldOutlined />} onMouseDown={(e) => { e.preventDefault(); run('bold') }} /></Tooltip>
          <Tooltip title={t('rte.italic')}><Button size="small" type="text" icon={<ItalicOutlined />} onMouseDown={(e) => { e.preventDefault(); run('italic') }} /></Tooltip>
          <Tooltip title={t('rte.underline')}><Button size="small" type="text" icon={<UnderlineOutlined />} onMouseDown={(e) => { e.preventDefault(); run('underline') }} /></Tooltip>
          <span className="rte-sep" />
          {COLORS.map((c) => <Tooltip key={c} title={t('rte.color')}><button type="button" className="rte-color" style={{ background: c }} aria-label={c} onMouseDown={(e) => { e.preventDefault(); run('foreColor', c) }} /></Tooltip>)}
          <span className="rte-sep" />
          <Tooltip title={t('rte.ul')}><Button size="small" type="text" icon={<UnorderedListOutlined />} onMouseDown={(e) => { e.preventDefault(); run('insertUnorderedList') }} /></Tooltip>
          <Tooltip title={t('rte.ol')}><Button size="small" type="text" icon={<OrderedListOutlined />} onMouseDown={(e) => { e.preventDefault(); run('insertOrderedList') }} /></Tooltip>
          <Tooltip title={t('rte.link')}><Button size="small" type="text" icon={<LinkOutlined />} onMouseDown={(e) => { e.preventDefault(); link() }} /></Tooltip>
          {onUploadImages && (
            <>
              <Tooltip title={t('rte.image')}><Button size="small" type="text" icon={<PictureOutlined />} loading={busy} onMouseDown={(e) => { e.preventDefault(); fileRef.current?.click() }} /></Tooltip>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void insertImages(fs) }} />
            </>
          )}
          <Tooltip title={t('rte.clear')}><Button size="small" type="text" icon={<ClearOutlined />} onMouseDown={(e) => { e.preventDefault(); run('removeFormat') }} /></Tooltip>
        </Space>
      </div>
      <div
        ref={ref} className="rte-area hn-body" contentEditable suppressContentEditableWarning role="textbox" aria-multiline
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        onPaste={(e) => {
          e.preventDefault()
          const pics = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
          if (pics.length > 0 && onUploadImages) { void insertImages(pics); return }
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        }}
      />
    </div>
  )
}
