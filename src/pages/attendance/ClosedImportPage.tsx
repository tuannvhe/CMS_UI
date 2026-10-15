import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Descriptions, Input, Select, Space, Steps, Tabs, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleFilled, CheckOutlined, DownloadOutlined, FileExcelOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  CLOSED_FIELDS, EXTRA_TABLE_SQL, closedAttendance, closedError, closedValue, type ClosedInput, type ClosedRecord, type ImportPreview, type ImportResult, type RowIssue,
} from '../../api/closedAttendance'
import { DataTable, MiniTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useToast } from '../../hooks/useToast'

const MAX_SHOWN = 8

function Issues({ title, type, items }: { title: string; type: 'error' | 'warning'; items: RowIssue[] }) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <Alert type={type} showIcon style={{ marginBottom: 12 }} title={`${title} (${items.length})`}
      description={(
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.slice(0, MAX_SHOWN).map((i, k) => (
            <li key={k}>{t('cls.row', { n: i.excelRow })}: {t(`cls.issue.${i.code}`, { defaultValue: i.code })}{i.detail ? ` (${i.detail})` : ''}</li>
          ))}
          {items.length > MAX_SHOWN && <li>…</li>}
        </ul>
      )} />
  )
}

function ImportTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [done, setDone] = useState<ImportResult | null>(null)

  const errText = (e: unknown) => {
    const { code, detail } = closedError(e)
    if (code === 'too_large') return t('cls.err.too_large')
    if (code === 'expired') return t('cls.err.expired')
    if (code === 'bad_file') return t(`cls.err.bad_${detail}`, { defaultValue: t('cls.err.bad_file') })
    return t('cls.err.generic')
  }

  const doPreview = useMutation({
    mutationFn: (f: File) => closedAttendance.preview(f),
    onSuccess: (p) => { setDone(null); setPreview(p) },
    onError: (e) => msg.error(errText(e)),
  })
  const commit = useMutation({
    mutationFn: () => closedAttendance.commit(preview!.token),
    onSuccess: (r) => { setDone(r); setPreview(null); qc.invalidateQueries({ queryKey: ['closed'] }) },
    onError: (e) => { msg.error(errText(e)); if (closedError(e).code === 'expired') setPreview(null) },
  })

  const sampleCols: ColumnsType<ClosedInput> = [
    { title: t('cls.row', { n: '' }).replace(/\s*$/, ''), dataIndex: 'excelRow', width: 70 },
    { title: t('sys.colEmp'), dataIndex: 'employeeId', width: 110 },
    { title: t('att.name'), dataIndex: 'fullName', width: 200, ellipsis: true },
    { title: t('att.dept'), dataIndex: 'department', width: 150, ellipsis: true },
    { title: t('cls.period'), dataIndex: 'period', width: 100 },
    ...(['tongGioCaNgayCT', 'tongGioCaDemCT', 'nghiPhep', 'tongCongHuongLuong', 'thuongChuyenCan'] as const).map((k) => ({
      title: t(`cls.f.${CLOSED_FIELDS.find((f) => f.key === k)!.label}`) + (k.endsWith('CT') ? ' (CT)' : ''), width: 130, align: 'right' as const, render: (_: unknown, r: ClosedInput) => r.values[k] || '-',
    })),
    ...(preview?.extraRows ? (['hungYenTravel', 'hungYenLodging'] as const).map((k) => ({
      title: t(`cls.f.${k}`), width: 150, align: 'right' as const, render: (_: unknown, r: ClosedInput) => r.extras?.[k] || '-',
    })) : []),
  ]
  const onlyUpdates = !!preview && preview.totalRows > 0 && preview.periods.every((p) => p.new === 0)
  const step = done ? 2 : preview ? 1 : 0

  return (
    <div>
      <Steps className="ci-steps" current={step} items={[{ title: t('cls.step1') }, { title: t('cls.step2') }, { title: t('cls.step3') }]} />

      {!preview && !done && (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('cls.noteTitle')} description={t('cls.note')} />
          <div className="ci-drop">
            <Upload.Dragger accept=".xlsx" multiple={false} showUploadList={false} disabled={doPreview.isPending}
              beforeUpload={(f) => { doPreview.mutate(f); return false }}>
              <InboxOutlined className="ci-drop-icon" />
              <div className="ci-drop-title">{doPreview.isPending ? t('cls.reading') : t('cls.drop')}</div>
              <div className="ci-drop-hint">{t('cls.dropHint')}</div>
            </Upload.Dragger>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={() => closedAttendance.template().catch(() => msg.error(t('cls.err.generic')))}>{t('cls.template')}</Button>
          </div>
        </>
      )}

      {done && (
        <div className="ci-card">
          <div className="ci-body ci-success">
            <CheckCircleFilled />
            <Typography.Title level={4} style={{ margin: '12px 0 4px' }}>{t('cls.doneTitle')}</Typography.Title>
            <Typography.Paragraph type="secondary">{t('cls.doneText', { inserted: done.inserted, updated: done.updated, periods: done.periods.join(', ') })}{done.extrasSaved > 0 ? ` ${t('cls.extrasSaved', { n: done.extrasSaved })}` : ''}</Typography.Paragraph>
            <Button type="primary" onClick={() => setDone(null)}>{t('cls.importMore')}</Button>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="stat-grid">
            <div className="stat-tile" style={{ ['--tile' as string]: '#0F6B3E' }}><div className="st-label">{t('cls.rows')}</div><div className="st-value">{preview.totalRows.toLocaleString()}</div></div>
            <div className="stat-tile" style={{ ['--tile' as string]: preview.errors.length ? '#D92D20' : '#98A2B3' }}><div className="st-label">{t('cls.errorsN')}</div><div className="st-value">{preview.errors.length}</div></div>
            <div className="stat-tile" style={{ ['--tile' as string]: '#98A2B3' }}><div className="st-label">{t('cls.ignoredN')}</div><div className="st-value">{preview.ignoredRows}</div></div>
            <div className="stat-tile" style={{ ['--tile' as string]: preview.unknownEmployees ? '#D48806' : '#98A2B3' }}><div className="st-label">{t('cls.unknownN')}</div><div className="st-value">{preview.unknownEmployees}</div></div>
          </div>

          <div className="ci-card">
            <header>
              <span className="ci-file"><FileExcelOutlined /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.fileName}</span></span>
              <Space>
                <Button onClick={() => setPreview(null)}>{t('cls.chooseOther')}</Button>
                <Button type="primary" icon={<CheckOutlined />} loading={commit.isPending} disabled={preview.totalRows === 0} onClick={() => commit.mutate()}>
                  {t('cls.confirm', { n: preview.totalRows })}
                </Button>
              </Space>
            </header>
            <div className="ci-body">
              {preview.totalRows === 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('cls.empty')} />}
              {preview.unknownEmployees > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('cls.unknownText', { n: preview.unknownEmployees })} />}
              {onlyUpdates && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('cls.overwriteText')} />}
              <Issues title={t('cls.errors')} type="error" items={preview.errors} />
              <Issues title={t('cls.warnings')} type="warning" items={preview.warnings} />
              {preview.totalRows > 0 && (
                <>
                  <div className="ci-periods">
                    {preview.periods.map((p) => (
                      <div key={p.period} className="ci-period">
                        <b>{p.period}</b>
                        <span>{t('cls.rowsN', { n: p.rows })}</span>
                        <span className="ci-chip new">{t('cls.newN', { n: p.new })}</span>
                        <span className="ci-chip upd">{t('cls.updN', { n: p.updated })}</span>
                      </div>
                    ))}
                  </div>
                  <Typography.Text type="secondary">{t('cls.sampleOf', { n: preview.sample.length, total: preview.totalRows })}</Typography.Text>
                  <MiniTable<ClosedInput> rowKey="excelRow" size="small" pagination={false} columns={sampleCols} dataSource={preview.sample} scroll={{ x: 1100 }} style={{ marginTop: 8 }} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DataTab() {
  const { t } = useTranslation()
  const msg = useToast()
  const periods = useQuery({ queryKey: ['closed', 'periods'], queryFn: closedAttendance.periods })
  const [period, setPeriod] = useState<string>()
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const current = period ?? periods.data?.[0]?.period
  const summary = periods.data?.find((p) => p.period === current)

  const list = useQuery({
    queryKey: ['closed', 'list', current, applied, page, pageSize],
    queryFn: () => closedAttendance.list(current!, applied, page, pageSize),
    enabled: !!current, placeholderData: (prev) => prev, retry: false,
  })

  const columns: ColumnsType<ClosedRecord> = useMemo(() => [
    { title: t('sys.colEmp'), dataIndex: 'employeeId', width: 100, fixed: 'left' },
    { title: t('att.name'), dataIndex: 'fullName', width: 200, fixed: 'left', ellipsis: true },
    { title: t('att.dept'), dataIndex: 'department', width: 150, ellipsis: true },
    { title: t('cls.position'), dataIndex: 'position', width: 120, ellipsis: true },
    { title: t('cls.titleCol'), dataIndex: 'title', width: 120, ellipsis: true },
    ...CLOSED_FIELDS.map((f) => ({
      title: t(`cls.f.${f.label}`) + (f.group === 'official' ? ' (CT)' : f.group === 'probation' ? ' (TV)' : ''),
      width: f.group === 'allowance' ? 170 : 120, align: 'right' as const, render: (_: unknown, r: ClosedRecord) => closedValue(r, f.key) || '-',
    })),
  ], [t])

  return (
    <DataTable<ClosedRecord>
      rowKey="id" size="small" sticky={false} scroll={{ x: 900 + CLOSED_FIELDS.length * 120 }} loading={list.isFetching} columns={columns} dataSource={list.data?.rows ?? []}
      pagination={{ current: page, pageSize, total: list.data?.total ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: (n: number) => n.toLocaleString(), onChange: (p: number, s: number) => { setPage(p); setPageSize(s) } }}
      locale={{ emptyText: list.isError ? t('cls.err.generic') : t('cls.noData') }}
      toolbar={(
        <Space wrap>
          <Select style={{ width: 150 }} placeholder={t('cls.period')} value={current} loading={periods.isLoading}
            onChange={(v) => { setPeriod(v); setPage(1) }} options={(periods.data ?? []).map((p) => ({ value: p.period, label: `${p.period} (${p.rows})` }))} />
          <Input.Search allowClear style={{ width: 300 }} placeholder={t('cls.search')} value={search} onChange={(e) => setSearch(e.target.value)}
            onSearch={() => { setPage(1); setApplied(search.trim()) }} enterButton />
          <Button icon={<DownloadOutlined />} disabled={!current} onClick={() => closedAttendance.exportPeriod(current!).catch(() => msg.error(t('cls.err.generic')))}>{t('cls.export')}</Button>
          {summary && (
            <Descriptions size="small" column={3} style={{ marginLeft: 8 }}>
              <Descriptions.Item label={t('cls.lastUpdate')}>{summary.lastChanged ? dayjs(summary.lastChanged).format('DD/MM/YYYY HH:mm') : summary.firstCreated ? dayjs(summary.firstCreated).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cls.by')}>{summary.lastBy ?? '-'}</Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      )}
    />
  )
}

/** Nhập chốt công tháng từ Excel (thay trang UploadTimeWork của hệ thống cũ) và xem / xuất lại dữ liệu đã nhập. */
export default function ClosedImportPage() {
  const { t } = useTranslation()
  const extra = useQuery({ queryKey: ['closed', 'extra-status'], queryFn: closedAttendance.extraStatus, retry: false })
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<UploadOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.closingImport')} subtitle={t('nav.closingImportDesc')} />
      {extra.data && !extra.data.ready && (
        <div style={{ marginBottom: 16 }}>
          <SqlNotReady title={t('cls.extraNotReady')} sql={EXTRA_TABLE_SQL} onRetry={() => extra.refetch()} loading={extra.isFetching} />
        </div>
      )}
      <Tabs items={[
        { key: 'import', label: t('cls.tabImport'), children: <ImportTab /> },
        { key: 'data', label: t('cls.tabData'), children: <DataTab /> },
      ]} />
    </div>
  )
}
