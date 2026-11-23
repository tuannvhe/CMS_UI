import { useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Empty, Skeleton } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorKey, type HnRow } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { fmtCell, visibleColumns } from '../../utils/hnFormat'

const MAX_DAYS = 62
const MAX_ROWS = 500
const FIRST = ['EMPLOYEESID', 'FULLNAME', 'DEPARTMENT', 'DATEREGISTER', 'TIMEIN', 'TIMEOUT']
const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')

/** Xem vân tay theo khoảng ngày (tối đa 62 ngày, mặc định 7 ngày gần nhất; máy chủ trả tối đa 500 dòng). */
export default function HnFingerPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().subtract(6, 'day'), dayjs()])
  // Chỉ gọi API khi bấm "Xem" / đổi khoảng hợp lệ: khoá truy vấn theo khoảng ngày đã chọn
  const [applied, setApplied] = useState<[Dayjs, Dayjs]>(range)
  const from = fmt(applied[0]), to = fmt(applied[1])
  const q = useQuery({ queryKey: ['hn', 'finger', user?.userId, from, to], queryFn: () => hnApi.finger(from, to), staleTime: 60_000, retry: false })

  const rows = useMemo(() => q.data?.rows ?? [], [q.data])
  const label = (k: string) => (k.includes('.') ? k : t(`hn.col.${k.toLowerCase()}`, { defaultValue: k }))
  const columns = useMemo<ColumnsType<HnRow>>(() => visibleColumns(rows, FIRST).map((k) => ({
    title: label(k), dataIndex: k, key: k, ellipsis: true, render: (v: unknown) => fmtCell(v),
  })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, t])

  // Không cho chọn quá 62 ngày: ô chọn tự chặn các ngày ngoài khoảng cho phép khi đã chọn đầu mút
  const [pick, setPick] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const disabled = (d: Dayjs) => !!pick?.[0] && !pick[1] && Math.abs(d.diff(pick[0], 'day')) >= MAX_DAYS
  const search = () => setApplied(range)

  return (
    <div className="page wide">
      <PageBanner avatar={<ClockCircleOutlined style={{ fontSize: 30 }} />} title={t('hn.nav.finger')} subtitle={t('hn.nav.fingerDesc')} chips={q.data ? [t('hn.finger.count', { n: q.data.count ?? rows.length })] : undefined} />
      {q.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={t(hnErrorKey(q.error))} />}
      {(q.data?.count ?? rows.length) >= MAX_ROWS && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('hn.finger.truncated')} />}
      {q.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <DataTable<HnRow>
          rowKey={(_, i) => String(i)}
          columnFilters={false}
          columns={columns}
          dataSource={rows}
          loading={q.isFetching}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.finger.empty')} /> }}
          toolbar={(
            <>
              <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} disabledDate={disabled}
                aria-label={t('hn.finger.range')}
                onCalendarChange={(v) => setPick(v as [Dayjs | null, Dayjs | null] | null)}
                onOpenChange={(o) => { if (!o) setPick(null) }}
                onChange={(v) => { if (v?.[0] && v[1]) setRange([v[0], v[1]]) }} />
              <Button type="primary" onClick={search} loading={q.isFetching}>{t('hn.finger.search')}</Button>
              <span style={{ color: 'var(--c-muted)' }}>{t('hn.finger.hint')}</span>
            </>
          )}
        />
      )}
    </div>
  )
}
