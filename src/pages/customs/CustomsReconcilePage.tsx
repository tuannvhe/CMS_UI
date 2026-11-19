import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Alert, Avatar, Button, Card, DatePicker, Drawer, Empty, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DatabaseOutlined, DiffOutlined, FileExcelOutlined, ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { customsError } from '../../api/customs'
import {
  customsReconcile, RECONCILE_STATUSES, type ReconcileCheck, type ReconcileCounts, type ReconcilePage, type ReconcilePermit, type ReconcileQuery,
  type ReconcileRow, type ReconcileStatus, type ReconcileTolerance,
} from '../../api/customsReconcile'
import { useAuth } from '../../auth/AuthContext'
import { PageBanner } from '../../components/PageBanner'
import { FilterBar, FilterRow, PillFilter } from '../../components/FilterBar'
import { useToast } from '../../hooks/useToast'
import { ErpPushButtons } from './ErpPush'

type Kind = 'all' | 'N' | 'X'

/** Màu theo trạng thái: tag (preset Ant Design) và màu nhấn của thẻ số. */
const STATUS_TONE: Record<ReconcileStatus, { tag: string; tile: string }> = {
  matched: { tag: 'success', tile: '#2E9E4F' },
  mismatch: { tag: 'error', tile: '#D92D20' },
  notPushed: { tag: 'warning', tile: '#D48806' },
  notApplicable: { tag: 'default', tile: '#667085' },
  orphanPermit: { tag: 'purple', tile: '#7A5AF8' },
  duplicate: { tag: 'volcano', tile: '#E8590C' },
}
/** Nền dòng so sánh: vượt dung sai = đỏ nhạt, cảnh báo = vàng nhạt (trong suốt nên hợp cả nền sáng lẫn tối). */
const RESULT_BG: Record<string, string | undefined> = { over: 'rgba(217, 45, 32, 0.10)', warn: 'rgba(212, 136, 6, 0.12)' }
const RESULT_TAG: Record<string, string> = { ok: 'success', over: 'error', warn: 'warning', skip: 'default' }
/** Số chữ số thập phân khi hiện giá trị / chênh lệch của từng mục. */
const DIGITS: Record<string, number> = { lines: 0, qty: 3, curAmt: 2, domAmt: 0, importTax: 0, vat: 0, date: 0 }
const TEXT_FIELDS = new Set(['date', 'currency'])

const day = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '')
/** PermitDate của ERP dạng "yyyyMMdd". */
const ymd = (v: string | null | undefined) => (v && /^\d{8}$/.test(v) ? `${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)}` : v ?? '')
const muted = <span className="cell-muted">—</span>

function useNum() {
  const { i18n } = useTranslation()
  return (v: number | null | undefined, digits = 2, signed = false) => {
    if (v == null) return ''
    const s = v.toLocaleString(i18n.language, { maximumFractionDigits: digits })
    return signed && v > 0 ? `+${s}` : s
  }
}

function StatusTag({ status }: { status: ReconcileStatus }) {
  const { t } = useTranslation()
  return <Tag color={STATUS_TONE[status]?.tag} variant="filled">{t(`crc.status.${status}`)}</Tag>
}

function KindTag({ value }: { value: string }) {
  const { t } = useTranslation()
  if (value === 'N') return <Tag color="blue" variant="filled">{t('crc.kindN')}</Tag>
  if (value === 'X') return <Tag color="purple" variant="filled">{t('crc.kindX')}</Tag>
  return <span className="cell-muted">{value || '—'}</span>
}

/** Lý do "Không áp dụng": huỷ / đã có tờ khai sửa thay thế / loại hình chưa có trong bảng mã. */
function useReasonText() {
  const { t } = useTranslation()
  return (r: ReconcileRow) => {
    if (r.reason === 'cancelled') return t('crc.reason.cancelled')
    if (r.reason === 'superseded') return r.supersededBy ? t('crc.reason.supersededBy', { no: r.supersededBy }) : t('crc.reason.superseded')
    if (r.reason === 'kindNotMapped') return t('crc.reason.kindNotMapped', { code: r.maLoaiHinh ?? '' })
    return ''
  }
}

