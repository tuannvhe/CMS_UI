import { useState, type ReactNode } from 'react'
import { Alert, Button, Empty, Input, Modal, Select, Space, Spin, Table, Tag, Upload } from 'antd'
import { AimOutlined, DownloadOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { KpiCategory, KpiImportResult, KpiIndicator, KpiPeriod, KpiPeriodStatus, KpiSheetStatus } from '../../api/kpi'
import { useToast } from '../../hooks/useToast'
import { CATS } from './kpiMeta'
import { pick } from './kpiDemoData'
import { isNotReady, kpiErrText, pickName, SHEET_STATUS_COLOR } from './kpiShared'

/** Thành phần giao diện dùng chung cho các màn KPI dữ liệu thật. */

export type KpiPageKey = 'kpiOverview' | 'kpiDepartment' | 'kpiLines' | 'kpiPeople' | 'kpiTargets' | 'kpiReport' | 'kpiEntry' | 'kpiAdmin'

/** Đầu trang KPI: khối trắng gọn (biểu tượng, tiêu đề, mô tả lấy từ nav.*), nút thao tác bên phải. Đặt ngay trên .kpi-bar thì hai khối liền nhau thành một. */
export function KpiHead({ page, extra }: { page: KpiPageKey; extra?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <header className="kpi-head">
      <span className="kh-ic" aria-hidden><AimOutlined /></span>
      <div className="kh-main">
        <h1>{t(`nav.${page}`)}</h1>
        <p>{t(`nav.${page}Desc`)}</p>
      </div>
      {extra && <div className="kh-extra">{extra}</div>}
    </header>
  )
}

/** Ô tên chỉ tiêu trong bảng: tên đậm, dòng dưới là nhóm (chấm màu) và mã. Có onClick thì thành liên kết mở chi tiết. */
export function NameCell({ ind, onClick }: { ind: Pick<KpiIndicator, 'name' | 'code' | 'category'>; onClick?: () => void }) {
  const { i18n } = useTranslation()
  const c = CATS[ind.category]
  const body = (
    <>
      <b>{pickName(ind.name, i18n.language)}</b>
      <small>{c && <i className="kpi-dot" style={{ background: c.color, marginRight: 2 }} />}{c ? `${pick(c.name, i18n.language)} · ` : ''}{ind.code}</small>
    </>
  )
  return onClick ? <a className="kpi-name" onClick={onClick}>{body}</a> : <span className="kpi-name">{body}</span>
}

/** Khung trạng thái truy vấn: đang tải / lỗi (kèm "chưa sẵn sàng" khi 409 not_ready) / rỗng / nội dung. */
export function KpiState({ loading, error, empty, emptyText, onRetry, children }: {
  loading?: boolean; error?: unknown; empty?: boolean; emptyText?: ReactNode; onRetry?: () => void; children?: ReactNode
}) {
  const { t } = useTranslation()
  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  if (error) {
    return isNotReady(error)
      ? <Alert type="warning" showIcon message={t('kpi.notReady')} />
      : <Alert type="error" showIcon message={kpiErrText(t, error)}
          action={onRetry && <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>{t('kpi.retry')}</Button>} />
  }
  if (empty) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText ?? t('kpi.noData')} />
  return <>{children}</>
}

