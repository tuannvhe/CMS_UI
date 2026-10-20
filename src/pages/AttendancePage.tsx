import { useState } from 'react'
import { Alert, Button, DatePicker, Space } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { getMyAttendance, errorCode, sumColumns, type AttendanceDay } from '../api/attendance'
import { useAuth } from '../auth/AuthContext'
import { DataTable } from '../components/DataTable'
import { PageBanner } from '../components/PageBanner'
import { UserAvatar } from '../components/UserAvatar'
import { StatTiles } from '../components/StatTiles'
import { fmtDate, num } from '../utils/format'
import { DayToggle, detailColumns, formsExpandable, rowClass, totalsRow } from './attendanceColumns'

export default function AttendancePage() {
  const { t } = useTranslation()
  const [openKeys, setOpenKeys] = useState<React.Key[]>([])
  const dayKey = (r: AttendanceDay) => r.date
  const { user } = useAuth()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [applied, setApplied] = useState(range)

  // Chỉ truyền khoảng ngày: mã nhân viên do máy chủ lấy từ token.
  const q = useQuery({
    queryKey: ['attendance', 'me', fmtDate(applied[0]), fmtDate(applied[1])],
    queryFn: () => getMyAttendance(fmtDate(applied[0]), fmtDate(applied[1])),
    enabled: !!user?.employeeId,
    retry: false,
  })

  const [errMsg, setErrMsg] = useState('')
  if (q.isError && !errMsg) errorCode(q.error).then((c) => setErrMsg(c || 'x'))

  const apiError = (() => {
    if (!user?.employeeId) return t('att.noEmployee')
    if (!q.isError) return ''
    if (errMsg === 'no_employee') return t('att.noEmployee')
    if (errMsg === 'invalid_range') return t('att.invalid_range')
    if (errMsg === 'range_too_long') return t('att.range_too_long')
    return t('att.loadFailed')
  })()

  const s = q.data?.summary
  const d = t('att.days')
  const h = t('att.hours')

  return (
    <div className="page wide">
      <PageBanner
        avatar={<UserAvatar name={user?.fullName} src={user?.avatarUrl} size={64} />}
        title={user?.fullName || t('nav.attendance')}
        subtitle={t('nav.attendance') + ' · ' + t('att.mineHint')}
        chips={[
          `${t('att.empId')}: ${user?.employeeId || '—'}`,
          ...(q.data?.department ? [q.data.department] : []),
          ...(q.data?.position ? [q.data.position] : []),
          ...(q.data?.rows[0]?.employeeType ? [q.data.rows[0].employeeType] : []),
        ]}
      />

      {apiError && <Alert type="warning" showIcon title={apiError} style={{ marginBottom: 16 }} />}

      {s && (
        <StatTiles
          items={[
            { label: t('att.present'), value: s.presentDays, unit: d, color: 'var(--c-primary)' },
            { label: t('att.absent'), value: s.absentDays, unit: d, color: '#D92D20' },
            { label: t('att.manual'), value: s.manualDays, unit: d, color: '#3b82f6' },
            { label: t('att.dayWork'), value: num(s.dayWorkHours) || 0, unit: h, color: 'var(--c-accent)' },
            { label: t('att.nightWork'), value: num(s.nightWorkHours) || 0, unit: h, color: '#6D5BD0' },
            { label: t('att.otHours'), value: num(s.otHours) || 0, unit: h, color: '#D48806' },
            { label: t('att.leave'), value: num(s.annualLeaveHours) || 0, unit: h, color: '#14b8a6' },
          ]}
        />
      )}

      <div className="att-table">
        <DataTable<AttendanceDay>
          rowKey={(r) => r.date}
          loading={q.isFetching}
          columns={detailColumns(t, { withEmployee: false, toggle: (r) => <DayToggle r={r} keys={openKeys} setKeys={setOpenKeys} rowKey={dayKey} t={t} /> })}
          dataSource={q.data?.rows ?? []}
          size="small"
          sticky={false}
          scroll={{ x: 1360 }}
          pagination={{ pageSize: 31, showSizeChanger: false }}
          rowClassName={rowClass}
          expandable={formsExpandable(t, openKeys, setOpenKeys)}
          summary={() => totalsRow(t, q.data ? sumColumns(q.data.rows) : undefined, { withEmployee: false })}
          toolbar={
            <Space wrap>
              <DatePicker.RangePicker
                allowClear={false}
                format="DD/MM/YYYY"
                value={range}
                onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                presets={[
                  { label: t('att.thisMonth'), value: [dayjs().startOf('month'), dayjs()] },
                  { label: t('att.lastMonth'), value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                ]}
              />
              <Button type="primary" disabled={!user?.employeeId} onClick={() => { setErrMsg(''); setApplied(range) }}>{t('att.query')}</Button>
            </Space>
          }
        />
      </div>
    </div>
  )
}
