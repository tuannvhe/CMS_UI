import { useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Col, DatePicker, Empty, Input, Popconfirm, Row, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import {
  apiErrorCode, lookups, requests,
  type ApproversInput, type CreateResult, type DraftRow, type RequestKind,
} from '../../api/requests'
import { personColumn, deptColumn, ShiftChip, DayChip, TimeRange, AmountBadge } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { ApproverEmailWarning, approverOption, noEmailNames } from '../../components/ApproverEmailWarning'
import { EditDraftModal, otRangeText } from './EditDraftModal'
import { fmtDate, localDayName } from '../../utils/format'
import { mergeVisible } from '../../utils/selection'
import { useToast } from '../../hooks/useToast'

/**
 * Thời lượng hiển thị. Vân tay: như bản cũ, giá trị tuyệt đối của (đến − từ). Tăng ca: giờ kết thúc ≤ giờ bắt đầu nghĩa là qua nửa đêm
 * (23:30 → 07:00 hôm sau = 7,5 giờ), giống cách máy chủ tính và lưu.
 */
function duration(from: string, to: string, overnight: boolean) {
  const m = (s: string) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm }
  if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) return null
  let minutes = m(to) - m(from)
  if (overnight) { if (minutes <= 0) minutes += 24 * 60 } else minutes = Math.abs(minutes)
  return minutes > 0 ? { minutes, hours: Number((minutes / 60).toFixed(2)) } : null
}

function Step({ n, title }: { n: number; title: string }) {
  return <div className="req-step"><span className="n">{n}</span>{title}</div>
}

/**
 * Đăng ký quên vân tay / tăng ca theo flow cũ:
 * chọn bộ phận → nhân viên → ngày, ca, giờ, lý do, người duyệt → "Thêm" (lưu NHÁP) → chọn nháp → "Gửi duyệt".
 */
