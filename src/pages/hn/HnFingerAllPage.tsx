import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Empty, Input, Select, Space, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ClockCircleOutlined, FileExcelOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { hnAdminApi, hnErrorKey, type HnFingerFilter, type HnRow } from '../../api/hn'
import { PageBanner } from '../../components/PageBanner'
import { fmtCell } from '../../utils/hnFormat'

/*
 * 2026-11-25 [Truong] - HN HR: fingerprint / daily attendance of every active employee (Search_FingerUser1 with an empty employee ID),
 * filters like the old FingerUserReport, Excel export with the same 27 columns as the old system. Module "Xem tất cả vân tay" (only "Nhân sự").
 */

/** Thứ tự cột như file Excel của CMS_HN cũ (HnFingerExcel.Columns ở máy chủ). */
const COLS = ['EMPLOYEESID', 'FULLNAME', 'POSITTION', 'DEPARTMENT', 'TypeEmployee', 'DATEREGISTER', 'DayinWeek', 'NgayLamViec', 'Shift', 'TIMEIN', 'TIMEOUT', 'starts', 'endtime',
  'CongCaNgay', 'CongCaDem', 'OTNgayChuNhat', 'OTDemChuNhat', 'OTNgayLe', 'OTDemLe', 'TimeNghiPhep', 'TimeNghiBHXH', 'TimeNghiDacBiet', 'TimeNghiKhamThai', 'TimeNghiKhongLuong',
  'NghiTuGio', 'NghiToiGio', 'Statuss'] as const
const NARROW = new Set(['DayinWeek', 'Shift', 'TIMEIN', 'TIMEOUT', 'starts', 'endtime', 'CongCaNgay', 'CongCaDem', 'OTNgayChuNhat', 'OTDemChuNhat', 'OTNgayLe', 'OTDemLe',
  'TimeNghiPhep', 'TimeNghiBHXH', 'TimeNghiDacBiet', 'TimeNghiKhamThai', 'TimeNghiKhongLuong', 'NghiTuGio', 'NghiToiGio'])

export default function HnFingerAllPage() {
  const { t } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().startOf('month'), dayjs()])
  const [name, setName] = useState('')
  const [dept, setDept] = useState<string>()
  const [type, setType] = useState('')
  const [applied, setApplied] = useState<HnFingerFilter | null>(null)
  const tooLong = range[1].diff(range[0], 'day') + 1 > 31

  const build = (): HnFingerFilter => ({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), name: name.trim() || undefined, dept: dept || undefined, type: type || undefined })
  const q = useQuery({ queryKey: ['hn', 'admin', 'finger', applied], queryFn: () => hnAdminApi.finger(applied!), enabled: !!applied, retry: false, staleTime: 60_000 })
  const exp = useMutation({ mutationFn: () => hnAdminApi.fingerExport(applied ?? build()) })

  const rows = useMemo(() => q.data?.rows ?? [], [q.data])
  // Danh sách bộ phận lấy từ kết quả đã tải (lọc tại máy chủ khi bấm Xem lại)
  const depts = useMemo(() => [...new Set(rows.map((r) => fmtCell(r.DEPARTMENT)).filter(Boolean))].sort(), [rows])
  const columns = useMemo<ColumnsType<HnRow>>(() => COLS.map((k) => ({
    title: t(`hn.fingerAll.col.${k}`), dataIndex: k, key: k, ellipsis: true, width: NARROW.has(k) ? 96 : k === 'FULLNAME' ? 190 : 130,
    ...(k === 'EMPLOYEESID' ? { fixed: 'left' as const } : {}),
    render: (v: unknown) => fmtCell(v),
  })), [t])

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<ClockCircleOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('hn.nav.fingerAll')} subtitle={t('hn.nav.fingerAllDesc')} chips={q.data ? [t('hn.fingerAll.count', { n: q.data.count })] : undefined} />

      <section className="pay-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap align="start">
          <div>
            <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} status={tooLong ? 'error' : undefined} />
            <div style={{ fontSize: 12, color: tooLong ? 'var(--ant-color-error, #D92D20)' : 'var(--c-muted)' }}>{t('hn.fingerAll.rangeHint')}</div>
          </div>
          <Input allowClear style={{ width: 200 }} placeholder={t('hn.fingerAll.name')} value={name} onChange={(e) => setName(e.target.value)} onPressEnter={() => !tooLong && setApplied(build())} />
          <Select allowClear showSearch style={{ width: 220 }} placeholder={t('hn.fingerAll.dept')} value={dept} onChange={setDept} options={depts.map((d) => ({ value: d, label: d }))} />
          <Select style={{ width: 150 }} value={type} onChange={setType} options={[{ value: '', label: `${t('hn.fingerAll.type')}: ${t('hn.fingerAll.all')}` }, { value: 'Chính thức', label: t('hn.fingerAll.official') }, { value: 'Thời vụ', label: t('hn.fingerAll.seasonal') }]} />
          <Button type="primary" icon={<SearchOutlined />} disabled={tooLong} loading={q.isFetching} onClick={() => setApplied(build())}>{t('hn.fingerAll.search')}</Button>
          <Button icon={<FileExcelOutlined />} disabled={tooLong || !applied} loading={exp.isPending} onClick={() => exp.mutate()}>{t('hn.fingerAll.export')}</Button>
        </Space>
        {q.isFetching && <Typography.Paragraph type="secondary" style={{ margin: '10px 0 0' }}>{t('hn.fingerAll.slow')}</Typography.Paragraph>}
      </section>

      {(q.isError || exp.isError) && <Alert type="error" showIcon title={t(hnErrorKey(q.error ?? exp.error))} style={{ marginBottom: 16 }} />}

      {applied && (
        <Table<HnRow> size="small" bordered rowKey={(_, i) => String(i)} columns={columns} dataSource={rows} loading={q.isFetching}
          scroll={{ x: 'max-content' }} pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [50, 100, 200] }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.fingerAll.empty')} /> }} />
      )}
    </div>
  )
}