/** Tóm tắt một dòng: dựng từ checks có kết quả over / warn (không dùng `note` tiếng Việt của máy chủ). */
function useSummary() {
  const { t } = useTranslation()
  const n = useNum()
  const reasonText = useReasonText()
  const item = (c: ReconcileCheck) => {
    const field = t(`crc.field.${c.field}`, { defaultValue: c.field })
    if (TEXT_FIELDS.has(c.field) || c.diff == null) return t('crc.sum.text', { field, ecus: c.ecusText ?? '—', erp: c.erpText ?? '—' })
    return t('crc.sum.diff', { field, diff: n(c.diff, DIGITS[c.field] ?? 2, true) })
  }
  return (r: ReconcileRow) => {
    if (r.status === 'notApplicable') return { over: [] as string[], warn: [] as string[], other: reasonText(r) }
    if (r.status === 'orphanPermit') return { over: [], warn: [], other: t('crc.sum.orphan', { no: r.permits.map((p) => p.permitNo).filter(Boolean).join(', ') || '—' }) }
    const over = r.checks.filter((c) => c.result === 'over').map(item)
    const warn = r.checks.filter((c) => c.result === 'warn').map(item)
    const other = r.status === 'duplicate' ? t('crc.sum.duplicate', { count: r.permits.length }) : ''
    return { over, warn, other }
  }
}

function Summary({ row }: { row: ReconcileRow }) {
  const s = useSummary()(row)
  if (!s.over.length && !s.warn.length && !s.other) return muted
  return (
    <div style={{ lineHeight: 1.5 }}>
      {s.other && <div className="cell-muted">{s.other}</div>}
      {s.over.length > 0 && <div style={{ color: '#D92D20' }}>{s.over.join('; ')}</div>}
      {s.warn.length > 0 && <div style={{ color: '#B76E00' }}>{s.warn.join('; ')}</div>}
    </div>
  )
}

/** Hàng thẻ số theo counts: bấm để lọc theo trạng thái, bấm lại để bỏ lọc. */
function CountTiles({ counts, value, onChange }: { counts: ReconcileCounts | undefined; value: ReconcileStatus | null; onChange: (s: ReconcileStatus | null) => void }) {
  const { t } = useTranslation()
  const n = useNum()
  return (
    <div className="stat-grid" title={t('crc.tileHint')}>
      {RECONCILE_STATUSES.map((s) => {
        const on = value === s
        const toggle = () => onChange(on ? null : s)
        const style: CSSProperties = { ['--tile' as string]: STATUS_TONE[s].tile, cursor: 'pointer', opacity: value && !on ? 0.55 : 1,
          boxShadow: on ? `0 0 0 2px ${STATUS_TONE[s].tile}` : undefined } as CSSProperties
        return (
          <div key={s} className="stat-tile" role="button" tabIndex={0} aria-pressed={on} style={style} onClick={toggle}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
            <div className="st-label" title={t(`crc.status.${s}`)}>{t(`crc.status.${s}`)}</div>
            <div><span className="st-value">{counts ? n(counts[s], 0) : '—'}</span></div>
          </div>
        )
      })}
    </div>
  )
}

/** Dung sai của một mục để hiện ở bảng chi tiết (máy chủ trả số áp dụng cho dòng này; trị giá VND kèm quy tắc % / tối thiểu). */
function useToleranceText(tol: ReconcileTolerance | undefined) {
  const { t } = useTranslation()
  const n = useNum()
  return (c: ReconcileCheck) => {
    if (c.field === 'date') return t('crc.detail.days', { n: c.tolerance ?? tol?.dateDays ?? 0 })
    if (c.field === 'domAmt' && tol) return `${n(c.tolerance, 0) || '—'} (${n(tol.domAmtPercent, 3)}% / ${n(tol.domAmtMin, 0)})`
    return c.tolerance == null ? '—' : n(c.tolerance, 6)
  }
}

