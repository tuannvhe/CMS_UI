import { api } from './client'

export interface TripEntry {
  id: number; date: string; employeeId: string; employeeName: string; department: string | null; registeredBy: string; registeredByName: string | null; createdAt: string | null
  /** confirmed | pending (đăng ký bù đang chờ nhân sự xác nhận) */
  status: 'confirmed' | 'pending'; late: boolean; reason: string | null
  /** day = ca ngày, night = ca đêm */
  shift: TripShift
}
export type TripShift = 'day' | 'night'
export interface TripCandidate { employeeId: string; name: string; department: string | null }
export interface TripMe { canRegister: boolean; all: boolean; departments: string[]; ready: boolean; today: string }

/** Script tạo bảng đăng ký người đi Hưng Yên (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const TRIP_TABLE_SQL = `CREATE TABLE dbo.Tbl_HungYenTrips (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TRIPDATE     date          NOT NULL,
    EMPLOYEEID   nvarchar(50)  NOT NULL,
    REGISTEREDBY nvarchar(50)  NOT NULL,
    CREATEDATE   datetime      NULL,
    SHIFT        varchar(5)    NOT NULL CONSTRAINT DF_Tbl_HungYenTrips_SHIFT DEFAULT 'day',          -- day = ca ngày | night = ca đêm
    STATUS       varchar(10)   NOT NULL CONSTRAINT DF_Tbl_HungYenTrips_STATUS DEFAULT 'confirmed',   -- confirmed | pending (đăng ký bù chờ HR xác nhận)
    LATE         bit           NOT NULL CONSTRAINT DF_Tbl_HungYenTrips_LATE DEFAULT 0,                -- 1 = đăng ký bù
    REASON       nvarchar(300) NULL,                                                                  -- lý do đăng ký bù
    CONFIRMEDBY  nvarchar(50)  NULL,
    CONFIRMDATE  datetime      NULL,
    CONSTRAINT UQ_Tbl_HungYenTrips UNIQUE (TRIPDATE, EMPLOYEEID, SHIFT)   -- không đăng ký trùng: cùng người, cùng ca, cùng ngày
);

-- Nếu bảng đã được tạo trước đó (thiếu cột ca và / hoặc các cột đăng ký bù), KHÔNG tạo lại; chỉ chạy đoạn này (bỏ các dòng đã có):
-- ALTER TABLE dbo.Tbl_HungYenTrips ADD
--     SHIFT       varchar(5)    NOT NULL CONSTRAINT DF_Tbl_HungYenTrips_SHIFT DEFAULT 'day',
--     STATUS      varchar(10)   NOT NULL CONSTRAINT DF_Tbl_HungYenTrips_STATUS DEFAULT 'confirmed',
--     LATE        bit           NOT NULL CONSTRAINT DF_Tbl_HungYenTrips_LATE DEFAULT 0,
--     REASON      nvarchar(300) NULL,
--     CONFIRMEDBY nvarchar(50)  NULL,
--     CONFIRMDATE datetime      NULL;
--
-- Và nếu bảng cũ có ràng buộc duy nhất theo (TRIPDATE, EMPLOYEEID) thì đổi sang tính cả ca (một người được đi cả ca ngày lẫn ca đêm):
-- ALTER TABLE dbo.Tbl_HungYenTrips DROP CONSTRAINT UQ_Tbl_HungYenTrips;
-- ALTER TABLE dbo.Tbl_HungYenTrips ADD CONSTRAINT UQ_Tbl_HungYenTrips UNIQUE (TRIPDATE, EMPLOYEEID, SHIFT);`

const base = '/trips/hung-yen'

function saveBlob(res: { data: Blob; headers: Record<string, unknown> }, fallback: string) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const trips = {
  me: () => api.get<TripMe>(`${base}/me`).then((r) => r.data),
  candidates: () => api.get<TripCandidate[]>(`${base}/candidates`).then((r) => r.data),
  list: (date: string) => api.get<TripEntry[]>(base, { params: { date } }).then((r) => r.data),
  saveList: (date: string, department: string, employeeIds: string[], shift: TripShift) => api.put<{ added: number; removed: number }>(base, { date, department, employeeIds, shift }).then((r) => r.data),
  submitLate: (date: string, department: string, employeeIds: string[], reason: string, shift: TripShift) =>
    api.post<{ added: number; skipped: number; pending: boolean }>(`${base}/late`, { date, department, employeeIds, reason, shift }).then((r) => r.data),
  pending: () => api.get<TripEntry[]>(`${base}/late/pending`).then((r) => r.data),
  confirmLate: (ids: number[]) => api.post<{ count: number }>(`${base}/late/confirm`, { ids }).then((r) => r.data),
  rejectLate: (ids: number[], reason: string) => api.post<{ count: number }>(`${base}/late/reject`, { ids, reason }).then((r) => r.data),
  remove: (id: number) => api.delete(`${base}/${id}`).then(() => undefined),
  cancelLate: (id: number) => api.delete(`${base}/late/${id}`).then(() => undefined),
  exportRange: async (from: string, to: string) => saveBlob(await api.get<Blob>(`${base}/export`, { params: { from, to }, responseType: 'blob', timeout: 120000 }), `DiHungYen_${from}_${to}.xlsx`),
}
