import { api } from './client'

export type ComplaintStatus = 'new' | 'processing' | 'resolved' | 'rejected'
export type ComplaintCategory = 'missing_in' | 'missing_out' | 'wrong_ot' | 'wrong_leave' | 'wrong_hours' | 'other'
export const COMPLAINT_CATEGORIES: ComplaintCategory[] = ['missing_in', 'missing_out', 'wrong_ot', 'wrong_leave', 'wrong_hours', 'other']
export interface ComplaintRow {
  id: number; employeeId: string; employeeName: string; department: string | null; workDate: string; category: ComplaintCategory; message: string; status: ComplaintStatus
  handler: string | null; handlerName: string | null; reply: string | null; dueDate: string; createdAt: string | null; resolvedAt: string | null; overdue: boolean
}
export interface ComplaintList { ready: boolean; items: ComplaintRow[] }

export const complaints = {
  mine: () => api.get<ComplaintList>('/complaints/mine').then((r) => r.data),
  create: (b: { workDate: string; category: ComplaintCategory; message: string }) => api.post<{ id: number }>('/complaints', b).then((r) => r.data),
  manage: (p: { status?: string; search?: string }) => api.get<ComplaintList>('/admin/complaints', { params: p }).then((r) => r.data),
  take: (id: number) => api.post(`/admin/complaints/${id}/take`).then(() => undefined),
  close: (id: number, status: 'resolved' | 'rejected', reply: string) => api.post(`/admin/complaints/${id}/close`, { status, reply }).then(() => undefined),
}

/** Script tạo bảng phản hồi công (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const COMPLAINT_TABLE_SQL = `CREATE TABLE dbo.Tbl_AttendanceComplaints (
    ID          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EMPLOYEEID  nvarchar(50)   NOT NULL,
    WORKDATE    date           NOT NULL,
    CATEGORY    nvarchar(20)   NOT NULL,
    MESSAGE     nvarchar(1000) NOT NULL,
    STATUS      nvarchar(12)   NOT NULL,   -- new | processing | resolved | rejected
    HANDLER     nvarchar(50)   NULL,
    REPLY       nvarchar(1000) NULL,
    DUEDATE     date           NOT NULL,
    CREATEDATE  datetime       NULL,
    UPDATEDATE  datetime       NULL,
    RESOLVEDDATE datetime      NULL
);
CREATE INDEX IX_Tbl_AttendanceComplaints_EMP ON dbo.Tbl_AttendanceComplaints (EMPLOYEEID, WORKDATE);
CREATE INDEX IX_Tbl_AttendanceComplaints_STATUS ON dbo.Tbl_AttendanceComplaints (STATUS, DUEDATE);`
