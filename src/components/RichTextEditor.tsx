import { useEffect, useRef } from 'react'
import { Button, Space, Tooltip } from 'antd'
import { BoldOutlined, ClearOutlined, ItalicOutlined, LinkOutlined, OrderedListOutlined, UnderlineOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

const COLORS = ['#101828', '#D92D20', '#2F6FB0', '#2E9E4F', '#D48806']

/**
 * Trình soạn văn bản gọn (đậm, nghiêng, gạch chân, màu chữ, danh sách, liên kết). Dán vào luôn là chữ thường để không kéo theo định dạng lạ;
 * máy chủ còn lọc HTML một lần nữa khi lưu nên không cần tin nội dung từ đây.
 * `value` chỉ nạp vào khi `resetKey` đổi (mở bản ghi khác) để con trỏ không nhảy khi đang gõ.
 */
export function RichTextEditor({ value, onChange, resetKey }: { value: string; onChange: (html: string) => void; resetKey: string | number }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { if (ref.current) ref.current.innerHTML = value }, [resetKey])   // eslint-disable-line react-hooks/exhaustive-deps

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(ref.current?.innerHTML ?? '')
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
          <Tooltip title={t('rte.clear')}><Button size="small" type="text" icon={<ClearOutlined />} onMouseDown={(e) => { e.preventDefault(); run('removeFormat') }} /></Tooltip>
        </Space>
      </div>
      <div
        ref={ref} className="rte-area hn-body" contentEditable suppressContentEditableWarning role="textbox" aria-multiline
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }}
      />
    </div>
  )
}
