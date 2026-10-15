import { api } from './client'

export type StatKind = 'finger' | 'overtime' | 'leave' | 'goout' | 'late' | 'early'
export type StatStatus = '' | 'approved' | 'waiting' | 'rejected'

export interface StatStep { name: string; status: 'none' | 'waiting' | 'approved' | 'rejected'; at: string | null; rejectReason: string | null }

export interface StatRow {
  id: number; employeeId: string; fullName: string; department: string | null
  date: string; dateTo: string | null; timeFrom: string; timeTo: string
  /** Số giờ (quên vân tay, tăng ca, đi muộn, về sớm) hoặc số ngày (nghỉ phép); 0 với đơn ra ngoài. */
  amount: number; reason: string; groupId: string
  senderId: string; senderName: string; submittedAt: string | null
  status: 'approved' | 'waiting' | 'rejected'; steps: StatStep[]
  purpose: 'company' | 'personal' | null; comeBackTime: string | null; securityName: string | null; securityAt: string | null
}

export interface StatTotals { rows: number; approved: number; waiting: number; rejected: number; amount: number }
export interface StatPage { totals: StatTotals; page: number; pageSize: number; rows: StatRow[] }

export interface StatFilter { kind: StatKind; from: string; to: string; department?: string; employee?: string; status?: StatStatus }

const params = (f: StatFilter) => ({ kind: f.kind, from: f.from, to: f.to, department: f.department || undefined, employee: f.employee || undefined, status: f.status || undefined })

export const getStats = (f: StatFilter, page: number, pageSize: number) =>
  api.get<StatPage>('/admin/request-stats', { params: { ...params(f), page, pageSize }, timeout: 180000 }).then((r) => r.data)

/** Tải file Excel (có header Authorization) rồi cho trình duyệt lưu. */
export async function downloadStatsExcel(f: StatFilter) {
  const res = await api.get<Blob>('/admin/request-stats/export', { params: params(f), responseType: 'blob', timeout: 300000 })
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers['content-disposition'] ?? '')
  const name = m ? decodeURIComponent(m[1]) : `ThongKe_${f.kind}_${f.from}_${f.to}.xlsx`
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Mã lỗi (title của ProblemDetails); với blob thì đọc nội dung JSON. */
export async function statsErrorCode(e: unknown): Promise<string> {
  const err = e as { response?: { status?: number; data?: unknown } }
  const data = err.response?.data
  try {
    if (data instanceof Blob) return (JSON.parse(await data.text()) as { title?: string }).title ?? ''
    return (data as { title?: string } | undefined)?.title ?? (err.response?.status === 403 ? 'forbidden' : '')
  } catch { return '' }
}
