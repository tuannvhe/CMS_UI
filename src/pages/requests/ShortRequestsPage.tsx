import { useCallback, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Checkbox, Col, DatePicker, Empty, Input, Popconfirm, Radio, Row, Segmented, Select, Space, Tag, TimePicker, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowRightOutlined, ClockCircleOutlined, LogoutOutlined, RollbackOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { apiErrorCode, lookups, type Approver, type CreateResult, type LastLine, type SubmittedScope } from '../../api/requests'
import { shortRequests, type ShortDraft, type ShortKind, type ShortSubmitted } from '../../api/shortRequests'
import { personColumn, deptColumn, TimeRange } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import { SentFilters, emptySentFilter, filterSent, type SentFilter } from '../../components/SentFilters'
import { fmtDate } from '../../utils/format'
import { mergeVisible } from '../../utils/selection'
import { useToast } from '../../hooks/useToast'
import { useApproverScope } from '../../hooks/useApproverScope'
import { useLastLine } from '../../hooks/useLastLine'
import { AutosaveNote } from '../../components/AutosaveNote'
import { useFormAutosave, useHasSavedDraft } from '../../hooks/useFormAutosave'

const TITLE: Record<ShortKind, string> = { goout: 'nav.goOut', late: 'nav.lateForm', early: 'nav.earlyForm' }
const DESC: Record<ShortKind, string> = { goout: 'nav.goOutDesc', late: 'nav.lateFormDesc', early: 'nav.earlyFormDesc' }
const ICON: Record<ShortKind, JSX.Element> = { goout: <LogoutOutlined />, late: <ClockCircleOutlined />, early: <RollbackOutlined /> }
const STATUS_COLOR = { waiting: 'processing', approved: 'success', rejected: 'error' } as const

const toHm = (d: Dayjs | null) => (d ? d.format('HH:mm') : undefined)

function Step({ n, title }: { n: number; title: string }) {
  return <div className="req-step"><span className="n">{n}</span>{title}</div>
}

/**
 * Đơn ra ngoài / đi muộn / về sớm: tab "Đăng ký" (tạo nháp → gửi duyệt) và tab "Đơn đã gửi".
 * Người duyệt và bảo vệ xác nhận vẫn thao tác ở hệ thống cũ (cùng bảng dữ liệu).
 */
export default function ShortRequestsPage({ kind }: { kind: ShortKind }) {
  const { t } = useTranslation()
  const tabs = [
    { key: 'register', label: t('req.tabRegister') },
    { key: 'submitted', label: t('req.tabSubmitted') },
  ]
  const [tab, setTab] = usePageTab(tabs)
  return (
    <>
      <PageTabs items={tabs} active={tab} onChange={setTab} />
      <div className="page wide">
        <PageBanner
          avatar={<Avatar size={56} icon={ICON[kind]} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
          title={t(TITLE[kind])} subtitle={t(DESC[kind])}
          chips={[`1 · ${t('req.sectionEmployees')}`, `2 · ${t('req.sectionTime')}`, `3 · ${t('sh.approver')}`, `4 · ${t('req.submit')}`]}
        />
        {tab === 'register' ? <RegisterTab kind={kind} /> : <SubmittedTab kind={kind} />}
      </div>
    </>
  )
}

function RegisterTab({ kind }: { kind: ShortKind }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()

  const [department, setDepartment] = useState<string>()
  const [checked, setChecked] = useState<string[]>([])
  const [manual, setManual] = useState('')
  const [filter, setFilter] = useState('')
  const [date, setDate] = useState<Dayjs | null>(dayjs())
  const [dateTo, setDateTo] = useState<Dayjs | null>(null)
  const [timeA, setTimeA] = useState<Dayjs | null>(null)
  const [timeB, setTimeB] = useState<Dayjs | null>(null)
  const [company, setCompany] = useState(false)
  const [comeBack, setComeBack] = useState(false)
  const [backTime, setBackTime] = useState<Dayjs | null>(null)
  const [reason, setReason] = useState('')
  const [approver, setApprover] = useState<string>()
  const [selectedDrafts, setSelectedDrafts] = useState<number[]>([])
  const [result, setResult] = useState<CreateResult | null>(null)
  const [error, setError] = useState('')

  const staleLong = 10 * 60 * 1000
  const departments = useQuery({ queryKey: ['req', 'departments'], queryFn: lookups.departments, staleTime: staleLong })
  const employees = useQuery({ queryKey: ['req', 'employees', department], queryFn: () => lookups.employees(department!), enabled: !!department, staleTime: 60 * 1000 })
  const { scope: approverScope, inferred } = useApproverScope(department, manual)
  const approvers = useQuery({ queryKey: ['req', 'approvers', approverScope], queryFn: () => lookups.approvers(approverScope!), enabled: !!approverScope, staleTime: 60 * 1000 })
  const applyLast = useCallback((line: LastLine, list: Approver[]) => {   // đơn ra ngoài / đi muộn / về sớm lưu email người duyệt: khớp lại theo email
    const email = (line.email ?? '').trim().toLowerCase()
    const hit = list.find((a) => (a.email ?? '').trim().toLowerCase() === email || a.userId.trim().toLowerCase() === email) ?? list.find((a) => a.name === line.name)
    if (hit) setApprover(hit.userId)
  }, [])
  const hasDraft = useHasSavedDraft(`short-${kind}`)
  const lastLine = useLastLine(kind, department, setDepartment, approvers.data, applyLast, manual.trim().length === 0 && !hasDraft)
  const drafts = useQuery({ queryKey: ['short', 'drafts', kind], queryFn: () => shortRequests.drafts(kind) })

  const visibleEmployees = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (employees.data ?? []).filter((e) => !f || e.label.toLowerCase().includes(f))
  }, [employees.data, filter])
  const manualIds = manual.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean)
  const allIds = Array.from(new Set([...checked, ...manualIds]))
  const iso = (d: Dayjs | null) => d?.toISOString() ?? null
  const autosave = useFormAutosave(`short-${kind}`, { department, checked, manual, date: iso(date), dateTo: iso(dateTo), timeA: iso(timeA), timeB: iso(timeB), company, comeBack, backTime: iso(backTime), reason, approver }, allIds.length === 0,
    (d) => {
      const dj = (s: string | null) => (s ? dayjs(s) : null)
      setDepartment(d.department); setChecked(d.checked ?? []); setManual(d.manual ?? ''); setDate(dj(d.date) ?? dayjs()); setDateTo(dj(d.dateTo)); setTimeA(dj(d.timeA)); setTimeB(dj(d.timeB))
      setCompany(!!d.company); setComeBack(!!d.comeBack); setBackTime(dj(d.backTime)); setReason(d.reason ?? ''); setApprover(d.approver)
    })
  const discardDraft = () => {
    autosave.clear()
    setDepartment(undefined); setChecked([]); setManual(''); setDate(dayjs()); setDateTo(null); setTimeA(null); setTimeB(null); setCompany(false); setComeBack(false); setBackTime(null); setReason(''); setApprover(undefined)
  }

  const isGoOut = kind === 'goout'
  const labelA = isGoOut ? t('sh.timeOut') : t('sh.fromTime')
  const timesOk = isGoOut
    ? !!timeA && (!comeBack || (!!backTime && (!!dateTo && !dateTo.isSame(date, 'day') ? true : backTime.isAfter(timeA, 'minute'))))
    : !!timeA && !!timeB && timeB.isAfter(timeA, 'minute')
  const canAdd = allIds.length > 0 && !!date && timesOk && !!reason.trim() && !!approver && (!isGoOut || !dateTo || !dateTo.isBefore(date, 'day'))

  const errMessage = (e: unknown) => {
    const { code, detail } = apiErrorCode(e)
    if (code === 'no_approver') return t('sh.err.approver')
    if (code === 'invalid_range') return t('sh.err.range')
    if (code === 'invalid_input') return t(`sh.err.${detail}`, { defaultValue: t('req.err.invalid_input') })
    if (code === 'not_found') return t('req.err.not_found')
    return t('req.err.generic')
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ['short', 'drafts', kind] })

  const create = useMutation({
    mutationFn: () => shortRequests.create(kind, {
      employeeIds: allIds, date: fmtDate(date!), dateTo: isGoOut && dateTo ? fmtDate(dateTo) : undefined,
      timeFrom: toHm(timeA)!, timeTo: isGoOut ? undefined : toHm(timeB), company: isGoOut && company, comeBack: isGoOut && comeBack,
      comeBackTime: isGoOut && comeBack ? toHm(backTime) : undefined, reason: reason.trim(), approver: { userId: approver },
    }),
    onSuccess: (r) => {
      setResult(r); setError(''); refresh()
      if (r.created > 0) { setChecked([]); setManual(''); autosave.clear(); msg.success(t('req.createdCount', { n: r.created })) } else msg.warning(t('req.createdNone'))
    },
    onError: (e) => { setResult(null); setError(errMessage(e)); msg.error(errMessage(e)) },
  })
  const remove = useMutation({
    mutationFn: () => shortRequests.remove(kind, selectedDrafts),
    onSuccess: () => { msg.success(t('req.deleted')); setSelectedDrafts([]); refresh() },
    onError: (e) => msg.error(errMessage(e)),
  })
  const submit = useMutation({
    mutationFn: () => shortRequests.submit(kind, selectedDrafts),
    onSuccess: (r) => { msg.success(t('req.submitted', { n: r.submitted, code: r.groupId })); setSelectedDrafts([]); refresh(); qc.invalidateQueries({ queryKey: ['short', 'submitted', kind] }) },
    onError: (e) => msg.error(errMessage(e)),
  })

  const onDepartment = (v: string) => { setDepartment(v); setChecked([]); setApprover(undefined); setFilter('') }

  // Hệ thống cũ tìm đơn chờ duyệt theo email người duyệt: người chưa có email không chọn được.
  const approverOptions = (approvers.data ?? []).map((a) => ({
    value: a.userId, disabled: !a.email, label: a.email ? a.name : `${a.name} — ${t('sh.noEmail')}`,
  }))

  const columns: ColumnsType<ShortDraft> = [
    personColumn<ShortDraft>(t('att.name'), 230),
    deptColumn<ShortDraft>(t('att.dept'), 190),
    { title: t('att.date'), width: 190, render: (_: unknown, r) => <DateCell r={r} /> },
    { title: isGoOut ? labelA : `${labelA} → ${t('sh.toTime')}`, width: 150, align: 'center', render: (_: unknown, r) => (isGoOut ? <b>{r.timeFrom}</b> : <TimeRange from={r.timeFrom} to={r.timeTo} />) },
    ...(isGoOut ? [
      { title: t('sh.purpose'), width: 130, render: (_: unknown, r: ShortDraft) => t(r.purpose === 'company' ? 'sh.purposeCompany' : 'sh.purposePersonal') },
      { title: t('sh.comeBack'), width: 120, render: (_: unknown, r: ShortDraft) => r.comeBackTime ?? t('sh.comeBackNo') },
    ] : []),
    { title: t('req.reason'), dataIndex: 'reason', width: 260, ellipsis: { showTitle: true } },
    { title: t('sh.approver'), dataIndex: 'approverName', width: 180 },
  ]

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={10}><div className="req-panel">
            <Step n={1} title={t('req.sectionEmployees')} />
            <Select showSearch allowClear style={{ width: '100%', marginBottom: 10 }} placeholder={t('req.deptPlaceholder')}
              value={department} onChange={onDepartment} onClear={() => onDepartment('')}
              loading={departments.isLoading} options={(departments.data ?? []).map((d) => ({ value: d, label: d }))} />
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
            <Input style={{ marginTop: 10 }} allowClear value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('req.manualIds')} addonBefore={t('att.empId')} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.manualHint')}</Typography.Text>
          </div></Col>

          <Col xs={24} md={12} xl={7}><div className="req-panel">
            <Step n={2} title={t('req.sectionTime')} />
            <Space orientation="vertical" style={{ width: '100%' }} size={10}>
              {isGoOut ? (
                <Space.Compact style={{ width: '100%' }}>
                  <DatePicker style={{ width: '50%' }} format="DD/MM/YYYY" value={date} onChange={setDate} allowClear={false} placeholder={t('att.date')} />
                  <DatePicker style={{ width: '50%' }} format="DD/MM/YYYY" value={dateTo} onChange={setDateTo} placeholder={t('sh.toDate')} />
                </Space.Compact>
              ) : (
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" value={date} onChange={setDate} allowClear={false} placeholder={t('att.date')} />
              )}
              {isGoOut ? (
                <>
                  <HmPicker value={timeA} onChange={setTimeA} placeholder={labelA} />
                  <Radio.Group value={company ? 'company' : 'personal'} onChange={(e) => setCompany(e.target.value === 'company')}>
                    <Radio value="personal">{t('sh.purposePersonal')}</Radio>
                    <Radio value="company">{t('sh.purposeCompany')}</Radio>
                  </Radio.Group>
                  <Radio.Group value={comeBack ? 'yes' : 'no'} onChange={(e) => setComeBack(e.target.value === 'yes')}>
                    <Radio value="no">{t('sh.comeBackNo')}</Radio>
                    <Radio value="yes">{t('sh.comeBackYes')}</Radio>
                  </Radio.Group>
                  {comeBack && <HmPicker value={backTime} onChange={setBackTime} placeholder={t('sh.comeBackTime')} />}
                </>
              ) : (
                <Space.Compact style={{ width: '100%' }}>
                  <HmPicker value={timeA} onChange={setTimeA} placeholder={labelA} />
                  <HmPicker value={timeB} onChange={setTimeB} placeholder={t('sh.toTime')} />
                </Space.Compact>
              )}
              <Input.TextArea rows={3} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('sh.reasonPh')} />
            </Space>
          </div></Col>

          <Col xs={24} md={12} xl={7}><div className="req-panel">
            <Step n={3} title={t('sh.approver')} />
            <Space orientation="vertical" style={{ width: '100%' }} size={10}>
              <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" placeholder={t('sh.approver')}
                value={approver} onChange={setApprover} disabled={!approverScope} options={approverOptions} />
              {inferred && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.scopeOf', { scope: inferred })}</Typography.Text>}
              {lastLine && department === lastLine.scope && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.lastLineHint')}</Typography.Text>}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('sh.approverHint')}</Typography.Text>
              <AutosaveNote savedAt={autosave.savedAt} restoredAt={autosave.restoredAt} onDiscard={discardDraft} />
              <div className="req-summary">
                {allIds.length > 0 && <span className="chip">{t('req.countSelectedShort', { n: allIds.length })}</span>}
                {date && <span className="chip">{date.format('DD/MM/YYYY')}</span>}
                {timeA && <span className="chip">{toHm(timeA)}{!isGoOut && timeB ? ` → ${toHm(timeB)}` : ''}</span>}
              </div>
              <Button type="primary" size="large" block disabled={!canAdd} loading={create.isPending} onClick={() => create.mutate()}>
                {t('req.add')}{allIds.length > 0 ? ` (${allIds.length})` : ''}
              </Button>
            </Space>
          </div></Col>
        </Row>

        {error && <Alert type="error" showIcon title={error} style={{ marginTop: 14 }} />}
        {result && (
          <Alert style={{ marginTop: 14 }} showIcon type={result.created > 0 ? (result.skipped.length ? 'warning' : 'success') : 'error'}
            title={t('req.createdCount', { n: result.created })}
            description={result.skipped.length > 0 ? result.skipped.map((s) => `${s.employeeId}: ${t(`req.skip.${s.reason}`, { detail: s.detail ?? '' })}`).join(' · ') : undefined} />
        )}
      </Card>

      <div className="list-table">
        <DataTable<ShortDraft>
          rowKey="id" size="small" sticky={false} scroll={{ x: 1300 }}
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
    </>
  )
}

