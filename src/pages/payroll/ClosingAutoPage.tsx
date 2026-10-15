import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Input, Modal, Progress, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalculatorOutlined, DownloadOutlined, EditOutlined, LockOutlined, PlayCircleOutlined, ReloadOutlined, RobotOutlined, UnlockOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CLOSING_AUTO_TABLES_SQL, closingAuto, type ClosingAutoRow, type ClosingAutoSummary } from '../../api/closingAuto'
import { CLOSED_FIELDS } from '../../api/closedAttendance'
import { payrollError } from '../../api/payroll'
import { CLOSING_AUTO_DIRECT } from '../../config/features'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/ImportWizard'
import { SqlNotReady } from '../../components/SqlNotReady'
import { ClosingAutoEdit } from './ClosingAutoEdit'
import { useToast } from '../../hooks/useToast'

const PAGE_SIZE = 25
const ISSUE_COLOR: Record<string, string> = { no_attendance: 'red', absent_workdays: 'volcano', manual_days: 'gold', started_mid_month: 'blue', left_mid_month: 'blue', no_employee_record: 'red', hy_no_punch: 'purple', multi_forms: 'magenta', ot_short: 'cyan', pending_forms: 'geekblue', ot_overlap: 'lime' }
const ISSUE_ORDER = ['no_attendance', 'absent_workdays', 'manual_days', 'started_mid_month', 'left_mid_month', 'no_employee_record', 'hy_no_punch', 'multi_forms', 'ot_short', 'ot_overlap', 'pending_forms']

