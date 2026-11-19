import { useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Select, Space, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, WarningOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { evaluations, type EvaluationSet } from '../../api/evaluations'
import { lines } from '../../api/lines'
import { apiErrorCode } from '../../api/requests'
import { useToast } from '../../hooks/useToast'
import { EvaluationLineModal } from './EvaluationLineModal'
import { DataTable } from '../../components/DataTable'
import { SearchBox } from '../../components/SearchBox'
import { foldFilter } from '../../utils/search'
import { EvaluationDeleteModal } from './EvaluationDeleteModal'
import { filterTexts } from '../../components/ColumnFilter'

const ROUND_COLOR = ['', 'green', 'blue', 'purple', 'orange', 'red']
const key = (s: EvaluationSet) => `${s.employeeId}|${s.dateRate.slice(0, 10)}|${s.typeRate}`

/** Các đơn đánh giá đã tạo (kể cả đơn đã đánh giá / HR đã chốt) để HR xóa ngay ở màn Đăng ký đánh giá. Xóa hàng loạt chỉ xóa đơn chưa có dữ liệu. */
export function EvaluationCreatedList() {
  const { t } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)   // khoảng hạn đánh giá; trống = toàn bộ đơn, không giới hạn ngày
  const [department, setDepartment] = useState<string>()
  const [search, setSearch] = useState('')
  const [delTarget, setDelTarget] = useState<EvaluationSet | null>(null)
  const [target, setTarget] = useState<EvaluationSet | null>(null)   // đơn đang xem / sửa line
  const message = useToast()
  const qc = useQueryClient()
  const parts = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000 })
  const list = useQuery({
    queryKey: ['evaluations', 'audit', 'all', range?.[0].format('YYYY-MM-DD') ?? 'all', range?.[1].format('YYYY-MM-DD') ?? 'all', department, search],
    queryFn: () => evaluations.audit({ from: range?.[0].format('YYYY-MM-DD'), to: range?.[1].format('YYYY-MM-DD'), department, search: search.trim() || undefined, includeDone: true }),
  })
  // Hạn đánh giá mới nhất lên đầu; cùng hạn thì theo mã nhân viên
  const rows = useMemo(() => [...(list.data ?? [])].sort((a, b) => b.dateRate.localeCompare(a.dateRate) || a.employeeId.localeCompare(b.employeeId)), [list.data])
  // Chi tiết đơn (điểm nháp từng vòng, phòng ban hiện tại, line của phòng ban) khi mở xem / sửa line
  const detail = useQuery({
    queryKey: ['evaluations', 'audit-set', target ? key(target) : ''], enabled: !!target, gcTime: 0,
    queryFn: () => evaluations.auditSet(target!.employeeId, target!.dateRate.slice(0, 10), target!.typeRate),
  })
  const fix = useMutation({
    mutationFn: (v: { line: { round: number; userId: string }[]; newDate: string | null; syncDepartment: boolean }) =>
      evaluations.fixLine({ employeeId: target!.employeeId, dateRate: target!.dateRate.slice(0, 10), typeRate: target!.typeRate, line: v.line, newDateRate: v.newDate ?? undefined, syncDepartment: v.syncDepartment || undefined, anyPerson: true }),
    onSuccess: () => { message.success(t('eva.auditSaved')); setTarget(null); qc.invalidateQueries({ queryKey: ['evaluations'] }) },
    onError: (e) => {
      const { code, detail: d } = apiErrorCode(e)
      message.error(code === 'invalid_input' ? t(`eva.regErr.${d}`, { defaultValue: t('req.err.invalid_input') }) : code === 'not_found' ? t('req.err.not_found') : t('req.err.generic'))
    },
  })

  const columns: ColumnsType<EvaluationSet> = [
    { title: t('eva.employeeId'), dataIndex: 'employeeId', width: 110 },
    { title: t('eva.fullName'), dataIndex: 'fullName', width: 200 },
    { title: t('eva.department'), dataIndex: 'department', width: 220 },
    { title: t('eva.typeRate'), dataIndex: 'typeRate', width: 240, render: (v: string) => <Tag color="green" variant="filled">{v}</Tag> },
    { title: t('eva.dateRate'), dataIndex: 'dateRate', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: t('eva.lineCol'), width: 380,
      // Lọc theo từng người đánh giá trong line (bất kỳ vòng nào); vòng tự đánh giá không đưa vào danh sách
      ...filterTexts<EvaluationSet>((s) => s.rounds.filter((r) => r.userId !== s.employeeId).map((r) => r.fullName ?? r.userId)),
      render: (_: unknown, s: EvaluationSet) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {s.rounds.map((r) => (
            <Tooltip key={r.id} title={r.confirmed ? t('eva.auditConfirmed') : r.active === false ? t('eva.issue.evaluator_inactive_short') : r.active == null ? t('eva.issue.evaluator_unknown') : ''}>
              <Tag color={r.confirmed ? 'success' : r.active === false || r.active == null ? 'error' : ROUND_COLOR[r.round] ?? 'default'} variant="filled" icon={!r.confirmed && r.active !== true ? <WarningOutlined /> : undefined}>
                {t('line.roundN', { n: r.round })}: {r.userId === s.employeeId ? t('eva.lineSelf') : (r.fullName ?? r.userId)}
              </Tag>
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      title: t('eva.createdProgress'), width: 150,
      ...filterTexts<EvaluationSet>((s) => [t('eva.createdRounds', { done: s.rounds.filter((r) => r.confirmed).length, total: s.rounds.length })]),
      render: (_: unknown, s: EvaluationSet) => {
        const done = s.rounds.filter((r) => r.confirmed).length
        return <Tag color={done === 0 ? 'default' : done === s.rounds.length ? 'success' : 'processing'} variant="filled">{t('eva.createdRounds', { done, total: s.rounds.length })}</Tag>
      },
    },
    {
      title: '', width: 230,
      render: (_: unknown, s: EvaluationSet) => (
        <Space size={6}>
          <Button size="small" onClick={() => setTarget(s)}>{t('eva.createdLine')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setDelTarget(s)}>{t('req.delete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Alert type="info" showIcon title={t('eva.createdNote')} style={{ marginBottom: 16 }} />
      <DataTable<EvaluationSet>
        rowKey={key} loading={list.isFetching} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('eva.createdEmpty') }}
        toolbar={(
          <Space wrap>
            <DatePicker.RangePicker allowClear format="DD/MM/YYYY" placeholder={[t('eva.dueFrom'), t('eva.dueTo')]} value={range}
              onChange={(v) => setRange(v?.[0] && v?.[1] ? [v[0], v[1]] : null)} />
            <Select showSearch filterOption={foldFilter()} allowClear style={{ width: 240 }} placeholder={t('req.deptPlaceholder')} value={department} onChange={setDepartment}
              options={(parts.data?.parts ?? []).map((p) => ({ value: p, label: p }))} />
            <SearchBox allowClear style={{ width: 230 }} placeholder={t('eva.search')} onSearch={setSearch} />
            <Button onClick={() => list.refetch()} loading={list.isFetching}>{t('apr.reload')}</Button>
          </Space>
        )}
      />
      <EvaluationDeleteModal target={delTarget} onClose={() => setDelTarget(null)} />
      <EvaluationLineModal
        subject={target && detail.data ? { employeeId: target.employeeId, fullName: target.fullName, position: target.position, department: target.department, typeRate: target.typeRate, dateRate: target.dateRate } : null}
        fixed={detail.data?.rounds} saving={fix.isPending} onClose={() => setTarget(null)}
        currentDepartment={detail.data?.currentDepartment} resigned={detail.data?.resigned} endWork={detail.data?.endWork} unitLine={null}
        onSave={(line, newDate, opts) => line && fix.mutate({ line, newDate, syncDepartment: !!opts?.syncDepartment })}
      />
    </>
  )
}
