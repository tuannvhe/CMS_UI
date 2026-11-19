import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { lookups } from '../api/requests'

/**
 * Thông tin từng mã nhân viên vừa nhập tay (tên, chức vụ, bộ phận / phòng ban) hiện ngay dưới ô nhập, để biết mình nhập đúng người;
 * mã không có (hoặc đã nghỉ) báo đỏ. `value` là chuỗi người dùng gõ, các mã cách nhau bằng dấu phẩy / khoảng trắng.
 */
export function EmployeeCodeInfo({ value }: { value: string }) {
  const { t } = useTranslation()
  const codes = Array.from(new Set(value.split(/[,\s;]+/).map((s) => s.trim()).filter((s) => /^[\w-]{3,30}$/.test(s)))).slice(0, 50)
  const key = codes.join(',')
  const [probe, setProbe] = useState('')
  useEffect(() => {
    const h = setTimeout(() => setProbe(key), 400)
    return () => clearTimeout(h)
  }, [key])
  const q = useQuery({ queryKey: ['req', 'employee-info', probe], queryFn: () => lookups.employeeInfo(probe.split(',')), enabled: !!probe, staleTime: 5 * 60 * 1000, retry: false })
  if (!probe || codes.length === 0) return null
  const found = new Map((q.data ?? []).map((e) => [e.employeeId.toLowerCase(), e]))
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
      {codes.filter((c) => probe.split(',').includes(c)).map((c) => {
        const e = found.get(c.toLowerCase())
        if (q.isLoading) return <span key={c} className="cell-muted" style={{ fontSize: 12 }}>{c} …</span>
        if (!e) return <span key={c} style={{ fontSize: 12.5, color: 'var(--ant-color-error, #dc2626)' }}>{c} · {t('req.codeNotFound')}</span>
        return (
          <div key={c} style={{ fontSize: 12.5, lineHeight: 1.35, padding: '4px 8px', borderRadius: 8, background: 'var(--c-surface-2)' }}>
            <b>{e.employeeId} · {e.fullName}</b>
            <div className="cell-muted">{[e.position, [e.department, e.part && e.part.toLowerCase() !== e.department.toLowerCase() ? e.part : null].filter(Boolean).join(' › ')].filter(Boolean).join(' · ')}</div>
          </div>
        )
      })}
    </div>
  )
}
