import { api } from './client'

/**
 * Đọc invoice / packing list bằng AI chạy trong mạng công ty → gợi ý mã ERP, HS / thuế từ lịch sử ECUS → Excel nhập hàng ECUS5.
 * Trang quản trị cấp được: khoá "customsInvoiceAi"; team Logistic tự được vào.
 * Lỗi là ProblemDetails, mã ở `title` (đọc bằng customsError trong api/customs.ts); 400 checks_failed kèm danh sách ở `checks`.
 * Không lưu giá / kết quả vào trình duyệt (chỉ jobId trong sessionStorage ở trang).
 */

export type InvoiceAiConfidence = 'high' | 'medium' | 'low' | string
export type InvoiceAiJobState = 'queued' | 'running' | 'done' | 'failed'

export interface InvoiceAiStatus {
  aiEnabled: boolean; provider: 'local' | string | null; textModel: string | null; visionModel: string | null; ocr: boolean; timeoutSeconds: number
  maxFileMb: number; maxTotalMb: number; maxPages: number; maxFiles: number; maxLines: number; ecusConfigured: boolean; erpConfigured: boolean
  /** Tên CSDL ERP đang tra mã hàng; erpIsTest = true khi đang trỏ DB thử. */
  erpDbName?: string | null; erpIsTest?: boolean
  /** true: đang trong vài phút bỏ qua lịch sử ECUS sau một lần tải lỗi (HS để trống). */
  historyUnavailable?: boolean
  templateName: string; templateVersion: number; templateAssumed: boolean; historyMonths: number; consentRequired: boolean; pollSeconds: number
  queue: { running: number; waiting: number; maxWaiting: number }
  usageToday: { mine: number; all: number; limitMine: number; limitAll: number }
}

export interface AiInvoice { invoiceNo: string | null; date: string | null; supplier: string | null; currency: string | null; incoterm: string | null; totalAmount: number | null; totalQty: number | null }
/** match = code | desc | order | none. */
export interface AiPacking { match: string | null; qty: number | null; packages: number | null; nw: number | null; gw: number | null }
export interface ErpCandidate { itemNo: string | null; itemName: string | null; unitName: string | null }
export interface AiErp { itemNo: string | null; itemName: string | null; unitName: string | null; by: string | null; confidence: InvoiceAiConfidence; candidates: ErpCandidate[] }
export interface HsSuggestion {
  hsCode: string; importRate: number | null; importTariffCode: string | null; vatRate: number | null; vatTariffCode: string | null; ecusUnit: string | null
  ecusCode: string | null; description: string | null; confidence: InvoiceAiConfidence; by: string; soToKhai: string | null; ngayDk: string | null; count: number
}
export interface AiLine {
  id: string; invoiceNo: string | null; lineNo: number; description: string | null; supplierCode: string | null; qty: number | null; unit: string | null
  unitPrice: number | null; amount: number | null; currency: string | null; origin: string | null; page: number | null; confidence: InvoiceAiConfidence
  packing: AiPacking | null; erp: AiErp | null; hs: HsSuggestion[]; warnings: string[]
}
export interface AiPackingLine {
  id: string; invoiceNo: string | null; lineNo: number; supplierCode: string | null; description: string | null; qty: number | null; unit: string | null
  packages: number | null; nw: number | null; gw: number | null; dimensions: string | null; page: number | null; matchedLineId: string | null
}
export interface PackingTotals { packages: number | null; nw: number | null; gw: number | null; unitW: string | null }
/** level = error (chặn xuất trừ khi force) | warning. */
export interface InvoiceCheck { code: string; level: 'error' | 'warning' | string; invoiceNo: string | null; lineId: string | null; expected: number | null; actual: number | null }
export interface AiPageInfo { page: number; file: string | null; kind: string | null; source: 'text' | 'ocr' | 'vision' | 'none' | string | null }
export interface InvoiceExtractResult {
  provider: string; model: string | null; pages: number; ocrPages: number; visionPages: number; durationMs: number
  invoices: AiInvoice[]; lines: AiLine[]; packing: AiPackingLine[]; packingTotals: PackingTotals | null; pageSources: AiPageInfo[]; checks: InvoiceCheck[]; warnings: string[]
}
export interface InvoiceAiJob {
  jobId: string; state: InvoiceAiJobState; position: number | null; createdAt: string; startedAt: string | null; finishedAt: string | null
  error: string | null; result: InvoiceExtractResult | null
}
export interface InvoiceAiJobCreated { jobId: string; state: InvoiceAiJobState; position: number | null; pollSeconds: number }

