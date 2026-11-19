import { api } from './client'

/** Một dòng gửi lên để lưu (ngày dạng yyyy-MM-dd). */
export interface IdCardInput {
  idNo: string; oldIdNo: string | null; fullName: string; dob: string | null; gender: string | null
  address: string | null; issueDate: string | null; employeeId: string | null; note: string | null; newAddress: string | null
  extra: IdCardExtra | null
  /** Mã bộ phận 1–9 (chữ số đầu của mã NV tự sinh); trống = máy chủ đoán từ bộ phận + vị trí */
  codeGroup?: string | null
}
/** Thông tin nhân sự nhập thêm (không có trong mã QR); ngày vào làm dạng yyyy-MM-dd. */
export interface IdCardExtra {
  startDate: string | null; position: string | null; department: string | null; factory: string | null; ethnicity: string | null
  /** Không còn nhập trên web; giữ để dữ liệu cũ không mất */
  birthPlace?: string | null; birthRegPlace?: string | null; tempAddress: string | null
  /** Ngân hàng và số tài khoản (số tài khoản mã hoá trong CSDL, hiện đầy đủ trên web) */
  bankName?: string | null; bankAccount?: string | null
  /** Mã vân tay (mã chấm công) */
  fingerCode?: string | null
  /** Người giới thiệu / nhà cung cấp */
  referrer?: string | null
  /** Chức danh trên màn nhân sự CMS (OP, Staff, AM, M…); trống mà bộ phận có Part thì coi là OP */
  title?: string | null
  /** Số điện thoại (cột Phone) */
  phone?: string | null
  /** Số liên hệ khẩn cấp (cột EmergencyPhone) */
  emergencyPhone?: string | null
}
/** Dòng đã lưu: số CCCD / CMND đầy đủ (máy chủ giải mã khi trả về). */
export interface IdCardRow {
  id: number; idNo: string; oldIdNo: string | null; fullName: string; dob: string | null; gender: string | null; address: string | null
  issueDate: string | null; employeeId: string | null; note: string | null; createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null
  newAddress: string | null; extra: IdCardExtra
  /** Nơi nhập: HY, BN hoặc rỗng (chưa rõ) */
  site: string
  /** Cập nhật không nhận việc; null = bảng chưa có cột (chưa chạy ALTER) */
  job: { noShow: boolean; at: string | null; reason: string | null; by: string | null } | null
  /** Ảnh hiển thị của nhân viên: ảnh tự tải > ảnh nhân sự tải > ảnh hệ thống cũ (null = chưa có) */
  photoUrl?: string | null
}
/** Bộ lọc danh sách đã lưu: ngày nhập (yyyy-MM-dd, gồm hai đầu) và nơi nhập (HY / BN / '-' = chưa rõ). */
export interface IdCardFilter { q: string; from?: string; to?: string; site?: string; /** active = chưa đánh dấu, noshow = không nhận việc */ status?: string }
/** Đổi địa chỉ cũ → mới: exact = chắc chắn; check = phải chọn trong candidates (xã cũ bị chia); already_new = đã là địa chỉ mới; not_found = không nhận ra. */
export interface AddressConversion { status: 'exact' | 'check' | 'already_new' | 'not_found'; newAddress: string | null; candidates: string[]; note: string | null }
export interface IdCardState { keyReady: boolean; tableReady: boolean }
/** Mã NV vừa được cấp khi lưu: row = dòng thứ mấy trong lô (từ 1) */
export interface IdCardAssigned { row: number; code: string }
/** Cấu hình mã nhân viên: mode Local = tự sinh, Erp = mã do ERP cấp (phải nhập) */
/** Một dòng khi đẩy sang ERP: status = ready | exists | no_code | no_show | no_start_date | no_dob | bad_gender | decrypt_failed | created | failed */
export interface ErpPushRow { id: number; employeeId: string | null; fullName: string; status: string; empSeq: number | null; error: string | null; changes?: string[] | null }
export interface ErpPushInfo { configured: boolean; target: string | null }
/** Danh mục ERP cho màn CCCD: bộ phận (factory = nhà máy cấp 1, path = đường dẫn) và vị trí (UMJpSeq). */
/** Bộ phận theo cây nhân sự CMS (value lưu trên thẻ) + bộ phận ERP quy đổi; via = link (gán tay) | auto (theo người cùng nhóm trong ERP) | none. */
export interface OrgDeptOption { value: string; dept: string; team: string | null; part: string | null; erpDept: string | null; erpFactory: string; via: 'link' | 'auto' | 'none'; employees: number; matched: number }
export interface ErpMasters { depts: { seq: number; name: string; factory: string; path: string }[]; positions: { seq: number; name: string }[]; org?: OrgDeptOption[]; titles?: string[] }
export interface CodeConfig { mode: 'Local' | 'Erp'; defaultRole: string; defaultGroup: string; roles: string[]; groups: { code: string; name: string }[] }

