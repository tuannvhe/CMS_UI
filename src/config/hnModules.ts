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
} as const
