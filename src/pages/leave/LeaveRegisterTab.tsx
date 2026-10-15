import { useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Col, DatePicker, Empty, Input, InputNumber, Popconfirm, Row, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuth } from '../../auth/AuthContext'
import { StatTiles } from '../../components/StatTiles'
import { apiErrorCode, leave, lookups, type CreateResult, type LeaveApproversInput, type LeaveDraftRow } from '../../api/requests'
import { personColumn, deptColumn, ShiftChip } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { ApproverEmailWarning, approverOption, noEmailNames } from '../../components/ApproverEmailWarning'
import { EditLeaveDraftModal } from './EditLeaveDraftModal'
import { fmtDate } from '../../utils/format'
import { mergeVisible } from '../../utils/selection'
import { useToast } from '../../hooks/useToast'

function Step({ n, title }: { n: number; title: string }) {
  return <div className="req-step"><span className="n">{n}</span>{title}</div>
}

/** Đăng ký nghỉ phép theo flow cũ: chọn nhân viên → thời gian nghỉ, lý do, người nhận việc, 4 cấp duyệt → Thêm (nháp) → Gửi duyệt. */
export default function LeaveRegisterTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const { user } = useAuth()

  const [department, setDepartment] = useState<string>()
  const [checked, setChecked] = useState<string[]>([])
  const [manual, setManual] = useState('')
  const [filter, setFilter] = useState('')
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [totalDays, setTotalDays] = useState<number | null>(null)
  const [shift, setShift] = useState<string>()
  const [timeIn, setTimeIn] = useState<string>()
  const [timeOut, setTimeOut] = useState<string>()
  const [reasonCode, setReasonCode] = useState<string>()
  const [other, setOther] = useState('')
  const [person, setPerson] = useState('')
  const [ap, setAp] = useState<{ one?: string; two?: string; three?: string; four?: string }>({})
  const [selected, setSelected] = useState<number[]>([])
  const [result, setResult] = useState<CreateResult | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<LeaveDraftRow | null>(null)

  const long = 10 * 60 * 1000
  const departments = useQuery({ queryKey: ['req', 'departments'], queryFn: lookups.departments, staleTime: long })
  const shifts = useQuery({ queryKey: ['req', 'shifts'], queryFn: lookups.shifts, staleTime: long })
  const reasons = useQuery({ queryKey: ['req', 'leave-reasons'], queryFn: leave.reasons, staleTime: long })
  const employees = useQuery({ queryKey: ['req', 'employees', department], queryFn: () => lookups.employees(department!), enabled: !!department, staleTime: 60000 })
  const approvers = useQuery({ queryKey: ['req', 'approvers', department], queryFn: () => lookups.approvers(department!), enabled: !!department, staleTime: 60000 })
  const times = useQuery({ queryKey: ['req', 'times', 'finger', shift], queryFn: () => lookups.times('finger', shift!), enabled: !!shift, staleTime: long })
  const drafts = useQuery({ queryKey: ['req', 'leave-drafts'], queryFn: leave.drafts })
  // Số giờ phép năm còn lại: của chính mình (luôn hiện) và của những nhân viên đang chọn
  const myBalance = useQuery({ queryKey: ['req', 'leave-balance', 'me'], queryFn: () => leave.balance(), enabled: !!user?.employeeId, staleTime: 60000 })

  const visibleEmployees = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (employees.data ?? []).filter((e) => !f || e.label.toLowerCase().includes(f))
  }, [employees.data, filter])

  const manualIds = manual.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean)
  const allIds = Array.from(new Set([...checked, ...manualIds]))

  const idsKey = allIds.slice(0, 50).join(',')
  const picked = useQuery({
    queryKey: ['req', 'leave-balance', idsKey], queryFn: () => leave.balance(allIds.slice(0, 50)),
    enabled: allIds.length > 0, staleTime: 60000,
  })
  const needHours = totalDays && Number.isFinite(totalDays) ? totalDays * 8 : 0

  const approverOptions = (approvers.data ?? []).map(approverOption)
  const pick = (userId?: string) => (userId ? { userId, name: approvers.data?.find((a) => a.userId === userId)?.name } : undefined)
  const approversInput: LeaveApproversInput = { one: pick(ap.one), two: pick(ap.two), three: pick(ap.three), four: pick(ap.four) }

  // Chỉ nhận số nguyên hoặc 0,5 như màn cũ
  const daysOk = totalDays != null && totalDays > 0 && (Number.isInteger(totalDays) || totalDays === 0.5)
  const canAdd = allIds.length > 0 && !!range && daysOk && !!shift && !!timeIn && !!timeOut && !!reasonCode && !!person.trim() && !!(ap.one || ap.two || ap.three || ap.four)

  const errMessage = (e: unknown) => {
    const { code, detail } = apiErrorCode(e)
    if (code === 'no_approver') return t('req.err.no_approver')
    if (code === 'invalid_range') return t('att.invalid_range')
    if (code === 'invalid_input') return detail === 'totalDays' ? t('leave.err.totalDays') : detail === 'personTakeJob' ? t('leave.err.personTakeJob') : t('req.err.invalid_input')
    if (code === 'not_found') return t('req.err.not_found')
    return t('req.err.generic')
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['req', 'leave-drafts'] })

  const create = useMutation({
    mutationFn: () => leave.create({
      employeeIds: allIds, from: fmtDate(range![0]), to: fmtDate(range![1]), totalDays: totalDays!, shift: shift!, timeIn: timeIn!, timeOut: timeOut!,
      reasonCode: reasonCode!, otherReason: other.trim() || undefined, personTakeJob: person.trim(), approvers: approversInput,
    }),
    onSuccess: (r) => {
      setResult(r); setError(''); refresh()
      if (r.created > 0) { setChecked([]); setManual(''); msg.success(t('req.createdCount', { n: r.created })) } else msg.warning(t('req.createdNone'))
    },
    onError: (e) => { setResult(null); setError(errMessage(e)); msg.error(errMessage(e)) },
  })
  const remove = useMutation({
    mutationFn: () => leave.remove(selected),
    onSuccess: () => { msg.success(t('req.deleted')); setSelected([]); refresh() },
    onError: (e) => msg.error(errMessage(e)),
  })
  const submit = useMutation({
    mutationFn: () => leave.submit(selected),
    onSuccess: (r) => { msg.success(t('req.submitted', { n: r.submitted, code: r.groupId })); setSelected([]); refresh(); qc.invalidateQueries({ queryKey: ['req', 'leave-submitted'] }) },
    onError: (e) => msg.error(errMessage(e)),
  })

  const onDepartment = (v: string) => { setDepartment(v); setChecked([]); setAp({}); setFilter('') }
  const onRange = (v: [Dayjs | null, Dayjs | null] | null) => {
    if (v?.[0] && v?.[1]) { setRange([v[0], v[1]]); setTotalDays(v[1].diff(v[0], 'day') + 1) } else setRange(null)
  }
  const timeOptions = (list?: string[]) => (list ?? []).map((x) => ({ value: x, label: x }))
  const full: React.CSSProperties = { width: '100%' }
  const apSelect = (key: 'one' | 'two' | 'three' | 'four', label: string) => (
    <Select style={full} allowClear showSearch optionFilterProp="label" placeholder={label} value={ap[key]} disabled={!department}
      onChange={(v) => setAp((p) => ({ ...p, [key]: v }))} options={approverOptions} />
  )

  const columns: ColumnsType<LeaveDraftRow> = [
    personColumn<LeaveDraftRow>(t('att.name'), 230),
    deptColumn<LeaveDraftRow>(t('att.dept'), 190),
    { title: t('leave.from'), dataIndex: 'from', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('leave.to'), dataIndex: 'to', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('leave.days'), dataIndex: 'totalDays', width: 70, align: 'right' },
    { title: t('att.shift'), dataIndex: 'shift', width: 110, render: (v: string) => <ShiftChip value={v} /> },
    { title: `${t('req.timeIn')} – ${t('req.timeOut')}`, width: 120, align: 'center', render: (_: unknown, r: LeaveDraftRow) => `${r.timeIn} – ${r.timeOut}` },
    { title: t('req.reason'), dataIndex: 'reason', width: 200, ellipsis: { showTitle: true } },
    { title: t('leave.handover'), dataIndex: 'personTakeJob', width: 140, ellipsis: { showTitle: true } },
    {
      title: t('req.sectionApprovers'), width: 300,
      render: (_: unknown, r: LeaveDraftRow) => {
        const rows: [string, string][] = [[t('req.shortOne'), r.approverOne], [t('req.shortTwo'), r.approverTwo], [t('req.shortThree'), r.approverThree], ['HQ', r.approverFour]]
        const used = rows.filter(([, n]) => n && !/^no need/i.test(n))
        return used.length === 0 ? '—' : (
          <div style={{ display: 'grid', gap: 2 }}>
            {used.map(([l, n]) => <div key={l} style={{ display: 'flex', gap: 8 }}><span style={{ width: 98, flex: 'none', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--c-muted)' }}>{l}</span><span>{n}</span></div>)}
          </div>
        )
      },
    },
    { title: '', width: 80, align: 'center', render: (_: unknown, r: LeaveDraftRow) => <Button size="small" onClick={() => setEditing(r)}>{t('req.edit')}</Button> },
  ]

  const skipText = (s: { employeeId: string; reason: string; detail?: string | null }) => `${s.employeeId}: ${t(`req.skip.${s.reason}`, { detail: s.reason === 'period_closed' ? (s.detail ?? '') : s.detail ? s.detail.split(' → ').map((d) => dayjs(d).format('DD/MM/YYYY')).join(' → ') : '' })}`

  return (
    <>
      {myBalance.data?.[0] && (
        <StatTiles
          items={[
            { label: t('leave.balanceYear', { year: myBalance.data[0].year }), value: myBalance.data[0].entitledHours, unit: t('leave.hours'), color: 'var(--c-primary)' },
            { label: t('leave.used'), value: myBalance.data[0].usedHours, unit: t('leave.hours'), color: '#D48806' },
            { label: t('leave.remaining'), value: myBalance.data[0].remainingHours, unit: t('leave.hours'), color: myBalance.data[0].remainingHours < 0 ? '#D92D20' : 'var(--c-accent)' },
          ]}
        />
      )}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={9}>
            <div className="req-panel">
              <Step n={1} title={t('req.sectionEmployees')} />
              <Select showSearch allowClear style={{ ...full, marginBottom: 10 }} placeholder={t('req.deptPlaceholder')} value={department}
                onChange={onDepartment} onClear={() => onDepartment('')} loading={departments.isLoading}
                options={(departments.data ?? []).map((d) => ({ value: d, label: d }))} />
              {department && (
                <>
                  <Space style={{ marginBottom: 8 }} wrap>
                    <Input allowClear placeholder={t('req.filterEmp')} value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 190 }} />
                    <Button size="small" onClick={() => setChecked(Array.from(new Set([...checked, ...visibleEmployees.map((e) => e.value)])))}>{t('req.selectAll')}</Button>
                    <Button size="small" onClick={() => setChecked([])}>{t('req.clearAll')}</Button>
                    <Typography.Text type="secondary">{t('req.countSelected', { n: checked.length, total: employees.data?.length ?? 0 })}</Typography.Text>
                  </Space>
                  <div className="req-emp-list">
                    {employees.isLoading ? null : visibleEmployees.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                      <Checkbox.Group value={checked} onChange={(v) => setChecked(mergeVisible(checked, visibleEmployees.map((e) => e.value), v as string[]))}>
                        {visibleEmployees.map((e) => <Checkbox key={e.value} value={e.value}>{e.label}</Checkbox>)}
                      </Checkbox.Group>
                    )}
                  </div>
                </>
              )}
              <Input style={{ marginTop: 10 }} allowClear value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('req.manualIds')} addonBefore={t('att.empId')} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.manualHint')}</Typography.Text>
            </div>
          </Col>

          <Col xs={24} md={12} xl={8}>
            <div className="req-panel">
              <Step n={2} title={t('leave.sectionPeriod')} />
              <Space orientation="vertical" style={full} size={10}>
                <DatePicker.RangePicker style={full} format="DD/MM/YYYY" value={range} onChange={onRange} />
                <Space.Compact style={full}>
                  <InputNumber style={{ width: '60%' }} min={0.5} max={90} step={0.5} value={totalDays} onChange={setTotalDays} addonBefore={t('leave.totalDays')} status={totalDays != null && !daysOk ? 'error' : undefined} />
                  <Select style={{ width: '40%' }} placeholder={t('att.shift')} value={shift} onChange={(v) => { setShift(v); setTimeIn(undefined); setTimeOut(undefined) }} loading={shifts.isLoading}
                    options={(shifts.data ?? []).map((s) => ({ value: s.value, label: s.label }))} />
                </Space.Compact>
                <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: -6 }}>{t('leave.totalDaysHint')}</Typography.Text>
                <Space.Compact style={full}>
                  <Select style={{ width: '50%' }} showSearch placeholder={t('req.timeIn')} value={timeIn} onChange={setTimeIn} disabled={!shift} options={timeOptions(times.data?.start)} />
                  <Select style={{ width: '50%' }} showSearch placeholder={t('req.timeOut')} value={timeOut} onChange={setTimeOut} disabled={!shift} options={timeOptions(times.data?.end)} />
                </Space.Compact>
                <Select style={full} placeholder={t('leave.reasonSelect')} value={reasonCode} onChange={setReasonCode} loading={reasons.isLoading}
                  options={(reasons.data ?? []).map((r) => ({ value: r.value, label: r.label }))} />
                <Input.TextArea rows={2} maxLength={500} value={person} onChange={(e) => setPerson(e.target.value)} placeholder={t('leave.personTakeJob')} status={person.length > 0 && !person.trim() ? 'error' : undefined} />
                <Input.TextArea rows={2} maxLength={500} value={other} onChange={(e) => setOther(e.target.value)} placeholder={t('leave.otherReason')} />
              </Space>
            </div>
          </Col>

          <Col xs={24} md={12} xl={7}>
            <div className="req-panel">
              <Step n={3} title={t('req.sectionApprovers')} />
              <Space orientation="vertical" style={full} size={10}>
                {apSelect('one', t('req.approverOne'))}
                {apSelect('two', t('req.approverTwo'))}
                {apSelect('three', t('req.approverThree'))}
                {apSelect('four', t('leave.approverFour'))}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('leave.approverHint')}</Typography.Text>
                <ApproverEmailWarning names={noEmailNames(approvers.data, [ap.one, ap.two, ap.three, ap.four])} />
                <div className="req-summary">
                  {allIds.length > 0 && <span className="chip">{t('req.countSelectedShort', { n: allIds.length })}</span>}
                  {range && <span className="chip">{range[0].format('DD/MM')} – {range[1].format('DD/MM/YYYY')}</span>}
                  {daysOk && <span className="chip">{totalDays} {t('leave.days').toLowerCase()}</span>}
                </div>
                <Button type="primary" size="large" block disabled={!canAdd} loading={create.isPending} onClick={() => create.mutate()}>
                  {t('req.add')}{allIds.length > 0 ? ` (${allIds.length})` : ''}
                </Button>
              </Space>
            </div>
          </Col>
        </Row>

        {picked.data && allIds.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('leave.balanceOf')}{needHours > 0 ? ` · ${t('leave.needHours', { h: needHours })}` : ''}</Typography.Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {allIds.map((id) => {
                const b = picked.data!.find((x) => x.employeeId === id)
                if (!b) return <Tag key={id} variant="filled">{id}: {t('leave.balanceNone')}</Tag>
                const over = needHours > 0 && reasonCode === 'CDR16' && b.remainingHours < needHours
                return (
                  <Tag key={id} variant="filled" color={b.remainingHours < 0 ? 'error' : over ? 'warning' : 'success'}>
                    {b.employeeId} · {b.fullName}: {b.remainingHours} {t('leave.hours')}{over ? ` — ${t('leave.overLimit')}` : ''}
                  </Tag>
                )
              })}
            </div>
          </div>
        )}
        {error && <Alert type="error" showIcon title={error} style={{ marginTop: 14 }} />}
        {result && (
          <Alert style={{ marginTop: 14 }} showIcon type={result.created > 0 ? (result.skipped.length ? 'warning' : 'success') : 'error'}
            title={t('req.createdCount', { n: result.created })} description={result.skipped.length > 0 ? <>{result.skipped.map(skipText).join(' · ')}{result.skipped.some((s) => s.reason === 'period_closed') && <div style={{ marginTop: 6 }}><Link to="/attendance/complaints">{t('req.sendFeedback')}</Link></div>}</> : undefined} />
        )}
      </Card>

      <div className="list-table">
        <DataTable<LeaveDraftRow>
          rowKey="id" size="small" sticky={false} scroll={{ x: 1500 }} loading={drafts.isFetching}
          columns={columns} dataSource={drafts.data ?? []}
          rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as number[]) }}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          locale={{ emptyText: <Empty description={t('leave.draftsEmpty')} /> }}
          toolbar={
            <Space wrap>
              <Typography.Text strong>{t('req.drafts')}</Typography.Text>
              <Tag variant="filled" color="processing">{drafts.data?.length ?? 0}</Tag>
              <Popconfirm title={t('req.confirmSubmit', { n: selected.length })} okText={t('req.submit')} cancelText={t('req.cancel')} onConfirm={() => submit.mutate()} disabled={selected.length === 0}>
                <Button type="primary" disabled={selected.length === 0} loading={submit.isPending}>{t('req.submit')} ({selected.length})</Button>
              </Popconfirm>
              <Popconfirm title={t('req.confirmDelete', { n: selected.length })} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate()} disabled={selected.length === 0}>
                <Button danger disabled={selected.length === 0} loading={remove.isPending}>{t('req.delete')} ({selected.length})</Button>
              </Popconfirm>
            </Space>
          }
        />
      </div>
      <EditLeaveDraftModal row={editing} onClose={() => setEditing(null)} />
    </>
  )
}
