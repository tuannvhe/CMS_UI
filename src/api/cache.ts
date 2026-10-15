import type { QueryClient } from '@tanstack/react-query'

/**
 * Cơ cấu tổ chức vừa đổi (thêm / sửa / tắt bộ phận, phòng ban, ban; chuyển người; nhập nhân viên): làm mới mọi danh sách và combo box dựa trên nó,
 * để màn khác (line duyệt, line đánh giá, điều chuyển…) thấy ngay mà không phải F5.
 */
export function invalidateOrgData(qc: QueryClient) {
  for (const key of ['org', 'departments', 'coverage', 'lines', 'cleanup', 'transfers', 'att', 'leave', 'hr-recipients']) qc.invalidateQueries({ queryKey: [key] })
  qc.invalidateQueries({ queryKey: ['evaluations', 'parts'] })
  qc.invalidateQueries({ queryKey: ['req', 'approvers'] })
}
