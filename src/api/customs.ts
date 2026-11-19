import { api } from './client'

/** Tờ khai hải quan đọc từ phần mềm ECUS (chỉ đọc). Trang quản trị cấp được: khoá "customsDeclarations". */

export interface CustomsStatus { configured: boolean; maxRangeDays: number; maxExport: number }

export interface CustomsRow {
  soToKhai: string; ngayDangKy: string | null; loai: 'N' | 'X' | string | null; maLoaiHinh: string | null; phanLuong: string | null
  maHaiQuan: string | null; tenHaiQuan: string | null; nguoiNhapKhau: string | null; nguoiXuatKhau: string | null; nuocXuatKhau: string | null
  soHoaDon: string | null; vanDon: string | null; tongTriGiaHoaDon: number | null; maTienTe: string | null
  tongTriGiaTinhThue: number | null; tongTienThue: number | null; soKien: number | null; trongLuong: number | null; donViTrongLuong: string | null
}
export interface CustomsPage { rows: CustomsRow[]; total: number; page: number; pageSize: number }
export interface CustomsQuery { from: string; to: string; loai?: string; q?: string }

export interface Phi { ma: string | null; maTienTe: string | null; triGia: number | null; soDangKy: string | null }
export interface ChungTuNganHang { maNganHang: string | null; namPhatHanh: number | null; kyHieu: string | null; so: string | null }
export interface HangHoa {
  soDong: number; maNplSp: string | null; maHang: string | null; tenHang: string | null; maHS: string | null; maNuocXuatXu: string | null; tenNuocXuatXu: string | null
  soLuong: number | null; donViTinh: string | null; soLuong2: number | null; donViTinh2: string | null; donGiaHoaDon: number | null; donGiaKhaiBao: number | null
  maTienTeDonGia: string | null; donViTinhDonGia: string | null; triGiaHoaDon: number | null; triGiaKhaiBao: number | null; donGiaTinhThue: number | null
  triGiaTinhThue: number | null; triGiaTinhThueS: number | null; triGiaKhaiBaoVnd: number | null; maTienTeTriGiaTinhThue: string | null; maBieuThueNhapKhau: string | null
  maBieuThueTtdb: string | null; maBieuThueBvmt: string | null; maBieuThueVat: string | null
  tsTtdb: number | null; tsBvmt: number | null; tsVat: number | null; tsXnk: number | null; thueXnk: number | null; thueVat: number | null
}
export interface CustomsDeclaration {
  toKhai: {
    thongTinChung: {
      soToKhai: string; soToKhaiDauTien: string | null; soToKhaiNhanh: string | null; soToKhaiTong: string | null; soToKhaiTamNhapTaiXuat: string | null
      copyTuToKhaiId: number | null; phanLuong: string | null; loai: string | null; maLoaiHinh: string | null; maPhanLoaiHangHoa: string | null
      maHaiQuan: string | null; tenHaiQuan: string | null; phanLoaiCaNhanToChuc: string | null; ngayDangKy: string | null; maBoPhanXuLy: string | null
      thoiHanTaiXuat: string | null; maPhuongThucVanChuyen: string | null; tyGia: { maTienTe: string | null; tyGia: number }[] | null
    }
    nguoiNhapKhau: { ma: string | null; ten: string[]; maBuuChinh: string | null; diaChi: string | null; dienThoai: string | null }
    nguoiXuatKhau: { ten: string[]; diaChi: string[]; maNuoc: string | null }
    nguoiKhaiHaiQuan: { ma: string | null; ten: string | null }
    vanDon: { soDinhDanhCV1593: boolean | null; soDinhDanhQD2061: boolean | null; danhSach: { so: string | null; ngay: string | null }[]; soMawb: string[]
      soLuongKien: number | null; donViKien: string | null; tongTrongLuong: number | null; donViTrongLuong: string | null }
    hopDong: { so: string | null; ngay: string | null; ngayHetHan: string | null }
    vanBanGiayPhep: { maVanBanPhapQuy: string[]; giayPhep: { ma: string | null; so: string | null }[] }
    hoaDon: { phanLoaiHinhThuc: string | null; soTiepNhanHoaDonDienTu: string | null; soHoaDon: string | null; ngayPhatHanh: string | null
      phuongThucThanhToan: string | null; maPhanLoaiGia: string | null; dieuKienGiaoHang: string | null; tongTriGia: number | null; maTienTe: string | null }
    khaiTriGia: { maPhanLoai: string | null; soTiepNhan: string | null; maTienTeGiaCoSo: string | null; giaCoSo: number | null; phiVanChuyen: Phi | null; phiBaoHiem: Phi | null
      khoanDieuChinh: { maKhoan: string | null; maLoai: string | null; maTienTe: string | null; triGia: number | null; tongHeSoPhanBo: number | null }[]
      chiTiet: string | null; tongHeSoPhanBo: number | null }
    thue: { maNguoiNopThue: string | null; maLyDoDeNghiBP: string | null; maXacDinhThoiHanNop: string | null
      nganHangTraThueThay: ChungTuNganHang | null; nganHangBaoLanh: ChungTuNganHang | null }
  }
  hangHoa: HangHoa[]
  tongCong: { tongTriGiaKhaiBao: number | null; tongTriGiaTinhThue: number | null; tongTienThue: number | null; tongSoLuong: number } | null
}

