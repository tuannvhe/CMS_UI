import { useState } from 'react'
import { PERSON_PAY_SYNC } from '../../config/features'
import { Alert, Avatar, Button, Input, Modal, Space, Steps, Table, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleFilled, LockOutlined, DownloadOutlined, FileExcelOutlined, InboxOutlined, SendOutlined, CalculatorOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { payroll, payrollError, payrollPeople, type PersonPayPreview, type PayrollPeriodSummary, type PayrollPreview, type PayrollResultRow } from '../../api/payroll'
import { payslip, type PayslipPeriodPreview, type PayslipPreview } from '../../api/payslip'
import { IssueList, StatTiles } from '../../components/ImportWizard'
import { PageBanner } from '../../components/PageBanner'
import { PersonPaySuggest } from '../../components/PersonPaySuggest'
import { useToast } from '../../hooks/useToast'

const PAGE_SIZE = 20
const FLAG_ORDER = ['hr_slip_differs', 'hr_edited', 'calc_error', 'net_negative', 'staff_no_base', 'zero_hours', 'base_changed', 'big_change', 'low_hours', 'new_person']
const FLAG_COLOR: Record<string, string> = { calc_error: 'red', net_negative: 'red', zero_hours: 'volcano', base_changed: 'orange', big_change: 'orange', staff_no_base: 'red', low_hours: 'gold', new_person: 'blue', hr_edited: 'green', hr_slip_differs: 'magenta' }

/** Tính lương từ file Excel tổng hợp cuối tháng: tải lên → xem kết quả (chưa ghi gì) → xuất Excel và/hoặc đăng phiếu lương cho từng người. */
export default function PayrollPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const location = useLocation()
  // Nhận kết quả tính lương từ màn Chốt công tự động (chuyển sang bằng router state).
  const [preview, setPreview] = useState<PayrollPreview | null>((location.state as { preview?: PayrollPreview } | null)?.preview ?? null)
  const provisional = !!(location.state as { provisional?: boolean } | null)?.provisional && !!preview && preview.fileName.startsWith('LuongTam_')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [flag, setFlag] = useState('')
  const [group, setGroup] = useState<'op' | 'staff' | 'temp'>('op')
  const [previewGroup, setPreviewGroup] = useState<'op' | 'staff' | 'temp' | null>(null)
  const [personPrev, setPersonPrev] = useState<PersonPayPreview | null>(null)
  const [suggestPeriod, setSuggestPeriod] = useState<string | null>(null)
  const [publishPrev, setPublishPrev] = useState<PayslipPreview | null>(null)
  const [published, setPublished] = useState<{ inserted: number; updated: number; periods: string[] } | null>(null)
  const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 2 }))

  const errText = (e: unknown) => {
    const { code, detail } = payrollError(e)
    if (code === 'too_large') return t('cls.err.too_large')
    if (code === 'expired') return t('cls.err.expired')
    if (code === 'bad_file') return t(`cls.err.bad_${detail}`, { defaultValue: t('cls.err.bad_file') })
    if (code === 'invalid_input' && detail === 'nothing_to_publish') return t('prl.err.nothing')
    return t('cls.err.generic')
  }
  const doPreview = useMutation({
    mutationFn: (f: File) => payroll.preview({ file: f, group }),
    onSuccess: (p) => { setPreviewGroup(group); setPublished(null); setSearch(''); setPage(1); setFlag(''); setPreview(p) },
    onError: (e) => msg.error(errText(e)),
  })
  const doPublishPreview = useMutation({
    mutationFn: () => payroll.publishPreview(preview!.token),
    onSuccess: setPublishPrev,
    onError: (e) => { msg.error(errText(e)); if (payrollError(e).code === 'expired') setPreview(null) },
  })
  const doCommit = useMutation({
    mutationFn: () => payslip.commit(publishPrev!.token),
    onSuccess: (r) => { setPublished(r); setPublishPrev(null); setPreview(null); setSuggestPeriod(r.periods[0] ?? null); qc.invalidateQueries({ queryKey: ['payslip'] }) },
    onError: (e) => { msg.error(errText(e)); setPublishPrev(null) },
  })
  const doPersonPreview = useMutation({
    mutationFn: () => payrollPeople.fromRunPreview(preview!.token),
    onSuccess: (p) => { if (p.rows === 0) msg.info(t('prl.person.none')); else setPersonPrev(p) },
    onError: (e) => { const c = payrollError(e).code; msg.error(c === 'key_missing' || c === 'table_missing' ? t('prl.person.notReady') : errText(e)) },
  })
  const doPersonCommit = useMutation({
    mutationFn: () => payrollPeople.commit(personPrev!.token),
    onSuccess: (r) => { msg.success(t('prl.person.done', { n: r.rows })); setPersonPrev(null) },
    onError: (e) => msg.error(errText(e)),
  })
  const results = useQuery({
    queryKey: ['payroll', 'results', preview?.token, search, page, flag],
    queryFn: () => payroll.results(preview!.token, search, page, PAGE_SIZE, flag),
    enabled: !!preview, placeholderData: (prev) => prev, retry: false,
  })

  const periodCols: ColumnsType<PayrollPeriodSummary> = [
    { title: t('cls.period'), dataIndex: 'period', width: 100 },
    { title: t('prl.version'), render: (_, r) => `${r.versionName} (${r.effectiveFrom})` },
    { title: t('prl.people'), dataIndex: 'people', width: 90, align: 'right' },
    { title: t('prl.rowErrors'), dataIndex: 'errorRows', width: 100, align: 'right', render: (v: number) => (v ? <Tag color="red">{v}</Tag> : 0) },
    { title: t('prl.gross'), dataIndex: 'totalGross', align: 'right', render: fmt },
    { title: t('prl.deduction'), dataIndex: 'totalDeduction', align: 'right', render: fmt },
    { title: t('prl.net'), dataIndex: 'totalNet', align: 'right', render: (v: number) => <b>{fmt(v)}</b> },
  ]
  const resultCols: ColumnsType<PayrollResultRow> = [
    { title: t('org.colEmp'), dataIndex: 'employeeId', width: 100, fixed: 'left' },
    { title: t('org.colName'), dataIndex: 'fullName', width: 170, fixed: 'left' },
    { title: t('cls.period'), dataIndex: 'period', width: 90 },
    { title: t('org.department'), dataIndex: 'department', width: 150, ellipsis: true },
    ...(results.data?.columns ?? []).map((c) => ({
      title: c.label, width: 130, align: 'right' as const,
      render: (_: unknown, r: PayrollResultRow) => (c.kind === 'total' ? <b>{fmt(r.values[c.key])}</b> : fmt(r.values[c.key])),
    })),
    {
      title: t('prl.flagCol'), width: 220, fixed: 'right',
      render: (_, r) => (
        <>
          {r.errors.length > 0 && <Tag color="red" title={r.errors.join('\n')}>!</Tag>}
          {(r.flags ?? []).map((f) => <Tag key={f} color={FLAG_COLOR[f] ?? 'default'} title={t(`prl.flagHelp.${f}`)}>{t(`prl.flag.${f}`)}</Tag>)}
        </>
      ),
    },
  ]
  const slipCols: ColumnsType<PayslipPeriodPreview> = [
    { title: t('cls.period'), dataIndex: 'period', width: 110 },
    { title: t('pay.imp.rows'), dataIndex: 'rows', width: 90, align: 'right' },
    { title: t('pay.imp.new'), dataIndex: 'new', width: 90, align: 'right' },
    { title: t('pay.imp.updated'), dataIndex: 'updated', width: 110, align: 'right' },
    { title: t('pay.imp.total'), dataIndex: 'totalNetPay', align: 'right', render: (v: number) => <b>{fmt(v)}</b> },
  ]
  const step = published ? 2 : preview ? 1 : 0

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CalculatorOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.payroll')} subtitle={t('nav.payrollDesc')} />
      <Steps className="ci-steps" current={step} items={[{ title: t('prl.step1') }, { title: t('prl.step2') }, { title: t('prl.step3') }]} />

      {!preview && !published && (
        <>
          <div className="prl-groups" role="tablist">
            {(['op', 'staff', 'temp'] as const).map((g) => (
              <button key={g} type="button" role="tab" aria-selected={group === g} className={`prl-group prl-group-${g}${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>
                <b>{t(`prl.tab.${g}`)}</b>
                <small>{t(`prl.tab.${g}Short`)}</small>
              </button>
            ))}
          </div>
          <Alert type={group === 'op' ? 'success' : 'warning'} showIcon style={{ marginBottom: 16 }} title={t(`prl.tab.${group}Title`)} description={<>{t(`prl.tab.${group}Note`)} {t('prl.note')}</>} />
          <div className="ci-drop">
            <Upload.Dragger accept=".xlsx" multiple={false} showUploadList={false} disabled={doPreview.isPending} beforeUpload={(f) => { doPreview.mutate(f); return false }}>
              <InboxOutlined className="ci-drop-icon" />
              <div className="ci-drop-title">{doPreview.isPending ? t('prl.calculating') : t('prl.drop')}</div>
              <div className="ci-drop-hint">{t('cls.dropHint')}</div>
            </Upload.Dragger>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={() => payroll.template().catch(() => msg.error(t('cls.err.generic')))}>{t('prl.template')}</Button>
          </div>
        </>
      )}

      {published && (
        <div className="ci-card">
          <div className="ci-body ci-success">
            <CheckCircleFilled />
            <Typography.Title level={4} style={{ margin: '12px 0 4px' }}>{t('prl.doneTitle')}</Typography.Title>
            <Typography.Paragraph type="secondary">{t('pay.imp.doneText', { inserted: published.inserted, updated: published.updated, periods: published.periods.join(', ') })}</Typography.Paragraph>
            <Button type="primary" onClick={() => { setPublished(null); setSuggestPeriod(null) }}>{t('prl.again')}</Button>
            {PERSON_PAY_SYNC && previewGroup !== 'staff' && <div style={{ textAlign: 'left', marginTop: 16 }}><PersonPaySuggest period={suggestPeriod} /></div>}
          </div>
        </div>
      )}

      {preview && (
        <div className="ci-card">
          <header>
            <span className="ci-file"><FileExcelOutlined /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.fileName}</span>{previewGroup && <Tag color={previewGroup === 'staff' ? 'purple' : previewGroup === 'temp' ? 'orange' : 'green'} style={{ marginLeft: 8 }}>{t(`prl.tab.${previewGroup}`)}</Tag>}</span>
            <Space wrap>
              <Button onClick={() => setPreview(null)}>{t('cls.chooseOther')}</Button>
              {PERSON_PAY_SYNC && previewGroup !== 'staff' && !provisional && <Button icon={<LockOutlined />} loading={doPersonPreview.isPending} onClick={() => doPersonPreview.mutate()}>{t('prl.person.save')}</Button>}
              <Button icon={<DownloadOutlined />} onClick={() => payroll.exportXlsx(preview.token).catch(() => msg.error(t('cls.err.generic')))}>{t('prl.export')}</Button>
              <Button type="primary" icon={<SendOutlined />} disabled={previewGroup === 'temp' || provisional} loading={doPublishPreview.isPending} onClick={() => doPublishPreview.mutate()}>{t('prl.publish')}</Button>
            </Space>
          </header>
          <div className="ci-body">
            {provisional && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('prl.provisionalNote')} />}
            {preview.usingBuiltin && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('prl.builtinWarn')} />}
            <StatTiles items={[
              { label: t('pay.imp.rows'), value: preview.totalRows },
              { label: t('pay.imp.unknown'), value: preview.unknownEmployees, color: preview.unknownEmployees ? '#D48806' : '#2E9E4F' },
              { label: t('prl.rowErrors'), value: preview.errorRows, color: preview.errorRows ? '#D92D20' : '#2E9E4F' },
              { label: t('pay.imp.warnings'), value: preview.warnings.length, color: preview.warnings.length ? '#D48806' : '#2E9E4F' },
            ]} />
            <IssueList title={t('pay.imp.errors')} type="error" items={preview.errors} issueKey="prl.issue" />
            <IssueList title={t('pay.imp.warnings')} type="warning" items={preview.warnings} issueKey="prl.issue" />
            <Typography.Paragraph type="secondary">{t('prl.checkTotals')}</Typography.Paragraph>
            <Table<PayrollPeriodSummary> rowKey="period" size="small" pagination={false} columns={periodCols} dataSource={preview.periods} style={{ marginBottom: 16 }} />
            {preview.flagCounts && Object.keys(preview.flagCounts).length > 0 && (
              <div className="prl-flags">
                <b>{t('prl.review')}</b>
                <span className="prl-flags-note">{t('prl.reviewNote', { n: preview.flaggedRows ?? 0 })}</span>
                <div>
                  <Tag.CheckableTag checked={flag === ''} onChange={() => { setFlag(''); setPage(1) }}>{t('prl.flagAll')}</Tag.CheckableTag>
                  <Tag.CheckableTag checked={flag === 'any'} onChange={() => { setFlag('any'); setPage(1) }}>{t('prl.flagAny', { n: preview.flaggedRows ?? 0 })}</Tag.CheckableTag>
                  {FLAG_ORDER.filter((f) => preview.flagCounts?.[f]).map((f) => (
                    <Tag.CheckableTag key={f} checked={flag === f} onChange={() => { setFlag(flag === f ? '' : f); setPage(1) }}>{t(`prl.flag.${f}`)} ({preview.flagCounts![f]})</Tag.CheckableTag>
                  ))}
                </div>
              </div>
            )}
            {!(preview.flagCounts && Object.keys(preview.flagCounts).length > 0) && <Alert type="success" showIcon style={{ marginBottom: 12 }} title={t('prl.noFlagTitle')} description={t('prl.noFlagText')} />}
            <Input.Search allowClear placeholder={t('prl.search')} style={{ maxWidth: 320, marginBottom: 8 }} onSearch={(v) => { setSearch(v); setPage(1) }} />
            <Table<PayrollResultRow> rowKey={(r) => `${r.period}|${r.employeeId}|${r.excelRow}`} size="small" loading={results.isFetching} columns={resultCols} dataSource={results.data?.rows ?? []}
              scroll={{ x: 'max-content' }}
              pagination={{ current: page, pageSize: PAGE_SIZE, total: results.data?.total ?? 0, showSizeChanger: false, onChange: setPage }} />
          </div>
        </div>
      )}

      <Modal open={!!personPrev} title={t('prl.person.title')} onCancel={() => setPersonPrev(null)} destroyOnHidden okText={t('prl.person.confirm', { n: personPrev?.rows ?? 0 })}
        okButtonProps={{ loading: doPersonCommit.isPending, disabled: !personPrev || personPrev.rows === 0 }} onOk={() => doPersonCommit.mutate()}>
        {personPrev && <Typography.Paragraph>{t('prl.person.text', { rows: personPrev.rows, added: personPrev.new, updated: personPrev.updated })}</Typography.Paragraph>}
      </Modal>

      <Modal open={!!publishPrev} title={t('prl.publishTitle')} width={720} onCancel={() => setPublishPrev(null)} destroyOnHidden
        okText={t('prl.publishConfirm', { n: publishPrev?.totalRows ?? 0 })} cancelText={t('common.cancel', { defaultValue: 'Hủy' })}
        okButtonProps={{ loading: doCommit.isPending, disabled: !publishPrev || publishPrev.totalRows === 0 }} onOk={() => doCommit.mutate()}>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('prl.publishNote')} />
        {publishPrev && (
          <>
            <IssueList title={t('pay.imp.errors')} type="error" items={publishPrev.errors} issueKey="prl.issue" />
            <Table<PayslipPeriodPreview> rowKey="period" size="small" pagination={false} columns={slipCols} dataSource={publishPrev.periods} />
          </>
        )}
      </Modal>
    </div>
  )
}