export function idCardError(e: unknown): { code: string; detail: string } {
  const d = (e as { response?: { data?: { title?: string; detail?: string } } }).response?.data
  return { code: d?.title ?? '', detail: d?.detail ?? '' }
}

const base = '/admin/id-cards'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const idCards = {
  state: () => api.get<IdCardState>(`${base}/state`).then((r) => r.data),
  list: (f: IdCardFilter) => api.get<IdCardRow[]>(base, { params: { q: f.q || undefined, from: f.from, to: f.to, site: f.site, status: f.status } }).then((r) => r.data),
  check: (idNos: string[]) => api.post<string[]>(`${base}/check`, { idNos }).then((r) => r.data),
  save: (items: IdCardInput[]) => api.post<{ added: number; updated: number; assigned: IdCardAssigned[] | null; renamed?: { row: number; name: string }[] | null }>(base, { items }).then((r) => r.data),
  /** Cấp mã NV ngay khi quét một thẻ (giữ chỗ ở máy chủ, an toàn khi nhiều máy quét cùng lúc); existing = số CCCD này đã có mã từ trước. */
  reserveCode: (b: { idNo: string; department: string; position: string; startDate: string | null; codeGroup: string; site?: string }) => api.post<{ code: string; existing: boolean; claimedBy?: string | null }>(`${base}/code-reserve`, b).then((r) => r.data),
  /** Bản nháp lưới quét chưa lưu (máy chủ lưu mã hoá, mỗi người mỗi nơi một bản). rows = 0 thì xoá. */
  getDraft: (site: string) => api.get<{ exists: boolean; data?: string; rows?: number; updatedAt?: string }>(`${base}/draft`, { params: { site } }).then((r) => r.data),
  saveDraft: (site: string, data: string, rows: number) => api.put<{ saved: boolean }>(`${base}/draft`, { site, data, rows }).then((r) => r.data),
  releaseCode: (code: string) => api.post<{ released: boolean }>(`${base}/code-release`, { code }).then((r) => r.data),
  codeConfig: () => api.get<CodeConfig>(`${base}/code-config`).then((r) => r.data),
  codeGroup: (department: string, position: string) => api.get<{ group: string }>(`${base}/code-group`, { params: { department, position } }).then((r) => r.data.group),
  remove: (id: number) => api.delete(`${base}/${id}`),
  uploadEmployeePhoto: (employeeId: string, file: File) => { const fd = new FormData(); fd.append('file', file); return api.post<{ url: string | null }>(`${base}/employee-photo/${encodeURIComponent(employeeId)}`, fd, { timeout: 120000 }).then((r) => r.data.url) },
  /** Xoá ảnh nhân sự tải; trả về ảnh hiển thị còn lại (ảnh tự tải / hệ thống cũ, null = không có) */
  removeEmployeePhoto: (employeeId: string) => api.delete<{ url: string | null } | ''>(`${base}/employee-photo/${encodeURIComponent(employeeId)}`).then((r) => (r.data && typeof r.data === 'object' ? r.data.url : null)),
  employeePhotos: (ids: string[]) => api.get<Record<string, string>>(`${base}/employee-photos`, { params: { ids: ids.join(',') } }).then((r) => r.data),
  /** Sửa một dòng đã lưu (ghi đè); số CCCD / CMND không đổi. */
  update: (id: number, item: IdCardInput) => api.put(`${base}/${id}`, item),
  /** Tỉnh và xã / phường sau sáp nhập để chọn nơi tạm trú (bản rút gọn: mã + tên). */
  provinces: () => api.get<{ code: string; name: string }[]>(`${base}/address/provinces`).then((r) => r.data),
  wards: (code: string) => api.get<{ code: string; name: string }[]>(`${base}/address/provinces/${encodeURIComponent(code)}/wards`).then((r) => r.data),
  /** Đánh dấu / bỏ đánh dấu không nhận việc (kèm lý do). */
  setNoShow: (id: number, noShow: boolean, reason: string | null) => api.post(`${base}/${id}/no-show`, { noShow, reason }),
  /** Đổi địa chỉ trên thẻ (xã, huyện, tỉnh cũ) sang đơn vị hành chính mới; máy chủ tra bảng sáp nhập lưu sẵn, không gọi ra ngoài. */
  convertAddresses: (addresses: string[]) => api.post<AddressConversion[]>(`${base}/convert-address`, { addresses }).then((r) => r.data),
  /** Xuất Excel theo cùng từ khoá đang tìm (POST để số CCCD không nằm trên URL). */
  /** Đồng bộ nhân viên mới sang ERP (chỉ thêm mới): CSDL đích, xem trước, tạo. */
  erpMasters: () => api.get<ErpMasters>(`${base}/erp/masters`).then((r) => r.data),
  /** Gán tay bộ phận ERP cho một Bộ phận / Team / Part nhân sự; erpDeptSeq null = bỏ gán tay. */
  setOrgMap: (value: string, erpDeptSeq: number | null) => api.put(`${base}/erp/org-map`, { value, erpDeptSeq }).then(() => undefined),
  erpInfo: () => api.get<ErpPushInfo>(`${base}/erp/info`).then((r) => r.data),
  erpPreview: (ids: number[]) => api.post<ErpPushRow[]>(`${base}/erp/preview`, { ids }, { timeout: 120000 }).then((r) => r.data),
  erpPush: (ids: number[]) => api.post<ErpPushRow[]>(`${base}/erp/push`, { ids }, { timeout: 600000 }).then((r) => r.data),
  exportPhotos: async (f: IdCardFilter) => saveBlob(await api.post<Blob>(`${base}/export-photos`, { q: f.q || null, from: f.from ?? null, to: f.to ?? null, site: f.site ?? null, status: f.status ?? null }, { responseType: 'blob', timeout: 300000 }), 'CCCD_photos.zip'),
  /** Màu nền từng ô bảng Đã lưu: { "<id dòng>": { "<cột>": "#RRGGBB" } } (chỉ dòng có tô màu); lưu chung trong CSDL. */
  cellColors: () => api.get<Record<string, Record<string, string>>>(`${base}/cell-colors`).then((r) => r.data),
  setCellColors: (cells: CellColorChange[]) => api.put(`${base}/cell-colors`, { cells }).then(() => undefined),
  /** columns = khoá các cột cần xuất (xem EXPORT_COLUMNS); bỏ trống = mọi cột thường dùng. */
  exportXlsx: async (f: IdCardFilter, photos = true, columns?: string[]) => saveBlob(await api.post<Blob>(`${base}/export`, { q: f.q || null, from: f.from ?? null, to: f.to ?? null, site: f.site ?? null, status: f.status ?? null, photos, columns: columns?.length ? columns : null }, { responseType: 'blob', timeout: 180000 }), 'CCCD.xlsx'),
}