/** Ô chọn giờ HH:mm (gõ trực tiếp hoặc chọn). */
function HmPicker({ value, onChange, placeholder }: { value: Dayjs | null; onChange: (d: Dayjs | null) => void; placeholder: string }) {
  return <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} showNow={false} needConfirm={false} value={value} onChange={onChange} placeholder={placeholder} />
}

function DateCell({ r }: { r: ShortDraft }) {
  const d = dayjs(r.date).format('DD/MM/YYYY')
  return r.dateTo && !dayjs(r.dateTo).isSame(dayjs(r.date), 'day')
    ? <b>{d} <ArrowRightOutlined style={{ fontSize: 11 }} /> {dayjs(r.dateTo).format('DD/MM/YYYY')}</b>
    : <b>{d}</b>
}

function SubmittedTab({ kind }: { kind: ShortKind }) {
  const { t } = useTranslation()
  const isGoOut = kind === 'goout'
  const [scope, setScope] = useState<SubmittedScope>('sent')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().add(1, 'month').endOf('month')])
  const [applied, setApplied] = useState({ range, scope: 'sent' as SubmittedScope, sender: '' })
  const [filter, setFilter] = useState<SentFilter>(emptySentFilter)

  const q = useQuery({
    queryKey: ['short', 'submitted', kind, fmtDate(applied.range[0]), fmtDate(applied.range[1]), applied.scope, applied.sender],
    queryFn: () => shortRequests.submitted(kind, fmtDate(applied.range[0]), fmtDate(applied.range[1]), applied.scope, applied.sender),
    retry: false, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 60_000,
  })
  const all = q.data ?? []
  const rows = useMemo(() => filterSent(all, filter), [all, filter])

  const code = q.isError ? apiErrorCode(q.error).code : ''
  const errText = !q.isError ? '' : code === 'range_too_long' ? t('req.err.range_too_long') : code === 'invalid_range' ? t('att.invalid_range') : code === 'forbidden' ? t('att.forbidden') : code === 'not_found' ? t('att.noEmployee') : t('req.err.generic')

  const columns: ColumnsType<ShortSubmitted> = [
    personColumn<ShortSubmitted>(t('att.name'), 230),
    deptColumn<ShortSubmitted>(t('att.dept'), 190),
    { title: t('att.date'), width: 190, render: (_: unknown, r) => <DateCell r={r} /> },
    { title: isGoOut ? t('sh.timeOut') : `${t('sh.fromTime')} → ${t('sh.toTime')}`, width: 150, align: 'center', render: (_: unknown, r) => (isGoOut ? <b>{r.timeFrom}</b> : <TimeRange from={r.timeFrom} to={r.timeTo} />) },
    ...(isGoOut ? [
      { title: t('sh.purpose'), width: 120, render: (_: unknown, r: ShortSubmitted) => t(r.purpose === 'company' ? 'sh.purposeCompany' : 'sh.purposePersonal') },
      { title: t('sh.comeBack'), width: 110, render: (_: unknown, r: ShortSubmitted) => r.comeBackTime ?? t('sh.comeBackNo') },
    ] : []),
    { title: t('req.reason'), dataIndex: 'reason', width: 240, ellipsis: { showTitle: true } },
    {
      title: t('req.sender'), width: 150,
      render: (_: unknown, r) => (
        <div style={{ lineHeight: 1.25 }}>
          <div>{r.senderName || r.senderId}</div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{r.senderId}{r.submittedAt ? ` · ${dayjs(r.submittedAt).format('DD/MM HH:mm')}` : ''}</div>
        </div>
      ),
    },
    { title: t('sh.approver'), dataIndex: 'approverName', width: 170, ellipsis: true },
    {
      title: t('req.overall'), width: 130, align: 'center',
      render: (_: unknown, r) => {
        const tag = <Tag color={STATUS_COLOR[r.overall]} variant="filled">{t(`req.status.${r.overall}`)}</Tag>
        return r.rejectReason ? <Tooltip title={r.rejectReason}>{tag}</Tooltip> : tag
      },
    },
    { title: t('sh.decidedAt'), width: 130, render: (_: unknown, r) => (r.decidedAt ? dayjs(r.decidedAt).format('DD/MM/YYYY HH:mm') : <span className="cell-muted">—</span>) },
    {
      title: t('sh.security'), width: 190,
      render: (_: unknown, r) => (r.securityName ? <span>{r.securityName}{r.securityAt ? ` · ${dayjs(r.securityAt).format('DD/MM HH:mm')}` : ''}</span> : <span className="cell-muted">{t('sh.securityNone')}</span>),
    },
  ]

  return (
    <>
      {errText && <Alert type="error" showIcon title={errText} style={{ marginBottom: 16 }} />}
      <div className="list-table">
        <DataTable<ShortSubmitted>
          rowKey="id" size="small" sticky={false} scroll={{ x: 1700 }}
          loading={q.isFetching} columns={columns} dataSource={rows} rowClassName={(r) => `row-st-${r.overall}`}
          locale={{ emptyText: <Empty description={t('req.submittedEmpty')} /> }}
          pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
          toolbar={
            <div className="dt-rows">
              <div className="dt-row">
                <Segmented<SubmittedScope> value={scope} onChange={setScope}
                  options={[
                    { value: 'sent', label: t('req.scopeSent') },
                    { value: 'mine', label: t('req.scopeMine') },
                  ]} />
                <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
                <Button type="primary" loading={q.isFetching} onClick={() => setApplied({ range, scope, sender: '' })}>{t('att.query')}</Button>
              </div>
              <div className="dt-row dt-row-filters">
                <SentFilters rows={all} value={filter} onChange={setFilter} shown={rows.length} />
              </div>
            </div>
          }
        />
      </div>
    </>
  )
}
