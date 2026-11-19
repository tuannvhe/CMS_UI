import { api } from './client'

/** Chế độ con nhỏ (child) / Học viện Vina (academy). child: date = ngày hết hiệu lực; academy: date = ngày tham gia. */
export type SpecialKind = 'child' | 'academy'
export interface SpecialRow { id: number; empId: string; fullName: string | null; department: string | null; date: string; noChild: string | null; createdBy: string | null; createdAt: string | null }
export interface SpecialInput { empId: string; date: string; noChild?: string }
export interface SpecialImportIssue { excelRow: number; code: string; detail: string | null }
export interface SpecialImportResult { added: number; updated: number; skipped: number; errors: SpecialImportIssue[] }

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

const base = (k: SpecialKind) => `/work-special/${k}`

export const workSpecial = {
  list: (k: SpecialKind) => api.get<SpecialRow[]>(base(k)).then((r) => r.data),
  add: (k: SpecialKind, b: SpecialInput) => api.post<{ id: number }>(base(k), b).then((r) => r.data),
  update: (k: SpecialKind, id: number, b: SpecialInput) => api.put(`${base(k)}/${id}`, b).then(() => undefined),
  remove: (k: SpecialKind, ids: number[]) => api.post<{ deleted: number }>(`${base(k)}/delete`, { ids }).then((r) => r.data),
  import: (k: SpecialKind, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<SpecialImportResult>(`${base(k)}/import`, fd, { timeout: 180000 }).then((r) => r.data)
  },
  template: async (k: SpecialKind) =>
    saveBlob(await api.get<Blob>(`${base(k)}/template`, { responseType: 'blob' }), k === 'child' ? 'MauCheDoConNho.xlsx' : 'MauHocVienVina.xlsx'),
}
