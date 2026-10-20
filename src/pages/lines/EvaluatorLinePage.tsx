import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Form, Popconfirm, Select, Space, Tag } from 'antd'
import { AppModal } from '../../components/AppModal'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { org } from '../../api/org'
import { lines, POSITION_CODES, type EvaluatorLineRow, type EvaluatorProblem, type PositionCode } from '../../api/lines'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { lineErrorText } from './ApprovalLinePage'
import { useToast } from '../../hooks/useToast'

const ROUND_COLOR = ['', 'green', 'blue', 'purple', 'orange', 'red']

/** Line đánh giá: người đánh giá của từng bộ phận theo vòng (1 tổ trưởng … 5 trụ sở). Dùng khi HR đăng ký đánh giá để tạo các vòng. */
export default function EvaluatorLinePage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [department, setDepartment] = useState<string | undefined>(params.get('unit') ?? undefined)
  const [person, setPerson] = useState<string>()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<EvaluatorLineRow | null>(null)
  const [problemsOpen, setProblemsOpen] = useState(false)
  const [moveTo, setMoveTo] = useState<Record<number, string | undefined>>({})
  const [addForm] = Form.useForm<{ department: string; userId: string; position: PositionCode }>()
  const [editForm] = Form.useForm<{ userId: string }>()

  const lookups = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, refetchOnMount: 'always' })
  const list = useQuery({ queryKey: ['lines', 'evaluators', department, person], queryFn: () => lines.evaluators({ department, userId: person }) })
  // Danh sách phòng ban chuẩn của cơ cấu tổ chức + gợi ý bộ phận cho từng phòng ban chưa khai báo (chỉ tải khi mở hộp xử lý)
  const orgData = useQuery({ queryKey: ['org', 'overview'], queryFn: org.overview, enabled: problemsOpen, staleTime: 60_000, retry: false })
  const [addDept, setAddDept] = useState<Record<number, string | undefined>>({})
  const suggestedDept = (name: string) => orgData.data?.orphans.find((o) => o.name.toLowerCase() === name.toLowerCase())?.suggestedDepartment ?? undefined
  const addToOrg = useMutation({
    mutationFn: (v: { name: string; department: string }) => org.assignUnit(v),
    onSuccess: (r) => { message.success(t('line.addedToOrg', { n: r.employees })); qc.invalidateQueries({ queryKey: ['lines'] }); qc.invalidateQueries({ queryKey: ['org'] }) },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  // Khai báo hàng loạt: mỗi phòng ban chưa có trong cơ cấu (một lần cho mỗi tên) vào bộ phận gợi ý
  const addAll = useMutation({
    mutationFn: async (items: { name: string; department: string }[]) => {
      let ok = 0, bad = 0
      for (const it of items) { try { await org.assignUnit(it); ok++ } catch { bad++ } }
      return { ok, bad }
    },
    onSuccess: (r) => { (r.bad ? message.warning : message.success)(t('line.addAllDone', r)); qc.invalidateQueries({ queryKey: ['lines'] }); qc.invalidateQueries({ queryKey: ['org'] }) },
  })
  const problems = useQuery({ queryKey: ['lines', 'evaluators', 'problems'], queryFn: lines.evaluatorProblems, retry: false })
  const refresh = () => qc.invalidateQueries({ queryKey: ['lines', 'evaluators'] })
  const bulkItems = (() => {
    const seen = new Map<string, { name: string; department: string }>()
    for (const r of problems.data ?? []) {
      if (!r.issues.includes('unknown_unit')) continue
      const dep = suggestedDept(r.line.department)
      if (dep && !seen.has(r.line.department.toLowerCase())) seen.set(r.line.department.toLowerCase(), { name: r.line.department, department: dep })
    }
    return [...seen.values()]
  })()
  const people = (lookups.data?.people ?? []).map((p) => ({ value: p.value, label: `${p.label} · ${p.value}` }))

  const add = useMutation({
    mutationFn: (v: { department: string; userId: string; position: PositionCode }) => lines.addEvaluator(v),
    onSuccess: () => { message.success(t('line.added')); setAddOpen(false); addForm.resetFields(); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const update = useMutation({
    mutationFn: (v: { id: number; userId: string }) => lines.updateEvaluator(v.id, v.userId),
    onSuccess: () => { message.success(t('line.updated')); setEditing(null); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const move = useMutation({
    mutationFn: (v: { id: number; department: string }) => lines.moveEvaluator(v.id, v.department),
    onSuccess: () => { message.success(t('line.moved')); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => lines.deleteEvaluator(id),
    onSuccess: () => { message.success(t('line.deleted')); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })

  const rows = list.data ?? []
  // Mở từ màn đối soát với một phòng ban chưa có line: mở sẵn hộp thêm người đánh giá cho phòng ban đó.
  const unit = params.get('unit')
  useEffect(() => {
    if (unit && list.isSuccess && (list.data?.length ?? 0) === 0) { addForm.setFieldsValue({ department: unit }); setAddOpen(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, list.isSuccess])
  const stats = useMemo(() => ({ total: rows.length, deps: new Set(rows.map((r) => r.department)).size, people: new Set(rows.map((r) => r.userId)).size }), [rows])

  const columns: ColumnsType<EvaluatorLineRow> = [
    { title: t('line.unit'), dataIndex: 'department', width: 280 },
    { title: t('line.round'), dataIndex: 'round', width: 200, render: (v: number) => <Tag color={ROUND_COLOR[v] ?? 'default'} variant="filled">{t('line.roundN', { n: v })} · {t(`line.roundName.${v}`, { defaultValue: '' })}</Tag> },
    { title: t('line.person'), width: 280, render: (_: unknown, r: EvaluatorLineRow) => <span><b>{r.fullName ?? '—'}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span> },
    {
      title: '', width: 180,
      render: (_: unknown, r: EvaluatorLineRow) => (
        <Space>
          <Button size="small" onClick={() => { setEditing(r); editForm.setFieldsValue({ userId: r.userId }) }}>{t('req.edit')}</Button>
          <Popconfirm title={t('line.confirmDelete')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.id)}>
            <Button size="small" danger>{t('req.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<TeamOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.evaluatorLine')} subtitle={t('nav.evaluatorLineDesc')}
      />
      <StatTiles items={[
        { label: t('line.tileLines'), value: stats.total, color: '#2E9E4F' },
        { label: t('line.tileUnits'), value: stats.deps, color: '#D48806' },
        { label: t('line.tilePeople'), value: stats.people, color: '#2F6FB0' },
      ]} />
      <Alert type="info" showIcon title={t('line.evaluatorNote')} style={{ marginBottom: 16 }} />
      {(problems.data?.length ?? 0) > 0 && (
        <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 16 }} title={t('line.problemsTitle', { n: problems.data!.length })} description={t('line.problemsText')}
          action={<Button size="small" type="primary" onClick={() => setProblemsOpen(true)}>{t('line.problemsOpen')}</Button>} />
      )}
      <DataTable<EvaluatorLineRow>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('line.empty') }}
        toolbar={(
          <Space wrap>
            <Select showSearch allowClear style={{ width: 280 }} placeholder={t('req.unitPlaceholder')} value={department} onChange={setDepartment}
              loading={lookups.isLoading} options={(lookups.data?.parts ?? []).map((p) => ({ value: p, label: p }))} />
            <Select showSearch allowClear optionFilterProp="label" style={{ width: 260 }} placeholder={t('line.filterPerson')} value={person} onChange={setPerson} options={people} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { addForm.setFieldsValue({ department }); setAddOpen(true) }}>{t('line.addEvaluator')}</Button>
          </Space>
        )}
      />

      <AppModal open={problemsOpen} onClose={() => setProblemsOpen(false)} size="xl" icon={<WarningOutlined />} title={t('line.problemsModal')} subtitle={t('line.problemsHint')}>
        {(problems.data ?? []).some((r) => r.issues.includes('unknown_unit')) && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            title={t('line.unknownAlert', { n: (lookups.data?.parts ?? []).length })}
            description={t('line.unknownAlertBody')}
            action={(
              <Space direction="vertical" size={6}>
                <Popconfirm title={t('line.addAllAsk', { n: bulkItems.length })} disabled={bulkItems.length === 0} okText={t('line.addToOrg')} cancelText={t('req.cancel')} onConfirm={() => addAll.mutate(bulkItems)}>
                  <Button size="small" type="primary" disabled={bulkItems.length === 0} loading={addAll.isPending || orgData.isLoading}>{t('line.addAllToOrg', { n: bulkItems.length })}</Button>
                </Popconfirm>
                <Link to="/org"><Button size="small">{t('line.openOrg')}</Button></Link>
              </Space>
            )} />
        )}
        <DataTable<EvaluatorProblem>
          rowKey={(r) => r.line.id} size="small" sticky={false} dataSource={problems.data ?? []} pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: t('line.problemsNone') }}
          columns={[
            { title: t('line.unit'), width: 230, render: (_: unknown, r) => <span>{r.line.department}{' '}<Tag color="red" variant="filled">{t('line.roundN', { n: r.line.round })}</Tag></span> },
            { title: t('line.person'), width: 200, render: (_: unknown, r) => <span><b>{r.line.fullName ?? '—'}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.line.userId}</span></span> },
            { title: t('line.problem'), width: 200, render: (_: unknown, r) => r.issues.map((i) => <Tag key={i} color="orange" variant="filled">{t(`line.issue.${i}`)}</Tag>) },
            {
              title: '', width: 560,
              render: (_: unknown, r) => (
                <Space size={6} wrap>
                  {r.issues.includes('unknown_unit') && (
                    <>
                      <Select showSearch size="small" style={{ width: 170 }} placeholder={t('line.moveTo')} optionFilterProp="label" value={moveTo[r.line.id] ?? r.suggestedUnit ?? undefined}
                        onChange={(v) => setMoveTo((m) => ({ ...m, [r.line.id]: v }))} options={(lookups.data?.parts ?? []).map((p) => ({ value: p, label: p }))}
                        notFoundContent={t('line.noUnitMatch')} />
                      <Button size="small" type="primary" disabled={!(moveTo[r.line.id] ?? r.suggestedUnit)} loading={move.isPending && move.variables?.id === r.line.id}
                        onClick={() => move.mutate({ id: r.line.id, department: (moveTo[r.line.id] ?? r.suggestedUnit)! })}>{t('line.move')}</Button>
                      <span className="line-or">{t('line.or')}</span>
                      <Select showSearch size="small" style={{ width: 190 }} placeholder={t('line.pickDept')} optionFilterProp="label" value={addDept[r.line.id] ?? suggestedDept(r.line.department)}
                        loading={orgData.isLoading} onChange={(v) => setAddDept((m) => ({ ...m, [r.line.id]: v }))}
                        options={(orgData.data?.departments ?? []).filter((d) => d.active).map((d) => ({ value: d.name, label: d.name }))} />
                      <Popconfirm title={t('line.addToOrgAsk', { name: r.line.department, dep: addDept[r.line.id] ?? suggestedDept(r.line.department) ?? '' })} okText={t('line.addToOrg')} cancelText={t('req.cancel')}
                        disabled={!(addDept[r.line.id] ?? suggestedDept(r.line.department))}
                        onConfirm={() => addToOrg.mutate({ name: r.line.department, department: (addDept[r.line.id] ?? suggestedDept(r.line.department))! })}>
                        <Button size="small" disabled={!(addDept[r.line.id] ?? suggestedDept(r.line.department))} loading={addToOrg.isPending && addToOrg.variables?.name === r.line.department}>{t('line.addToOrg')}</Button>
                      </Popconfirm>
                    </>
                  )}
                  {(r.issues.includes('inactive_person') || r.issues.includes('unknown_person')) && (
                    <Button size="small" onClick={() => { setProblemsOpen(false); setEditing(r.line); editForm.setFieldsValue({ userId: undefined }) }}>{t('line.changePerson')}</Button>
                  )}
                  <Popconfirm title={t('line.confirmDelete')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.line.id)}>
                    <Button size="small" danger>{t('req.delete')}</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </AppModal>

      <AppModal open={addOpen} onClose={() => setAddOpen(false)} size="sm" icon={<PlusOutlined />} title={t('line.addEvaluator')}
        onOk={() => addForm.validateFields().then((v) => add.mutate(v))} okText={t('line.add')} okLoading={add.isPending}>
        <Form form={addForm} layout="vertical">
          <Form.Item name="department" label={t('line.unit')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={(lookups.data?.parts ?? []).map((p) => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="position" label={t('line.round')} rules={[{ required: true }]}>
            <Select options={POSITION_CODES.map((c, i) => ({ value: c, label: `${t('line.roundN', { n: i + 1 })} · ${t(`line.roundName.${i + 1}`)}` }))} />
          </Form.Item>
          <Form.Item name="userId" label={t('line.person')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={people} />
          </Form.Item>
        </Form>
      </AppModal>

      <AppModal open={!!editing} onClose={() => setEditing(null)} size="sm" icon={<TeamOutlined />} title={t('line.editEvaluator')}
        subtitle={editing ? `${editing.department} · ${t('line.roundN', { n: editing.round })}` : undefined}
        onOk={() => editForm.validateFields().then((v) => update.mutate({ id: editing!.id, userId: v.userId }))} okText={t('req.saveChanges')} okLoading={update.isPending}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="userId" label={t('line.person')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={people} />
          </Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
