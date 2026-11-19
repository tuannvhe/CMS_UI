import { api } from './client'

/**
 * Thu hồi tài khoản người đã nghỉ việc (ERP chỉ đọc + CMS). Trang quản trị cấp được: khoá "accountReclaim".
 * Lỗi dạng ProblemDetails, mã ở `title`: 409 erp_not_configured, 503 erp_unreachable, 400 invalid_input / too_many.
 */

export type ReclaimSite = 'BN' | 'HY'
export type ErpReason = 'erp_retired' | 'cms_quit' | 'cms_endwork_past' | 'no_cms_match'
export type CmsReason = 'erp_retired' | 'cms_quit' | 'cms_endwork_past' | 'no_employee' | 'demo'
export type ReclaimReason = ErpReason | CmsReason
export type Seasonal = 'include' | 'exclude' | 'only'

export interface ReclaimStatus { erpConfigured: boolean; quitSync: { enabled: boolean; runAt: string; maxAuto: number } }

export interface ErpReclaimRow {
  userSeq: number; userId: string; userName: string; empSeq: number; empId: string | null; empName: string | null; erpDept: string | null
  erpRetireDate: string | null; cmsEmployeeId: string | null; cmsName: string | null; cmsDepartment: string | null; cmsStatusWorking: string | null
  cmsEndWork: string | null; site: string; quitDate: string | null; daysSinceQuit: number | null; match: 'auto' | 'manual' | 'none' | string
  reasons: ReclaimReason[]
}

export interface CmsReclaimRow {
  id: number; userId: string; employeeId: string; fullName: string; department: string | null; groupName: string | null; site: string
  statusWorking: string | null; endWork: string | null; erpRetireDate: string | null; seasonal: boolean; demo: boolean; reasons: ReclaimReason[]
}

export interface ReclaimPage<T> {
  generatedAt: string; total: number; page: number; pageSize: number
  /** Đếm trước khi lọc theo lý do; khoá giữ snake_case và BN / HY (tab CMS có thêm seasonal). */
  summary: Record<string, number>
  rows: T[]
  erpChecked: boolean
}

export interface ReclaimQuery { q?: string; site?: ReclaimSite | ''; quitFrom?: string; reason?: ReclaimReason | ''; seasonal?: Seasonal }

const base = '/admin/account-reclaim'
const clean = (q: ReclaimQuery) => ({
  q: q.q?.trim() || undefined, site: q.site || undefined, quitFrom: q.quitFrom || undefined, reason: q.reason || undefined, seasonal: q.seasonal || undefined,
})

/** Mã lỗi (title của ProblemDetails) từ lỗi axios, kể cả khi phản hồi là blob (tải Excel). */
export async function reclaimError(e: unknown): Promise<{ status: number; code: string; detail: string }> {
  const res = (e as { response?: { status?: number; data?: unknown } } | null | undefined)?.response
  let d = res?.data
  if (d instanceof Blob) { try { d = JSON.parse(await d.text()) } catch { d = null } }
  const p = d as { title?: string; detail?: string } | null | undefined
  return { status: res?.status ?? 0, code: p?.title ?? '', detail: p?.detail ?? '' }
}

export const accountReclaim = {
  status: () => api.get<ReclaimStatus>(`${base}/status`, { timeout: 120000 }).then((r) => r.data),
  /** refresh=true: bỏ đệm 3 phút của máy chủ, đọc lại DB (xoá đệm cả hai tab). Lần gọi thường không gửi. */
  erp: (q: ReclaimQuery & { page: number; pageSize: number; refresh?: boolean }) =>
    api.get<ReclaimPage<ErpReclaimRow>>(`${base}/erp`, { params: { ...clean({ ...q, seasonal: undefined }), page: q.page, pageSize: q.pageSize, refresh: q.refresh ? true : undefined }, timeout: 120000 }).then((r) => r.data),
  cms: (q: ReclaimQuery & { page: number; pageSize: number; refresh?: boolean }) =>
    api.get<ReclaimPage<CmsReclaimRow>>(`${base}/cms`, { params: { ...clean(q), page: q.page, pageSize: q.pageSize, refresh: q.refresh ? true : undefined }, timeout: 120000 }).then((r) => r.data),
  exportExcel: async (source: 'erp' | 'cms', q: ReclaimQuery) => {
    const params = { source, ...clean(source === 'erp' ? { ...q, seasonal: undefined } : q) }
    const res = await api.get<Blob>(`${base}/export`, { params, responseType: 'blob', timeout: 120000 })
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = m ? decodeURIComponent(m[1]) : `ThuHoiTaiKhoan_${source}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}