/** Một thay đổi màu ô: color null = xoá màu. */
export interface CellColorChange { id: number; field: string; color: string | null }
/** Cột của bảng Đã lưu có thể tô màu (khoá khớp IdCardCellColors.Fields ở máy chủ) và bảng màu (pastel, chữ đen vẫn đọc rõ). */
export const CELL_FIELDS = ['startDate', 'employeeId', 'fingerCode', 'phone', 'emergencyPhone', 'position', 'department', 'team', 'part', 'erpDept', 'title', 'factory',
  'fullName', 'dob', 'gender', 'ethnicity', 'address', 'newAddress', 'idNo', 'oldIdNo', 'issueDate', 'issuePlace', 'tempAddress', 'bankName', 'bankAccount', 'referrer', 'note', 'job', 'at']
export const CELL_COLORS = ['#FFF2A8', '#C6EFCE', '#FFC7CE', '#BDD7EE', '#FFD8A8', '#E4D0F5', '#B7E4E0', '#D9D9D9']

/** Các trường có thể chọn khi xuất Excel (khoá khớp với IdCardExcel.Columns ở máy chủ; thứ tự = thứ tự cột trong file). optional = mặc định không tích. */
export const EXPORT_GROUPS = ['job', 'personal', 'address', 'bank', 'other'] as const
export const EXPORT_COLUMNS: { key: string; group: (typeof EXPORT_GROUPS)[number]; optional?: boolean }[] = [
  { key: 'startDate', group: 'job' }, { key: 'employeeId', group: 'job' }, { key: 'position', group: 'job' }, { key: 'department', group: 'job' },
  { key: 'team', group: 'job' }, { key: 'part', group: 'job' }, { key: 'erpDept', group: 'job' }, { key: 'title', group: 'job' }, { key: 'factory', group: 'job' }, { key: 'site', group: 'job' },
  { key: 'fullName', group: 'personal' }, { key: 'dob', group: 'personal' }, { key: 'gender', group: 'personal' }, { key: 'ethnicity', group: 'personal' },
  { key: 'phone', group: 'personal' }, { key: 'emergencyPhone', group: 'personal' }, { key: 'idNo', group: 'personal' }, { key: 'oldIdNo', group: 'personal' },
  { key: 'issueDate', group: 'personal' }, { key: 'issuePlace', group: 'personal' },
  { key: 'address', group: 'address' }, { key: 'newAddress', group: 'address' }, { key: 'tempAddress', group: 'address' },
  { key: 'birthPlace', group: 'address', optional: true }, { key: 'birthRegPlace', group: 'address', optional: true },
  { key: 'bankName', group: 'bank' }, { key: 'bankAccount', group: 'bank' }, { key: 'fingerCode', group: 'bank' }, { key: 'referrer', group: 'bank' },
  { key: 'note', group: 'other' }, { key: 'status', group: 'other' }, { key: 'noShowReason', group: 'other' },
  { key: 'createdAt', group: 'other' }, { key: 'createdBy', group: 'other' }, { key: 'updatedAt', group: 'other' }, { key: 'updatedBy', group: 'other' },
]
export const EXPORT_DEFAULT_KEYS = EXPORT_COLUMNS.filter((c) => !c.optional).map((c) => c.key)

