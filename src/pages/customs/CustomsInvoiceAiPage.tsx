import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Alert, AutoComplete, Avatar, Button, Card, Checkbox, Descriptions, Drawer, Empty, Input, InputNumber, Popconfirm, Segmented, Space, Spin, Table, Tabs, Tag, Tooltip, Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { RcFile, UploadFile } from 'antd/es/upload'
import {
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, FileExcelOutlined, FilePdfOutlined, HistoryOutlined, InboxOutlined,
  LoadingOutlined, ReloadOutlined, RobotOutlined, SearchOutlined, StopOutlined, SyncOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  customsInvoiceAi, invoiceAiError, type AiErp, type AiInvoice, type AiLine, type AiPackingLine, type AiPageInfo, type GridLine, type HsHistoryRow, type HsSuggestion,
  type InvoiceCheck, type InvoiceExportRequest, type InvoiceExtractResult,
} from '../../api/customsInvoiceAi'
import { PageBanner } from '../../components/PageBanner'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

/** Chỉ jobId nằm trong sessionStorage (không lưu giá / kết quả ở trình duyệt). */
const JOB_KEY = 'cia.jobId'
const readJobId = () => { try { return sessionStorage.getItem(JOB_KEY) } catch { return null } }
const writeJobId = (id: string | null) => { try { if (id) sessionStorage.setItem(JOB_KEY, id); else sessionStorage.removeItem(JOB_KEY) } catch { /* bỏ qua */ } }

const PER_KIND = 3
const MB = 1024 * 1024
const CHECK_DEBOUNCE_MS = 800
const PAGE_SIZE = 50
/** Sửa các trường này thì dòng cần "Ghép lại ERP/HS". */
const MATCH_FIELDS = new Set(['description', 'supplierCode', 'unit', 'origin', 'erpItemNo'])
const NUMBER_FIELDS = new Set(['qty', 'unitPrice', 'amount'])
/** Cảnh báo số liệu của AI: bỏ khi người dùng sửa số (kiểm tra /check sẽ báo lại nếu vẫn sai). */
const NUMBER_WARNINGS = new Set(['number_ambiguous', 'unreadable_number', 'negative', 'missing_qty', 'missing_price', 'missing_amount', 'line_math'])
/** Cảnh báo do /match tính lại (thay bằng kết quả mới khi ghép lại). */
const MATCH_WARNINGS = new Set(['erp_multi', 'erp_truncated', 'erp_unavailable', 'no_history', 'hs_multi', 'rate_varies', 'unit_differs'])
/** Lỗi đối chiếu lấy từ kết quả đọc, máy chủ cũ không tính lại ở /check: giữ lại sau mỗi lần kiểm (không trùng). */
const HELD_CHECKS = new Set(['lines_truncated', 'unreadable_pages'])
/** Cảnh báo cho biết AI đã cắt bớt dòng hàng → truncated = true khi gửi /check, /export. */
const TRUNCATED_WARNINGS = new Set(['lines_truncated'])
const CONF_TAG: Record<string, string> = { high: 'success', medium: 'gold', low: 'error' }
const BG_ERROR = 'rgba(217, 45, 32, 0.10)'
const BG_WARN = 'rgba(212, 136, 6, 0.12)'
const BG_FLASH = 'rgba(47, 111, 176, 0.22)'
const EDITED_STYLE: CSSProperties = { background: 'rgba(47, 111, 176, 0.08)' }
const muted = <span className="cell-muted">—</span>

/** Dòng lưới = GridLine gửi máy chủ + phần chỉ để hiển thị (gợi ý, cảnh báo, ô đã sửa). */
interface Row extends GridLine {
  page: number | null; confidence: string; hs: HsSuggestion[]; erp: AiErp | null; warnings: string[]; edited: string[]; dirty: boolean
}

const toRow = (l: AiLine): Row => {
  const h = l.hs?.[0]
  return {
    id: l.id, invoiceNo: l.invoiceNo, lineNo: l.lineNo, description: l.description, supplierCode: l.supplierCode, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice,
    amount: l.amount, currency: l.currency, origin: l.origin, packing: l.packing, erpItemNo: l.erp?.itemNo ?? null, erpItemName: l.erp?.itemName ?? null,
    ecusCode: h?.ecusCode ?? null, hsCode: h?.hsCode ?? null, importRate: h?.importRate ?? null, importTariffCode: h?.importTariffCode ?? null, vatRate: h?.vatRate ?? null,
    vatTariffCode: h?.vatTariffCode ?? null, ecusUnit: h?.ecusUnit ?? null, qty2: null, unit2: null, importExemptCode: null, hsConfidence: h?.confidence ?? null,
    hsSource: h?.by ?? null, note: null, page: l.page, confidence: l.confidence, hs: l.hs ?? [], erp: l.erp, warnings: l.warnings ?? [], edited: [], dirty: false,
  }
}

const toGrid = (r: Row): GridLine => ({
  id: r.id, invoiceNo: r.invoiceNo, lineNo: r.lineNo, description: r.description, supplierCode: r.supplierCode, qty: r.qty, unit: r.unit, unitPrice: r.unitPrice,
  amount: r.amount, currency: r.currency, origin: r.origin, packing: r.packing, erpItemNo: r.erpItemNo, erpItemName: r.erpItemName, ecusCode: r.ecusCode, hsCode: r.hsCode,
  importRate: r.importRate, importTariffCode: r.importTariffCode, vatRate: r.vatRate, vatTariffCode: r.vatTariffCode, ecusUnit: r.ecusUnit, qty2: r.qty2, unit2: r.unit2,
  importExemptCode: r.importExemptCode, hsConfidence: r.hsConfidence, hsSource: r.hsSource, note: r.note,
})

