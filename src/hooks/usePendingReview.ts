import { useQuery } from '@tanstack/react-query'
import { review } from '../api/review'
import { useAuth } from '../auth/AuthContext'

/** Số đơn đã đủ vòng đang chờ HR đánh giá cuối cùng (huy hiệu cho quản trị); tự làm mới mỗi 3 phút. */
export function usePendingReview() {
  const { user } = useAuth()
  const q = useQuery({
    queryKey: ['evaluations', 'review-counts'], queryFn: review.counts, enabled: !!user?.isAdmin, refetchInterval: 180_000, staleTime: 60_000, retry: false,
  })
  return q.data?.pending ?? 0
}
