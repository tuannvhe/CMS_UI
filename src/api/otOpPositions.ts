import { api } from './client'

/** Một chức vụ: configured = đã có dòng trong Tbl_OtOpPositions; active = tăng ca ngày thường tính như OP; employees = số người đang làm. */
export interface OtOpPosition { position: string; active: boolean; configured: boolean; employees: number; note: string | null; updatedBy: string | null; updatedAt: string | null }
/** Nhân viên được chọn riêng: tính tăng ca ngày thường như OP dù chức vụ chưa bật. */
export interface OtOpEmployee { employeeId: string; fullName: string | null; position: string | null; department: string | null; active: boolean; note: string | null; updatedBy: string | null; updatedAt: string | null }
export interface OtOpPositionList { ready: boolean; items: OtOpPosition[]; employeesReady: boolean; employees: OtOpEmployee[] | null }

const base = '/admin/ot-op-positions'

export const otOpPositions = {
  list: () => api.get<OtOpPositionList>(base).then((r) => r.data),
  save: (b: { position: string; active: boolean; note?: string | null }) => api.put<OtOpPositionList>(base, b).then((r) => r.data),
  saveEmployee: (b: { employeeId: string; active: boolean; note?: string | null }) => api.put<OtOpPositionList>(`${base}/employees`, b).then((r) => r.data),
}