/** Dòng lưới gửi lại cho /check và /export. */
export interface GridLine {
  id: string; invoiceNo: string | null; lineNo: number | null; description: string | null; supplierCode: string | null; qty: number | null; unit: string | null
  unitPrice: number | null; amount: number | null; currency: string | null; origin: string | null; packing: AiPacking | null
  erpItemNo: string | null; erpItemName: string | null; ecusCode: string | null; hsCode: string | null; importRate: number | null; importTariffCode: string | null
  vatRate: number | null; vatTariffCode: string | null; ecusUnit: string | null; qty2: number | null; unit2: string | null; importExemptCode: string | null
  hsConfidence: string | null; hsSource: string | null; note: string | null
}
export interface InvoiceMatchLine { id: string; description: string | null; supplierCode: string | null; unit: string | null; origin: string | null; erpItemNo: string | null }
export interface InvoiceMatchResult {
  lines: { id: string; erp: AiErp | null; hs: HsSuggestion[]; warnings: string[] }[]
  ecusConfigured: boolean; erpConfigured: boolean; warnings: string[]
}
export interface HsHistoryRow {
  soToKhai: string | null; ngayDk: string | null; ecusCode: string | null; description: string | null; hsCode: string | null; unit: string | null
  importRate: number | null; importTariffCode: string | null; vatRate: number | null; vatTariffCode: string | null; origin: string | null
  unitPrice: number | null; currency: string | null; count: number
}
/** truncated: AI đọc bị cắt bớt dòng (lines_truncated); unreadablePages: trang không đọc được (source = none). Lấy từ kết quả đọc, gửi kèm mọi lần /check, /export. */
export interface InvoiceCheckRequest {
  invoices: AiInvoice[]; lines: GridLine[]; packingTotals: PackingTotals | null; packingProvided: boolean; truncated: boolean; unreadablePages: number[]
}
export interface InvoiceExportRequest extends InvoiceCheckRequest {
  header: { invoiceNo: string | null; invoiceDate: string | null; supplier: string | null; currency: string | null; incoterm: string | null }
  packing: AiPackingLine[]; force: boolean
}

const base = '/admin/customs-invoice-ai'

export const customsInvoiceAi = {
  status: () => api.get<InvoiceAiStatus>(`${base}/status`).then((r) => r.data),
  /** Gửi file (chỉ trong bộ nhớ máy chủ), trả 202 + jobId. */
  extract: (invoice: File[], packing: File[]) => {
    const fd = new FormData()
    invoice.forEach((f) => fd.append('invoice', f, f.name))
    packing.forEach((f) => fd.append('packing', f, f.name))
    return api.post<InvoiceAiJobCreated>(`${base}/extract`, fd, { timeout: 300000 }).then((r) => r.data)
  },
  job: (jobId: string) => api.get<InvoiceAiJob>(`${base}/extract/${encodeURIComponent(jobId)}`).then((r) => r.data),
  /** Huỷ lượt đang chờ / đang đọc: 204; lượt không còn → 404 not_found. */
  cancel: (jobId: string) => api.delete(`${base}/extract/${encodeURIComponent(jobId)}`).then(() => undefined),
  match: (lines: InvoiceMatchLine[]) => api.post<InvoiceMatchResult>(`${base}/match`, { lines }, { timeout: 120000 }).then((r) => r.data),
  hsHistory: (q: { q?: string; ecusCode?: string; hs?: string; take?: number }) =>
    api.get<HsHistoryRow[]>(`${base}/hs-history`, { params: { q: q.q || undefined, ecusCode: q.ecusCode || undefined, hs: q.hs || undefined, take: q.take ?? 20 }, timeout: 60000 }).then((r) => r.data),
  check: (req: InvoiceCheckRequest) => api.post<{ checks: InvoiceCheck[] }>(`${base}/check`, req).then((r) => r.data.checks),
  /** Tải file Excel; lỗi 400 checks_failed → nơi gọi đọc `checks` bằng invoiceAiChecks(e). */
  exportExcel: async (req: InvoiceExportRequest) => {
    const res = await api.post<Blob>(`${base}/export`, req, { responseType: 'blob', timeout: 300000 })
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = m ? decodeURIComponent(m[1]) : `ECUS_HangNhap_${req.header.invoiceNo ?? 'invoice'}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}

/** Đọc ProblemDetails (kể cả khi thân là Blob): mã, chi tiết, HTTP và danh sách checks (400 checks_failed). */
export async function invoiceAiError(e: unknown): Promise<{ code: string; detail: string; status: number; checks: InvoiceCheck[] }> {
  const r = (e as { response?: { data?: unknown; status?: number } } | null | undefined)?.response
  let d = r?.data
  if (d instanceof Blob) { try { d = JSON.parse(await d.text()) } catch { d = null } }
  const p = d as { title?: string; detail?: string; checks?: InvoiceCheck[]; extensions?: { checks?: InvoiceCheck[] } } | null | undefined
  return { code: p?.title ?? '', detail: p?.detail ?? '', status: r?.status ?? 0, checks: p?.checks ?? p?.extensions?.checks ?? [] }
}