export function PeriodSelect({ periods, value, onChange, loading, allowClear, placeholder, style }: {
  periods?: KpiPeriod[]; value?: number; onChange: (v: number | undefined) => void; loading?: boolean; allowClear?: boolean; placeholder?: string; style?: React.CSSProperties
}) {
  const { t } = useTranslation()
  return (
    <Select style={{ width: 200, ...style }} value={value} onChange={(v) => onChange(v ?? undefined)} loading={loading} allowClear={allowClear}
      placeholder={placeholder ?? t('kpi.period.pick')}
      options={(periods ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${t(`kpi.period.st.${p.status}`)}` }))} />
  )
}

export function SiteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  return <Select style={{ width: 140 }} value={value} onChange={onChange} options={['', 'BN', 'HY'].map((s) => ({ value: s, label: t(`kpi.site.${s || 'all'}`) }))} />
}

export function SheetStatusTag({ status }: { status: KpiSheetStatus | null | undefined }) {
  const { t } = useTranslation()
  if (!status) return <Tag>{t('kpi.assign.notAssigned')}</Tag>
  return <Tag color={SHEET_STATUS_COLOR[status]}>{t(`kpi.sheet.st.${status}`)}</Tag>
}

export function PeriodStatusTag({ status }: { status: KpiPeriodStatus }) {
  const { t } = useTranslation()
  return <Tag color={status === 'open' ? 'green' : status === 'closing' ? 'orange' : 'default'}>{t(`kpi.period.st.${status}`)}</Tag>
}

export function CatLabel({ cat }: { cat: KpiCategory }) {
  const { i18n } = useTranslation()
  const c = CATS[cat]
  if (!c) return <span>{cat}</span>
  return <span className="kpi-st"><i className="kpi-dot" style={{ background: c.color }} />{pick(c.name, i18n.language)}</span>
}

/** Nhập thực tế từ Excel: tải mẫu → chọn file → xem trước (dryRun) → ghi. */
export function KpiImportModal({ open, onClose, title, onTemplate, run, onApplied }: {
  open: boolean; onClose: () => void; title: ReactNode; onTemplate: () => Promise<void>
  run: (file: File, dryRun: boolean) => Promise<KpiImportResult>; onApplied: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KpiImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const reset = () => { setFile(null); setPreview(null) }
  const close = () => { reset(); onClose() }
  const check = async (f: File) => {
    setBusy(true); setFile(f); setPreview(null)
    try { setPreview(await run(f, true)) } catch (e) { toast.error(kpiErrText(t, e)); setFile(null) } finally { setBusy(false) }
  }
  const apply = async () => {
    if (!file) return
    setBusy(true)
    try {
      const r = await run(file, false)
      toast.success(t('kpi.import.applied', { n: r.applied }))
      if (r.errors.length) setPreview(r); else close()
      onApplied()
    } catch (e) { toast.error(kpiErrText(t, e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onCancel={close} title={title} width={760} destroyOnHidden centered
      footer={<Space>
        <Button onClick={close}>{t('kpi.close')}</Button>
        {preview && <Button onClick={reset} disabled={busy}>{t('kpi.import.another')}</Button>}
        <Button type="primary" loading={busy && !!preview} disabled={!preview || preview.rows.length === 0} onClick={apply}>{t('kpi.import.apply')}</Button>
      </Space>}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--c-muted)', fontSize: 13 }}>{t('kpi.import.hint')}</span>
        <Button type="link" icon={<DownloadOutlined />} onClick={() => onTemplate().catch((e) => toast.error(kpiErrText(t, e)))}>{t('kpi.import.template')}</Button>
      </div>
      {!preview && (
        <Upload.Dragger accept=".xlsx" showUploadList={false} multiple={false} disabled={busy} beforeUpload={(f) => { void check(f); return false }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{busy ? t('kpi.import.checking') : t('kpi.import.drop')}</p>
          <p className="ant-upload-hint">{t('kpi.import.dropSub')}</p>
        </Upload.Dragger>
      )}
      {preview && (
        <>
          <Alert style={{ marginBottom: 12 }} showIcon type={preview.errors.length ? 'warning' : 'info'}
            message={t('kpi.import.summary', { rows: preview.rows.length, errors: preview.errors.length, file: file?.name ?? '' })}
            description={preview.errors.length && preview.rows.length ? t('kpi.import.skipHint') : undefined} />
          {preview.rows.length > 0 && (
            <Table size="small" rowKey={(r) => `${r.excelRow}-${r.indicatorCode}`} pagination={{ pageSize: 50, hideOnSinglePage: true }} scroll={{ y: 260 }}
              dataSource={preview.rows}
              columns={[
                { title: t('kpi.import.excelRow'), dataIndex: 'excelRow', width: 70 },
                { title: t('kpi.col.dept'), dataIndex: 'unitName' },
                { title: t('kpi.lib.code'), dataIndex: 'indicatorCode', width: 120 },
                { title: t('kpi.import.old'), dataIndex: 'old', width: 100, align: 'right', render: (v: number | null) => v ?? '—' },
                { title: t('kpi.import.new'), dataIndex: 'actual', width: 100, align: 'right', render: (v: number, r) => <b style={{ color: r.old === v ? undefined : 'var(--c-primary)' }}>{v}</b> },
              ]} />
          )}
          {preview.errors.length > 0 && (
            <Table style={{ marginTop: 12 }} size="small" rowKey={(r, i) => `${r.excelRow}-${r.code}-${i}`} pagination={false} scroll={{ y: 200 }} dataSource={preview.errors}
              columns={[
                { title: t('kpi.import.excelRow'), dataIndex: 'excelRow', width: 70 },
                { title: t('kpi.import.reason'), key: 'c', render: (_: unknown, r) => t(`kpi.import.err.${r.code}`, { defaultValue: r.code }) },
                { title: t('kpi.import.detail'), dataIndex: 'detail', render: (v: string | null) => v ?? '' },
              ]} />
          )}
        </>
      )}
    </Modal>
  )
}

/** Hộp nhập lý do (từ chối, mở lại phiếu / kỳ, nhận xét khi duyệt), tối đa 500 ký tự. Nơi gọi chỉ render khi mở để mỗi lần mở là ô trống. */
export function ReasonModal({ open, title, label, required = true, okText, loading, onOk, onCancel }: {
  open: boolean; title: ReactNode; label: ReactNode; required?: boolean; okText?: ReactNode; loading?: boolean; onOk: (text: string) => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const bad = required && !text.trim()
  return (
    <Modal open={open} title={title} onCancel={onCancel} destroyOnHidden centered okText={okText} confirmLoading={loading}
      okButtonProps={{ disabled: bad }} onOk={() => onOk(text.trim())}>
      <div style={{ marginBottom: 6 }}>{label}</div>
      <Input.TextArea rows={4} maxLength={500} showCount value={text} onChange={(e) => setText(e.target.value)} aria-required={required} status={bad && text.length > 0 ? 'error' : undefined} />
      {bad && <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 4 }}>{t('kpi.sheet.reasonRequired')}</div>}
    </Modal>
  )
}
