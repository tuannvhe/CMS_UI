/** Tên module của cơ sở Ninh Bình (Hà Nam), khớp bảng quyền của hệ thống cũ (dùng để so với permissions của /api/hn/me). */
export const HN_MODULE = {
  home: 'Lịch sự kiện',
  profile: 'Thông tin cá nhân',
  timework: 'Chốt công',
  finger: 'Xem vân tay',
  otMine: 'Danh sách OT',
  otApprove: 'Duyệt tăng ca',
  otSummary: 'Tổng hợp OT',
  leaveMine: 'Danh sách đăng kí nghỉ phép',
  leaveApprove: 'Duyệt nghỉ phép',
  leaveSummary: 'Tổng hợp nghỉ phép',
  fingerRegMine: 'Danh sách đăng kí quên vân tay',
  fingerRegApprove: 'Duyệt quên vân tay',
  lateEarlyMine: 'Danh sách đăng kí đi muộn',
  payslip: 'Phiếu lương',
  lateEarlyApprove: 'Duyệt đơn đi muộn về sớm',
  /* 2026-11-25 [Truong] - HN HR tools (only group "Nhân sự" has these modules) */
  uploadTimework: 'Upload công',
  uploadPayslip: 'Upload lương',
  fingerAll: 'Xem tất cả vân tay',
  /* 2026-11-26 [Truong] - HN request registration modules (create buttons) */
  otRegister: 'Đăng ký OT',
  leaveRegister: 'Đăng kí nghỉ phép',
  fingerRegister: 'Đăng kí quên vân tay',
  lateEarlyRegister: 'Đăng kí đi muộn về sớm',
  /* 2026-11-25 [Truong] - HN employee management (old Employee.tsx) */
  employees: 'Quản lý nhân viên',
} as const