const base = '/admin/customs'
const clean = (q: CustomsQuery) => ({ from: q.from, to: q.to, loai: q.loai || undefined, q: q.q?.trim() || undefined })

/** Mã lỗi (title của ProblemDetails) từ lỗi axios, kể cả khi phản hồi là blob (tải Excel). */
export async function customsError(e: unknown): Promise<{ code: string; detail: string }> {
  let d = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  if (d instanceof Blob) { try { d = JSON.parse(await d.text()) } catch { d = null } }
  const p = d as { title?: string; detail?: string } | null | undefined
  return { code: p?.title ?? '', detail: p?.detail ?? '' }
}

export const customs = {
  status: () => api.get<CustomsStatus>(`${base}/status`).then((r) => r.data),
  list: (q: CustomsQuery & { page: number; pageSize: number }) =>
    api.get<CustomsPage>(`${base}/declarations`, { params: { ...clean(q), page: q.page, pageSize: q.pageSize }, timeout: 60000 }).then((r) => r.data),
  get: (soToKhai: string) => api.get<CustomsDeclaration>(`${base}/declarations/${encodeURIComponent(soToKhai)}`, { timeout: 60000 }).then((r) => r.data),
  exportExcel: async (q: CustomsQuery) => {
    const res = await api.get<Blob>(`${base}/export`, { params: clean(q), responseType: 'blob', timeout: 300000 })
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = m ? decodeURIComponent(m[1]) : `ToKhai_${q.from}_${q.to}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}

// ---- Chuyển tờ khai sang ERP (Import / Export Permit), chạy trong backend CMS (viết lại từ ecusErpBridge). Quyền riêng: khoá "customsErpPush". ----

export interface ErpBridgeHealth { configured: boolean; allowCommit: boolean; reachable: boolean; database: string | null; expectedDatabase: string | null; status: string | null; ecusConfigured: boolean }
export interface ErpSavedItem { permitSerl: number | null; ecusItemCode: string | null; itemNo: string | null; itemName: string | null; qty: number | null; price: number | null; curAmt: number | null; domPrice: number | null; domAmt: number | null; qty2: number | null; unit2: string | null; importTaxCode: string | null; remark: string | null
  dummy1: string | null; dummy2: string | null; dummy3: string | null; dummy4: string | null; dummy5: string | null; dummy6: string | null
  dummy7: number | null; dummy8: number | null; dummy9: number | null; dummy10: number | null }
export interface ErpPushDeclaration { idx: number; soToKhai: string | null; status: string | null; permitSeq: number | null; permitNo: string | null; lines: number | null; totalForeign: number | null; totalVnd: number | null; exRate: number | null; invoiceRefNo: string | null; messages: string[]; items: ErpSavedItem[] }
export interface ErpPushResult { dryRun: boolean; database: string | null; total: number; ok: number; error: number; results: ErpPushDeclaration[] }
export interface ErpPushInput { kind: 'import' | 'export'; soToKhai?: string; from?: string; to?: string; dryRun: boolean }

// ---- Job tự động đồng bộ tờ khai mới lên ERP (CustomsSync:*) ----
export interface CustomsSyncKind { kind: string; found: number; alreadyInErp: number; created: number; failed: number; needsReview: number; pending: number }
export interface CustomsSyncLast {
  startedAt: string; finishedAt: string; manual: boolean; from: string; to: string; skippedReason: string | null; database: string | null
  kinds: CustomsSyncKind[]; items: ErpPushDeclaration[]; created: number; failed: number; needsReview: number
}
export interface CustomsSyncStatus {
  enabled: boolean; enabledByConfig: boolean; switchBy: string | null; switchAt: string | null; runAt: string; fromDate: string; kinds: string[]; maxPerRun: number; allowTemp: boolean; allowCommit: boolean
  running: boolean; runningSince: string | null; nextRun: string | null; last: CustomsSyncLast | null
}

export const customsErp = {
  syncStatus: () => api.get<CustomsSyncStatus>('/admin/customs-erp/sync/status', { timeout: 30000 }).then((r) => r.data),
  syncSetEnabled: (enabled: boolean) => api.post<{ enabled: boolean }>('/admin/customs-erp/sync/enabled', { enabled }, { timeout: 30000 }).then((r) => r.data),
  syncRun: () => api.post<{ started: boolean }>('/admin/customs-erp/sync/run', null, { timeout: 30000 }).then((r) => r.data),
  health: () => api.get<ErpBridgeHealth>('/admin/customs-erp/health', { timeout: 30000 }).then((r) => r.data),
  push: (p: ErpPushInput) => api.post<ErpPushResult>('/admin/customs-erp/push', p, { timeout: 600000 }).then((r) => r.data),
}
