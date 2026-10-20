import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { lookups, type Approver, type LastLine } from '../api/requests'

/**
 * Nạp lại line duyệt của đơn gần nhất của chính người dùng (theo loại đơn): lần sau vào chỉ việc dùng lại, không phải chọn từng cấp.
 * Chỉ nạp khi người dùng chưa chọn bộ phận; chọn bộ phận khác thì thôi. Người duyệt đã nghỉ (không còn trong danh sách của bộ phận) bị bỏ qua.
 * @returns line gần nhất (nếu có) để hiển thị gợi ý
 */
export function useLastLine(kind: string, department: string | undefined, setDepartment: (d: string) => void, approvers: Approver[] | undefined, apply: (line: LastLine, list: Approver[]) => void, enabled = true) {
  const q = useQuery({ queryKey: ['req', 'last-line', kind], queryFn: () => lookups.lastLine(kind), staleTime: 5 * 60 * 1000, retry: false })
  const done = useRef(false)
  const line = q.data ?? undefined
  useEffect(() => {
    if (done.current || !line) return
    if (!department) { if (enabled) setDepartment(line.scope) }
    else if (department !== line.scope) done.current = true   // đã chọn bộ phận khác: không nạp
  }, [line, department, setDepartment, enabled])
  useEffect(() => {
    if (done.current || !line || !enabled || department !== line.scope || !approvers || approvers.length === 0) return
    done.current = true
    apply(line, approvers)
  }, [line, department, approvers, apply, enabled])
  return line
}