// ---------- Đọc chuỗi quét từ mã QR trên CCCD ----------

/** Ký tự Windows-1252 ở vùng 0x80–0x9F → byte gốc. */
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
  // Máy đặt bảng mã Windows-1258 (tiếng Việt) đọc byte vùng 0xC0–0xFF khác 1252: "Ă" thay "Ã", "Đ" thay "Ð"… (và dấu thanh tổ hợp).
  'Ă': 0xc3, '\u0300': 0xcc, 'Đ': 0xd0, '\u0309': 0xd2, 'Ơ': 0xd5, 'Ư': 0xdd, '\u0303': 0xde,
  'ă': 0xe3, '\u0301': 0xec, 'đ': 0xf0, '\u0323': 0xf2, 'ơ': 0xf5, 'ư': 0xfd, '₫': 0xfe,
}

/**
 * Sửa lỗi font khi máy quét gõ chuỗi UTF-8 của mã QR như thể là Windows-1252 ("Nguyá»…n" → "Nguyễn") hoặc Windows-1258 (máy cài tiếng Việt: "ThĂ´n" → "Thôn").
 * Chữ Việt đúng sẵn không bị đổi nhầm: hoặc có ký tự ngoài hai bảng mã (ạ, ễ…), hoặc đổi ra byte không thành UTF-8 hợp lệ (không có byte nối 0x80–0xBF).
 * Byte 0xA0 (trong "à", "Ạ", "Ơ"…) hay bị đổi thành dấu cách thường khi gõ / dán nên được trả lại. Chuỗi không bị lỗi thì giữ nguyên;
 * còn byte không đổi ngược được (máy quét bỏ mất ký tự) thì chỗ đó thành "�" để người dùng thấy và sửa tay.
 */
