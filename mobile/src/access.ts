/*
 * 2026-11-26 - Mobile app: màn / tab nào người đăng nhập được thấy (cùng nguồn với menu web: GET /auth/access)
 * Máy chủ đã tính sẵn: phân quyền nhóm, cấp riêng từng người, người trong line duyệt, và ngày 1–7 hằng tháng
 * Phê duyệt: chỉ người duyệt (ẩn với nhân viên thường và OP).
 * Phản hồi công + Hỏi đáp tự mở cho tất cả (Authorization:FeedbackOpenFromDay/ToDay). App chỉ đọc lại danh sách trang bị ẩn.
 */
import { useQuery } from '@tanstack/react-query'
import { accessHidden } from '@web/api/permissions'
import { useAuth } from './auth/AuthProvider'
import type { MobileRequestKind } from './requests'

/** Nhóm công nhân (OP) — trùng Authorization:FeedbackBlockedGroupIds phía máy chủ. OP không tự đăng ký / duyệt đơn: ẩn hai tab này. */
export const WORKER_GROUP_IDS = ['GID00006', 'GID00005']

/** Loại đơn của app → khoá trang web tương ứng (config/navigation.tsx). */
export const REQUEST_PAGE: Record<MobileRequestKind, string> = {
  overtime: 'overtime', finger: 'fingerForm', leave: 'leave', goout: 'goOut', late: 'lateForm', early: 'earlyForm',
}
const APPROVAL_PAGES = ['approvalFinger', 'approvalOvertime', 'approvalLeave', 'approvalGoOut', 'approvalLate', 'approvalEarly']

export const isWorkerGroup = (groupId?: string | null) =>
  !!groupId && WORKER_GROUP_IDS.some((g) => g.toUpperCase() === groupId.trim().toUpperCase())

export function useAccess() {
  const { user, status } = useAuth()
  const q = useQuery({
    queryKey: ['access', user?.userId],
    queryFn: accessHidden,
    enabled: status === 'signedIn',
    // Khoảng ngày mở Phản hồi công / Hỏi đáp đổi theo ngày: tải lại mỗi 30 phút và khi quay lại app
    staleTime: 5 * 60_000,
    refetchInterval: 30 * 60_000,
  })
  const hidden = new Set(q.data?.hiddenPages ?? [])
  const loaded = q.isSuccess
  // Chưa tải xong / lỗi: chỉ ẩn theo nhóm OP, không ẩn thêm gì (máy chủ vẫn chặn API nếu không có quyền)
  const can = (key: string) => !hidden.has(key)
  const worker = !user?.isAdmin && isWorkerGroup(user?.groupId)
  const requestKinds = (Object.keys(REQUEST_PAGE) as MobileRequestKind[]).filter((k) => can(REQUEST_PAGE[k]))
  return {
    loaded,
    can,
    worker,
    requestKinds,
    showRequests: !worker && requestKinds.length > 0,
    // Phê duyệt chỉ cho người duyệt: nhân viên thường và OP không thấy (26/11). Máy chủ chỉ hiện trang Ủy quyền cho người đang ở
    // line duyệt (PermissionService, DelegationPage) nên dùng nó làm dấu hiệu "là người duyệt"; người được ủy quyền thì hiện khi có đơn chờ (tabs/_layout).
    approver: !worker && (!!user?.isAdmin || (loaded && can('delegation') && APPROVAL_PAGES.some(can))),
    showComplaints: loaded && can('complaints'),
    showQa: loaded && can('qa'),
  }
}
