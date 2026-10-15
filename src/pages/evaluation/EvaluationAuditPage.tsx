import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Checkbox, DatePicker, Input, Select, Skeleton, Space, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AuditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons'
import { AppModal } from '../../components/AppModal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { evaluations, type EvaluationSet } from '../../api/evaluations'
import { apiErrorCode } from '../../api/requests'
import { lines } from '../../api/lines'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { EvaluationLineModal } from './EvaluationLineModal'
import { EvaluationHistoryDrawer } from './EvaluationHistoryDrawer'
import { issueColor } from './EvaluationReviewModal'
import { useToast } from '../../hooks/useToast'

const ROUND_COLOR = ['', 'green', 'blue', 'purple', 'orange', 'red']
const LINE_ISSUES = ['evaluator_inactive', 'evaluator_unknown', 'duplicate_person', 'missing_self', 'op_self']
/** Đơn không còn hợp lý (nên xóa/kiểm tra): đã qua giai đoạn này, tạo thừa, công tác quá lâu, thử việc nhưng đã chính thức. */
const STALE_ISSUES = ['already_permanent', 'stage_done', 'duplicate_stage', 'long_service', 'probation_moot']
const key = (s: EvaluationSet) => `${s.employeeId}|${s.dateRate.slice(0, 10)}|${s.typeRate}`