export function fixMojibake(s: string): string {
  if (!/[\u0080-￿]/.test(s)) return s
  const bytes: number[] = []
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c < 0x100) bytes.push(c)
    else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch])
    else return s   // có ký tự ngoài Windows-1252 / 1258 (vd. chữ Việt đúng sẵn): không phải lỗi font
  }
  // Byte đầu của ký tự UTF-8 nhiều byte mà theo sau là dấu cách: dấu cách đó vốn là 0xA0.
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    const need = b >= 0xc2 && b <= 0xdf ? 1 : b >= 0xe0 && b <= 0xef ? 2 : b >= 0xf0 && b <= 0xf4 ? 3 : 0
    for (let k = 1; k <= need && i + k < bytes.length; k++) {
      if (bytes[i + k] === 0x20) bytes[i + k] = 0xa0
      else if (bytes[i + k] < 0x80 || bytes[i + k] > 0xbf) break
    }
  }
  const data = new Uint8Array(bytes)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data) } catch { /* còn byte hỏng */ }
  const loose = new TextDecoder('utf-8').decode(data)
  // Chỉ nhận bản giải lỏng khi chuỗi rõ là UTF-8 bị đọc nhầm (có cặp byte đầu + byte nối, như "á»"), tránh làm hỏng chuỗi Latin-1 hợp lệ như "Café".
  const looksUtf8 = bytes.some((b, i) => b >= 0xc2 && b <= 0xf4 && (bytes[i + 1] ?? 0) >= 0x80 && (bytes[i + 1] ?? 0) <= 0xbf)
  return looksUtf8 ? loose : s
}

/** "28012000" → "28/01/2000"; chuỗi khác giữ nguyên. */
const qrDate = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

/** Dòng trên lưới (ngày dạng dd/MM/yyyy để sửa tay như Excel). */
export interface IdCardDraft {
  key: string; idNo: string; oldIdNo: string; fullName: string; dob: string; gender: string; address: string; issueDate: string; employeeId: string; note: string
  /** Địa chỉ mới (sau 01/07/2025). */
  newAddress: string
  /** Địa chỉ gốc đã dùng để tự điền newAddress; undefined = người dùng tự gõ / chọn (không tự đổi nữa). */
  newAddressFrom?: string
  startDate: string; position: string; department: string; factory: string; ethnicity: string; tempAddress: string
  bankName: string; bankAccount: string; fingerCode: string; referrer: string; title: string
  /** Mã bộ phận 1–9 do người dùng chọn; '' = tự đoán theo bộ phận + vị trí */
  codeGroup: string
}

let seq = 0
export const newDraftKey = () => `r${Date.now()}_${seq++}`

/** Thứ tự cột trên lưới, cũng là thứ tự cột khi dán từ Excel (theo bảng nhập nhân sự: ngày vào làm, mã NV, vị trí, bộ phận, nhà máy, họ tên…). */
export const DRAFT_FIELDS = ['bankName', 'bankAccount', 'fingerCode', 'employeeId', 'position', 'department', 'factory', 'fullName', 'dob', 'gender', 'ethnicity',
  'address', 'tempAddress', 'newAddress', 'idNo', 'oldIdNo', 'issueDate', 'note', 'startDate', 'referrer', 'title'] as const
export type DraftField = (typeof DRAFT_FIELDS)[number]

export const emptyDraft = (): IdCardDraft => ({
  key: newDraftKey(), employeeId: '', idNo: '', oldIdNo: '', fullName: '', dob: '', gender: '', address: '', newAddress: '', issueDate: '', note: '',
  startDate: '', position: '', department: '', factory: '', ethnicity: '', tempAddress: '', bankName: '', bankAccount: '', fingerCode: '', referrer: '', title: '', codeGroup: '',
})
/** Dòng chưa có số CCCD (mới dán thông tin nhân sự từ Excel, chờ quét thẻ): không lưu, không báo lỗi. */
export const isPending = (r: IdCardDraft) => !r.idNo && !r.oldIdNo
/** Chữ người nhập (đồng nhất giữa Bắc Ninh và Hưng Yên): chỉ HỌ TÊN (và tên ngân hàng, vì toàn viết tắt như BIDV / ACB) viết HOA, các thông tin khác viết hoa chữ cái đầu mỗi từ
 *  (19/11/2026). Bộ phận / vị trí / nhà máy / chức danh là giá trị danh mục nên giữ nguyên. Máy chủ cũng chuẩn hoá y hệt khi lưu. */
