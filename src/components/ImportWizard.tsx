import { useState, type ReactNode } from 'react'
import { Alert, Button, Space, Steps, Typography, Upload } from 'antd'
import { CheckCircleFilled, CheckOutlined, DownloadOutlined, FileExcelOutlined, InboxOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiError, type ImportIssue } from '../api/healthLeave'
import { useToast } from '../hooks/useToast'

const MAX_SHOWN = 8

export function IssueList({ title, type, items, issueKey }: { title: string; type: 'error' | 'warning'; items: ImportIssue[]; issueKey: string }) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <Alert type={type} showIcon style={{ marginBottom: 12 }} title={`${title} (${items.length})`}
      description={(
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.slice(0, MAX_SHOWN).map((i, k) => (
            <li key={k}>{t('cls.row', { n: i.excelRow })}: {t(`${issueKey}.${i.code}`, { defaultValue: t(`imp.issue.${i.code}`, { defaultValue: i.code }) })}{i.detail ? ` (${i.detail})` : ''}</li>
          ))}
          {items.length > MAX_SHOWN && <li>…</li>}
        </ul>
      )} />
  )
}

interface Props<P extends { token: string; fileName: string; totalRows: number }, R> {
  noteTitle: string
  note: string
  dropText: string
  preview: (file: File) => Promise<P>
  commit: (token: string) => Promise<R>
  template: () => Promise<void>
  /** Phần thân của bước xem trước: thẻ số liệu, cảnh báo, bảng… */
  renderPreview: (p: P) => ReactNode
  confirmLabel: (p: P) => string
  doneTitle: string
  doneText: (r: R) => string
  onDone?: (result: R) => void
}

/** Luồng nhập Excel 3 bước dùng chung: chọn file → xem trước (chưa ghi gì) → xác nhận → hoàn tất. */
export function ImportWizard<P extends { token: string; fileName: string; totalRows: number }, R>(props: Props<P, R>) {
  const { t } = useTranslation()
  const msg = useToast()
  const [preview, setPreview] = useState<P | null>(null)
  const [done, setDone] = useState<R | null>(null)

  const errText = (e: unknown) => {
    const { code, detail } = apiError(e)
    if (code === 'too_large') return t('cls.err.too_large')
    if (code === 'expired') return t('cls.err.expired')
    if (code === 'bad_file') return t(`cls.err.bad_${detail}`, { defaultValue: t('cls.err.bad_file') })
    return t('cls.err.generic')
  }
  const doPreview = useMutation({ mutationFn: props.preview, onSuccess: (p) => { setDone(null); setPreview(p) }, onError: (e) => msg.error(errText(e)) })
  const commit = useMutation({
    mutationFn: () => props.commit(preview!.token),
    onSuccess: (r) => { setDone(r); setPreview(null); props.onDone?.(r) },
    onError: (e) => { msg.error(errText(e)); if (apiError(e).code === 'expired') setPreview(null) },
  })
  const step = done ? 2 : preview ? 1 : 0

  return (
    <div>
      <Steps className="ci-steps" current={step} items={[{ title: t('cls.step1') }, { title: t('cls.step2') }, { title: t('cls.step3') }]} />

      {!preview && !done && (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title={props.noteTitle} description={props.note} />
          <div className="ci-drop">
            <Upload.Dragger accept=".xlsx" multiple={false} showUploadList={false} disabled={doPreview.isPending} beforeUpload={(f) => { doPreview.mutate(f); return false }}>
              <InboxOutlined className="ci-drop-icon" />
              <div className="ci-drop-title">{doPreview.isPending ? t('cls.reading') : props.dropText}</div>
              <div className="ci-drop-hint">{t('cls.dropHint')}</div>
            </Upload.Dragger>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={() => props.template().catch(() => msg.error(t('cls.err.generic')))}>{t('cls.template')}</Button>
          </div>
        </>
      )}

      {done && (
        <div className="ci-card">
          <div className="ci-body ci-success">
            <CheckCircleFilled />
            <Typography.Title level={4} style={{ margin: '12px 0 4px' }}>{props.doneTitle}</Typography.Title>
            <Typography.Paragraph type="secondary">{props.doneText(done)}</Typography.Paragraph>
            <Button type="primary" onClick={() => setDone(null)}>{t('cls.importMore')}</Button>
          </div>
        </div>
      )}

      {preview && (
        <div className="ci-card">
          <header>
            <span className="ci-file"><FileExcelOutlined /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.fileName}</span></span>
            <Space>
              <Button onClick={() => setPreview(null)}>{t('cls.chooseOther')}</Button>
              <Button type="primary" icon={<CheckOutlined />} loading={commit.isPending} disabled={preview.totalRows === 0} onClick={() => commit.mutate()}>{props.confirmLabel(preview)}</Button>
            </Space>
          </header>
          <div className="ci-body">{props.renderPreview(preview)}</div>
        </div>
      )}
    </div>
  )
}

/** Thẻ số liệu gọn dùng ở bước xem trước. */
export function StatTiles({ items }: { items: { label: string; value: number | string; color?: string }[] }) {
  return (
    <div className="stat-grid">
      {items.map((i) => (
        <div key={i.label} className="stat-tile" style={{ ['--tile' as string]: i.color ?? '#0F6B3E' }}>
          <div className="st-label">{i.label}</div>
          <div className="st-value">{typeof i.value === 'number' ? i.value.toLocaleString() : i.value}</div>
        </div>
      ))}
    </div>
  )
}
