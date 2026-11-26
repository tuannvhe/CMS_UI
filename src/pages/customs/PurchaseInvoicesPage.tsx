import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Drawer, Empty, InputNumber, Popconfirm, Space, Table, Tag, Tooltip, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import { AuditOutlined, CloudUploadOutlined, DatabaseOutlined, ExperimentOutlined, SafetyOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { customsError } from '../../api/customs'
import { purchaseInvoices, type InvoiceIssue, type PurchaseInvoicePreview, type PushResult, type VatItemRow } from '../../api/purchaseInvoices'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

/** Một dòng trên lưới: file gốc (giữ trong bộ nhớ để gửi lại khi chạy thử) + kết quả xem trước. */
interface Item { id: string; file: File; preview: PurchaseInvoicePreview }
interface Ran { item: Item; slipSeq: number; dryRun: boolean; result: PushResult }

/** SMVATType (nhóm 8028) → nhãn ngắn. */
const VAT_TYPE: Record<number, string> = { 8028003: 'KCT', 8028004: '0%', 8028005: '5%', 8028006: '10%', 8028007: '8%' }
const SUPPLIER_TAG: Record<string, string> = { exact: 'success', truncated: 'warning', ambiguous: 'error', notFound: 'error' }
/** Lỗi mức error chỉ do thiếu SlipSeq thì không có ở bước xem trước; mọi lỗi error khác chặn chạy thử. */
const hasError = (issues: InvoiceIssue[]) => issues.some((i) => i.level === 'error')
const ymd = (v: string | null | undefined) => (v && /^\d{8}$/.test(v) ? `${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)}` : v ?? '')
const muted = <span className="cell-muted">—</span>

function useNum() {
  const { i18n } = useTranslation()
  return (v: number | null | undefined, digits = 0) => (v == null ? '' : v.toLocaleString(i18n.language, { maximumFractionDigits: digits }))
}

function IssueTags({ issues }: { issues: InvoiceIssue[] }) {
  const { t } = useTranslation()
  if (issues.length === 0) return <Tag color="success" variant="filled">{t('pinv.ok')}</Tag>
  return (
    <Space size={[4, 4]} wrap>
      {issues.map((i, k) => (
        <Tooltip key={k} title={i.detail ? `${i.code}: ${i.detail}` : i.code}>
          <Tag color={i.level === 'error' ? 'error' : 'warning'} variant="filled">{t(`pinv.issue.${i.code}`, { d: i.detail ?? '', defaultValue: i.code })}</Tag>
        </Tooltip>
      ))}
    </Space>
  )
}

export default function PurchaseInvoicesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const num = useNum()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [slips, setSlips] = useState<Record<string, number | null>>({})
  const [ran, setRan] = useState<Ran | null>(null)

  const status = useQuery({ queryKey: ['purchase-invoices', 'status'], queryFn: purchaseInvoices.status, staleTime: 60_000 })
  const st = status.data
  const maxFiles = st?.maxFiles ?? 50

  const errText = (code: string, detail: string) => {
    if (code === 'invalid_input') {
      const [c, ...rest] = detail.split(':')
      return t(`pinv.err.${c}`, { d: rest.join(':'), defaultValue: t('pinv.err.invalid', { d: detail }) })
    }
    return t(`pinv.err.${code}`, { d: detail, defaultValue: t('pinv.err.invalid', { d: code || detail }) })
  }
  const onError = async (e: unknown) => { const { code, detail } = await customsError(e); toast.error(code ? errText(code, detail) : t('pinv.err.load')) }

  const preview = useMutation({
    mutationFn: (list: File[]) => purchaseInvoices.preview(list).then((res) => ({ list, res })),
    onSuccess: ({ list, res }) => {
      // Máy chủ trả đúng thứ tự file đã gửi
      setItems(res.map((p, i) => ({ id: `${i}-${p.fileName}`, file: list[i], preview: p })))
      setSlips({})
      setRan(null)
    },
    onError,
  })

  const push = useMutation({
    mutationFn: ({ item, slipSeq, dryRun }: { item: Item; slipSeq: number; dryRun: boolean }) =>
      purchaseInvoices.push(item.file, slipSeq, dryRun).then((result) => ({ item, slipSeq, dryRun, result })),
    onSuccess: (r) => setRan(r),
    onError,
  })

  const runCheck = () => {
    const list = files.map((f) => f.originFileObj).filter((f): f is NonNullable<typeof f> => !!f) as File[]
    if (list.length === 0) { toast.warning(t('pinv.err.no_files')); return }
    if (list.length > maxFiles) { toast.warning(t('pinv.err.too_many_files', { d: maxFiles })); return }
    preview.mutate(list)
  }

  const counts = useMemo(() => {
    const err = items.filter((i) => hasError(i.preview.issues)).length
    return { count: items.length, ok: items.length - err, err }
  }, [items])

  const invNo = (p: PurchaseInvoicePreview) => [p.template, p.series].filter(Boolean).join('') + (p.number ? ` / ${p.number}` : '')

  const columns: ColumnsType<Item> = [
    { title: t('pinv.col.file'), key: 'file', width: 170, ellipsis: true, render: (_, r) => <Tooltip title={r.preview.fileName}>{r.preview.fileName}</Tooltip> },
    {
      title: t('pinv.col.seller'), key: 'seller', width: 220,
      render: (_, r) => r.preview.sellerName || r.preview.sellerTaxCode
        ? <div><div>{r.preview.sellerName}</div><div className="cell-muted">{r.preview.sellerTaxCode}</div></div> : muted,
    },
    { title: t('pinv.col.number'), key: 'number', width: 140, render: (_, r) => (r.preview.number ? invNo(r.preview) : muted) },
    { title: t('pinv.col.date'), key: 'date', width: 100, render: (_, r) => (r.preview.issueDate ? dayjs(r.preview.issueDate).format('DD/MM/YYYY') : muted) },
    { title: t('pinv.col.amount'), key: 'amount', width: 120, align: 'right', render: (_, r) => num(r.preview.totalBeforeTax, 2) },
    { title: t('pinv.col.vat'), key: 'vat', width: 110, align: 'right', render: (_, r) => num(r.preview.totalTax, 2) },
    {
      title: t('pinv.col.total'), key: 'total', width: 130, align: 'right',
      render: (_, r) => <>{num(r.preview.totalPayable, 2)}{r.preview.currency && r.preview.currency !== 'VND' ? <span className="cell-muted"> {r.preview.currency}</span> : null}</>,
    },
    {
      title: t('pinv.col.supplier'), key: 'supplier', width: 190,
      render: (_, r) => {
        const s = r.preview.supplier
        if (!s) return muted
        return (
          <div>
            <Tag color={SUPPLIER_TAG[s.result] ?? 'default'} variant="filled">{t(`pinv.supplier.${s.result}`, { defaultValue: s.result })}</Tag>
            {s.custSeq != null && <div className="cell-muted">{s.custName} ({s.custSeq})</div>}
          </div>
        )
      },
    },
    { title: t('pinv.col.issues'), key: 'issues', width: 260, render: (_, r) => <IssueTags issues={r.preview.issues} /> },
    {
      title: <Tooltip title={t('pinv.slipHint')}>{t('pinv.col.slip')}</Tooltip>, key: 'slip', width: 130,
      render: (_, r) => (
        <InputNumber size="small" min={1} precision={0} controls={false} placeholder={t('pinv.slipPh')} style={{ width: '100%' }}
          value={slips[r.id] ?? null} disabled={hasError(r.preview.issues)} onChange={(v) => setSlips((m) => ({ ...m, [r.id]: v }))} />
      ),
    },
    {
      title: t('pinv.col.actions'), key: 'actions', width: 200, fixed: 'right',
      render: (_, r) => {
        const slip = slips[r.id]
        const blocked = hasError(r.preview.issues) || !slip
        const busy = push.isPending && push.variables?.item.id === r.id
        return (
          <Space size={4}>
            <Button size="small" icon={<ExperimentOutlined />} disabled={blocked} loading={busy && push.variables?.dryRun}
              onClick={() => slip && push.mutate({ item: r, slipSeq: slip, dryRun: true })}>{t('pinv.dryRun')}</Button>
            {st?.allowCommit && (
              <Popconfirm title={t('pinv.commitConfirm', { no: r.preview.number, slip })} disabled={blocked}
                onConfirm={() => slip && push.mutate({ item: r, slipSeq: slip, dryRun: false })}>
                <Button size="small" danger icon={<SafetyOutlined />} disabled={blocked} loading={busy && !push.variables?.dryRun}>{t('pinv.commit')}</Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  const rowColumns: ColumnsType<VatItemRow> = [
    { title: t('pinv.row.no'), dataIndex: 'dataSeq', width: 50 },
    { title: t('pinv.row.name'), dataIndex: 'itemName', ellipsis: true },
    { title: t('pinv.row.qty'), dataIndex: 'qty', width: 80, align: 'right', render: (v: number | null) => num(v, 3) },
    { title: t('pinv.row.price'), dataIndex: 'price', width: 110, align: 'right', render: (v: number | null) => num(v, 2) },
    { title: t('pinv.row.amt'), dataIndex: 'amt', width: 120, align: 'right', render: (v: number) => num(v) },
    { title: t('pinv.row.vatType'), dataIndex: 'smVatType', width: 90, render: (v: number) => VAT_TYPE[v] ?? v },
    { title: t('pinv.row.vatAmt'), dataIndex: 'vatAmt', width: 110, align: 'right', render: (v: number) => num(v) },
    { title: t('pinv.row.totAmt'), dataIndex: 'totAmt', width: 120, align: 'right', render: (v: number) => num(v) },
  ]

  const chips = st ? [
    <span key="db"><DatabaseOutlined /> {t('pinv.db', { db: st.expectedDatabase ?? '—' })}</span>,
    <span key="mode">{st.allowCommit ? t('pinv.commitOn') : t('pinv.dryOnly')}</span>,
  ] : undefined

  const res = ran?.result
  const saved = res?.saved
  const procErrors = saved?.errors ?? []
  const blockedByIssues = !!res && hasError(res.issues)
  const first = res?.rows[0]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<AuditOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.purchaseInvoices')} subtitle={t('nav.purchaseInvoicesDesc')} chips={chips} />
      {status.isError && <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('pinv.err.load')} />}
      {st && !st.configured && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('pinv.err.erp_not_configured')} />}

      <Card style={{ marginTop: 12 }}>
        <Upload.Dragger multiple accept=".xml,text/xml,application/xml" fileList={files} beforeUpload={() => false}
          onChange={({ fileList }) => setFiles(fileList)} disabled={preview.isPending}>
          <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
          <p className="ant-upload-text">{t('pinv.pick')}</p>
          <p className="ant-upload-hint">{t('pinv.pickHint', { max: maxFiles, mb: Math.round((st?.maxFileBytes ?? 5 * 1024 * 1024) / 1024 / 1024) })}</p>
        </Upload.Dragger>
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" onClick={runCheck} loading={preview.isPending} disabled={files.length === 0 || (st != null && !st.configured)}>{t('pinv.check')}</Button>
          <Button onClick={() => { setFiles([]); setItems([]); setSlips({}); setRan(null) }} disabled={preview.isPending}>{t('pinv.clear')}</Button>
          {items.length > 0 && <span className="cell-muted">{t('pinv.count', counts)}</span>}
        </Space>
      </Card>

      <Card style={{ marginTop: 12 }} styles={{ body: { padding: 0 } }}>
        <Table<Item> rowKey="id" size="small" columns={columns} dataSource={items} pagination={false} scroll={{ x: 1700 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} /> }} />
      </Card>

      <Drawer open={!!ran} onClose={() => setRan(null)} size={900}
        title={ran ? t('pinv.result.title', { mode: ran.dryRun ? t('pinv.result.modeDry') : t('pinv.result.modeCommit'), no: ran.item.preview.number, slip: ran.slipSeq }) : ''}>
        {res && (
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            {blockedByIssues && <Alert type="error" showIcon title={t('pinv.result.blocked')} />}
            {!blockedByIssues && procErrors.length > 0 && (
              <Alert type="error" showIcon title={t('pinv.result.procErrors')} description={<ul style={{ margin: 0, paddingLeft: 18 }}>{procErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>} />
            )}
            {!blockedByIssues && procErrors.length === 0 && saved && (
              saved.committed
                ? <Alert type="success" showIcon title={t('pinv.result.committed', { n: saved.serls.length, db: saved.database, serls: saved.serls.join(', ') })} />
                : <Alert type="info" showIcon title={t('pinv.result.dryOk', { db: saved.database, n: saved.serls.length, amt: num(saved.totalAmt), vat: num(saved.totalVat) })} />
            )}
            {res.issues.length > 0 && <IssueTags issues={res.issues} />}
            {first && (
              <div className="cell-muted">
                {t('pinv.row.invoiceCode')}: <b>{first.invoiceCode}</b> · {t('pinv.row.invoiceNo')}: <b>{first.invoiceNo}</b> · {t('pinv.row.invoiceDate')}: <b>{ymd(first.invoiceDate)}</b> · CustSeq <b>{first.custSeq}</b> · BizNo <b>{first.bizNo}</b>
              </div>
            )}
            <div><b>{t('pinv.result.rows')}</b></div>
            <Table<VatItemRow> rowKey="dataSeq" size="small" columns={rowColumns} dataSource={res.rows} pagination={false} />
          </Space>
        )}
      </Drawer>
    </div>
  )
}