const UPPER_FIELDS: ReadonlySet<string> = new Set(['fullName', 'bankName'])
const CAP_FIELDS: ReadonlySet<string> = new Set(['gender', 'address', 'newAddress', 'tempAddress', 'ethnicity', 'referrer', 'note'])
export const upper = (s: string) => s.normalize('NFC').toUpperCase()
/** Viết hoa chữ cái đầu mỗi từ, còn lại viết thường ("XÃ HÒA BÌNH" → "Xã Hòa Bình"); từ có chữ số ("12A", "3/4") giữ nguyên. Cùng quy tắc với IdCardText.Cap ở máy chủ. */
export const titleCase = (s: string) => s.normalize('NFC').split(/(\s+)/).map((tok) => (/\d/.test(tok) ? tok
  : tok.toLowerCase().replace(/(^|[-/(])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()))).join('')
export const cleanCell = (f: DraftField, v: string) => (f === 'idNo' || f === 'oldIdNo' || f === 'bankAccount' ? v.replace(/\D/g, '') : UPPER_FIELDS.has(f) ? upper(v.trim()) : CAP_FIELDS.has(f) ? titleCase(v.trim()) : v.trim())

/** Một lần quét mã QR: "CCCD|CMND cũ|Họ tên|ngày sinh ddMMyyyy|Giới tính|Địa chỉ|ngày cấp ddMMyyyy|…" (đã sửa lỗi font). null = không phải chuỗi QR. */
export type QrFields = Pick<IdCardDraft, 'idNo' | 'oldIdNo' | 'fullName' | 'dob' | 'gender' | 'address' | 'issueDate'>
export function parseQr(raw: string): QrFields | null {
  // Sửa lỗi font TỪNG TRƯỜNG (tách theo "|" trước): một trường có ký tự lạ (vd. bộ gõ tiếng Việt đổi mất vài chữ khi máy quét gõ)
  // không còn làm cả dòng giữ nguyên lỗi font — các trường khác vẫn được sửa. "|" là ASCII nên không bao giờ nằm giữa một chữ UTF-8.
  const line = raw.trim()
  if (!line.includes('|')) return null
  const p = line.split('|').map((x) => fixMojibake(x).trim())
  if (p.length < 3) return null
  return { idNo: (p[0] ?? '').replace(/\D/g, ''), oldIdNo: (p[1] ?? '').replace(/\D/g, ''), fullName: upper(p[2] ?? ''), dob: qrDate(p[3] ?? ''), gender: titleCase(p[4] ?? ''), address: titleCase(p[5] ?? ''), issueDate: qrDate(p[6] ?? '') }
}

/**
 * Máy quét đang ở chế độ bàn phím chỉ gõ được ASCII thì BỎ HẲN mọi chữ có dấu ("Nguyễn Văn Tuấn" → "Nguyn Vn Tun"); chữ đã mất thì
 * không khôi phục được, chỉ báo để chỉnh máy quét và gõ lại tay. Địa chỉ thường trú trên CCCD luôn có chữ có dấu (Xã, Thôn, Tỉnh, Phường…),
 * nên chuỗi QR có địa chỉ mà cả họ tên lẫn địa chỉ không có ký tự nào ngoài ASCII là dấu hiệu máy quét làm rơi dấu.
 */
export function qrLostAccents(raw: string): boolean {
  const q = parseQr(raw)
  if (!q || q.address.length < 8) return false
  return !/[\u0080-\uffff]/.test(q.fullName + q.address)
}

/** Khối dán từ Excel: dòng × cột (Tab), bỏ dòng trống cuối. */
export function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n')
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.map((l) => l.split('\t').map((c) => fixMojibake(c)))
}

