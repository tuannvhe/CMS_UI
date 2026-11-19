import { useState } from 'react'
import { Button, Checkbox, Space, Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { AppModal } from '../../components/AppModal'
import { EXPORT_COLUMNS, EXPORT_DEFAULT_KEYS, EXPORT_GROUPS } from '../../api/idCards'

const LS_COLS = 'idc-export-cols'
const LS_PHOTOS = 'idc-export-photos'

/** Cột đã chọn lần trước (nhớ theo trình duyệt); lần đầu hoặc khoá lạ thì lấy mặc định. */
const loadKeys = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(LS_COLS) ?? 'null')
    if (Array.isArray(v)) {
      const ok = EXPORT_COLUMNS.filter((c) => v.includes(c.key)).map((c) => c.key)
      if (ok.length > 0) return ok
    }
  } catch { /* hỏng thì dùng mặc định */ }
  return EXPORT_DEFAULT_KEYS
}

/**
 * Hộp "Xuất Excel": chọn những trường (cột) đưa vào file, có hay không kèm ảnh. Lựa chọn được nhớ cho lần sau.
 * Cột trong file luôn theo thứ tự chuẩn của bảng nhập nhân sự, không theo thứ tự tích.
 */
export default function IdCardExportModal({ open, count, loading, onClose, onExport }: {
  open: boolean; count: number; loading: boolean; onClose: () => void
  onExport: (columns: string[], photos: boolean) => void
}) {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<string[]>(loadKeys)
  const [photos, setPhotos] = useState(() => { try { return localStorage.getItem(LS_PHOTOS) !== '0' } catch { return true } })

  const toggle = (k: string, on: boolean) => setKeys((p) => (on ? [...p, k] : p.filter((x) => x !== k)))
  const go = () => {
    const cols = EXPORT_COLUMNS.filter((c) => keys.includes(c.key)).map((c) => c.key)
    try { localStorage.setItem(LS_COLS, JSON.stringify(cols)); localStorage.setItem(LS_PHOTOS, photos ? '1' : '0') } catch { /* không lưu được thì thôi */ }
    onExport(cols, photos)
  }

  return (
    <AppModal
      open={open} onClose={onClose} size="lg" icon={<FileExcelOutlined />} title={t('idc.exp.title')} subtitle={t('idc.exp.rows', { n: count })}
      onOk={go} okText={t('idc.exp.ok')} okDisabled={keys.length === 0} okLoading={loading}
      extra={(
        <Space size={4}>
          <Button size="small" onClick={() => setKeys(EXPORT_COLUMNS.map((c) => c.key))}>{t('idc.exp.all')}</Button>
          <Button size="small" onClick={() => setKeys([])}>{t('idc.exp.none')}</Button>
          <Button size="small" onClick={() => setKeys(EXPORT_DEFAULT_KEYS)}>{t('idc.exp.default')}</Button>
        </Space>
      )}
    >
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <Typography.Text type="secondary">{t('idc.exp.hint')} <b>{t('idc.exp.picked', { n: keys.length, total: EXPORT_COLUMNS.length })}</b></Typography.Text>
        <Checkbox style={{ fontWeight: 600 }} checked={photos} onChange={(e) => setPhotos(e.target.checked)}>{t('idc.exportPhotos')}</Checkbox>
        {EXPORT_GROUPS.map((g) => {
          const cols = EXPORT_COLUMNS.filter((c) => c.group === g)
          const on = cols.filter((c) => keys.includes(c.key)).length
          return (
            <div key={g}>
              <Checkbox
                checked={on === cols.length} indeterminate={on > 0 && on < cols.length}
                onChange={(e) => setKeys((p) => [...p.filter((k) => !cols.some((c) => c.key === k)), ...(e.target.checked ? cols.map((c) => c.key) : [])])}
              >
                <b>{t(`idc.exp.g.${g}`)}</b>
              </Checkbox>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '6px 12px', margin: '6px 0 0 24px' }}>
                {cols.map((c) => <Checkbox key={c.key} checked={keys.includes(c.key)} onChange={(e) => toggle(c.key, e.target.checked)}>{t(`idc.exp.c.${c.key}`)}</Checkbox>)}
              </div>
            </div>
          )
        })}
      </Space>
    </AppModal>
  )
}