export default function RegisterTab({ kind }: { kind: RequestKind }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()

  const [params] = useSearchParams()
  const [department, setDepartment] = useState<string | undefined>(params.get('department') || undefined)   // đường tắt từ bảng công điền sẵn bộ phận
  const [checked, setChecked] = useState<string[]>([])
  const [manual, setManual] = useState(params.get('employee') ?? '')
  const [filter, setFilter] = useState('')
  const [date, setDate] = useState<Dayjs | null>(params.get('date') && dayjs(params.get('date')).isValid() ? dayjs(params.get('date')) : null)
  const [shift, setShift] = useState<string>()
  const [timeA, setTimeA] = useState<string>()
  const [timeB, setTimeB] = useState<string>()
  const [reasonCode, setReasonCode] = useState<string>()
  const [reasonText, setReasonText] = useState('')
  const [apOne, setApOne] = useState<string>()
  const [apTwo, setApTwo] = useState<string>()
  const [apThree, setApThree] = useState<string>()
  const [selectedDrafts, setSelectedDrafts] = useState<number[]>([])
  const [result, setResult] = useState<CreateResult | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<DraftRow | null>(null)

  const staleLong = 10 * 60 * 1000
  const departments = useQuery({ queryKey: ['req', 'departments'], queryFn: lookups.departments, staleTime: staleLong })
  const shifts = useQuery({ queryKey: ['req', 'shifts'], queryFn: lookups.shifts, staleTime: staleLong })
  const reasons = useQuery({ queryKey: ['req', 'reasons'], queryFn: lookups.fingerReasons, staleTime: staleLong, enabled: kind === 'finger' })
  const employees = useQuery({
    queryKey: ['req', 'employees', department], queryFn: () => lookups.employees(department!), enabled: !!department, staleTime: 60 * 1000,
  })
  const approvers = useQuery({
    queryKey: ['req', 'approvers', department], queryFn: () => lookups.approvers(department!), enabled: !!department, staleTime: 60 * 1000,
  })
  const times = useQuery({
    queryKey: ['req', 'times', kind, shift], queryFn: () => lookups.times(kind, shift!), enabled: !!shift, staleTime: staleLong,
  })
  const drafts = useQuery({ queryKey: ['req', 'drafts', kind], queryFn: () => requests.drafts(kind) })

  const otherReason = kind === 'finger' && reasons.data?.find((r) => r.value === reasonCode)?.label === 'Lý do khác'
  const dur = timeA && timeB ? duration(timeA, timeB, kind === 'overtime') : null
  const dayName = date ? date.toDate().toLocaleDateString(i18n.language, { weekday: 'long' }) : ''

  const visibleEmployees = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (employees.data ?? []).filter((e) => !f || e.label.toLowerCase().includes(f))
  }, [employees.data, filter])

  const manualIds = manual.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean)
  const allIds = Array.from(new Set([...checked, ...manualIds]))

  const approverOptions = (approvers.data ?? []).map(approverOption)
  const pick = (userId?: string) => (userId ? { userId, name: approvers.data?.find((a) => a.userId === userId)?.name } : undefined)
  const approversInput: ApproversInput = { one: pick(apOne), two: pick(apTwo), three: pick(apThree) }

  const reasonOk = kind === 'finger' ? !!reasonCode && (!otherReason || !!reasonText.trim()) : !!reasonText.trim()
  const canAdd = allIds.length > 0 && !!date && !!shift && !!dur && reasonOk && !!(apOne || apTwo || apThree)

  const errMessage = (e: unknown) => {
    const { code, detail } = apiErrorCode(e)
    if (code === 'no_approver') return t('req.err.no_approver')
    if (code === 'invalid_input') return `${t('req.err.invalid_input')}${detail ? ` (${detail})` : ''}`
    if (code === 'not_found') return t('req.err.not_found')
    return t('req.err.generic')
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ['req', 'drafts', kind] })

  const create = useMutation({
    mutationFn: () => {
      const base = { employeeIds: allIds, date: fmtDate(date!), shift: shift!, approvers: approversInput }
      return kind === 'finger'
        ? requests.create('finger', { ...base, timeIn: timeA!, timeOut: timeB!, reasonCode: reasonCode!, reasonText: reasonText.trim() || undefined })
        : requests.create('overtime', { ...base, timeStart: timeA!, timeEnd: timeB!, reasonText: reasonText.trim() })
    },
    onSuccess: (r) => {
      setResult(r); setError(''); refresh()
      if (r.created > 0) { setChecked([]); setManual(''); msg.success(t('req.createdCount', { n: r.created })) } else msg.warning(t('req.createdNone'))
    },
    onError: (e) => { setResult(null); setError(errMessage(e)); msg.error(errMessage(e)) },
  })

  const remove = useMutation({
    mutationFn: () => requests.remove(kind, selectedDrafts),
    onSuccess: () => { msg.success(t('req.deleted')); setSelectedDrafts([]); refresh() },
    onError: (e) => msg.error(errMessage(e)),
  })

  const submit = useMutation({
    mutationFn: () => requests.submit(kind, selectedDrafts),
    onSuccess: (r) => {
      msg.success(t('req.submitted', { n: r.submitted, code: r.groupId }))
      setSelectedDrafts([]); refresh(); qc.invalidateQueries({ queryKey: ['req', 'submitted', kind] })
    },
    onError: (e) => msg.error(errMessage(e)),
  })

  const onDepartment = (v: string) => {
    setDepartment(v); setChecked([]); setApOne(undefined); setApTwo(undefined); setApThree(undefined); setFilter('')
  }
  const onShift = (v: string) => { setShift(v); setTimeA(undefined); setTimeB(undefined) }

  const timeOptions = (list?: string[]) => (list ?? []).map((x) => ({ value: x, label: x }))
  const labelA = kind === 'finger' ? t('req.timeIn') : t('req.otFrom')
  const labelB = kind === 'finger' ? t('req.timeOut') : t('req.otTo')

  const columns: ColumnsType<DraftRow> = [
    personColumn<DraftRow>(t('att.name'), 230),
    deptColumn<DraftRow>(t('att.dept'), 190),
    { title: t('att.date'), dataIndex: 'date', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('att.day'), dataIndex: 'dayName', width: 100, render: (v: string) => <DayChip raw={v} label={localDayName(v, i18n.language)} /> },
    { title: t('att.shift'), dataIndex: 'shift', width: 110, render: (v: string) => <ShiftChip value={v} /> },
    { title: `${labelA} → ${labelB}`, width: 150, align: 'center', render: (_: unknown, r: DraftRow) => <TimeRange from={r.timeFrom} to={r.timeTo} /> },
    { title: t('req.hours'), dataIndex: 'hours', width: 90, align: 'center', render: (v: string) => <AmountBadge value={v} unit={t('apr.hours')} /> },
    { title: t('req.minutes'), dataIndex: 'minutes', width: 90, align: 'right' },
    { title: t('req.reason'), dataIndex: 'reason', width: 230, ellipsis: { showTitle: true } },
    {
      title: t('req.sectionApprovers'), width: 300,
      render: (_: unknown, r: DraftRow) => {
        const rows: [string, string][] = [[t('req.shortOne'), r.approverOne], [t('req.shortTwo'), r.approverTwo], [t('req.shortThree'), r.approverThree]]
        const used = rows.filter(([, n]) => n && !/^no need/i.test(n))
        return used.length === 0 ? '—' : (
          <div style={{ display: 'grid', gap: 2 }}>
            {used.map(([l, n]) => (
              <div key={l} style={{ display: 'flex', gap: 8 }}>
                <span style={{ width: 98, flex: 'none', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--c-muted)' }}>{l}</span><span>{n}</span>
              </div>
            ))}
          </div>
        )
      },
    },
    { title: '', width: 80, align: 'center', render: (_: unknown, r: DraftRow) => <Button size="small" onClick={() => setEditing(r)}>{t('req.edit')}</Button> },
  ]

  const skipText = (s: { employeeId: string; reason: string; detail?: string | null }) => `${s.employeeId}: ${t(`req.skip.${s.reason}`, { detail: s.reason === 'overlap_ot' ? otRangeText(s.detail) : (s.detail ?? '') })}`
  const warnText = (s: { employeeId: string; reason: string; detail?: string | null }) => `${s.employeeId}: ${t(`req.warn.${s.reason}`, { detail: s.detail ?? '' })}`

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={10}><div className="req-panel">
            <Step n={1} title={t('req.sectionEmployees')} />
            <Select
              showSearch allowClear style={{ width: '100%', marginBottom: 10 }} placeholder={t('req.deptPlaceholder')}
              value={department} onChange={onDepartment} onClear={() => onDepartment('')}
              loading={departments.isLoading} options={(departments.data ?? []).map((d) => ({ value: d, label: d }))}
            />
            {department && (
              <>
                <Space style={{ marginBottom: 8 }} wrap>
                  <Input allowClear placeholder={t('req.filterEmp')} value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 200 }} />
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
            <Input
              style={{ marginTop: 10 }} allowClear value={manual} onChange={(e) => setManual(e.target.value)}
              placeholder={t('req.manualIds')} addonBefore={t('att.empId')}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.manualHint')}</Typography.Text>
          </div></Col>

          <Col xs={24} md={12} xl={7}><div className="req-panel">
            <Step n={2} title={t('req.sectionTime')} />
            <Space orientation="vertical" style={{ width: '100%' }} size={10}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" value={date} onChange={setDate} placeholder={t('req.date')} />
              {dayName && <Typography.Text type="secondary">{t('req.dayOfWeek')}: <b>{dayName}</b></Typography.Text>}
              <Select style={{ width: '100%' }} placeholder={t('att.shift')} value={shift} onChange={onShift} loading={shifts.isLoading}
                options={(shifts.data ?? []).map((s) => ({ value: s.value, label: s.label }))} />
              <Space.Compact style={{ width: '100%' }}>
                <Select style={{ width: '50%' }} placeholder={labelA} value={timeA} onChange={setTimeA} disabled={!shift} options={timeOptions(times.data?.start)} showSearch />
                <Select style={{ width: '50%' }} placeholder={labelB} value={timeB} onChange={setTimeB} disabled={!shift} options={timeOptions(times.data?.end)} showSearch />
              </Space.Compact>
              {dur && <Typography.Text>{t('req.total')}: <b>{dur.hours}</b> {t('att.hours')} ({dur.minutes} {t('req.minutesUnit')})</Typography.Text>}
              {kind === 'finger' ? (
                <>
                  <Select style={{ width: '100%' }} placeholder={t('req.reason')} value={reasonCode} onChange={setReasonCode} loading={reasons.isLoading}
                    options={(reasons.data ?? []).map((r) => ({ value: r.value, label: r.label }))} />
                  {otherReason && <Input.TextArea rows={2} value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder={t('req.reasonOtherPlaceholder')} />}
                </>
              ) : (
                <Input.TextArea rows={3} value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder={t('req.reasonPlaceholder')} />
              )}
            </Space>
          </div></Col>

          <Col xs={24} md={12} xl={7}><div className="req-panel">
            <Step n={3} title={t('req.sectionApprovers')} />
            <Space orientation="vertical" style={{ width: '100%' }} size={10}>
              <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" placeholder={t('req.approverOne')} value={apOne} onChange={setApOne} disabled={!department} options={approverOptions} />
              <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" placeholder={t('req.approverTwo')} value={apTwo} onChange={setApTwo} disabled={!department} options={approverOptions} />
              <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" placeholder={t('req.approverThree')} value={apThree} onChange={setApThree} disabled={!department} options={approverOptions} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.approverHint')}</Typography.Text>
              <ApproverEmailWarning names={noEmailNames(approvers.data, [apOne, apTwo, apThree])} />
              <div className="req-summary">
                {allIds.length > 0 && <span className="chip">{t('req.countSelectedShort', { n: allIds.length })}</span>}
                {date && <span className="chip">{date.format('DD/MM/YYYY')}</span>}
                {dur && <span className="chip">{dur.hours} {t('att.hours')}</span>}
              </div>
              <Button type="primary" size="large" block disabled={!canAdd} loading={create.isPending} onClick={() => create.mutate()}>
                {t('req.add')}{allIds.length > 0 ? ` (${allIds.length})` : ''}
              </Button>
            </Space>
          </div></Col>
        </Row>

        {error && <Alert type="error" showIcon title={error} style={{ marginTop: 14 }} />}
        {result && (
          <Alert
            style={{ marginTop: 14 }} showIcon type={result.created > 0 ? (result.skipped.length ? 'warning' : 'success') : 'error'}
            title={t('req.createdCount', { n: result.created })}
            description={(
              <>
                {[...result.skipped.map(skipText), ...(result.warnings ?? []).map(warnText)].join(' · ')}
                {result.skipped.some((s) => s.reason === 'period_closed') && <div style={{ marginTop: 6 }}><Link to={`/attendance/complaints${date ? `?date=${date.format('YYYY-MM-DD')}` : ''}`}>{t('req.sendFeedback')}</Link></div>}
              </>
            )}
          />
        )}
      </Card>

      <div className="list-table">
        <DataTable<DraftRow>
          rowKey="id" size="small" sticky={false} scroll={{ x: 1400 }}
          loading={drafts.isFetching} columns={columns} dataSource={drafts.data ?? []}
          rowSelection={{ selectedRowKeys: selectedDrafts, onChange: (k) => setSelectedDrafts(k as number[]) }}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          locale={{ emptyText: <Empty description={t('req.draftsEmpty')} /> }}
          toolbar={
            <Space wrap>
              <Typography.Text strong>{t('req.drafts')}</Typography.Text>
              <Tag variant="filled" color="processing">{drafts.data?.length ?? 0}</Tag>
              <Popconfirm title={t('req.confirmSubmit', { n: selectedDrafts.length })} okText={t('req.submit')} cancelText={t('req.cancel')} onConfirm={() => submit.mutate()} disabled={selectedDrafts.length === 0}>
                <Button type="primary" disabled={selectedDrafts.length === 0} loading={submit.isPending}>{t('req.submit')} ({selectedDrafts.length})</Button>
              </Popconfirm>
              <Popconfirm title={t('req.confirmDelete', { n: selectedDrafts.length })} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate()} disabled={selectedDrafts.length === 0}>
                <Button danger disabled={selectedDrafts.length === 0} loading={remove.isPending}>{t('req.delete')} ({selectedDrafts.length})</Button>
              </Popconfirm>
            </Space>
          }
        />
      </div>
      <EditDraftModal kind={kind} row={editing} onClose={() => setEditing(null)} />
    </>
  )
}
