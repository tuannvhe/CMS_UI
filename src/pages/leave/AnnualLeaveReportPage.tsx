import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Input, InputNumber, Select, Space, Switch, Tabs, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, EditOutlined, FundOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { apiError, leaveApi, type AnnualLeaveRow, type LeaveInput, type LeavePreview, type LeaveReportFilter } from '../../api/healthLeave'
import { AppModal } from '../../components/AppModal'
import { DataTable, MiniTable } from '../../components/DataTable'
import { ImportWizard, IssueList, StatTiles } from '../../components/ImportWizard'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const WARN = ['over_used', 'missing_start_date', 'duplicate', 'unusual_hours', 'no_leave_start']
const dayText = (d: number) => `${Math.round(d * 100) / 100}`

function ReportTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [year, setYear] = useState(dayjs().year())
  const [date, setDate] = useState<Dayjs>(dayjs())
  const [employee, setEmployee] = useState('')
  const [department, setDepartment] = useState<string>()
  const [applied, setApplied] = useState<LeaveReportFilter>({ year: dayjs().year(), date: dayjs().format('YYYY-MM-DD') })
  const [editing, setEditing] = useState<AnnualLeaveRow | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  const [hideResigned, setHideResigned] = useState(true)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const departments = useQuery({ queryKey: ['leave', 'departments'], queryFn: leaveApi.departments, staleTime: 60_000 })
  const q = useQuery({ queryKey: ['leave', 'report', applied], queryFn: () => leaveApi.report(applied), placeholderData: (p) => p, retry: false })

  const apply = () => setApplied({ year, date: date.format('YYYY-MM-DD'), employeeId: employee.trim(), department })
  const save = useMutation({
    mutationFn: () => leaveApi.updateMonths(editing!.id, draft),
    onSuccess: () => { msg.success(t('usr.saved')); setEditing(null); qc.invalidateQueries({ queryKey: ['leave'] }) },
    onError: (e) => msg.error(apiError(e).detail === 'hours' ? t('al.err.hours') : t('cls.err.generic')),
  })
  const rows = (q.data ?? []).filter((r) => (!hideResigned || !r.flags.includes('resigned')) && (!onlyIssues || r.flags.some((f) => WARN.includes(f))))
  const open = (r: AnnualLeaveRow) => { setEditing(r); setDraft(r.months.map((m) => (Number(m) === 0 ? '' : m))) }

  const columns: ColumnsType<AnnualLeaveRow> = [
    { title: t('sys.colEmp'), dataIndex: 'code', width: 100, fixed: 'left' },
    { title: t('att.name'), dataIndex: 'fullName', width: 190, fixed: 'left', ellipsis: true },
    { title: t('att.dept'), dataIndex: 'department', width: 170, ellipsis: true },
    { title: t('emi.statusWorking'), dataIndex: 'statusWorking', width: 90 },
    { title: t('al.startCalc'), dataIndex: 'dateStart', width: 110, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '') },
    { title: t('al.serviceYears'), dataIndex: 'serviceMonths', width: 90, align: 'right', render: (v: number) => (v / 12).toFixed(1) },
    { title: t('al.accrualMonths'), dataIndex: 'accrualMonths', width: 90, align: 'right' },
    { title: t('al.seniorityDays'), dataIndex: 'seniorityDays', width: 90, align: 'right' },
    { title: t('al.entitled'), dataIndex: 'entitledDays', width: 100, align: 'right', render: (v: number) => <b>{dayText(v)}</b> },
    ...MONTHS.map((m) => ({
      title: String(m), width: 52, align: 'right' as const,
      render: (_: unknown, r: AnnualLeaveRow) => { const v = r.monthDays[m - 1]; return v ? <Tooltip title={r.usedSource === 'hr' && r.months[m - 1] ? `${t('al.hrEntered')}: ${r.months[m - 1]} ${t('al.hoursUnit')}` : undefined}>{dayText(v)}</Tooltip> : <span className="cell-muted">-</span> },
    })),
    { title: t('al.used'), dataIndex: 'usedDays', width: 90, align: 'right', render: (v: number) => dayText(v) },
    { title: t('al.remaining'), dataIndex: 'remainingDays', width: 100, align: 'right', render: (v: number) => <Tag color={v < 0 ? 'red' : v === 0 ? 'default' : 'green'} variant="filled" style={{ margin: 0 }}>{dayText(v)}</Tag> },
    {
      title: t('al.flagsCol'), dataIndex: 'flags', width: 190,
      render: (f: string[]) => f.map((x) => <Tooltip key={x} title={t(`al.flag.${x}`)}><Tag color={WARN.includes(x) ? 'orange' : 'default'} variant="filled">{t(`al.flagShort.${x}`)}</Tag></Tooltip>),
    },
    { title: '', width: 60, fixed: 'right', render: (_: unknown, r) => (r.id > 0 && r.usedSource === 'hr' ? <Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(r)} /> : null) },
  ]

  return (
    <>
      <DataTable<AnnualLeaveRow>
        rowKey={(r) => (r.id > 0 ? `r${r.id}` : `v${r.code}`)} size="small" sticky={false} scroll={{ x: 2050 }} loading={q.isFetching} columns={columns} dataSource={rows}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200], showTotal: (n: number) => n.toLocaleString() }}
        locale={{ emptyText: q.isError ? t('cls.err.generic') : t('req.submittedEmpty') }}
        toolbar={(
          <Space wrap>
            <InputNumber min={2000} max={2100} value={year} onChange={(v) => v && setYear(v)} addonBefore={t('al.year')} style={{ width: 150 }} />
            <DatePicker value={date} onChange={(d) => d && setDate(d)} allowClear={false} format="DD/MM/YYYY" />
            <Input allowClear style={{ width: 150 }} placeholder={t('sys.colEmp')} value={employee} onChange={(e) => setEmployee(e.target.value)} onPressEnter={apply} />
            <Select allowClear showSearch style={{ width: 220 }} placeholder={t('att.dept')} value={department} onChange={setDepartment} options={(departments.data ?? []).map((d) => ({ value: d, label: d }))} />
            <Button type="primary" onClick={apply}>{t('al.view')}</Button>
            <Switch size="small" checked={hideResigned} onChange={setHideResigned} /> <span>{t('al.hideResigned')}</span>
            <Switch size="small" checked={onlyIssues} onChange={setOnlyIssues} /> <span>{t('al.onlyIssues')}</span>
            <Button icon={<DownloadOutlined />} onClick={() => leaveApi.exportReport(applied).catch(() => msg.error(t('cls.err.generic')))}>{t('cls.export')}</Button>
          </Space>
        )}
      />
      <AppModal open={editing !== null} onClose={() => setEditing(null)} size="md" icon={<EditOutlined />} title={t('al.editTitle')} subtitle={editing ? `${editing.fullName} · ${editing.code} · ${editing.year}` : undefined}
        okText={t('req.saveChanges')} okLoading={save.isPending} onOk={() => save.mutate()}>
        <Typography.Paragraph type="secondary">{t('al.editHint')}</Typography.Paragraph>
        <div className="al-edit">
          {MONTHS.map((m) => (
            <label key={m}>
              <span>{t('al.month', { n: m })}</span>
              <Input value={draft[m - 1] ?? ''} maxLength={5} inputMode="decimal" onChange={(e) => setDraft((d) => d.map((x, i) => (i === m - 1 ? e.target.value : x)))} />
            </label>
          ))}
        </div>
      </AppModal>
    </>
  )
}

function ImportTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const sampleCols: ColumnsType<LeaveInput> = [
    { title: t('cls.row', { n: '' }).replace(/\s*$/, ''), dataIndex: 'excelRow', width: 70 },
    { title: t('sys.colEmp'), dataIndex: 'employeeId', width: 110 },
    { title: t('al.year'), dataIndex: 'year', width: 80 },
    { title: t('al.startCalc'), dataIndex: 'dateStart', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    ...MONTHS.map((m) => ({ title: String(m), width: 50, align: 'right' as const, render: (_: unknown, r: LeaveInput) => r.months[m - 1] || '-' })),
  ]
  return (
    <ImportWizard<LeavePreview, { inserted: number; updated: number }>
      noteTitle={t('al.noteTitle')} note={t('al.importNote')} dropText={t('al.drop')}
      preview={leaveApi.preview} commit={leaveApi.commit} template={leaveApi.template}
      confirmLabel={(p) => t('al.confirm', { n: p.totalRows })} doneTitle={t('al.doneTitle')} doneText={(r) => t('hl.doneText', { inserted: r.inserted, updated: r.updated })}
      onDone={() => qc.invalidateQueries({ queryKey: ['leave'] })}
      renderPreview={(p) => (
        <>
          <StatTiles items={[
            { label: t('cls.rows'), value: p.totalRows }, { label: t('cls.errorsN'), value: p.errors.length, color: p.errors.length ? '#D92D20' : '#98A2B3' },
            { label: t('cls.ignoredN'), value: p.ignoredRows, color: '#98A2B3' }, { label: t('cls.unknownN'), value: p.unknownEmployees, color: p.unknownEmployees ? '#D48806' : '#98A2B3' },
          ]} />
          {p.totalRows === 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('al.empty')} />}
          {p.unknownEmployees > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('cls.unknownText', { n: p.unknownEmployees })} />}
          {p.years.some((y) => y.updated > 0) && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('al.overwrite')} />}
          <IssueList title={t('cls.errors')} type="error" items={p.errors} issueKey="al.issue" />
          <IssueList title={t('cls.warnings')} type="warning" items={p.warnings} issueKey="al.issue" />
          {p.totalRows > 0 && (
            <>
              <div className="ci-periods">
                {p.years.map((y) => (
                  <div key={y.year} className="ci-period"><b>{y.year}</b><span>{t('cls.rowsN', { n: y.rows })}</span><span className="ci-chip new">{t('cls.newN', { n: y.new })}</span><span className="ci-chip upd">{t('cls.updN', { n: y.updated })}</span></div>
                ))}
              </div>
              <Typography.Text type="secondary">{t('cls.sampleOf', { n: p.sample.length, total: p.totalRows })}</Typography.Text>
              <MiniTable<LeaveInput> rowKey="excelRow" size="small" pagination={false} columns={sampleCols} dataSource={p.sample} scroll={{ x: 1000 }} style={{ marginTop: 8 }} />
            </>
          )}
        </>
      )} />
  )
}

/** Báo cáo phép năm toàn công ty (số phép tính bằng proc cũ), sửa số giờ nghỉ từng tháng và nhập danh sách phép năm từ Excel. */
export default function AnnualLeaveReportPage() {
  const { t } = useTranslation()
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<FundOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.annualReport')} subtitle={t('nav.annualReportDesc')} />
      <Tabs items={[
        { key: 'report', label: t('al.tabReport'), children: <ReportTab /> },
        { key: 'import', label: t('cls.tabImport'), children: <ImportTab /> },
      ]} />
    </div>
  )
}
