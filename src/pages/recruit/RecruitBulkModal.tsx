import { useState } from 'react'
import { Button, Input, Progress, Select, Tag, Upload } from 'antd'
import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { recruit } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'

interface Item { uid: string; file: File; name: string; state: 'wait' | 'ok' | 'fail'; error?: string }

const MAX_FILES = 100
const PARALLEL = 3
/** "Nguyen_Van-A (CV).pdf" → "Nguyen Van A (CV)": gợi ý họ tên từ tên file, HR sửa lại được trước khi tải. */
const nameOf = (f: File) => f.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)

/** Tải hàng loạt CV cho staff trở lên: chọn vị trí một lần, mỗi file PDF thành một hồ sơ (mỗi file một yêu cầu để không vướng giới hạn dung lượng máy chủ). */
export function RecruitBulkModal({ open, onClose, departments, factories, onChanged }: { open: boolean; onClose: () => void; departments: string[]; factories: string[]; onChanged: () => void }) {
  const { t } = useTranslation()
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState<string>()
  const [factory, setFactory] = useState<string>()
  const [items, setItems] = useState<Item[]>([])
  const [running, setRunning] = useState(false)
  const done = items.filter((i) => i.state !== 'wait').length
  const failed = items.filter((i) => i.state === 'fail').length
  const pending = items.filter((i) => i.state === 'wait')

  const reset = () => { setItems([]); setPosition(''); setDepartment(undefined); setFactory(undefined) }
  const close = () => { if (running) return; if (done > 0) onChanged(); reset(); onClose() }

  const add = (file: File) => {
    setItems((xs) => (xs.length >= MAX_FILES || !/\.pdf$/i.test(file.name) ? xs : [...xs, { uid: `${file.name}-${file.size}-${xs.length}-${Date.now()}`, file, name: nameOf(file), state: 'wait' }]))
    return false
  }
  const patch = (uid: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.uid === uid ? { ...x, ...p } : x)))

  const run = async () => {
    const queue = items.filter((i) => i.state !== 'ok' && i.name.trim().length > 0)
    setRunning(true)
    let next = 0
    const worker = async () => {
      while (next < queue.length) {
        const it = queue[next++]
        try {
          await recruit.create({ fullName: it.name.trim(), position: position.trim(), level: 'staff', department, factory, file: it.file })
          patch(it.uid, { state: 'ok', error: undefined })
        } catch (e) {
          const { detail, code } = adminError(e)
          patch(it.uid, { state: 'fail', error: t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker))
    setRunning(false)
    onChanged()
  }

  const canRun = position.trim().length > 0 && items.some((i) => i.state !== 'ok' && i.name.trim().length > 0)
  return (
    <AppModal open={open} onClose={close} size="lg" icon={<UploadOutlined />} title={t('rec.bulk.title')} okText={failed > 0 && pending.length === 0 ? t('rec.bulk.retry') : t('rec.bulk.run', { n: items.filter((i) => i.state !== 'ok').length })}
      okLoading={running} onOk={() => { if (canRun) void run() }}>
      <p className="cell-muted">{t('rec.bulk.hint', { max: MAX_FILES })}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 260px' }}><div>{t('rec.position')} *</div><Input value={position} maxLength={100} onChange={(e) => setPosition(e.target.value)} disabled={running} /></div>
        <div><div>{t('rec.department')}</div><Select allowClear showSearch optionFilterProp="label" style={{ width: 240 }} value={department} onChange={setDepartment} disabled={running} options={departments.map((x) => ({ value: x, label: x }))} /></div>
        <div><div>{t('rec.factory')}</div><Select allowClear showSearch optionFilterProp="label" style={{ width: 170 }} value={factory} onChange={setFactory} disabled={running} options={factories.map((x) => ({ value: x, label: x }))} /></div>
      </div>
      <Upload.Dragger multiple accept=".pdf,application/pdf" showUploadList={false} beforeUpload={add} disabled={running || items.length >= MAX_FILES}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p>{t('rec.bulk.drop')}</p>
      </Upload.Dragger>
      {items.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {(running || done > 0) && <Progress percent={Math.round((done / items.length) * 100)} size="small" status={failed ? 'exception' : undefined} format={() => `${done}/${items.length}`} />}
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            {items.map((i) => (
              <div key={i.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border, #f0f0f0)' }}>
                <Input size="small" style={{ flex: 1 }} value={i.name} maxLength={100} disabled={running || i.state === 'ok'} status={i.name.trim() ? undefined : 'error'} onChange={(e) => patch(i.uid, { name: e.target.value })} />
                <span className="cell-muted" style={{ width: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.file.name}>{i.file.name}</span>
                {i.state === 'ok' && <Tag color="green">{t('rec.bulk.ok')}</Tag>}
                {i.state === 'fail' && <Tag color="red" title={i.error}>{i.error}</Tag>}
                {i.state !== 'ok' && !running && <Button size="small" type="text" onClick={() => setItems((xs) => xs.filter((x) => x.uid !== i.uid))}>✕</Button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppModal>
  )
}