/** Giờ máy chủ là UTC; chuỗi thiếu múi giờ thì coi là UTC. */
const utc = (v: string | null | undefined) => (v ? dayjs(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`) : null)
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
const day = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '')
const blank = (v: string) => (v.trim() === '' ? null : v)

function useNum() {
  const { i18n } = useTranslation()
  return (v: number | null | undefined, digits = 4) => (v == null ? '' : v.toLocaleString(i18n.language, { maximumFractionDigits: digits }))
}

function ConfTag({ value }: { value: string | null | undefined }) {
  const { t } = useTranslation()
  if (!value) return null
  return <Tag color={CONF_TAG[value] ?? 'default'} variant="filled" style={{ marginInlineEnd: 0 }}>{t(`cia.conf.${value}`, { defaultValue: value })}</Tag>
}

/**
 * Đọc invoice / packing list bằng AI nội bộ → lưới sửa được (gợi ý mã ERP, HS / thuế từ lịch sử ECUS) → kiểm đối chiếu → Excel nhập hàng ECUS5.
 * Lượt đọc chạy nền: POST /extract trả jobId, hỏi GET /extract/{jobId} mỗi pollSeconds. jobId giữ trong sessionStorage để rời màn rồi quay lại vẫn thấy.
 * Lưới chỉ nằm trong state React; không lưu giá / kết quả vào localStorage.
 */
export default function CustomsInvoiceAiPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const n = useNum()

  const status = useQuery({ queryKey: ['customs-invoice-ai', 'status'], queryFn: customsInvoiceAi.status, staleTime: 30_000, retry: false })
  const st = status.data
  const poll = Math.max(2, st?.pollSeconds ?? 5) * 1000
  const maxFiles = st?.maxFiles ?? PER_KIND * 2
  const perKind = Math.min(PER_KIND, maxFiles)

  // ---- tải file ----
  const [invFiles, setInvFiles] = useState<UploadFile[]>([])
  const [packFiles, setPackFiles] = useState<UploadFile[]>([])
  const filesRef = useRef<{ invoice: UploadFile[]; packing: UploadFile[] }>({ invoice: [], packing: [] })

  // ---- lượt đọc ----
  const [jobId, setJobIdState] = useState<string | null>(() => readJobId())
  const restoredRef = useRef(!!jobId)   // jobId lấy lại từ sessionStorage (quay lại màn) → báo các chỗ sửa trước đó không còn
  const [jobNotice, setJobNotice] = useState<string | null>(null)
  const setJobId = (id: string | null) => { writeJobId(id); setJobIdState(id) }

  // ---- kết quả + lưới ----
  const [result, setResult] = useState<InvoiceExtractResult | null>(null)
  const [invoices, setInvoices] = useState<AiInvoice[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const rowsRef = useRef<Row[]>([])
  rowsRef.current = rows
  const loadedForRef = useRef<string | null>(null)
  const [checks, setChecks] = useState<InvoiceCheck[]>([])
  const [checking, setChecking] = useState(false)
  const [version, setVersion] = useState(0)
  const checkSeq = useRef(0)
  const [tab, setTab] = useState('lines')
  const [page, setPage] = useState(1)
  const [flash, setFlash] = useState<string | null>(null)
  const [histRow, setHistRow] = useState<Row | null>(null)
  const [failedChecks, setFailedChecks] = useState<InvoiceCheck[] | null>(null)
  const [force, setForce] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  /** Câu báo lỗi theo mã ProblemDetails / mã lỗi của lượt đọc. */
  const errText = (code: string, detail = '') => {
    switch (code) {
      case 'invalid_input':
        return ['invoice_required', 'lines_required', 'query_required', 'too_many_lines'].includes(detail)
          ? t(`cia.err.${detail}`, { max: st?.maxLines ?? 500 }) : t('cia.err.invalid', { d: detail || code })
      case 'ai_busy': return t(detail === 'queue_full' ? 'cia.err.queue_full' : 'cia.err.user_has_job')
      case 'too_large': return t('cia.err.too_large', { fileMb: st?.maxFileMb ?? '?', totalMb: st?.maxTotalMb ?? '?' })
      case 'too_many_pages': return t('cia.err.too_many_pages', { pages: detail || '?', max: st?.maxPages ?? '?' })
      case 'pdf_unreadable': return t('cia.err.pdf_unreadable', { file: detail ? `"${detail}"` : '' })
      case 'invoice_required': case 'ai_timeout': case 'too_many_files': case 'too_long': case 'ai_unreadable': case 'ai_failed': case 'quota_exceeded': case 'not_found':
      case 'history_unavailable': case 'cancelled': case 'checks_failed': case 'ai_not_configured': case 'ecus_not_configured': case 'erp_not_configured':
        return t(`cia.err.${code}`)
      default: return t('cia.err.generic')
    }
  }
  const failToast = async (e: unknown, fallback = 'cia.err.generic') => {
    const { code, detail } = await invoiceAiError(e)
    toast.error(code ? errText(code, detail) : t(fallback))
  }

  const job = useQuery({
    queryKey: ['customs-invoice-ai', 'job', jobId],
    queryFn: () => customsInvoiceAi.job(jobId as string),
    enabled: !!jobId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => (q.state.data && (q.state.data.state === 'done' || q.state.data.state === 'failed') ? false : poll),
  })
  const jobState = job.data?.state
  const active = !!jobId && (jobState === 'queued' || jobState === 'running' || (!job.data && job.isFetching))

  // Lượt hết hạn / máy chủ khởi động lại → bỏ jobId
  useEffect(() => {
    if (!job.isError || !jobId) return
    let live = true
    invoiceAiError(job.error).then(({ code }) => {
      if (!live) return
      if (code === 'not_found') { setJobNotice(t('cia.job.expired')); setJobId(null) }
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.isError, job.errorUpdatedAt, jobId])

  // Lượt xong: nạp kết quả vào lưới (một lần cho mỗi jobId)
  useEffect(() => {
    const d = job.data
    if (!d || d.state !== 'done' || !d.result || loadedForRef.current === d.jobId) return
    loadedForRef.current = d.jobId
    setResult(d.result)
    setInvoices(d.result.invoices ?? [])
    setRows((d.result.lines ?? []).map(toRow))
    setChecks(d.result.checks ?? [])
    setTab('lines')
    setPage(1)
    if (restoredRef.current) setJobNotice(t('cia.job.reloaded'))
    restoredRef.current = false
    qc.invalidateQueries({ queryKey: ['customs-invoice-ai', 'status'] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data])

  useEffect(() => { if (job.data?.state === 'failed') qc.invalidateQueries({ queryKey: ['customs-invoice-ai', 'status'] }) }, [job.data?.state, qc])

  // Đồng hồ thời gian đã chạy
  useEffect(() => {
    if (!active) return
    const h = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(h)
  }, [active])

  const packingProvided = !!result && ((result.packing?.length ?? 0) > 0 || (result.pageSources ?? []).some((p) => p.kind === 'packing'))
  /** Lấy một lần từ kết quả đọc, gửi kèm mọi lần /check và /export. */
  const truncated = !!result && (result.warnings ?? []).some((w) => TRUNCATED_WARNINGS.has(w))
  const unreadablePages = useMemo(() => [...new Set((result?.pageSources ?? []).filter((p) => p.source === 'none').map((p) => p.page))].sort((a, b) => a - b), [result])
  const heldChecks = useMemo(() => (result?.checks ?? []).filter((c) => HELD_CHECKS.has(c.code)), [result])
  /** Gộp lại lỗi lines_truncated / unreadable_pages của kết quả đọc nếu máy chủ không trả lại (không trùng mã). */
  const withHeld = (list: InvoiceCheck[]) => [...list, ...heldChecks.filter((h) => !list.some((c) => c.code === h.code))]

  // Kiểm đối chiếu lại phía máy chủ sau mỗi lần sửa (debounce)
  useEffect(() => {
    if (version === 0 || !result) return
    const h = window.setTimeout(() => {
      const seq = ++checkSeq.current
      setChecking(true)
      customsInvoiceAi.check({ invoices, lines: rowsRef.current.map(toGrid), packingTotals: result.packingTotals, packingProvided, truncated, unreadablePages })
        .then((c) => { if (seq === checkSeq.current) setChecks(withHeld(c)) })
        .catch((e) => { if (seq === checkSeq.current) void failToast(e, 'cia.err.check') })
        .finally(() => { if (seq === checkSeq.current) setChecking(false) })
    }, CHECK_DEBOUNCE_MS)
    return () => window.clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])
  const bump = () => setVersion((v) => v + 1)

  /** Sửa một ô: đánh dấu ô đã sửa, dòng cần ghép lại nếu là trường dùng để gợi ý ERP / HS. */
  const patch = (id: string, field: keyof Row, changes: Partial<Row>) => {
    setRows((rs) => rs.map((r) => {
      if (r.id !== id) return r
      const warnings = NUMBER_FIELDS.has(field) ? r.warnings.filter((w) => !NUMBER_WARNINGS.has(w)) : r.warnings
      return { ...r, ...changes, warnings, edited: r.edited.includes(field) ? r.edited : [...r.edited, field], dirty: r.dirty || MATCH_FIELDS.has(field) }
    }))
    bump()
  }

  // ---- tải file: kiểm phía trình duyệt ----
  const addFile = (kind: 'invoice' | 'packing', f: RcFile) => {
    const cur = filesRef.current
    const list = cur[kind]
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    if (!isPdf) { toast.error(t('cia.upload.notPdf', { name: f.name })); return }
    if (st && f.size > st.maxFileMb * MB) { toast.error(t('cia.upload.tooBig', { name: f.name, mb: st.maxFileMb })); return }
    if (list.length >= perKind) { toast.error(t('cia.upload.tooMany', { max: perKind })); return }
    if (cur.invoice.length + cur.packing.length >= maxFiles) { toast.error(t('cia.upload.tooManyAll', { max: maxFiles })); return }
    const total = [...cur.invoice, ...cur.packing].reduce((s, x) => s + (x.size ?? 0), 0) + f.size
    if (st && total > st.maxTotalMb * MB) { toast.error(t('cia.upload.totalTooBig', { mb: st.maxTotalMb })); return }
    const item: UploadFile = { uid: f.uid, name: f.name, size: f.size, status: 'done', originFileObj: f }
    const next = { ...cur, [kind]: [...list, item] }
    filesRef.current = next
    if (kind === 'invoice') setInvFiles(next.invoice); else setPackFiles(next.packing)
  }
  const removeFile = (kind: 'invoice' | 'packing', f: UploadFile) => {
    const next = { ...filesRef.current, [kind]: filesRef.current[kind].filter((x) => x.uid !== f.uid) }
    filesRef.current = next
    if (kind === 'invoice') setInvFiles(next.invoice); else setPackFiles(next.packing)
  }
  const clearFiles = () => { filesRef.current = { invoice: [], packing: [] }; setInvFiles([]); setPackFiles([]) }

  const extract = useMutation({
    mutationFn: () => customsInvoiceAi.extract(
      invFiles.map((f) => f.originFileObj as File), packFiles.map((f) => f.originFileObj as File)),
    onSuccess: (r) => {
      clearFiles()   // không giữ PDF trên trình duyệt sau khi gửi
      setJobNotice(null)
      restoredRef.current = false
      setNow(Date.now())
      setJobId(r.jobId)
      qc.invalidateQueries({ queryKey: ['customs-invoice-ai', 'status'] })
    },
    onError: (e) => { void failToast(e); qc.invalidateQueries({ queryKey: ['customs-invoice-ai', 'status'] }) },
  })

  const cancelJob = useMutation({
    mutationFn: (id: string) => customsInvoiceAi.cancel(id),
    onSettled: async (_d, e) => {
      const code = e ? (await invoiceAiError(e)).code : ''
      if (e && code !== 'not_found') { toast.error(code ? errText(code) : t('cia.err.generic')); return }
      setJobId(null)   // xoá jobId khỏi sessionStorage
      qc.removeQueries({ queryKey: ['customs-invoice-ai', 'job'] })
      setJobNotice(t('cia.job.cancelledByYou'))
      qc.invalidateQueries({ queryKey: ['customs-invoice-ai', 'status'] })
    },
  })

  const resetAll = () => {
    setJobId(null)
    loadedForRef.current = null
    setResult(null); setInvoices([]); setRows([]); setChecks([]); setJobNotice(null); setFailedChecks(null); setForce(false)
    qc.removeQueries({ queryKey: ['customs-invoice-ai', 'job'] })
  }

  // ---- ghép lại ERP / HS ----
  const dirtyRows = rows.filter((r) => r.dirty)
  const rematch = useMutation({
    mutationFn: () => customsInvoiceAi.match(dirtyRows.map((r) => ({
      id: r.id, description: r.description, supplierCode: r.supplierCode, unit: r.unit, origin: r.origin, erpItemNo: r.erpItemNo,
    }))),
    onSuccess: (res) => {
      const byId = new Map(res.lines.map((l) => [l.id, l]))
      // Lịch sử ECUS / ERP tạm không đọc được: máy chủ trả HS / ERP rỗng → giữ gợi ý và giá trị đang có
      const noHistory = (res.warnings ?? []).includes('history_unavailable')
      const noErp = (res.warnings ?? []).includes('erp_unavailable')
      setRows((rs) => rs.map((r) => {
        const m = byId.get(r.id)
        if (!m) return r
        const h = m.hs?.[0]
        const keepHs = noHistory || (!!r.hsCode && (r.hsSource === 'manual' || r.hsSource === 'history'))
        if (noErp) m.erp = r.erp
        const next: Row = {
          ...r, erp: m.erp, hs: noHistory ? r.hs : m.hs ?? [], dirty: false,
          warnings: [...r.warnings.filter((w) => !MATCH_WARNINGS.has(w)), ...(m.warnings ?? [])],
          erpItemNo: r.erpItemNo || m.erp?.itemNo || null,
          erpItemName: r.erpItemNo ? (r.erpItemNo === m.erp?.itemNo ? m.erp?.itemName ?? r.erpItemName : r.erpItemName) : m.erp?.itemName ?? null,
        }
        if (!keepHs) {
          Object.assign(next, {
            hsCode: h?.hsCode ?? null, ecusCode: h?.ecusCode ?? null, importRate: h?.importRate ?? null, importTariffCode: h?.importTariffCode ?? null,
            vatRate: h?.vatRate ?? null, vatTariffCode: h?.vatTariffCode ?? null, ecusUnit: h?.ecusUnit ?? null, hsConfidence: h?.confidence ?? null, hsSource: h?.by ?? null,
          })
        }
        return next
      }))
      bump()
      toast.success(t('cia.grid.rematched', { n: res.lines.length }))
      if (res.warnings?.length) toast.warning(res.warnings.map((w) => t(`cia.warn.${w}`, { defaultValue: w })).join(' · '))
      if (res.warnings?.includes('history_unavailable')) qc.invalidateQueries({ queryKey: ['customs-invoice-ai', 'status'] })
    },
    onError: (e) => { void failToast(e); qc.invalidateQueries({ queryKey: ['customs-invoice-ai', 'status'] }) },
  })

  // ---- xuất Excel ----
  const exportReq = (forceExport: boolean): InvoiceExportRequest => {
    const h = invoices[0]
    return {
      header: { invoiceNo: h?.invoiceNo ?? null, invoiceDate: h?.date ?? null, supplier: h?.supplier ?? null, currency: h?.currency ?? null, incoterm: h?.incoterm ?? null },
      invoices, lines: rows.map(toGrid), packing: result?.packing ?? [], packingTotals: result?.packingTotals ?? null, packingProvided, truncated, unreadablePages, force: forceExport,
    }
  }
  const doExport = useMutation({
    mutationFn: (forceExport: boolean) => customsInvoiceAi.exportExcel(exportReq(forceExport)),
    onSuccess: () => { setFailedChecks(null); setForce(false); toast.success(t('cia.export.done')) },
    onError: async (e) => {
      const { code, detail, checks: c } = await invoiceAiError(e)
      if (code === 'checks_failed') { setFailedChecks(c.length ? withHeld(c) : checks.filter((x) => x.level === 'error')); setForce(false); if (c.length) setChecks((old) => withHeld(mergeChecks(old, c))); return }
      toast.error(code ? errText(code, detail) : t('cia.err.export'))
    },
  })

  // ---- tô màu dòng / nhảy tới dòng ----
  const lineNoById = useMemo(() => new Map(rows.map((r) => [r.id, r.lineNo])), [rows])
  const checksByLine = useMemo(() => {
    const m = new Map<string, InvoiceCheck[]>()
    checks.forEach((c) => { if (c.lineId) m.set(c.lineId, [...(m.get(c.lineId) ?? []), c]) })
    return m
  }, [checks])
  const rowLevel = (r: Row): 'error' | 'warning' | null => {
    const cs = checksByLine.get(r.id) ?? []
    if (cs.some((c) => c.level === 'error')) return 'error'
    if (cs.length || r.warnings.length) return 'warning'
    return null
  }
  const rowBg = (r: Row) => (flash === r.id ? BG_FLASH : ({ error: BG_ERROR, warning: BG_WARN, none: undefined })[rowLevel(r) ?? 'none'])
  const errRows = rows.filter((r) => rowLevel(r) === 'error').length
  const warnRows = rows.filter((r) => rowLevel(r) === 'warning').length

  const checkText = (c: InvoiceCheck) => {
    const base = t(`cia.check.code.${c.code}`, { defaultValue: c.code })
    const nums = c.expected != null || c.actual != null ? ` (${t('cia.check.expectedActual', { expected: n(c.expected) || '—', actual: n(c.actual) || '—' })})` : ''
    return base + nums
  }
  const checkWhere = (c: InvoiceCheck) => {
    const parts: string[] = []
    if (c.invoiceNo && invoices.length > 1) parts.push(t('cia.check.invoice', { no: c.invoiceNo }))
    if (c.lineId) parts.push(t('cia.check.line', { n: lineNoById.get(c.lineId) ?? '?' }))
    return parts.join(' · ')
  }
  const reasons = (r: Row) => [
    ...(checksByLine.get(r.id) ?? []).map((c) => ({ level: c.level, text: checkText(c) })),
    ...r.warnings.map((w) => ({ level: 'warning', text: t(`cia.warn.${w}`, { defaultValue: w }) })),
  ]

  const jumpTo = (lineId: string) => {
    const idx = rows.findIndex((r) => r.id === lineId)
    if (idx < 0) return
    setTab('lines')
    setPage(Math.floor(idx / PAGE_SIZE) + 1)
    setFlash(lineId)
    window.setTimeout(() => {
      const sel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(lineId) : lineId
      document.querySelector(`tr[data-row-key="${sel}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    window.setTimeout(() => setFlash((f) => (f === lineId ? null : f)), 2500)
  }

  // ---- cột lưới ----
  const ed = (r: Row, f: string) => (r.edited.includes(f) ? EDITED_STYLE : undefined)
  const text = (f: 'description' | 'supplierCode' | 'unit' | 'origin' | 'ecusUnit' | 'note', width: number) => ({
    width,
    render: (_: unknown, r: Row) => (
      <Input size="small" value={r[f] ?? ''} style={ed(r, f)} title={r[f] ?? ''} onChange={(e) => patch(r.id, f, { [f]: blank(e.target.value) } as Partial<Row>)} />
    ),
  })
  const num = (f: 'qty' | 'unitPrice' | 'amount' | 'importRate' | 'vatRate', width: number) => ({
    width, align: 'right' as const,
    render: (_: unknown, r: Row) => (
      <InputNumber<number> size="small" value={r[f]} style={{ width: '100%', ...ed(r, f) }} onChange={(v) => patch(r.id, f, { [f]: v ?? null } as Partial<Row>)} />
    ),
  })

  const hsOptions = (r: Row) => {
    const seen = new Set<string>()
    return r.hs.filter((h) => (seen.has(h.hsCode) ? false : (seen.add(h.hsCode), true))).map((h) => ({
      value: h.hsCode,
      label: (
        <Tooltip placement="left" title={(
          <div>
            {h.soToKhai && <div>{t('cia.hs.source', { so: h.soToKhai, date: day(h.ngayDk), count: h.count })}</div>}
            <div>{t(`cia.hs.by.${h.by}`, { defaultValue: h.by })}</div>
            {h.description && <div style={{ opacity: 0.8 }}>{h.description}</div>}
          </div>
        )}>
          <Space size={6} style={{ width: '100%', justifyContent: 'space-between' }}>
            <b>{h.hsCode}</b>
            <span className="cell-muted">{t('cia.hs.rates', { imp: n(h.importRate, 2) || '—', vat: n(h.vatRate, 2) || '—' })}</span>
            <ConfTag value={h.confidence} />
          </Space>
        </Tooltip>
      ),
    }))
  }
  const setHs = (r: Row, v: string) => {
    const s = r.hs.find((h) => h.hsCode === v)
    if (s) {
      patch(r.id, 'hsCode', {
        hsCode: s.hsCode, ecusCode: s.ecusCode, importRate: s.importRate, importTariffCode: s.importTariffCode, vatRate: s.vatRate, vatTariffCode: s.vatTariffCode,
        ecusUnit: s.ecusUnit ?? r.ecusUnit, hsConfidence: s.confidence, hsSource: s.by,
      })
    } else patch(r.id, 'hsCode', { hsCode: blank(v), hsConfidence: null, hsSource: 'manual' })
  }
  const erpOptions = (r: Row) => {
    const list = [...(r.erp?.itemNo ? [{ itemNo: r.erp.itemNo, itemName: r.erp.itemName, unitName: r.erp.unitName }] : []), ...(r.erp?.candidates ?? [])]
    const seen = new Set<string>()
    return list.filter((c) => c.itemNo && (seen.has(c.itemNo) ? false : (seen.add(c.itemNo), true))).map((c) => ({
      value: c.itemNo as string,
      label: <span><b>{c.itemNo}</b> <span className="cell-muted">{c.itemName}{c.unitName ? ` (${c.unitName})` : ''}</span></span>,
    }))
  }
  const setErp = (r: Row, v: string) => {
    const c = [...(r.erp?.itemNo ? [{ itemNo: r.erp.itemNo, itemName: r.erp.itemName }] : []), ...(r.erp?.candidates ?? [])].find((x) => x.itemNo === v)
    patch(r.id, 'erpItemNo', { erpItemNo: blank(v), erpItemName: c?.itemName ?? null })
  }

  const baseLineColumns: ColumnsType<Row> = [
    {
      title: '', key: 'flag', width: 40, fixed: 'left', align: 'center',
      render: (_: unknown, r) => {
        const level = rowLevel(r)
        const list = reasons(r)
        return (
          <Tooltip title={list.length ? <div><b>{t('cia.grid.rowWarn')}</b>{list.map((x, i) => <div key={i}>• {x.text}</div>)}</div> : t('cia.grid.noWarn')}>
            {level === 'error' ? <CloseCircleOutlined style={{ color: '#D92D20' }} /> : level === 'warning' ? <WarningOutlined style={{ color: '#B76E00' }} /> : <CheckCircleOutlined style={{ color: '#2E9E4F' }} />}
          </Tooltip>
        )
      },
    },
    { title: t('cia.col.no'), dataIndex: 'lineNo', width: 56, fixed: 'left', align: 'right', render: (v: number | null) => <b>{v ?? ''}</b> },
    ...(invoices.length > 1 ? [{ title: t('cia.col.invoice'), dataIndex: 'invoiceNo', width: 120, render: (v: string | null) => v || muted }] : []),
    { title: t('cia.col.description'), ...text('description', 260) },
    { title: t('cia.col.supplierCode'), ...text('supplierCode', 140) },
    { title: t('cia.col.qty'), ...num('qty', 110) },
    { title: t('cia.col.unit'), ...text('unit', 80) },
    { title: t('cia.col.unitPrice'), ...num('unitPrice', 120) },
    { title: t('cia.col.amount'), ...num('amount', 130) },
    { title: t('cia.col.origin'), ...text('origin', 90) },
    {
      title: t('cia.col.erpItem'), width: 200,
      render: (_: unknown, r) => (
        <div>
          <AutoComplete size="small" style={{ width: '100%', ...ed(r, 'erpItemNo') }} value={r.erpItemNo ?? ''} options={erpOptions(r)} placeholder={t('cia.grid.erpPick')}
            popupMatchSelectWidth={360} onChange={(v: string) => setErp(r, v)} />
          {r.erpItemName && <div className="cell-muted" style={{ fontSize: 12, marginTop: 2 }} title={r.erpItemName}>{r.erpItemName}</div>}
        </div>
      ),
    },
    {
      title: t('cia.col.hs'), width: 190,
      render: (_: unknown, r) => (
        <Space.Compact style={{ width: '100%' }}>
          <AutoComplete size="small" style={{ width: '100%', ...ed(r, 'hsCode') }} value={r.hsCode ?? ''} options={hsOptions(r)} placeholder={t('cia.grid.hsPick')}
            popupMatchSelectWidth={380} onChange={(v: string) => setHs(r, v)} />
          <Tooltip title={t('cia.grid.history')}><Button size="small" icon={<HistoryOutlined />} onClick={() => setHistRow(r)} /></Tooltip>
        </Space.Compact>
      ),
    },
    { title: t('cia.col.importRate'), ...num('importRate', 95) },
    { title: t('cia.col.vatRate'), ...num('vatRate', 85) },
    { title: t('cia.col.ecusUnit'), ...text('ecusUnit', 90) },
    { title: t('cia.col.note'), ...text('note', 160) },
    {
      title: t('cia.col.confidence'), width: 120,
      render: (_: unknown, r) => (
        <Space orientation="vertical" size={2}>
          <Tooltip title={r.page ? `${t('cia.col.page')} ${r.page}` : undefined}><span><ConfTag value={r.confidence} /></span></Tooltip>
          {r.hsCode ? <Tooltip title={`HS · ${t(`cia.hs.by.${r.hsSource ?? 'manual'}`, { defaultValue: r.hsSource ?? '' })}`}><span>{r.hsConfidence ? <ConfTag value={r.hsConfidence} /> : <Tag style={{ marginInlineEnd: 0 }}>HS</Tag>}</span></Tooltip>
            : <ConfTag value="none" />}
        </Space>
      ),
    },
  ]
  const lineColumns: ColumnsType<Row> = baseLineColumns.map((c) => ({ ...c, onCell: (r: Row) => ({ style: { background: rowBg(r) } }) }))

  const packingColumns: ColumnsType<AiPackingLine> = [
    { title: t('cia.col.no'), dataIndex: 'lineNo', width: 60, align: 'right' },
    ...(invoices.length > 1 ? [{ title: t('cia.col.invoice'), dataIndex: 'invoiceNo', width: 120, render: (v: string | null) => v || muted }] : []),
    { title: t('cia.col.supplierCode'), dataIndex: 'supplierCode', width: 140, render: (v: string | null) => v || muted },
    { title: t('cia.col.description'), dataIndex: 'description', ellipsis: { showTitle: true }, render: (v: string | null) => v || muted },
    { title: t('cia.col.qty'), dataIndex: 'qty', width: 100, align: 'right', render: (v: number | null) => n(v) || muted },
    { title: t('cia.col.unit'), dataIndex: 'unit', width: 70, render: (v: string | null) => v || muted },
    { title: t('cia.col.packages'), dataIndex: 'packages', width: 90, align: 'right', render: (v: number | null) => n(v) || muted },
    { title: t('cia.col.nw'), dataIndex: 'nw', width: 100, align: 'right', render: (v: number | null) => n(v, 3) || muted },
    { title: t('cia.col.gw'), dataIndex: 'gw', width: 100, align: 'right', render: (v: number | null) => n(v, 3) || muted },
    { title: t('cia.col.dimensions'), dataIndex: 'dimensions', width: 130, render: (v: string | null) => v || muted },
    { title: t('cia.col.page'), dataIndex: 'page', width: 60, align: 'right' },
    {
      title: t('cia.col.matched'), dataIndex: 'matchedLineId', width: 110,
      render: (v: string | null) => (v && lineNoById.has(v)
        ? <a onClick={() => jumpTo(v)}>{t('cia.packing.matchedTo', { n: lineNoById.get(v) })}</a>
        : <Tag color="warning" variant="filled">{t('cia.packing.unmatched')}</Tag>),
    },
  ]
  const pageColumns: ColumnsType<AiPageInfo> = [
    { title: t('cia.col.page'), dataIndex: 'page', width: 70, align: 'right' },
    { title: t('cia.col.file'), dataIndex: 'file', ellipsis: { showTitle: true }, render: (v: string | null) => v || muted },
    { title: t('cia.col.kind'), dataIndex: 'kind', width: 140, render: (v: string | null) => (v ? t(`cia.pageKind.${v}`, { defaultValue: v }) : muted) },
    {
      title: t('cia.col.source'), dataIndex: 'source', width: 160,
      render: (v: string | null) => (v ? <Tag color={v === 'text' ? 'success' : v === 'none' ? 'error' : 'warning'} variant="filled">{t(`cia.pageSource.${v}`, { defaultValue: v })}</Tag> : muted),
    },
  ]
  const checkColumns: ColumnsType<InvoiceCheck> = [
    {
      title: '', dataIndex: 'level', width: 110,
      render: (v: string) => <Tag color={v === 'error' ? 'error' : 'warning'} variant="filled">{t(`cia.check.level.${v}`, { defaultValue: v })}</Tag>,
    },
    { title: '', key: 'where', width: 150, render: (_: unknown, c) => checkWhere(c) || muted },
    { title: '', key: 'text', render: (_: unknown, c) => checkText(c) },
  ]

  // ---- phần đầu màn ----
  const chips: ReactNode[] = []
  if (st) {
    chips.push(<span key="ai">{st.aiEnabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />} {st.aiEnabled ? t('cia.st.aiOn') : t('cia.st.aiOff')}</span>)
    if (st.aiEnabled) chips.push(<span key="model"><RobotOutlined /> {st.textModel ? t('cia.st.model', { model: st.textModel }) : t('cia.st.modelShared')}</span>)
    if (st.aiEnabled && st.visionModel) chips.push(<span key="vision">{t('cia.st.vision', { model: st.visionModel })}</span>)
    if (st.erpIsTest) chips.push(<span key="erptest" style={{ color: '#FDBA74', fontWeight: 700 }}>{t('cia.st.erpTestTag')}</span>)
    chips.push(<span key="queue"><ClockCircleOutlined /> {t('cia.st.queue', { running: st.queue.running, waiting: st.queue.waiting, max: st.queue.maxWaiting })}</span>)
    const u = st.usageToday
    chips.push(<span key="usage">{u.limitMine > 0 || u.limitAll > 0
      ? t('cia.st.usage', { mine: u.mine, limitMine: u.limitMine || '∞', all: u.all, limitAll: u.limitAll || '∞' })
      : t('cia.st.usageNoLimit', { mine: u.mine, all: u.all })}</span>)
  }

  const canRead = !!st?.aiEnabled && invFiles.length > 0 && !active && !extract.isPending
  const lineSum = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const errChecks = checks.filter((c) => c.level === 'error').length
  const warnChecks = checks.length - errChecks
  const pt = result?.packingTotals

  const jobPanel = (() => {
    if (!jobId) return null
    const d = job.data
    if (!d) {
      if (job.isError) return <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('cia.err.generic')} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => job.refetch()} />} />
      return <Card size="small" style={{ margin: '12px 0' }}><Spin size="small" /></Card>
    }
    if (d.state === 'queued' || d.state === 'running') {
      const since = utc(d.state === 'running' ? d.startedAt ?? d.createdAt : d.createdAt)
      const elapsed = since ? clock(now - since.valueOf()) : '—'
      return (
        <Alert type="info" showIcon icon={<LoadingOutlined />} style={{ margin: '12px 0' }}
          title={d.state === 'running' ? t('cia.job.running') : d.position ? t('cia.job.queued', { position: d.position }) : t('cia.job.queuedNoPos')}
          description={(
            <div>
              <div>{t('cia.job.elapsed', { time: elapsed })} · {t('cia.job.limit', { min: Math.ceil((st?.timeoutSeconds ?? 600) / 60) })}</div>
              <div className="cell-muted">{t('cia.job.leaveHint')}</div>
            </div>
          )}
          action={(
            <Popconfirm title={t('cia.job.cancelAsk')} onConfirm={() => cancelJob.mutate(d.jobId)}>
              <Button size="small" danger icon={<StopOutlined />} loading={cancelJob.isPending}>{t('cia.job.cancel')}</Button>
            </Popconfirm>
          )} />
      )
    }
    if (d.state === 'failed' && d.error === 'cancelled') {
      return (
        <Alert type="info" showIcon style={{ margin: '12px 0' }} title={t('cia.job.cancelled')}
          action={<Button size="small" icon={<ReloadOutlined />} onClick={resetAll}>{t('cia.reset')}</Button>} />
      )
    }
    if (d.state === 'failed') {
      return (
        <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('cia.job.failed')} description={errText(d.error ?? '')}
          action={<Button size="small" icon={<ReloadOutlined />} onClick={resetAll}>{t('cia.reset')}</Button>} />
      )
    }
    return null
  })()

  const uploadCard = !result && !active && (
    <Card size="small" style={{ margin: '12px 0' }} title={<span><FilePdfOutlined /> {t('cia.upload.title')}</span>}
      extra={st ? <span className="cell-muted">{t('cia.st.limits', { files: maxFiles, fileMb: st.maxFileMb, totalMb: st.maxTotalMb, pages: st.maxPages })}</span> : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {(['invoice', 'packing'] as const).map((kind) => (
          <div key={kind}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t(`cia.upload.${kind}`)}</div>
            <Upload.Dragger accept=".pdf,application/pdf" multiple disabled={!st?.aiEnabled || extract.isPending}
              fileList={kind === 'invoice' ? invFiles : packFiles}
              beforeUpload={(f) => { addFile(kind, f); return Upload.LIST_IGNORE }}
              onRemove={(f) => { removeFile(kind, f); return false }}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">{t(kind === 'invoice' ? 'cia.upload.invoiceHint' : 'cia.upload.packingHint', { max: perKind })}</p>
            </Upload.Dragger>
          </div>
        ))}
      </div>
      <Space wrap style={{ marginTop: 12 }}>
        <Button type="primary" icon={<RobotOutlined />} loading={extract.isPending} disabled={!canRead} onClick={() => extract.mutate()}>{t('cia.read')}</Button>
        {(invFiles.length > 0 || packFiles.length > 0) && <Button onClick={clearFiles} disabled={extract.isPending}>{t('cia.upload.clear')}</Button>}
        {st?.aiEnabled && invFiles.length === 0 && <span className="cell-muted">{t('cia.upload.needInvoice')}</span>}
      </Space>
      <div className="cell-muted" style={{ marginTop: 8, fontSize: 12 }}>{t('cia.st.privacy')}</div>
    </Card>
  )

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<RobotOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.customsInvoiceAi')} subtitle={t('nav.customsInvoiceAiDesc')} chips={chips.length ? chips : undefined} />

      {status.isError && <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('cia.err.status')} />}
      {st && !st.aiEnabled && <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('cia.st.aiOff')} description={t('cia.st.aiOffHint')} />}
      {st?.templateAssumed && (
        <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('cia.st.templateAssumed')}
          description={st.templateName ? t('cia.st.templateName', { name: st.templateName, version: st.templateVersion }) : undefined} />
      )}
      {st?.erpIsTest && (
        <Alert showIcon icon={<ExclamationCircleOutlined />} style={{ margin: '12px 0', background: 'rgba(232, 89, 12, 0.10)', borderColor: 'rgba(232, 89, 12, 0.45)' }}
          title={<span style={{ color: '#C2410C', fontWeight: 600 }}>{t('cia.st.erpTest', { db: st.erpDbName ?? '?' })}</span>} />
      )}
      {st?.historyUnavailable && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('cia.st.historyUnavailable')} />}
      {st && !st.ecusConfigured && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('cia.st.ecusOff')} />}
      {st && !st.erpConfigured && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('cia.st.erpOff')} />}
      {jobNotice && <Alert type="info" showIcon closable style={{ margin: '12px 0' }} title={jobNotice} onClose={() => setJobNotice(null)} />}

      {jobPanel}
      {uploadCard}

      {result && (
        <>
          <Card size="small" style={{ margin: '12px 0' }}
            title={<span><CheckCircleOutlined style={{ color: '#2E9E4F' }} /> {t('cia.job.done', { pages: result.pages, time: clock(result.durationMs), model: result.model ?? result.provider })}</span>}
            extra={(
              <Space wrap>
                {result.ocrPages > 0 && <Tag color="warning" variant="filled">{t('cia.job.pagesOcr', { n: result.ocrPages })}</Tag>}
                {result.visionPages > 0 && <Tag color="warning" variant="filled">{t('cia.job.pagesVision', { n: result.visionPages })}</Tag>}
                <Popconfirm title={t('cia.resetAsk')} onConfirm={resetAll}><Button size="small" icon={<ReloadOutlined />}>{t('cia.reset')}</Button></Popconfirm>
              </Space>
            )}>
            {invoices.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('cia.inv.none')} /> : (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {invoices.map((iv, i) => (
                  <Descriptions key={`${iv.invoiceNo ?? ''}-${i}`} size="small" bordered column={{ xs: 1, sm: 2, md: 3, xl: 4 }}
                    items={[
                      { key: 'no', label: t('cia.inv.no'), children: <b>{iv.invoiceNo || '—'}</b> },
                      { key: 'date', label: t('cia.inv.date'), children: iv.date || '—' },
                      { key: 'supplier', label: t('cia.inv.supplier'), children: iv.supplier || '—' },
                      { key: 'currency', label: t('cia.inv.currency'), children: iv.currency || '—' },
                      { key: 'incoterm', label: t('cia.inv.incoterm'), children: iv.incoterm || '—' },
                      { key: 'total', label: t('cia.inv.total'), children: n(iv.totalAmount, 2) || '—' },
                      { key: 'qty', label: t('cia.inv.totalQty'), children: n(iv.totalQty) || '—' },
                      ...(i === 0 ? [{ key: 'sum', label: t('cia.inv.lineSum'), children: <b>{n(lineSum, 2)}</b> }] : []),
                    ]} />
                ))}
              </Space>
            )}
          </Card>

          {(result.warnings?.length ?? 0) > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              title={result.warnings.map((w) => t(`cia.warn.${w}`, { defaultValue: w })).join(' · ')} />
          )}

          <Card size="small" style={{ marginBottom: 12 }}
            title={checks.length ? <span><ExclamationCircleOutlined style={{ color: errChecks ? '#D92D20' : '#B76E00' }} /> {t('cia.check.title', { err: errChecks, warn: warnChecks })}</span>
              : <span><CheckCircleOutlined style={{ color: '#2E9E4F' }} /> {t('cia.check.ok')}</span>}
            extra={checking ? <span className="cell-muted"><SyncOutlined spin /> {t('cia.check.checking')}</span> : undefined}>
            {checks.length > 0 && (
              <Table<InvoiceCheck> size="small" showHeader={false} pagination={false} columns={checkColumns} scroll={{ y: 220 }}
                rowKey={(c, i) => `${c.code}|${c.lineId ?? ''}|${c.invoiceNo ?? ''}|${i}`} dataSource={[...checks].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))}
                onRow={(c) => (c.lineId ? { onClick: () => jumpTo(c.lineId as string), style: { cursor: 'pointer' }, title: t('cia.check.jump') } : {})} />
            )}
          </Card>

          <Card size="small">
            <Tabs activeKey={tab} onChange={setTab}
              tabBarExtraContent={(
                <Space wrap>
                  <Tooltip title={dirtyRows.length ? t('cia.grid.rematchHint', { n: dirtyRows.length }) : t('cia.grid.rematchNone')}>
                    <Button icon={<SyncOutlined />} loading={rematch.isPending} disabled={!dirtyRows.length} onClick={() => rematch.mutate()}>{t('cia.grid.rematch')}</Button>
                  </Tooltip>
                  <Button type="primary" icon={<FileExcelOutlined />} loading={doExport.isPending && !failedChecks} disabled={!rows.length} onClick={() => doExport.mutate(false)}>
                    {t('cia.export.button')}
                  </Button>
                </Space>
              )}
              items={[
                {
                  key: 'lines', label: t('cia.tab.lines', { n: rows.length }),
                  children: (
                    <>
                      <div className="cell-muted" style={{ marginBottom: 8 }}>
                        {t('cia.grid.rowCount', { n: rows.length, err: errRows, warn: warnRows })} · <span style={{ ...EDITED_STYLE, padding: '0 6px', borderRadius: 4 }}>{t('cia.grid.edited')}</span> = {t('cia.grid.editedHint')}
                      </div>
                      <Table<Row> size="small" rowKey="id" columns={lineColumns} dataSource={rows} scroll={{ x: 2300 }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('cia.grid.empty')} /> }}
                        pagination={rows.length > PAGE_SIZE ? { current: page, pageSize: PAGE_SIZE, showSizeChanger: false, onChange: setPage } : false} />
                    </>
                  ),
                },
                {
                  key: 'packing', label: t('cia.tab.packing', { n: result.packing?.length ?? 0 }),
                  children: (
                    <>
                      {pt && (pt.packages != null || pt.nw != null || pt.gw != null) && (
                        <Space wrap size={[8, 8]} style={{ marginBottom: 8 }}>
                          <b>{t('cia.packing.totals')}:</b>
                          <Tag variant="filled">{t('cia.packing.packages', { v: n(pt.packages) || '—' })}</Tag>
                          <Tag variant="filled">{t('cia.packing.nw', { v: n(pt.nw, 3) || '—', u: pt.unitW ?? '' })}</Tag>
                          <Tag variant="filled">{t('cia.packing.gw', { v: n(pt.gw, 3) || '—', u: pt.unitW ?? '' })}</Tag>
                        </Space>
                      )}
                      <Table<AiPackingLine> size="small" rowKey="id" columns={packingColumns} dataSource={result.packing ?? []} scroll={{ x: 1200 }}
                        pagination={(result.packing?.length ?? 0) > PAGE_SIZE ? { pageSize: PAGE_SIZE, showSizeChanger: false } : false}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('cia.packing.empty')} /> }} />
                    </>
                  ),
                },
                {
                  key: 'pages', label: t('cia.tab.pages', { n: result.pageSources?.length ?? 0 }),
                  children: <Table<AiPageInfo> size="small" rowKey={(p) => `${p.file ?? ''}|${p.page}`} columns={pageColumns} dataSource={result.pageSources ?? []} pagination={false} />,
                },
              ]} />
          </Card>
          <div className="cell-muted" style={{ marginTop: 12, fontSize: 12 }}>{t('cia.disclaimer')}</div>
        </>
      )}

      <HsHistoryDrawer row={histRow} onClose={() => setHistRow(null)} errText={errText}
        onUse={(r, h) => {
          patch(r.id, 'hsCode', {
            hsCode: h.hsCode, ecusCode: h.ecusCode, importRate: h.importRate, importTariffCode: h.importTariffCode, vatRate: h.vatRate, vatTariffCode: h.vatTariffCode,
            ecusUnit: h.unit ?? r.ecusUnit, hsConfidence: null, hsSource: 'history',
          })
          toast.success(t('cia.hist.used', { hs: h.hsCode, n: r.lineNo }))
          setHistRow(null)
        }} />

      <AppModal open={!!failedChecks} onClose={() => { setFailedChecks(null); setForce(false) }} size="md" icon={<ExclamationCircleOutlined />}
        title={t('cia.export.failedTitle')} subtitle={t('cia.export.failedHint')}
        onOk={() => doExport.mutate(true)} okText={t('cia.export.forceOk')} okDisabled={!force} okLoading={doExport.isPending} danger
        extra={<Checkbox checked={force} onChange={(e) => setForce(e.target.checked)}>{t('cia.export.force')}</Checkbox>}>
        <Table<InvoiceCheck> size="small" showHeader={false} pagination={false} columns={checkColumns}
          rowKey={(c, i) => `${c.code}|${c.lineId ?? ''}|${i}`} dataSource={failedChecks ?? []}
          onRow={(c) => (c.lineId ? { onClick: () => { setFailedChecks(null); setForce(false); jumpTo(c.lineId as string) }, style: { cursor: 'pointer' }, title: t('cia.check.jump') } : {})} />
      </AppModal>
    </div>
  )
}