/** Chi tiết một dòng đối soát: thông tin tờ khai, nút đẩy (dòng Chưa đẩy), bảng so sánh ECUS | ERP, danh sách permit, lý do Không áp dụng. */
function DetailDrawer({ row, tolerance, canPush, onClose, onCommitted }: { row: ReconcileRow | null; tolerance: ReconcileTolerance | undefined; canPush: boolean; onClose: () => void; onCommitted: () => void }) {
  const { t } = useTranslation()
  const n = useNum()
  const reasonText = useReasonText()
  const tolText = useToleranceText(tolerance)
  const value = (text: string | null, v: number | null, field: string) => text ?? (v == null ? '' : n(v, DIGITS[field] ?? 6))
  const bg = (c: ReconcileCheck) => ({ style: { background: RESULT_BG[c.result] } })
  const checkCols: ColumnsType<ReconcileCheck> = [
    { title: t('crc.detail.field'), dataIndex: 'field', width: 150, onCell: bg, render: (v: string) => <b>{t(`crc.field.${v}`, { defaultValue: v })}</b> },
    { title: t('crc.detail.ecus'), width: 150, align: 'right', onCell: bg, render: (_: unknown, c) => value(c.ecusText, c.ecusValue, c.field) || muted },
    { title: t('crc.detail.erp'), width: 150, align: 'right', onCell: bg, render: (_: unknown, c) => value(c.erpText, c.erpValue, c.field) || muted },
    { title: t('crc.detail.diff'), dataIndex: 'diff', width: 140, align: 'right', onCell: bg,
      render: (v: number | null, c) => (v == null ? muted : <span style={{ color: c.result === 'over' ? '#D92D20' : c.result === 'warn' ? '#B76E00' : undefined, fontWeight: c.result === 'over' ? 600 : undefined }}>{n(v, DIGITS[c.field] ?? 6, true)}</span>) },
    { title: t('crc.detail.tolerance'), width: 150, align: 'right', onCell: bg, render: (_: unknown, c) => tolText(c) },
    { title: t('crc.detail.result'), dataIndex: 'result', width: 130, onCell: bg, render: (v: string) => <Tag color={RESULT_TAG[v] ?? 'default'} variant="filled">{t(`crc.result.${v}`, { defaultValue: v })}</Tag> },
  ]
  const permitCols: ColumnsType<ReconcilePermit> = [
    { title: t('crc.detail.permitNo'), dataIndex: 'permitNo', render: (v: string | null) => (v ? <b>{v}</b> : muted) },
    { title: t('crc.detail.permitRefNo'), dataIndex: 'permitRefNo', render: (v: string | null) => v || muted },
    { title: t('crc.detail.permitDate'), dataIndex: 'permitDate', width: 120, render: (v: string | null) => ymd(v) || muted },
    { title: t('crc.detail.permitSeq'), dataIndex: 'permitSeq', width: 110, align: 'right' },
  ]
  const pushable = !!row && row.status === 'notPushed' && (row.loai === 'N' || row.loai === 'X')
  return (
    <Drawer open={!!row} onClose={onClose} size={980} destroyOnHidden
      title={row ? <span><DiffOutlined /> {t('crc.detail.title')} <b>{row.soToKhai}</b></span> : null}>
      {row && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap size={[8, 8]}>
            <KindTag value={row.loai} />
            <StatusTag status={row.status} />
            {row.maLoaiHinh && <Tag>{row.maLoaiHinh}</Tag>}
            {row.ngayDangKy && <span>{day(row.ngayDangKy)}</span>}
            {row.doiTac && <span className="cell-muted">· {row.doiTac}</span>}
            {row.soHoaDon && <span className="cell-muted">· {row.soHoaDon}</span>}
          </Space>

          {row.status === 'notApplicable' && <Alert type="info" showIcon title={t('crc.detail.notApplicable')} description={reasonText(row) || undefined} />}
          {row.status === 'orphanPermit' && <Alert type="warning" showIcon title={t('crc.detail.orphanHint')} />}
          {row.status === 'duplicate' && <Alert type="warning" showIcon title={t('crc.detail.duplicateHint', { count: row.permits.length })} />}
          {row.status === 'mismatch' && <Alert type="error" showIcon title={t('crc.detail.mismatchHint')} />}
          {row.status === 'notPushed' && (
            <Alert type="warning" showIcon title={t('crc.detail.notPushedHint')}
              action={pushable && canPush ? <Space><ErpPushButtons size="small" target={{ kind: row.loai === 'N' ? 'import' : 'export', soToKhai: row.soToKhai }} onCommitted={onCommitted} /></Space> : undefined} />
          )}

          {row.status !== 'notApplicable' && row.status !== 'orphanPermit' && (
            <Card size="small" title={t('crc.detail.checks')}>
              <Table<ReconcileCheck> size="small" rowKey="field" columns={checkCols} dataSource={row.checks} pagination={false} scroll={{ x: 870 }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('crc.detail.noChecks')} /> }} />
            </Card>
          )}

          <Card size="small" title={t('crc.detail.permits')}>
            <Table<ReconcilePermit> size="small" rowKey="permitSeq" columns={permitCols} dataSource={row.permits} pagination={false}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('crc.detail.noPermits')} /> }} />
          </Card>
        </Space>
      )}
    </Drawer>
  )
}

