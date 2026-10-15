import { useMemo, useState } from 'react'
import { Button, DatePicker, Input, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { evaluations, type EvaluationDoneItem, type EvaluationItem } from '../../api/evaluations'
import { DataTable } from '../../components/DataTable'
import { StatTiles } from '../../components/StatTiles'
import { EvaluationDetailDrawer } from './EvaluationDetailDrawer'

const d = (s: string | null) => (s ? dayjs(s).format('DD/MM/YYYY') : '')

/** Danh sách các đánh giá tôi đã xác nhận: lọc theo ngày xác nhận, tìm nhanh, xem lại chi tiết (chỉ đọc). */
export default function EvaluationDoneTab() {
  const { t } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(89, 'day'), dayjs()])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<EvaluationItem | null>(null)
  const [keyword, setKeyword] = useState('')   // chỉ đổi khi bấm tìm / Enter / xóa
  // Có từ khóa thì tìm trên toàn bộ thời gian (không giới hạn theo khoảng ngày xác nhận); không có thì theo khoảng ngày đã chọn.
  const searching = keyword.trim() !== ''
  const from = searching ? '2000-01-01' : range[0].format('YYYY-MM-DD'), to = searching ? dayjs().format('YYYY-MM-DD') : range[1].format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['evaluations', 'done', from, to], queryFn: () => evaluations.done(from, to) })

  const rows = useMemo(() => {
    const f = keyword.trim().toLowerCase()
    return (q.data ?? []).filter((r) => !f || `${r.employeeId} ${r.fullName} ${r.department}`.toLowerCase().includes(f))
  }, [q.data, keyword])

  const completed = (q.data ?? []).filter((r) => r.roundsTotal > 0 && r.roundsDone >= r.roundsTotal).length
  const scored = (q.data ?? []).filter((r) => r.myTotal != null)
  const avg = scored.length ? Math.round((scored.reduce((n, r) => n + (r.myTotal as number), 0) / scored.length) * 10) / 10 : '—'

  const open = (r: EvaluationDoneItem) => setSelected({
    id: r.id, employeeId: r.employeeId, fullName: r.fullName, position: r.position, startWork: r.startWork,
    department: r.department, typeRate: r.typeRate, dateRate: r.dateRate, round: r.round,
  })

  const columns: ColumnsType<EvaluationDoneItem> = [
    { title: t('eva.employeeId'), dataIndex: 'employeeId', width: 110 },
    { title: t('eva.fullName'), dataIndex: 'fullName', width: 200 },
    { title: t('eva.position'), dataIndex: 'position', width: 100 },
    { title: t('eva.department'), dataIndex: 'department', width: 190 },
    { title: t('eva.typeRate'), dataIndex: 'typeRate', width: 240, render: (v: string) => <Tag color="green" variant="filled">{v}</Tag> },
    { title: t('eva.dateRate'), dataIndex: 'dateRate', width: 120, render: d },
    { title: t('eva.round'), dataIndex: 'round', width: 80, align: 'center' },
    { title: t('eva.myTotal'), dataIndex: 'myTotal', width: 110, align: 'right', render: (v: number | null) => (v == null ? '—' : <b>{v}</b>) },
    {
      title: t('eva.progress'), width: 130, align: 'center',
      render: (_: unknown, r: EvaluationDoneItem) => (
        <Tag variant="filled" color={r.roundsDone >= r.roundsTotal ? 'success' : 'processing'}>
          {r.roundsDone}/{r.roundsTotal} {r.roundsDone >= r.roundsTotal ? t('eva.allDone') : t('eva.inProgress')}
        </Tag>
      ),
    },
    { title: t('eva.confirmedAt'), dataIndex: 'confirmedAt', width: 150, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '') },
    { title: '', width: 90, render: (_: unknown, r: EvaluationDoneItem) => <Button size="small" onClick={() => open(r)}>{t('eva.view')}</Button> },
  ]

  return (
    <>
      <StatTiles items={[
        { label: t('eva.tileDone'), value: q.data?.length ?? 0, color: '#2E9E4F' },
        { label: t('eva.tileCompleted'), value: completed, color: '#2F6FB0' },
        { label: t('eva.tileAvg'), value: avg, color: '#D48806' },
      ]} />
      <DataTable<EvaluationDoneItem>
        rowKey={(r) => `${r.id}-${r.round}`} loading={q.isLoading} columns={columns} dataSource={rows}
        toolbar={(
          <>
            <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
            <Input.Search allowClear style={{ width: 260 }} placeholder={t('eva.search')} value={filter}
              onChange={(e) => { setFilter(e.target.value); if (!e.target.value) setKeyword('') }} onSearch={(v) => setKeyword(v)} />
          </>
        )}
        locale={{ emptyText: q.isError ? t('req.err.generic') : t('eva.emptyDone') }}
      />
      <EvaluationDetailDrawer item={selected} onClose={() => setSelected(null)} readOnly />
    </>
  )
}
