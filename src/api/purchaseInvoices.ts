import { api } from './client'

/**
 * Hoá đơn mua vào: đọc XML hoá đơn điện tử (TT78) → xem trước (ghép NCC theo MST, kiểm trùng) → chạy thử / ghi dòng VAT vào một dòng chứng từ ERP.
 * Khoá trang "purchaseInvoices", chỉ quản trị. Lỗi là ProblemDetails, mã ở `title` (đọc bằng customsError trong api/customs.ts).
 * Không lưu file hay kết quả vào trình duyệt.
 */

export type IssueLevel = 'error' | 'warn' | string
export interface InvoiceIssue { level: IssueLevel; code: string; detail: string | null }
/** result = exact | truncated | ambiguous | notFound. */
export interface SupplierMatch { result: string; custSeq: number | null; custName: string | null; candidates: number[] }
export interface VatItemRef { slipSeq: number; serl: number }

export interface PurchaseInvoicePreview {
  fileName: string; key: string | null; sellerName: string | null; sellerTaxCode: string | null; template: string | null; series: string | null; number: string | null
  issueDate: string | null; currency: string | null; totalBeforeTax: number | null; totalTax: number | null; totalPayable: number | null; lines: number
  supplier: SupplierMatch | null; alreadyInErp: VatItemRef[]; issues: InvoiceIssue[]
}

export interface VatItemRow {
  slipSeq: number; dataSeq: number; smInvoiceType: number; smItemType: number; itemSeq: number; itemNo: string | null; itemName: string; itemSpec: string | null
  qty: number | null; price: number | null; amt: number; smVatType: number; vatAmt: number; totAmt: number; invoiceDate: string; invoiceNo: string; invoiceCode: string
  smVatGsGroup: number; custSeq: number; bizNo: string | null; address: string | null; impYn: string; remark: string | null; taxInvoiceCode: string | null; taxInvoiceNo: string | null
}
export interface VatItemSaved { committed: boolean; database: string | null; serls: number[]; errors: string[]; totalAmt: number; totalVat: number }
export interface PushResult { saved: VatItemSaved | null; rows: VatItemRow[]; issues: InvoiceIssue[] }

export interface PurchaseInvoiceStatus { configured: boolean; allowCommit: boolean; expectedDatabase: string | null; maxFiles: number; maxFileBytes: number }

const base = '/admin/purchase-invoices'

export const purchaseInvoices = {
  status: () => api.get<PurchaseInvoiceStatus>(`${base}/status`).then((r) => r.data),
  preview: (files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f, f.name))
    return api.post<PurchaseInvoicePreview[]>(`${base}/preview`, fd, { timeout: 120000 }).then((r) => r.data)
  },
  /** dryRun = true: chạy đủ Check → Save rồi rollback. */
  push: (file: File, slipSeq: number, dryRun: boolean) => {
    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('slipSeq', String(slipSeq))
    fd.append('dryRun', String(dryRun))
    return api.post<PushResult>(`${base}/push`, fd, { timeout: 180000 }).then((r) => r.data)
  },
}