const rowKey = (r: ReconcileRow) => `${r.status === 'orphanPermit' ? 'o' : 'd'}|${r.loai}|${r.soToKhai}|${r.permits[0]?.permitSeq ?? ''}`
const sameRow = (a: ReconcileRow, b: ReconcileRow) => a.soToKhai === b.soToKhai && a.loai === b.loai && (a.status === 'orphanPermit') === (b.status === 'orphanPermit')

/**
 * Đối soát tờ khai ECUS ↔ permit ERP (đợt 1: chỉ tab Đối soát + xuất Excel). Chỉ đọc; dòng "Chưa đẩy" dùng lại nút Chạy thử / Đẩy sang ERP sẵn có.
 * Số liệu máy chủ giữ trong bộ nhớ đệm: nút Làm mới (refresh=true) đọc lại ECUS + ERP; đẩy thật xong cũng tự làm mới.
 */
export default function CustomsReconcilePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canPush = !!(user?.isAdmin || user?.grantedPages?.includes('customsErpPush'))
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [kind, setKind] = useState<Kind>('all')
  const [status, setStatus] = useState<ReconcileStatus | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sel, setSel] = useState<ReconcileRow | null>(null)
  const selRef = useRef<ReconcileRow | null>(null)
  selRef.current = sel
  const [exporting, setExporting] = useState(false)
  const params: ReconcileQuery = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), kind: kind === 'all' ? undefined : kind, status: status ?? undefined }

  const info = useQuery({ queryKey: ['customs-reconcile', 'status'], queryFn: customsReconcile.status, staleTime: 300_000, retry: false })
  const maxDays = info.data?.maxRangeDays ?? 31
  const maxDecl = info.data?.maxDeclarations ?? 1000
  const tooLong = range[1].diff(range[0], 'day') + 1 > maxDays
  const configured = !!info.data?.ecusConfigured && !!info.data?.erpConfigured
  const ready = configured && !tooLong
  const listKey = ['customs-reconcile', 'list', params, page, pageSize] as const
  const list = useQuery({ queryKey: listKey, queryFn: () => customsReconcile.list({ ...params, page, pageSize }), enabled: ready, retry: false, placeholderData: (p) => p })
  const listErr = useQuery({ queryKey: ['customs-reconcile', 'list-err', list.errorUpdatedAt], queryFn: () => customsError(list.error), enabled: list.isError })

  /** Câu báo lỗi theo mã ProblemDetails của API đối soát. */
  const errText = (code: string, detail: string) => {
    if (code === 'too_many') return t('crc.err.too_many', { max: Number(detail) || maxDecl })
    if (code === 'invalid_input') return detail === 'range_too_long' ? t('crc.err.range_too_long', { days: maxDays }) : t('crc.err.invalid', { d: detail || code })
    if (['ecus_not_configured', 'erp_not_configured', 'reconcile_unavailable', 'not_found'].includes(code)) return t(`crc.err.${code}`)
    return t('crc.err.load')
  }

  /** Sau khi có số liệu mới: cập nhật dòng đang mở trong Drawer (dòng đã đẩy có thể rời trang hiện tại thì đọc riêng qua GET /{soToKhai}). */
  const syncSelected = (data: ReconcilePage) => {
    const cur = selRef.current
    if (!cur) return
    const found = data.rows.find((r) => sameRow(r, cur))
    if (found) { setSel(found); return }
    if (cur.status === 'orphanPermit') return
    customsReconcile.get(cur.soToKhai, { from: params.from, to: params.to, kind: cur.loai === 'N' || cur.loai === 'X' ? cur.loai : undefined })
      .then((r) => { if (selRef.current && sameRow(selRef.current, cur)) setSel(r) })
      .catch(() => { /* giữ dòng cũ */ })
  }

  const refresh = useMutation({
    mutationFn: () => customsReconcile.list({ ...params, page, pageSize, refresh: true }),
    onSuccess: (data) => {
      const k = JSON.stringify(listKey)
      qc.setQueryData(listKey, data)
      // các trang / bộ lọc khác đang giữ số liệu cũ: đánh dấu cũ để lần mở sau tải lại (không tải ngay)
      qc.invalidateQueries({ queryKey: ['customs-reconcile', 'list'], predicate: (q) => JSON.stringify(q.queryKey) !== k, refetchType: 'none' })
      syncSelected(data)
    },
    onError: async (e) => { const { code, detail } = await customsError(e); toast.error(errText(code, detail)) },
  })

  const doExport = async () => {
    setExporting(true)
    try { await customsReconcile.exportExcel(params) }
    catch (e) {
      const { code, detail } = await customsError(e)
      toast.error(code ? errText(code, detail) : t('crc.err.export'))
    }
    finally { setExporting(false) }
  }

  const reset = () => setPage(1)
  const data = list.data
  const busy = list.isFetching || refresh.isPending

  const columns: ColumnsType<ReconcileRow> = [
    { title: t('crc.col.number'), dataIndex: 'soToKhai', width: 150, fixed: 'left', render: (v: string) => <a><b>{v}</b></a> },
    { title: t('crc.col.kind'), dataIndex: 'loai', width: 80, render: (v: string) => <KindTag value={v} /> },
    { title: t('crc.col.date'), dataIndex: 'ngayDangKy', width: 105, render: (v: string | null) => day(v) || muted },
    { title: t('crc.col.type'), dataIndex: 'maLoaiHinh', width: 90, render: (v: string | null) => v || muted },
    { title: t('crc.col.partner'), dataIndex: 'doiTac', width: 240, ellipsis: { showTitle: true }, render: (v: string | null) => v || muted },
    { title: t('crc.col.invoice'), dataIndex: 'soHoaDon', width: 150, render: (v: string | null) => v || muted },
    { title: t('crc.col.status'), dataIndex: 'status', width: 170, render: (v: ReconcileStatus) => <StatusTag status={v} /> },
    { title: t('crc.col.summary'), render: (_: unknown, r) => <Summary row={r} /> },
  ]
  if (canPush) {
    columns.push({
      title: t('crc.col.actions'), width: 250, render: (_: unknown, r) => (r.status === 'notPushed' && (r.loai === 'N' || r.loai === 'X')
        // chặn click lan lên dòng (kể cả từ modal của nút, React cho sự kiện trong portal nổi lên cây component)
        ? <span onClick={(e) => e.stopPropagation()}><Space size={6}><ErpPushButtons size="small" target={{ kind: r.loai === 'N' ? 'import' : 'export', soToKhai: r.soToKhai }} onCommitted={() => refresh.mutate()} /></Space></span>
        : null),
    })
  }

  const chips = data ? [
    <span key="db"><DatabaseOutlined /> {t('crc.erpDb', { db: data.erpDatabase ?? '—', source: data.erpSource ?? info.data?.erpSource ?? '' })}</span>,
    <span key="at"><ClockCircleOutlined /> {t('crc.generatedAt', { at: dayjs(data.generatedAt).format('HH:mm:ss DD/MM/YYYY') })}</span>,
  ] : undefined

  const errCode = listErr.data?.code ?? ''
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<DiffOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.customsReconcile')} subtitle={t('nav.customsReconcileDesc')} chips={chips} />
      {info.isError && <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('crc.err.load')} />}
      {info.data && !info.data.ecusConfigured && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('crc.err.ecus_not_configured')} />}
      {info.data && !info.data.erpConfigured && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('crc.err.erp_not_configured')} />}
      <Card size="small" style={{ margin: '12px 0' }}>
        <FilterBar>
          <FilterRow kind="status">
            <PillFilter value={kind} onChange={(k) => { setKind(k); reset() }}
              options={[{ key: 'all', label: t('crc.kindAll'), tone: '#475467' }, { key: 'N', label: t('crc.kindN'), tone: '#2F6FB0' }, { key: 'X', label: t('crc.kindX'), tone: '#7A5AF8' }]} />
          </FilterRow>
          <FilterRow kind="find">
            <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} disabledDate={(d) => d.isAfter(dayjs(), 'day')}
              onChange={(v) => { if (v && v[0] && v[1]) { setRange([v[0], v[1]]); reset() } }} />
            <Button icon={<ReloadOutlined />} onClick={() => refresh.mutate()} loading={refresh.isPending} disabled={!ready || list.isFetching}>{t('crc.refresh')}</Button>
            <Button icon={<FileExcelOutlined />} onClick={doExport} loading={exporting} disabled={!ready || !data?.total}>{t('crc.export')}</Button>
            {info.data?.taxCompareFrom && <span className="cell-muted">{t('crc.taxFrom', { date: day(info.data.taxCompareFrom) })}</span>}
          </FilterRow>
        </FilterBar>
      </Card>
      {tooLong && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('crc.err.range_too_long', { days: maxDays })} />}
      {list.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={listErr.data ? errText(errCode, listErr.data.detail) : t('crc.err.load')} />}

      {configured && <CountTiles counts={data?.counts} value={status} onChange={(s) => { setStatus(s); reset() }} />}

      <Card size="small" title={data ? (status ? t('crc.foundFiltered', { count: data.total, status: t(`crc.status.${status}`) }) : t('crc.found', { count: data.total })) : t('nav.customsReconcile')}
        extra={status ? <Tooltip title={t('crc.tileHint')}><Tag closable color={STATUS_TONE[status].tag} onClose={(e) => { e.preventDefault(); setStatus(null); reset() }}>{t(`crc.status.${status}`)}</Tag></Tooltip> : undefined}>
        {!configured && info.data ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
          <Table<ReconcileRow> size="small" rowKey={rowKey} loading={busy} columns={columns} dataSource={data?.rows ?? []} scroll={{ x: canPush ? 1500 : 1250 }}
            onRow={(r) => ({ onClick: () => setSel(r), style: { cursor: 'pointer' } })}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={status ? t('crc.emptyFilter') : t('crc.empty')} /> }}
            pagination={{ current: page, pageSize, total: data?.total ?? 0, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200],
              onChange: (p, s) => { setPage(s !== pageSize ? 1 : p); setPageSize(s) } }} />
        )}
      </Card>
      <DetailDrawer row={sel} tolerance={info.data?.tolerance} canPush={canPush} onClose={() => setSel(null)} onCommitted={() => refresh.mutate()} />
    </div>
  )
}
