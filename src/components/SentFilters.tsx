import { useMemo } from 'react'
import { Button, Input, Select, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

export type SentStatus = 'all' | 'waiting' | 'approved' | 'rejected'
export interface SentFilter { text: string; status: SentStatus; dept?: string }
export const emptySentFilter: SentFilter = { text: '', status: 'all' }

interface Filterable {
  employeeId: string; fullName: string; department: string | null; overall: string
  senderName?: string; senderId?: string; reason?: string
}

/** Lọc các dòng đơn đã gửi ngay trên trình duyệt (không gọi lại máy chủ): từ khoá, trạng thái tổng, bộ phận. */
export function filterSent<T extends Filterable>(rows: T[], f: SentFilter): T[] {
  const q = f.text.trim().toLowerCase()
  return rows.filter((r) =>
    (f.status === 'all' || r.overall === f.status)
    && (!f.dept || r.department === f.dept)
    && (!q || `${r.employeeId} ${r.fullName} ${r.department ?? ''} ${r.senderName ?? ''} ${r.senderId ?? ''} ${r.reason ?? ''}`.toLowerCase().includes(q)))
}

/** Bộ lọc của danh sách đơn đã gửi: ô tìm nhanh + trạng thái + bộ phận + nút bỏ lọc. */
export function SentFilters<T extends Filterable>({ rows, value, onChange, shown }: { rows: T[]; value: SentFilter; onChange: (f: SentFilter) => void; shown: number }) {
  const { t } = useTranslation()
  const depts = useMemo(() => Array.from(new Set(rows.map((r) => r.department).filter((d): d is string => !!d))).sort(), [rows])
  const active = value.text.trim() !== '' || value.status !== 'all' || !!value.dept
  return (
    <>
      <Input.Search allowClear style={{ width: 240 }} placeholder={t('req.filterSearch')} value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />
      <Select<SentStatus> style={{ width: 150 }} value={value.status} onChange={(status) => onChange({ ...value, status })}
        options={[
          { value: 'all', label: `${t('req.overall')}: ${t('att.typeAll')}` },
          { value: 'waiting', label: t('req.status.waiting') },
          { value: 'approved', label: t('req.status.approved') },
          { value: 'rejected', label: t('req.status.rejected') },
        ]} />
      <Select allowClear showSearch style={{ width: 200 }} placeholder={t('att.allDepts')} value={value.dept} onChange={(dept) => onChange({ ...value, dept })}
        options={depts.map((d) => ({ value: d, label: d }))} />
      {active && (
        <>
          <Typography.Text type="secondary">{shown}/{rows.length}</Typography.Text>
          <Button type="link" size="small" onClick={() => onChange(emptySentFilter)}>{t('req.clearFilter')}</Button>
        </>
      )}
    </>
  )
}
