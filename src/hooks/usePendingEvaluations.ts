import { useQuery } from '@tanstack/react-query'
import { evaluations } from '../api/evaluations'
import { useAuth } from '../auth/AuthContext'

/** Số nhân viên đang chờ bạn đánh giá (huy hiệu trên menu); dùng chung cache với màn "Chờ đánh giá", tự làm mới mỗi 2 phút. */
export function usePendingEvaluations() {
  const { user } = useAuth()
  const q = useQuery({
    queryKey: ['evaluations', 'mine'], queryFn: evaluations.mine, enabled: !!user?.employeeId, refetchInterval: 120_000, staleTime: 60_000, retry: false,
  })
  return q.data?.length ?? 0
}
