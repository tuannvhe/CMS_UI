import { useMemo, useState, type KeyboardEvent } from 'react'
import { Input, Modal, Empty } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { ALL_PAGES, canSee } from '../config/navigation'

/** Bỏ dấu tiếng Việt để gõ "nghi phep" vẫn tìm ra "Nghỉ phép". */
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

function Body({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  const results = useMemo(() => {
    const needle = fold(q.trim())
    return ALL_PAGES.filter((p) => canSee(p, user) && fold(`${t(p.labelKey)} ${t(p.descKey)} ${t(p.workspace.labelKey)}`).includes(needle))
  }, [q, t, user])

  const open = (path: string) => { navigate(path); onClose() }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[idx]) open(results[idx].path)
  }

  return (
    <div>
      <Input
        autoFocus
        size="large"
        variant="borderless"
        prefix={<SearchOutlined />}
        placeholder={t('common.searchPlaceholder')}
        value={q}
        onChange={(e) => { setQ(e.target.value); setIdx(0) }}
        onKeyDown={onKeyDown}
        style={{ borderBottom: '1px solid var(--c-border)', borderRadius: 0 }}
      />
      <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
        {results.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.searchEmpty')} />}
        {results.map((p, i) => (
          <button
            key={p.key}
            type="button"
            className={`side-item${i === idx ? ' active' : ''}`}
            onMouseEnter={() => setIdx(i)}
            onClick={() => open(p.path)}
          >
            <span className="si-icon">{p.icon}</span>
            <span style={{ minWidth: 0 }}>
              <div className="si-title">{t(p.labelKey)}</div>
              <div className="si-desc">{t(p.workspace.labelKey)} · {t(p.descKey)}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Hộp tìm nhanh trang/chức năng (mở bằng Ctrl+K hoặc nút tìm kiếm trên left rail). */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      styles={{ body: { padding: 0 }, container: { padding: 0, overflow: 'hidden' } }}
      style={{ top: 96 }}
    >
      {open && <Body onClose={onClose} />}
    </Modal>
  )
}
