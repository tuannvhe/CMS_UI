import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { lookups } from '../api/requests'

/**
 * Phạm vi (phòng ban / bộ phận) dùng để nạp người duyệt: đã chọn bộ phận thì dùng bộ phận đó; chưa chọn mà gõ thẳng mã nhân viên
 * thì tra phòng ban / bộ phận của mã đầu tiên, để vẫn hiện được người duyệt.
 */
export function useApproverScope(department: string | undefined, manual: string) {
  const first = manual.split(/[,\s;]+/).map((s) => s.trim()).find(Boolean) ?? ''
  const [probe, setProbe] = useState('')
  useEffect(() => {
    const h = setTimeout(() => setProbe(/^[\w-]{4,30}$/.test(first) ? first : ''), 400)
    return () => clearTimeout(h)
  }, [first])
  const q = useQuery({ queryKey: ['req', 'scope', probe], queryFn: () => lookups.employeeScope(probe), enabled: !!probe && !department, staleTime: 10 * 60 * 1000 })
  return { scope: department || q.data || undefined, inferred: !department ? (q.data ?? undefined) : undefined }
}
