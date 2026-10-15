import { useQuery } from '@tanstack/react-query'
import { approvalSummary } from '../api/approvals'

/** Số đơn đang chờ bạn duyệt (huy hiệu trên menu thay cho email thông báo); được đẩy ngay khi có thông báo mới, và tự làm mới 2 phút một lần để dự phòng. */
export function usePendingApprovals() {
  const q = useQuery({ queryKey: ['approvals', 'summary'], queryFn: approvalSummary, refetchInterval: 120_000, staleTime: 30_000, retry: false })
  const forms = (k: string) => q.data?.find((x) => x.kind === k)?.forms ?? 0
  const total = (q.data ?? []).reduce((n, x) => n + x.forms, 0)
  return { forms, total }
}
