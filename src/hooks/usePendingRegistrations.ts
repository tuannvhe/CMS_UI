import { useQuery } from '@tanstack/react-query'
import { evaluations } from '../api/evaluations'
import { useAuth } from '../auth/AuthContext'

/** Số nhân viên đến hạn đánh giá mà HR chưa đăng ký (huy hiệu cho quản trị); tự làm mới mỗi 5 phút. */
export function usePendingRegistrations() {
  const { user } = useAuth()
  const q = useQuery({
    queryKey: ['evaluations', 'register-count'], queryFn: () => evaluations.candidates({}), enabled: !!user?.isAdmin, refetchInterval: 300_000, staleTime: 120_000, retry: false,
  })
  return q.data?.length ?? 0
}
