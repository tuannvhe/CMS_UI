import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Popover } from 'antd'
import { CustomerServiceOutlined, MessageOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { UserAvatar } from './UserAvatar'

interface SupportContact { name: string; title: string; phone: string; zaloUrl: string; qrUrl: string; note: string }

/** Bong bóng FAQ góc phải: danh thiếp Zalo của người hỗ trợ (cấu hình "Support" ở máy chủ) và đường dẫn tới hỏi đáp. */
export function SupportBubble() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [qrFailed, setQrFailed] = useState(false)
  const q = useQuery({ queryKey: ['support', 'contact'], queryFn: () => api.get<SupportContact>('/support/contact').then((r) => r.data), staleTime: 10 * 60 * 1000, retry: false })
  const c = q.data
  const hasCard = !!c && (c.name || c.phone || c.zaloUrl)
  const content = (
    <div className="sb-panel">
      <div className="sb-title"><QuestionCircleOutlined /> {t('support.title')}</div>
      {hasCard ? (
        <div className="sb-card">
          <UserAvatar name={c!.name || 'Zalo'} size={48} />
          <div className="sb-who">
            <b>{c!.name || t('support.contact')}</b>
            {c!.title && <span>{c!.title}</span>}
            {c!.phone && <span>Zalo: <a href={`tel:${c!.phone.replace(/\s/g, '')}`}>{c!.phone}</a></span>}
          </div>
        </div>
      ) : <div className="sb-none">{t('support.noCard')}</div>}
      {hasCard && c!.qrUrl && !qrFailed && <img className="sb-qr" src={c!.qrUrl} alt={t('support.qr')} onError={() => setQrFailed(true)} />}
      {hasCard && c!.note && <p className="sb-note">{c!.note}</p>}
      {hasCard && c!.zaloUrl && <Button type="primary" block icon={<MessageOutlined />} href={c!.zaloUrl} target="_blank" rel="noopener noreferrer">{t('support.openZalo')}</Button>}
      <div className="sb-links">
        <Link to="/qa" onClick={() => setOpen(false)}>{t('support.qa')}</Link>
        <Link to="/attendance/complaints" onClick={() => setOpen(false)}>{t('support.complaints')}</Link>
      </div>
    </div>
  )
  return (
    <Popover content={content} trigger="click" placement="topRight" open={open} onOpenChange={setOpen} arrow={false}>
      <button type="button" className="support-bubble" aria-label={t('support.title')} title={t('support.title')}>
        <CustomerServiceOutlined />
        <span>FAQ</span>
      </button>
    </Popover>
  )
}