/** Kỳ gợi ý: 6 tháng gần nhất, bắt đầu từ tháng trước. */
function periods() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` })
}

/** Chốt công tự động: hệ thống tự tổng hợp công cả tháng từ chấm công theo ngày, so với chốt công HR đã nhập, tô sáng người cần xem lại, tải file Excel nháp và tính lương ngay. */
export default function ClosingAutoPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [period, setPeriod] = useState(() => { const p = params.get('period'); return p && periods().includes(p) ? p : periods()[0] })
  const [group, setGroup] = useState<'op' | 'staff' | 'temp'>('op')
  const [editing, setEditing] = useState<ClosingAutoRow | null>(null)
  const [sum, setSum] = useState<ClosingAutoSummary | null>(null)
  const [view, setView] = useState<string>('issues')
  const [issue, setIssue] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 2 }))
  const colLabel = (key: string) => {
    const f = CLOSED_FIELDS.find((x) => x.key === key)
    return f ? `${t(`cls.f.${f.label}`)}${key.endsWith('CT') ? ' (CT)' : key.endsWith('TV') ? ' (TV)' : ''}` : key
  }

  const errText = (e: unknown) => {
    const { code } = payrollError(e)
    if (code === 'expired') return t('cls.err.expired')
    if (code === 'invalid_input') return t('car.err.period')
    return t('cls.err.generic')
  }
  const build = useMutation({ mutationFn: (refresh: boolean) => closingAuto.preview(period, refresh, group), onSuccess: (s) => { setSum(s); setView(s.withIssues > 0 ? 'issues' : 'all'); setIssue(''); setSearch(''); setPage(1) }, onError: (e) => msg.error(errText(e)) })
  const lock = useMutation({
    mutationFn: () => closingAuto.lock(sum!.token),
    onSuccess: (r) => { msg.success(t('car.lock.done', { n: r.written + r.updated })); build.mutate(false) },
    onError: (e) => { const { code } = payrollError(e); msg.error(code === 'table_missing' ? t('car.edit.errTable') : code === 'locked' ? t('car.edit.errLocked') : errText(e)) },
  })
  const unlock = useMutation({
    mutationFn: () => closingAuto.unlock(sum!.period),
    onSuccess: () => { msg.success(t('car.lock.unlocked')); build.mutate(false) },
    onError: (e) => msg.error(errText(e)),
  })
  const confirmLock = () => Modal.confirm({
    title: t('car.lock.confirmTitle', { period: sum!.period }), content: t('car.lock.confirmText', { n: sum!.people, edited: sum!.edited }), okText: t('car.lock.confirmOk'), cancelText: t('car.lock.cancel'), okButtonProps: { danger: true },
    onOk: () => lock.mutateAsync().catch(() => undefined),
  })
  const confirmUnlock = () => Modal.confirm({ title: t('car.lock.unlockTitle'), content: t('car.lock.unlockText'), okText: t('car.lock.unlock'), cancelText: t('car.lock.cancel'), onOk: () => unlock.mutateAsync().catch(() => undefined) })
  const pay = useMutation({ mutationFn: () => closingAuto.payroll(sum!.token), onSuccess: (p) => navigate('/payroll', { state: { preview: p } }), onError: (e) => msg.error(errText(e)) })
  const list = useQuery({
    queryKey: ['closing-auto', 'results', sum?.token, view, issue, search, page],
    queryFn: () => closingAuto.results(sum!.token, { view: view === 'all' ? '' : view, issue, search, page, pageSize: PAGE_SIZE }),
    enabled: !!sum, retry: false, placeholderData: (p) => p,
  })

  const cols: ColumnsType<ClosingAutoRow> = useMemo(() => [
    { title: t('org.colEmp'), dataIndex: 'employeeId', width: 100, fixed: 'left' },
    { title: t('org.colName'), dataIndex: 'fullName', width: 170, fixed: 'left' },
    { title: t('org.department'), dataIndex: 'department', width: 140, ellipsis: true },
    {
      title: t('car.issues'), width: 300,
      render: (_, r) => r.issues.map((i) => (
        <Tooltip key={i.code} title={t(`car.issueHelp.${i.code}`)}>
          <Tag color={ISSUE_COLOR[i.code] ?? 'default'}>{t(`car.issue.${i.code}`)}{i.detail ? `: ${i.detail}` : ''}</Tag>
        </Tooltip>
      )),
    },
    { title: t('car.dayHours'), dataIndex: 'dayHours', width: 90, align: 'right', render: fmt },
    { title: t('car.nightHours'), dataIndex: 'nightHours', width: 90, align: 'right', render: fmt },
    { title: t('car.otHours'), dataIndex: 'otHours', width: 90, align: 'right', render: fmt },
    { title: t('car.leave'), dataIndex: 'leave', width: 90, align: 'right', render: fmt },
    { title: t('car.total'), dataIndex: 'total', width: 100, align: 'right', render: (v: number) => <b>{fmt(v)}</b> },
    { title: t('car.hrTotal'), dataIndex: 'hrTotal', width: 100, align: 'right', render: (v: number | null, r) => (v == null ? '—' : <Tag color={r.total === v ? 'green' : 'red'}>{fmt(v)}</Tag>) },
    {
      title: '', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.edited && <Tooltip title={r.note || t('car.edit.edited')}><Tag color="green">{t('car.edit.edited')}</Tag></Tooltip>}
          {sum?.status !== 'locked' && <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditing(r)} aria-label={t('car.edit.title')} />}
        </Space>
      ),
    },
  ], [t, i18n.language, sum?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (params.get('period')) build.mutate(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100))

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<RobotOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.closingAuto')} subtitle={t('nav.closingAutoDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('car.noteTitle')} description={t('car.note')} />
      <div className="prl-groups" role="tablist">
        {(['op', 'staff', 'temp'] as const).map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} className={`prl-group prl-group-${g}${group === g ? ' active' : ''}`} onClick={() => { setGroup(g); setSum(null); setPage(1) }}>
            <b>{t(`car.group.${g}`)}</b>
            <small>{t(`car.group.${g}Hint`)}</small>
          </button>
        ))}
      </div>
      <div className="pay-toolbar">
        <Space wrap>
          <Typography.Text strong>{t('cls.period')}:</Typography.Text>
          <Select style={{ width: 140 }} value={period} onChange={setPeriod} options={periods().map((p) => ({ value: p, label: p }))} />
          <Button type="primary" icon={<PlayCircleOutlined />} loading={build.isPending} onClick={() => build.mutate(false)}>{t('car.build')}</Button>
          {sum && sum.status !== 'locked' && <Button icon={<ReloadOutlined />} disabled={build.isPending} onClick={() => build.mutate(true)}>{t('car.refresh')}</Button>}
          {build.isPending && <Typography.Text type="secondary">{t('car.building')}</Typography.Text>}
        </Space>
        {sum && (
          <Space wrap>
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => closingAuto.draft(sum.token).catch(() => msg.error(t('cls.err.generic')))}>{t('car.download')}</Button>
            {sum.compared > 0 && <Button icon={<DownloadOutlined />} onClick={() => closingAuto.compare(sum.token).catch(() => msg.error(t('cls.err.generic')))}>{t('car.compareReport')}</Button>}
            {!CLOSING_AUTO_DIRECT && <Button icon={<CalculatorOutlined />} onClick={() => navigate('/payroll')}>{t('car.toPayroll')}</Button>}
            {CLOSING_AUTO_DIRECT && <Button type="primary" icon={<CalculatorOutlined />} loading={pay.isPending} onClick={() => pay.mutate()}>{t('car.calcPay')}</Button>}
            {CLOSING_AUTO_DIRECT && (sum.status === 'locked'
              ? <Button icon={<UnlockOutlined />} loading={unlock.isPending} onClick={confirmUnlock}>{t('car.lock.unlock')}</Button>
              : <Button danger icon={<LockOutlined />} disabled={!sum.tablesReady} loading={lock.isPending} onClick={confirmLock}>{t('car.lock.lock')}</Button>)}
          </Space>
        )}
      </div>

      {sum && !sum.tablesReady && <SqlNotReady title={t('car.tables.title')} sql={CLOSING_AUTO_TABLES_SQL} onRetry={() => build.mutate(false)} loading={build.isPending} />}
      {sum && CLOSING_AUTO_DIRECT && (
        <Alert style={{ marginBottom: 12 }} showIcon type={sum.status === 'locked' ? 'success' : 'warning'}
          title={sum.status === 'locked' ? t('car.status.locked', { period: sum.period, by: sum.lockedBy ?? '', at: sum.lockedAt ? new Date(sum.lockedAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language) : '' }) : t('car.status.draft', { period: sum.period })}
          description={sum.status === 'locked' ? t('car.status.lockedHelp') : t('car.status.draftHelp', { built: new Date(sum.builtAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language) })} />
      )}

      {sum && (
        <>
          <StatTiles items={[
            { label: t('car.editedPeople'), value: sum.edited, color: sum.edited ? '#0F6B3E' : undefined },
            { label: t('car.people'), value: sum.people },
            { label: t('car.withIssues'), value: sum.withIssues, color: sum.withIssues ? '#D48806' : '#2E9E4F' },
            { label: t('car.matchHr', { n: sum.compared }), value: sum.compared ? `${pct(sum.totalMatches, sum.compared)}%` : '—', color: '#0F6B3E' },
            { label: t('car.differHr'), value: sum.differFromHr, color: sum.differFromHr ? '#D92D20' : '#2E9E4F' },
          ]} />
          {sum.compared > 0 && (
            <details className="car-cols">
              <summary>{t('car.columnMatch')}</summary>
              <div className="car-cols-grid">
                {sum.columns.map((c) => (
                  <div key={c.key} className="car-col">
                    <span>{colLabel(c.key)}</span>
                    <Progress percent={pct(c.exact, c.nonzero)} size="small" status={pct(c.exact, c.nonzero) >= 90 ? 'success' : 'normal'} />
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="prl-flags">
            <Space wrap>
              <Segmented value={view} onChange={(v) => { setView(String(v)); setIssue(''); setPage(1) }}
                options={[{ value: 'issues', label: t('car.viewIssues', { n: sum.withIssues }) }, ...(sum.compared > 0 ? [{ value: 'diff', label: t('car.viewDiff', { n: sum.differFromHr }) }] : []), ...(sum.edited > 0 ? [{ value: 'edited', label: t('car.viewEdited', { n: sum.edited }) }] : []), { value: 'all', label: t('car.viewAll') }]} />
              <Input.Search allowClear placeholder={t('prl.search')} style={{ width: 240 }} onSearch={(v) => { setSearch(v); setPage(1) }} />
            </Space>
            <div>
              {ISSUE_ORDER.filter((c) => sum.issueCounts[c]).map((c) => (
                <Tag.CheckableTag key={c} checked={issue === c} onChange={() => { setIssue(issue === c ? '' : c); setPage(1) }}>{t(`car.issue.${c}`)} ({sum.issueCounts[c]})</Tag.CheckableTag>
              ))}
            </div>
          </div>
          <Table<ClosingAutoRow> rowKey="employeeId" size="small" loading={list.isFetching} columns={cols} dataSource={list.data?.rows ?? []} scroll={{ x: 'max-content' }}
            expandable={{ rowExpandable: (r) => r.diffs.length > 0, expandedRowRender: (r) => (
              <div className="car-diffs">
                <Typography.Text type="secondary">{t('car.diffsTitle')}</Typography.Text>
                <Table size="small" pagination={false} rowKey="key" dataSource={r.diffs} columns={[
                  { title: t('car.column'), dataIndex: 'key', render: colLabel },
                  { title: t('car.auto'), dataIndex: 'auto', width: 120, align: 'right', render: fmt },
                  { title: t('car.hr'), dataIndex: 'hr', width: 120, align: 'right', render: fmt },
                ]} />
              </div>
            ) }}
            pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, showSizeChanger: false, onChange: setPage }} />
        </>
      )}
      {sum && <ClosingAutoEdit token={sum.token} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); build.mutate(false) }} />}
    </div>
  )
}
