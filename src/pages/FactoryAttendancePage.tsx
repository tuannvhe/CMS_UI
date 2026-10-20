import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Empty, Input, Modal, Select, Space, Switch, Tag } from 'antd'
import { DownloadOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import {
  downloadExcel, errorCode, getDepartments, getFactoryDetail, getFlagSummary,
  type AttendanceDay, type EmployeeKind, type FactoryFilter, type FlagSummary,
} from '../api/attendance'
import { DataTable } from '../components/DataTable'
import { PageBanner } from '../components/PageBanner'
import { StatTiles } from '../components/StatTiles'
import { fmtDate, num } from '../utils/format'
import { DayToggle, detailColumns, formsExpandable, rowClass, totalsRow } from './attendanceColumns'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../auth/AuthContext'

/**
 * Tổng hợp công toàn nhà máy (quản trị): chỉ bảng chi tiết từng người-ngày.
 * Vào trang KHÔNG tự truy vấn; chỉ truy vấn khi bấm "Xem" (dữ liệu cả nhà máy khá nặng).
 */
export default function FactoryAttendancePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [openKeys, setOpenKeys] = useState<React.Key[]>([])
  const dayKey = (r: AttendanceDay) => `${r.employeeId}|${r.date}`
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [type, setType] = useState<EmployeeKind>('all')
  const [department, setDepartment] = useState<string>()
  const [name, setName] = useState('')
  const [empId, setEmpId] = useState('')
  const [applied, setApplied] = useState<FactoryFilter | null>(null)   // null = chưa bấm Xem
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [exporting, setExporting] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [warn, setWarn] = useState<FlagSummary | null>(null)   // cảnh báo trước khi xuất khi còn dòng cần xem lại
  const msg = useToast()

  const depts = useQuery({ queryKey: ['att', 'departments'], queryFn: getDepartments, staleTime: 60_000 })

  const detail = useQuery({
    queryKey: ['att', 'factory-detail', applied, page, pageSize, flaggedOnly],
    queryFn: () => getFactoryDetail(applied!, page, pageSize, flaggedOnly),
    enabled: applied !== null,
    retry: false,
    placeholderData: (prev) => prev,
  })

  const [errCode, setErrCode] = useState('')
  if (detail.isError && !errCode) errorCode(detail.error).then((c) => setErrCode(c || 'x'))
  const errText = !detail.isError ? '' :
    errCode === 'range_too_long' ? t('att.range_too_long') :
    errCode === 'invalid_range' ? t('att.invalid_range') :
    errCode === 'forbidden' ? t('att.forbidden') : t('att.loadFailed')

  const filter = (): FactoryFilter =>
    ({ from: fmtDate(range[0]), to: fmtDate(range[1]), type, department, name: name.trim(), employeeId: empId.trim() })

  const apply = () => { setErrCode(''); setPage(1); setApplied(filter()) }

  const doExport = async () => {
    setExporting(true)
    try { await downloadExcel(filter()); msg.success(t('att.exportDone')) }
    catch (e) {
      const c = await errorCode(e)
      msg.error(c === 'range_too_long' ? t('att.exportMax') : t('att.exportFailed'))
    } finally { setExporting(false) }
  }

  // Trước khi xuất: nếu còn dòng có cờ thì cảnh báo để HR xem / sửa (tạo đơn bổ sung) trước; HR vẫn có thể chọn xuất luôn.
  const onExport = async () => {
    setExporting(true)
    try {
      const s = await getFlagSummary(filter())
      if (s.flaggedRows > 0) { setWarn(s); setExporting(false); return }
    } catch { /* không kiểm tra được cờ thì vẫn cho xuất */ }
    setExporting(false)
    await doExport()
  }
  const reviewFlagged = () => { setWarn(null); setFlaggedOnly(true); setErrCode(''); setPage(1); setApplied(filter()) }

  const kindLabel = (k: EmployeeKind) => (k === 'all' ? t('att.typeAll') : k === 'official' ? t('att.typeOfficial') : t('att.typeTemporary'))
  const tt = detail.data?.totals
  const h = t('att.hours')

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<TeamOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.factoryAttendance')}
        subtitle={t('att.factoryHint')}
        chips={applied ? [`${dayjs(applied.from).format('DD/MM/YYYY')} – ${dayjs(applied.to).format('DD/MM/YYYY')}`, kindLabel(applied.type)] : []}
        extra={user?.isAdmin ? <Button size="large" icon={<DownloadOutlined />} loading={exporting} onClick={onExport}>{t('att.export')}</Button> : undefined}
      />
      {errText && <Alert type="error" showIcon title={errText} style={{ marginBottom: 16 }} />}

      {tt && (
        <StatTiles
          items={[
            { label: t('att.detail'), value: tt.rows.toLocaleString(), color: 'var(--c-primary)' },
            { label: t('att.dayWork'), value: num(tt.dayWorkHours) || 0, unit: h, color: 'var(--c-accent)' },
            { label: t('att.nightWork'), value: num(tt.nightWorkHours) || 0, unit: h, color: '#6D5BD0' },
            { label: t('att.otHours'), value: num(tt.otHours) || 0, unit: h, color: '#D48806' },
            { label: t('attFlag.tile'), value: `${tt.flaggedRows.toLocaleString()} · ${tt.flaggedPeople.toLocaleString()} ${t('attFlag.people')}`, color: tt.flaggedRows ? '#D48806' : '#2E9E4F' },
          ]}
        />
      )}

      <div className="att-table">
        <DataTable<AttendanceDay>
          rowKey={(r) => `${r.employeeId}|${r.date}`}
          size="small"
          sticky={false}
          scroll={{ x: 1680 }}
          rowClassName={rowClass}
          expandable={formsExpandable(t, openKeys, setOpenKeys)}
          summary={() => totalsRow(t, tt?.columns, { withEmployee: true })}
          loading={detail.isFetching}
          columns={detailColumns(t, { withEmployee: true, toggle: (r) => <DayToggle r={r} keys={openKeys} setKeys={setOpenKeys} rowKey={dayKey} t={t} /> })}
          dataSource={detail.data?.rows ?? []}
          locale={{ emptyText: applied === null ? <Empty description={t('att.pressView')} /> : undefined }}
          pagination={{
            current: page, pageSize, total: tt?.rows ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
            showTotal: (n: number) => n.toLocaleString(),
            onChange: (p: number, s: number) => { setPage(p); setPageSize(s) },
          }}
          toolbar={
            <Space wrap>
              <DatePicker.RangePicker
                allowClear={false} format="DD/MM/YYYY" value={range}
                onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                presets={[
                  { label: t('att.thisMonth'), value: [dayjs().startOf('month'), dayjs()] },
                  { label: t('att.lastMonth'), value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                ]}
              />
              <Select<EmployeeKind>
                value={type} onChange={setType} style={{ width: 150 }} aria-label={t('att.type')}
                options={[
                  { value: 'all', label: t('att.typeAll') },
                  { value: 'official', label: t('att.typeOfficial') },
                  { value: 'temporary', label: t('att.typeTemporary') },
                ]}
              />
              <Select
                allowClear showSearch value={department} onChange={setDepartment} style={{ width: 190 }}
                placeholder={t('att.allDepts')} options={(depts.data ?? []).map((d) => ({ value: d, label: d }))}
              />
              <Input allowClear placeholder={t('att.searchName')} value={name} onChange={(e) => setName(e.target.value)} onPressEnter={apply} style={{ width: 170 }} />
              <Input allowClear placeholder={t('att.searchId')} value={empId} onChange={(e) => setEmpId(e.target.value)} onPressEnter={apply} style={{ width: 120 }} />
              <Button type="primary" loading={detail.isFetching} onClick={apply}>{t('att.query')}</Button>
              <Space size={6}><Switch checked={flaggedOnly} onChange={(v) => { setFlaggedOnly(v); setPage(1) }} /><span>{t('attFlag.only')}</span></Space>
            </Space>
          }
        />
      </div>
      <Modal open={!!warn} onCancel={() => setWarn(null)} title={t('attFlag.warnTitle')} width={520}
        footer={[
          <Button key="x" onClick={() => setWarn(null)}>{t('req.cancel')}</Button>,
          <Button key="go" loading={exporting} onClick={async () => { setWarn(null); await doExport() }}>{t('attFlag.exportAnyway')}</Button>,
          <Button key="rv" type="primary" onClick={reviewFlagged}>{t('attFlag.review')}</Button>,
        ]}>
        {warn && (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Alert type="warning" showIcon title={t('attFlag.warnText', { rows: warn.flaggedRows, people: warn.flaggedPeople })} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(warn.byCode).map(([c, n]) => <Tag key={c} color="gold">{t(`attFlag.code.${c}`, { defaultValue: c })}: {n}</Tag>)}
            </div>
            <div className="cell-muted">{t('attFlag.warnHint')}</div>
          </Space>
        )}
      </Modal>
    </div>
  )
}