/** Rà soát line các đơn đánh giá đang chạy: phát hiện người đánh giá nghỉ việc/không có hồ sơ, trùng người, thiếu tự đánh giá… và sửa line (vòng chưa xác nhận). */
export default function EvaluationAuditPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [from, setFrom] = useState<Dayjs>(dayjs().subtract(180, 'day'))
  const [department, setDepartment] = useState<string>()
  const [search, setSearch] = useState('')
  const [issue, setIssue] = useState<string>('line')
  const [target, setTarget] = useState<EvaluationSet | null>(null)
  const [delTarget, setDelTarget] = useState<EvaluationSet | null>(null)
  const [history, setHistory] = useState<EvaluationSet | null>(null)
  const [understood, setUnderstood] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)

  const parts = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, refetchOnMount: 'always' })
  const list = useQuery({
    queryKey: ['evaluations', 'audit', from.format('YYYY-MM-DD'), department, search],
    queryFn: () => evaluations.audit({ from: from.format('YYYY-MM-DD'), department, search: search.trim() || undefined }),
  })
  // Chi tiết đơn (có số điểm nháp từng vòng) khi mở sửa line
  const detail = useQuery({
    queryKey: ['evaluations', 'audit-set', target ? key(target) : ''], enabled: !!target, gcTime: 0,
    queryFn: () => evaluations.auditSet(target!.employeeId, target!.dateRate.slice(0, 10), target!.typeRate),
  })

  // Chi tiết đơn định xóa: để biết số vòng đã xác nhận và điểm nháp sẽ mất
  const delDetail = useQuery({
    queryKey: ['evaluations', 'audit-del', delTarget ? key(delTarget) : ''], enabled: !!delTarget, gcTime: 0,
    queryFn: () => evaluations.auditSet(delTarget!.employeeId, delTarget!.dateRate.slice(0, 10), delTarget!.typeRate),
  })
  const delConfirmed = delDetail.data?.rounds.filter((r) => r.confirmed).length ?? 0
  const delMarks = delDetail.data?.rounds.reduce((n, r) => n + (r.markCount ?? 0), 0) ?? 0
  const needForce = delConfirmed > 0 || delMarks > 0
  const closeDelete = () => { setDelTarget(null); setUnderstood(false) }

  const remove = useMutation({
    mutationFn: () => evaluations.deleteSet(delTarget!.employeeId, delTarget!.dateRate.slice(0, 10), delTarget!.typeRate, needForce),
    onSuccess: () => { message.success(t('eva.auditDeleted')); closeDelete(); qc.invalidateQueries({ queryKey: ['evaluations'] }) },
    onError: (e) => { const { code } = apiErrorCode(e); message.error(code === 'not_found' ? t('req.err.not_found') : t('req.err.generic')) },
  })

  const bulkRemove = useMutation({
    mutationFn: () => evaluations.deleteBatch(selected.map((k) => { const [employeeId, dateRate, typeRate] = k.split('|'); return { employeeId, dateRate, typeRate } })),
    onSuccess: (r) => {
      if (r.skipped.length) message.warning(t('eva.auditBulkResultSkipped', { n: r.deleted, skipped: r.skipped.length }))
      else message.success(t('eva.auditBulkResult', { n: r.deleted }))
      setBulkOpen(false); setSelected([]); qc.invalidateQueries({ queryKey: ['evaluations'] })
    },
    onError: () => message.error(t('req.err.generic')),
  })

  const fix = useMutation({
    mutationFn: (v: { line: { round: number; userId: string }[]; newDate: string | null }) =>
      evaluations.fixLine({ employeeId: target!.employeeId, dateRate: target!.dateRate.slice(0, 10), typeRate: target!.typeRate, line: v.line, newDateRate: v.newDate ?? undefined }),
    onSuccess: () => { message.success(t('eva.auditSaved')); setTarget(null); qc.invalidateQueries({ queryKey: ['evaluations'] }) },
    onError: (e) => {
      const { code, detail: d } = apiErrorCode(e)
      message.error(code === 'invalid_input' ? t(`eva.regErr.${d}`, { defaultValue: t('req.err.invalid_input') }) : code === 'not_found' ? t('req.err.not_found') : t('req.err.generic'))
    },
  })

  const all = list.data ?? []
  const rows = useMemo(() => all.filter((s) => (issue === 'all' || search.trim() !== '' ? true :   // đang tìm một nhân viên cụ thể thì hiện mọi đơn của họ, không lọc theo loại vấn đề
       issue === 'line' ? s.issues.some((i) => LINE_ISSUES.includes(i)) : issue === 'stale' ? s.issues.some((i) => STALE_ISSUES.includes(i)) : s.issues.includes(issue))), [all, issue, search])
  const count = (code: string) => all.filter((s) => s.issues.includes(code)).length
  const withLineIssues = all.filter((s) => s.issues.some((i) => LINE_ISSUES.includes(i))).length
  const staleCount = all.filter((s) => s.issues.some((i) => STALE_ISSUES.includes(i))).length

  const columns: ColumnsType<EvaluationSet> = [
    { title: t('eva.employeeId'), dataIndex: 'employeeId', width: 100 },
    { title: t('eva.fullName'), width: 200, render: (_: unknown, s: EvaluationSet) => <div><b>{s.fullName}</b><div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{s.position} · {s.department}</div></div> },
    { title: t('eva.typeRate'), dataIndex: 'typeRate', width: 230, render: (v: string) => <Tag color="green" variant="filled">{v}</Tag> },
    { title: t('eva.dateRate'), dataIndex: 'dateRate', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: t('eva.lineCol'), width: 360,
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
      title: t('eva.reviewIssues'), width: 220,
      render: (_: unknown, s: EvaluationSet) => (s.issues.length === 0 ? <Tag color="success" variant="filled">{t('eva.reviewOk')}</Tag>
        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{s.issues.map((i) => <Tag key={i} color={issueColor(i)} variant="filled">{t(`eva.issue.${i}`, { defaultValue: i })}</Tag>)}</div>),
    },
    {
      title: '', width: 270,
      render: (_: unknown, s: EvaluationSet) => (
        <Space size={6}>
          <Button size="small" onClick={() => setHistory(s)}>{t('hist.button')}</Button>
          <Button size="small" onClick={() => setTarget(s)}>{t('eva.auditFix')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setDelTarget(s)}>{t('req.delete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<AuditOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.evaluationAudit')} subtitle={t('nav.evaluationAuditDesc')}
      />
      <StatTiles items={[
        { label: t('eva.auditTileRunning'), value: all.length, color: '#2E9E4F' },
        { label: t('eva.auditTileIssues'), value: withLineIssues, color: '#D92D20' },
        { label: t('eva.auditTileInactive'), value: count('evaluator_inactive'), color: '#D48806' },
        { label: t('eva.auditTileStale'), value: staleCount, color: '#6D5BD0' },
        { label: t('eva.auditTileOverdue'), value: count('overdue'), color: '#2F6FB0' },
      ]} />
      <Alert type="info" showIcon title={t('eva.auditNote')} style={{ marginBottom: 16 }} />
      <DataTable<EvaluationSet>
        rowKey={key} loading={list.isFetching} columns={columns} dataSource={rows} pagination={{ pageSize: 30, showSizeChanger: false }}
        rowSelection={{ selectedRowKeys: selected, preserveSelectedRowKeys: true, onChange: (k) => setSelected(k as string[]) }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('eva.auditEmpty') }}
        toolbar={(
          <Space wrap>
            <DatePicker allowClear={false} format="DD/MM/YYYY" value={from} onChange={(v) => v && setFrom(v)} />
            <Select showSearch allowClear style={{ width: 240 }} placeholder={t('req.deptPlaceholder')} value={department} onChange={setDepartment}
              options={(parts.data?.parts ?? []).map((p) => ({ value: p, label: p }))} />
            <Select style={{ width: 230 }} value={issue} onChange={setIssue} options={[
              { value: 'line', label: t('eva.auditFilterLine') }, { value: 'stale', label: t('eva.auditFilterStale') }, { value: 'all', label: t('eva.auditFilterAll') },
              ...[...LINE_ISSUES, ...STALE_ISSUES, 'overdue'].map((i) => ({ value: i, label: t(`eva.issue.${i}`) })),
            ]} />
            <Input.Search allowClear style={{ width: 230 }} placeholder={t('eva.search')} onSearch={setSearch} />
            <Button onClick={() => list.refetch()} loading={list.isFetching}>{t('apr.reload')}</Button>
            <Button onClick={() => setSelected(rows.map(key))} disabled={rows.length === 0}>{t('eva.auditSelectAll', { n: rows.length })}</Button>
            <Button danger icon={<DeleteOutlined />} disabled={selected.length === 0} onClick={() => setBulkOpen(true)}>{t('eva.auditBulkDelete')} ({selected.length})</Button>
          </Space>
        )}
      />
      <AppModal open={bulkOpen} onClose={() => setBulkOpen(false)} size="sm" danger icon={<DeleteOutlined />} title={t('eva.auditBulkTitle')}
        subtitle={t('eva.auditBulkSubtitle', { n: selected.length })} onOk={() => bulkRemove.mutate()} okText={t('eva.auditDeleteDo')} okLoading={bulkRemove.isPending}>
        <Alert type="warning" showIcon title={t('eva.auditBulkInfo')} />
      </AppModal>
      <AppModal open={!!delTarget} onClose={closeDelete} size="sm" danger icon={<DeleteOutlined />} title={t('eva.auditDeleteTitle')}
        subtitle={delTarget ? `${delTarget.employeeId} – ${delTarget.fullName}` : undefined}
        onOk={() => remove.mutate()} okText={t('eva.auditDeleteDo')} okLoading={remove.isPending} okDisabled={delDetail.isLoading || (needForce && !understood)}>
        {delDetail.isLoading ? <Skeleton active /> : (
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            <div>{delTarget?.typeRate} · {t('eva.dateRate')}: {delTarget ? dayjs(delTarget.dateRate).format('DD/MM/YYYY') : ''}</div>
            <Alert type={needForce ? 'error' : 'warning'} showIcon title={t(needForce ? 'eva.auditDeleteDanger' : 'eva.auditDeleteInfo', { rounds: delDetail.data?.rounds.length ?? 0, confirmed: delConfirmed, marks: delMarks })} />
            {needForce && <Checkbox checked={understood} onChange={(e) => setUnderstood(e.target.checked)}>{t('eva.auditDeleteAck')}</Checkbox>}
          </Space>
        )}
      </AppModal>
      <EvaluationHistoryDrawer target={history ? { employeeId: history.employeeId, dateRate: history.dateRate.slice(0, 10), typeRate: history.typeRate } : null} title={history?.fullName} onClose={() => setHistory(null)} />
      <EvaluationLineModal
        subject={target && detail.data ? { employeeId: target.employeeId, fullName: target.fullName, position: target.position, department: target.department, typeRate: target.typeRate, dateRate: target.dateRate } : null}
        fixed={detail.data?.rounds} saving={fix.isPending} onClose={() => setTarget(null)}
        onSave={(line, newDate) => line && fix.mutate({ line, newDate })}
      />
    </div>
  )
}