/** "dd/MM/yyyy" (hoặc ddMMyyyy) → "yyyy-MM-dd"; rỗng → null; sai → undefined. */
export function toIsoDate(s: string): string | null | undefined {
  const v = s.trim()
  if (!v) return null
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v)   // Excel đôi khi dán ngày dạng yyyy-MM-dd
  if (iso) return toIsoDate(`${iso[3]}/${iso[2]}/${iso[1]}`)
  const m = /^(\d{1,2})[/.-]?(\d{1,2})[/.-]?(\d{4})$/.exec(v.length === 8 && /^\d+$/.test(v) ? `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}` : v)
  if (!m) return undefined
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || y < 1900) return undefined
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Lỗi của từng ô (khoá = tên trường). */
export function draftErrors(r: IdCardDraft): Partial<Record<keyof IdCardDraft, true>> {
  const e: Partial<Record<keyof IdCardDraft, true>> = {}
  if (!/^\d{12}$/.test(r.idNo)) e.idNo = true
  if (r.oldIdNo && !/^(\d{9}|\d{12})$/.test(r.oldIdNo)) e.oldIdNo = true
  if (!r.fullName.trim() || r.fullName.trim().length > 100 || r.fullName.includes('�')) e.fullName = true
  if (r.address.includes('�')) e.address = true   // máy quét làm mất ký tự: phải sửa tay
  if (toIsoDate(r.dob) === undefined) e.dob = true
  if (toIsoDate(r.issueDate) === undefined) e.issueDate = true
  if (toIsoDate(r.startDate) === undefined) e.startDate = true
  if (r.bankAccount && !/^\d{6,20}$/.test(r.bankAccount)) e.bankAccount = true   // số tài khoản chỉ gồm 6–20 chữ số
  return e
}

const foldSite = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
/** Nhà máy tự điền theo sheet đang quét: HY = Hưng Yên, BN = Bắc Ninh. */
export const SITE_FACTORY = { HY: 'Hưng Yên', BN: 'Bắc Ninh' } as const

/** Nơi nhập suy ra từ mã nhà máy hoặc tên bộ phận (cùng quy ước với máy chủ): HY, BN hoặc '' (chưa rõ). */
export function resolveSite(factory: string, department: string): 'HY' | 'BN' | '' {
  const f = foldSite(factory), d = ` ${foldSite(department).replace(/[^a-z0-9]+/g, ' ')} `
  if (d.includes(' hy ') || d.includes(' hung yen ')) return 'HY'
  if (f === 'vvt_f5' || f === 'hy' || f.includes('hung yen')) return 'HY'
  if (f === 'vvt_f1' || f === 'bn' || f.includes('bac ninh')) return 'BN'
  if (d.includes(' bn ') || d.includes(' bac ninh ')) return 'BN'
  return ''
}

/** site: sheet đang quét (HY / BN). Dòng chưa thuộc sheet đó (nhà máy / bộ phận trống hoặc thuộc nơi khác) được gắn nhà máy = sheet để nằm đúng sheet sau khi lưu. */
export const draftToInput = (r: IdCardDraft, site?: 'HY' | 'BN'): IdCardInput => ({
  idNo: r.idNo, oldIdNo: r.oldIdNo || null, fullName: r.fullName.trim(), dob: toIsoDate(r.dob) ?? null, gender: r.gender.trim() || null,
  address: r.address.trim() || null, issueDate: toIsoDate(r.issueDate) ?? null, employeeId: r.employeeId.trim() || null, note: r.note.trim() || null,
  newAddress: r.newAddress.trim() || null, codeGroup: r.codeGroup || null,
  extra: {
    startDate: toIsoDate(r.startDate) ?? null, position: r.position.trim() || null, department: r.department.trim() || null,
    factory: (site && resolveSite(r.factory, r.department) !== site ? SITE_FACTORY[site] : r.factory.trim()) || null,
    ethnicity: r.ethnicity.trim() || null, tempAddress: r.tempAddress.trim() || null,
    bankName: r.bankName.trim() || null, bankAccount: r.bankAccount.replace(/\D/g, '') || null, fingerCode: r.fingerCode.trim() || null, referrer: r.referrer.trim() || null,
    title: r.title.trim() || null,
  },
})

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim()
/** Dòng chưa có CCCD khớp với thẻ vừa quét theo họ tên (và ngày sinh nếu cả hai có): dùng khi đã dán danh sách nhân sự từ Excel rồi quét thẻ không theo thứ tự. */
export function matchRow(rows: IdCardDraft[], qr: QrFields): number {
  const name = fold(qr.fullName)
  if (!name) return -1
  const hits = rows.map((r, i) => ({ r, i })).filter(({ r }) => isPending(r) && fold(r.fullName) === name && (!r.dob || !qr.dob || toIsoDate(r.dob) === toIsoDate(qr.dob)))
  return hits.length === 1 ? hits[0].i : -1
}
