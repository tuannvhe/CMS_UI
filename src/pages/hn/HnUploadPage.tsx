import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Empty, Popconfirm, Space, Table, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CloudUploadOutlined, FileDoneOutlined, InboxOutlined, WalletOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { hnAdminApi, hnErrorKey, type HnImportKind, type HnImportLine, type HnImportPreview } from '../../api/hn'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

/*
 * 2026-11-25 [Truong] - HN HR: upload timework (Tbl_TimeWork via ADD_TIMEWORK) / payslip (Tbl_EmployeeSalary via ADD_VIEWSALARY).
 * Same Excel files as the old CMS_HN. Choose file → server preview (new / overwrite / unknown employee / skipped in test mode / row errors) → confirm to write.
 * Writing obeys Hn:WriteMode on the server (off blocks, test writes only allowed employee IDs, live writes all). Payslip preview never shows amounts.
 */

const STATUS_COLOR: Record<HnImportLine['status'], string> = { new: 'green', update: 'gold', unknown: 'red', skipped: 'default' }

export default function HnUploadPage({ kind }: { kind: HnImportKind }) {
  const { t } = useTranslation()
  const toast = useToast()
  const isTw = kind === 'timework'
  const [period, setPeriod] = useState<Dayjs>(() => dayjs().subtract(1, 'month').startOf('month'))
  const [preview, setPreview] = useState<HnImportPreview | null>(null)
  const [error, setError] = useState('')

  const mode = useQuery({ queryKey: ['hn', 'admin', 'write-mode'], queryFn: hnAdminApi.writeMode, staleTime: 30_000 })
  const read = useMutation({
    mutationFn: (file: File) => hnAdminApi.preview(kind, file, period.format('M/YYYY')),
    onMutate: () => { setError(''); setPreview(null) },
    onSuccess: setPreview,
    onError: (e) => setError(t(hnErrorKey(e))),
  })
  const commit = useMutation({
    mutationFn: () => hnAdminApi.commit(kind, preview!.token!),
    onSuccess: (r) => {
      toast.success(r.skipped ? t('hn.upload.committedSkipped', { n: r.written, s: r.skipped }) : t('hn.upload.committed', { n: r.written }))
      setPreview(null)
    },
    onError: (e) => { setError(t(hnErrorKey(e))); setPreview(null) },   // bản xem trước dùng một lần: lỗi thì tải lại file
  })

  const writable = preview ? preview.new + preview.update : 0
  const reason = !preview ? '' : preview.writeMode === 'off' ? t('hn.upload.reasonOff') : preview.errors.length ? t('hn.upload.reasonErrors') : writable === 0 ? t('hn.upload.reasonNone') : ''
  const m = mode.data?.mode

  const columns: ColumnsType<HnImportLine> = [
    { title: t('hn.upload.row'), dataIndex: 'excelRow', width: 80, align: 'center' },
    { title: t('hn.col.manv'), dataIndex: 'employeeId', width: 130 },
    { title: t('hn.col.hovaten'), dataIndex: 'fullName', ellipsis: true },
    { title: t('hn.col.bophan'), dataIndex: 'department', width: 200, ellipsis: true },
    { title: t('hn.payslip.period'), dataIndex: 'period', width: 110, align: 'center' },
    {
      title: '', dataIndex: 'status', width: 150, align: 'center',
      filters: (['new', 'update', 'unknown', 'skipped'] as const).map((s) => ({ text: t(`hn.upload.status.${s}`), value: s })),
      onFilter: (v, r) => r.status === v,
      render: (s: HnImportLine['status']) => <Tag color={STATUS_COLOR[s]} variant="filled">{t(`hn.upload.status.${s}`)}</Tag>,
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={isTw ? <FileDoneOutlined /> : <WalletOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t(isTw ? 'hn.nav.uploadTimework' : 'hn.nav.uploadPayslip')} subtitle={t(isTw ? 'hn.nav.uploadTimeworkDesc' : 'hn.nav.uploadPayslipDesc')} />

      {m && (
        <Alert style={{ marginBottom: 16 }} showIcon type={m === 'off' ? 'error' : m === 'test' ? 'warning' : 'success'}
          title={m === 'off' ? t('hn.upload.modeOff') : m === 'test' ? t('hn.upload.modeTest', { list: (mode.data?.allowed ?? []).join(', ') || '—' }) : t('hn.upload.modeLive')} />
      )}

      <section className="pay-card" style={{ padding: 20, marginBottom: 16 }}>
        {/* 2026-11-25 [Truong] - both kinds: HR picks the period (payslip: column I must be in that month when filled) */}
        <div style={{ marginBottom: 14 }}>
          <Space wrap align="center">
            <Typography.Text strong>{t(isTw ? 'hn.upload.period' : 'hn.payslip.period')}:</Typography.Text>
            <DatePicker picker="month" format="MM/YYYY" allowClear={false} value={period} onChange={(v) => { if (v) { setPeriod(v); setPreview(null) } }} disabled={read.isPending} />
          </Space>
          <div style={{ color: 'var(--c-muted)', fontSize: 12.5, marginTop: 6 }}>{t(isTw ? 'hn.upload.periodHint' : 'hn.upload.periodHintPayslip')}</div>
        </div>
        <Upload.Dragger accept=".xlsx,.xlsm" multiple={false} showUploadList={false} disabled={read.isPending || commit.isPending}
          beforeUpload={(file) => { read.mutate(file); return false }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{read.isPending ? t('hn.upload.reading') : t('hn.upload.drop')}</p>
          <p className="ant-upload-hint">{t(isTw ? 'hn.upload.dropHintTimework' : 'hn.upload.dropHintPayslip')}</p>
        </Upload.Dragger>
      </section>

      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      {preview && (
        <>
          <StatTiles items={[
            { label: t('hn.upload.total'), value: preview.total, color: 'var(--c-primary)' },
            { label: t('hn.upload.new'), value: preview.new, color: '#12B76A' },
            { label: t('hn.upload.update'), value: preview.update, color: '#D48806' },
            { label: t('hn.upload.unknown'), value: preview.unknown, color: '#D92D20' },
            ...(preview.skipped ? [{ label: t('hn.upload.skipped'), value: preview.skipped, color: '#667085' }] : []),
            ...(preview.errors.length ? [{ label: t('hn.upload.errors'), value: preview.errors.length, color: '#D92D20' }] : []),
          ]} />

          {preview.errors.length > 0 && (
            <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('hn.upload.errors')}
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{preview.errors.slice(0, 50).map((e, i) => (
                <li key={i}>{t('hn.upload.row')} {e.excelRow}: {t(`hn.upload.issue.${e.code}`, { detail: e.detail ?? '', defaultValue: e.code })}</li>
              ))}</ul>} />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '12px 0' }}>
            <div style={{ color: 'var(--c-muted)' }}>
              {preview.fileName} · {t('hn.upload.periods', { list: preview.periods.join(', ') || '—' })}
              {!isTw && <> · {t('hn.upload.noAmounts')}</>}
            </div>
            <Space wrap>
              {preview.token ? (
                <Popconfirm title={t('hn.upload.commitAsk', { n: writable })} okText={t('hn.upload.commit', { n: writable })} cancelText={t('hn.common.cancel')} onConfirm={() => commit.mutate()}>
                  <Button type="primary" icon={<CloudUploadOutlined />} loading={commit.isPending}>{t('hn.upload.commit', { n: writable })}</Button>
                </Popconfirm>
              ) : <Typography.Text type="danger">{t('hn.upload.noToken')}{reason}</Typography.Text>}
              <Button onClick={() => { setPreview(null); setError('') }} disabled={commit.isPending}>{t('hn.upload.again')}</Button>
            </Space>
          </div>

          <Table<HnImportLine> size="small" rowKey={(r) => `${r.excelRow}`} columns={columns} dataSource={preview.lines} pagination={{ pageSize: 50, showSizeChanger: false }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} />
        </>
      )}
    </div>
  )
}