/** Gộp danh sách lỗi mới từ /export vào bảng đối chiếu (thay toàn bộ lỗi mức error cũ). */
function mergeChecks(old: InvoiceCheck[], errors: InvoiceCheck[]) {
  return [...errors, ...old.filter((c) => c.level !== 'error')]
}

/** Drawer tra lịch sử HS (GET /hs-history): tìm theo mô tả / mã, theo mã ECUS hoặc theo mã HS; bấm Dùng để điền vào dòng. */
function HsHistoryDrawer({ row, onClose, onUse, errText }: {
  row: Row | null; onClose: () => void; onUse: (r: Row, h: HsHistoryRow & { hsCode: string }) => void; errText: (code: string, detail?: string) => string
}) {
  const { t } = useTranslation()
  const n = useNum()
  const [mode, setMode] = useState<'q' | 'ecusCode' | 'hs'>('q')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState<{ mode: 'q' | 'ecusCode' | 'hs'; value: string } | null>(null)
  const [openedFor, setOpenedFor] = useState<string | null>(null)

  // Mở cho dòng mới: điền sẵn mã NCC (hoặc mô tả) và tìm luôn
  if (row && openedFor !== row.id) {
    const v = (row.supplierCode || row.description || '').trim()
    setOpenedFor(row.id)
    setMode('q')
    setInput(v)
    setQuery(v ? { mode: 'q', value: v } : null)
  }
  if (!row && openedFor !== null) setOpenedFor(null)

  const hist = useQuery({
    queryKey: ['customs-invoice-ai', 'hs-history', query],
    queryFn: () => customsInvoiceAi.hsHistory({ [query!.mode]: query!.value, take: 50 }),
    enabled: !!row && !!query?.value,
    retry: false,
    staleTime: 60_000,
  })
  const histErr = useQuery({ queryKey: ['customs-invoice-ai', 'hs-history-err', hist.errorUpdatedAt], queryFn: () => invoiceAiError(hist.error), enabled: hist.isError })

  const cols: ColumnsType<HsHistoryRow> = [
    { title: t('cia.col.hs'), dataIndex: 'hsCode', width: 110, render: (v: string | null) => (v ? <b>{v}</b> : muted) },
    { title: t('cia.col.description'), dataIndex: 'description', ellipsis: { showTitle: true }, render: (v: string | null) => v || muted },
    { title: t('cia.hist.byEcus'), dataIndex: 'ecusCode', width: 120, render: (v: string | null) => v || muted },
    { title: t('cia.col.importRate'), dataIndex: 'importRate', width: 90, align: 'right', render: (v: number | null, r) => <Tooltip title={r.importTariffCode}>{n(v, 2) || '—'}</Tooltip> },
    { title: t('cia.col.vatRate'), dataIndex: 'vatRate', width: 80, align: 'right', render: (v: number | null, r) => <Tooltip title={r.vatTariffCode}>{n(v, 2) || '—'}</Tooltip> },
    { title: t('cia.col.unit'), dataIndex: 'unit', width: 70, render: (v: string | null) => v || muted },
    { title: t('cia.col.origin'), dataIndex: 'origin', width: 70, render: (v: string | null) => v || muted },
    { title: t('cia.hist.unitPrice'), dataIndex: 'unitPrice', width: 110, align: 'right', render: (v: number | null, r) => (v == null ? muted : `${n(v)} ${r.currency ?? ''}`) },
    { title: t('cia.hist.declaration'), dataIndex: 'soToKhai', width: 130, render: (v: string | null) => v || muted },
    { title: t('cia.hist.date'), dataIndex: 'ngayDk', width: 100, render: (v: string | null) => day(v) || muted },
    { title: t('cia.hist.count'), dataIndex: 'count', width: 70, align: 'right' },
    {
      title: '', key: 'use', width: 80, fixed: 'right',
      render: (_: unknown, h) => (h.hsCode && row ? <Button size="small" type="primary" onClick={() => onUse(row, { ...h, hsCode: h.hsCode as string })}>{t('cia.hist.use')}</Button> : null),
    },
  ]

  const search = () => setQuery(input.trim() ? { mode, value: input.trim() } : null)
  return (
    <Drawer open={!!row} onClose={onClose} size={1100} destroyOnHidden
      title={row ? <span><SearchOutlined /> {t('cia.hist.title')} <span className="cell-muted" style={{ fontWeight: 400 }}>{t('cia.hist.subtitle', { n: row.lineNo, desc: row.description ?? '' })}</span></span> : null}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented value={mode} onChange={(v) => setMode(v as 'q' | 'ecusCode' | 'hs')}
          options={[{ value: 'q', label: t('cia.col.description') }, { value: 'ecusCode', label: t('cia.hist.byEcus') }, { value: 'hs', label: t('cia.hist.byHs') }]} />
        <Input.Search value={input} onChange={(e) => setInput(e.target.value)} onSearch={search} enterButton={t('cia.hist.go')} allowClear
          placeholder={t('cia.hist.search')} style={{ width: 360 }} loading={hist.isFetching} />
      </Space>
      {hist.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={histErr.data?.code ? errText(histErr.data.code, histErr.data.detail) : t('cia.err.generic')} />}
      <Table<HsHistoryRow> size="small" columns={cols} dataSource={hist.data ?? []} loading={hist.isFetching} pagination={false} scroll={{ x: 1250 }}
        rowKey={(h, i) => `${h.soToKhai ?? ''}|${h.hsCode ?? ''}|${h.ecusCode ?? ''}|${i}`}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? t('cia.hist.empty') : t('cia.err.query_required')} /> }} />
    </Drawer>
  )
}
