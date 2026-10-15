import { api } from './client'
import type { TripCandidate } from './trips'

export interface BusinessTripEntry {
  id: number; employeeId: string; employeeName: string; department: string | null; from: string; to: string
  destination: string | null; reason: string | null
  /** confirmed (nhân sự đăng ký hoặc đã xác nhận: được tính công) | pending (chờ nhân sự xác nhận) */
  status: 'confirmed' | 'pending'
  registeredBy: string; createdAt: string | null; confirmedBy: string | null; confirmedAt: string | null
}
export interface BusinessTripMe { canRegister: boolean; all: boolean; departments: string[]; ready: boolean; today: string; hoursPerDay: number }
export interface RegisterBusinessTrip { from: string; to: string; employeeIds: string[]; destination: string; reason: string }

/** Script tạo bảng đăng ký công tác (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng, không đụng bảng của hệ thống cũ). */
export const BUSINESS_TRIP_TABLE_SQL = `CREATE TABLE dbo.Tbl_BusinessTrips (
    ID          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EMPLOYEESID nvarchar(50)  NOT NULL,
    FROMDATE    date          NOT NULL,                                                                       -- ngày bắt đầu công tác
    TODATE      date          NOT NULL,                                                                       -- ngày kết thúc (cùng ngày nếu đi một ngày)
    DESTINATION nvarchar(200) NULL,
    REASON      nvarchar(300) NULL,
    STATUS      varchar(10)   NOT NULL CONSTRAINT DF_Tbl_BusinessTrips_STATUS DEFAULT 'pending',              -- confirmed (được tính công) | pending (chờ nhân sự xác nhận)
    CREATEDBY   nvarchar(50)  NOT NULL,
    CREATEDATE  datetime      NULL,
    CONFIRMEDBY nvarchar(50)  NULL,
    CONFIRMDATE datetime      NULL,
    CONSTRAINT CK_Tbl_BusinessTrips_RANGE CHECK (TODATE >= FROMDATE)
);
CREATE INDEX IX_Tbl_BusinessTrips_EMP ON dbo.Tbl_BusinessTrips (EMPLOYEESID, FROMDATE, TODATE);
CREATE INDEX IX_Tbl_BusinessTrips_STATUS ON dbo.Tbl_BusinessTrips (STATUS) INCLUDE (FROMDATE, TODATE);`

const base = '/trips/business'

export const businessTrips = {
  me: () => api.get<BusinessTripMe>(`${base}/me`).then((r) => r.data),
  candidates: () => api.get<TripCandidate[]>(`${base}/candidates`).then((r) => r.data),
  list: (from: string, to: string) => api.get<BusinessTripEntry[]>(base, { params: { from, to } }).then((r) => r.data),
  pending: () => api.get<BusinessTripEntry[]>(`${base}/pending`).then((r) => r.data),
  register: (b: RegisterBusinessTrip) => api.post<{ added: number; skipped: string[]; pending: boolean }>(base, b).then((r) => r.data),
  confirm: (ids: number[]) => api.post<{ confirmed: number }>(`${base}/confirm`, { ids }).then((r) => r.data),
  remove: (ids: number[]) => api.post<{ deleted: number }>(`${base}/delete`, { ids }).then((r) => r.data),
}
