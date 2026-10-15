import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Empty, Input, Popconfirm, Space, Tag, Typography } from 'antd'
import { AppModal } from '../../components/AppModal'
import { CloseCircleOutlined, CheckSquareOutlined, ClockCircleOutlined, FieldTimeOutlined, LogoutOutlined, RollbackOutlined, ScheduleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { approvals, isSingleApprover, type ApprovalKind, type ApprovalRow, type PendingGroup } from '../../api/approvals'
import { apiErrorCode } from '../../api/requests'
import { personColumn, deptColumn, ShiftChip, DayChip, TimeRange, AmountBadge } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import ApprovalDoneTab from './ApprovalDoneTab'
import { localDayName } from '../../utils/format'
import { useToast } from '../../hooks/useToast'

type RejectTarget = { level: number; groupId: string; id?: number; label: string }

/** Các dòng đơn trong một lô – mỗi dòng có thể bị từ chối riêng (như màn duyệt cũ). */
function GroupRows({ kind, group, onReject, onApprove, approving }: { kind: ApprovalKind; group: PendingGroup; onReject: (t: RejectTarget) => void; onApprove: (g: PendingGroup, ids: number[]) => void; approving: boolean }) {
  const { t, i18n } = useTranslation()
  const q = useQuery({ queryKey: ['apr', 'group', kind, group.level, group.groupId], queryFn: () => approvals.group(kind, group.level, group.groupId) })
  const from = kind === 'finger' ? t('req.timeIn') : t('req.otFrom')
  const to = kind === 'finger' ? t('req.timeOut') : t('req.otTo')

  const isLeave = kind === 'leave'
  const isGoOut = kind === 'goout'
  const isShort = isSingleApprover(kind)   // ra ngoài / đi muộn / về sớm
  const [picked, setPicked] = useState<number[]>([])
  const sender = {
    title: t('req.sender'), width: 160,
    render: (_: unknown, r: ApprovalRow) => (
      <div style={{ lineHeight: 1.25 }}>
        <div>{r.senderName || r.senderId}</div>
        <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{r.submittedAt ? dayjs(r.submittedAt).format('DD/MM HH:mm') : r.senderId}</div>
      </div>
    ),
  }
  const rejectCol = {
    title: '', width: 170,
    render: (_: unknown, r: ApprovalRow) => (
      <Space size={6}>
        <Popconfirm title={t('apr.approveOneConfirm', { name: r.fullName })} okText={t('apr.approve')} cancelText={t('req.cancel')} onConfirm={() => onApprove(group, [r.id])}>
          <Button size="small" type="primary" loading={approving}>{t('apr.approve')}</Button>
        </Popconfirm>
        <Button size="small" danger onClick={() => onReject({ level: group.level, groupId: group.groupId, id: r.id, label: `${r.employeeId} · ${r.fullName}` })}>
          {t('apr.reject')}
        </Button>
      </Space>
    ),
  }
  const who: ColumnsType<ApprovalRow> = [
    personColumn<ApprovalRow>(t('att.name'), 230),
    deptColumn<ApprovalRow>(t('att.dept'), 190),
  ]
  const columns: ColumnsType<ApprovalRow> = isLeave
    ? [
        ...who,
        { title: t('leave.from'), dataIndex: 'date', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: t('leave.to'), dataIndex: 'dateTo', width: 105, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '') },
        { title: t('leave.days'), dataIndex: 'hours', width: 90, align: 'center', render: (v: string) => <AmountBadge value={v} unit={t('apr.days')} /> },
        { title: t('att.shift'), dataIndex: 'shift', width: 110, render: (v: string) => <ShiftChip value={v} /> },
        { title: `${t('req.timeIn')} – ${t('req.timeOut')}`, width: 120, align: 'center', render: (_: unknown, r: ApprovalRow) => <TimeRange from={r.timeFrom} to={r.timeTo} /> },
        { title: t('req.reason'), dataIndex: 'reason', ellipsis: { showTitle: true }, width: 200 },
        { title: t('leave.handover'), dataIndex: 'extra', ellipsis: { showTitle: true }, width: 150 },
        sender,
        rejectCol,
      ]
    : isShort
    ? [
        ...who,
        {
          title: t('att.date'), width: isGoOut ? 190 : 105,
          render: (_: unknown, r: ApprovalRow) => (r.dateTo && !dayjs(r.dateTo).isSame(dayjs(r.date), 'day')
            ? <b>{dayjs(r.date).format('DD/MM/YYYY')} → {dayjs(r.dateTo).format('DD/MM/YYYY')}</b> : <b>{dayjs(r.date).format('DD/MM/YYYY')}</b>),
        },
        { title: t('att.day'), dataIndex: 'dayName', width: 100, render: (v: string) => <DayChip raw={v} label={localDayName(v, i18n.language)} /> },
        isGoOut
          ? { title: t('sh.timeOut'), width: 90, align: 'center' as const, render: (_: unknown, r: ApprovalRow) => <b>{r.timeFrom}</b> }
          : { title: `${t('sh.fromTime')} → ${t('sh.toTime')}`, width: 150, align: 'center' as const, render: (_: unknown, r: ApprovalRow) => <TimeRange from={r.timeFrom} to={r.timeTo} /> },
        ...(isGoOut
          ? [
              { title: t('sh.purpose'), width: 130, render: (_: unknown, r: ApprovalRow) => t(r.purpose === 'company' ? 'sh.purposeCompany' : 'sh.purposePersonal') },
              { title: t('sh.comeBack'), width: 120, render: (_: unknown, r: ApprovalRow) => r.comeBackTime ?? t('sh.comeBackNo') },
            ]
          : [{ title: t('req.hours'), dataIndex: 'hours', width: 90, align: 'center' as const, render: (v: string) => <AmountBadge value={v} unit={t('apr.hours')} /> }]),
        { title: t('req.reason'), dataIndex: 'reason', ellipsis: { showTitle: true }, width: 240 },
        sender,
        rejectCol,
      ]
    : [
        ...who,
        { title: t('att.date'), dataIndex: 'date', width: 105, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: t('att.day'), dataIndex: 'dayName', width: 100, render: (v: string) => <DayChip raw={v} label={localDayName(v, i18n.language)} /> },
        { title: t('att.shift'), dataIndex: 'shift', width: 110, render: (v: string) => <ShiftChip value={v} /> },
        { title: `${from} → ${to}`, width: 150, align: 'center', render: (_: unknown, r: ApprovalRow) => <TimeRange from={r.timeFrom} to={r.timeTo} /> },
        { title: t('req.hours'), dataIndex: 'hours', width: 90, align: 'center', render: (v: string) => <AmountBadge value={v} unit={t('apr.hours')} /> },
        ...(kind === 'overtime' && (q.data ?? []).some((r) => (r.overlaps?.length ?? 0) > 0)
          ? [{
              title: t('apr.overlapCol'), width: 230,
              render: (_: unknown, r: ApprovalRow) => (r.overlaps?.length ? (
                <div style={{ lineHeight: 1.3 }}>
                  <Tag color="orange" variant="filled">{t('apr.overlapTag')}</Tag>
                  {r.overlaps.map((o) => (
                    <div key={o.id} style={{ fontSize: 12 }}>
                      {dayjs(o.date).format('DD/MM')} {o.start} → {o.end} ({o.hours}h{o.state === 'pending' ? `, ${t('apr.overlapPending')}` : ''}) · {t('apr.overlapHours', { n: o.overlapHours })}
                    </div>
                  ))}
                </div>
              ) : null),
            }] as ColumnsType<ApprovalRow>
          : []),
        { title: t('req.reason'), dataIndex: 'reason', ellipsis: { showTitle: true }, width: 240 },
        sender,
        rejectCol,
      ]

  return (
    <div className="list-table" style={{ margin: '4px 0' }}>
      <DataTable<ApprovalRow>
        rowKey="id" size="small" sticky={false} scroll={{ x: isLeave ? 1450 : 1300 }} loading={q.isFetching}
        columns={columns} dataSource={q.data ?? []} pagination={false}
        rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]) }}
        toolbar={picked.length > 0 ? (
          <Space>
            <Typography.Text>{t('apr.selectedN', { n: picked.length })}</Typography.Text>
            <Popconfirm title={t('apr.approveSelectedConfirm', { n: picked.length })} okText={t('apr.approve')} cancelText={t('req.cancel')} onConfirm={() => { onApprove(group, picked); setPicked([]) }}>
              <Button size="small" type="primary" loading={approving}>{t('apr.approveSelected')}</Button>
            </Popconfirm>
            <Button size="small" onClick={() => setPicked([])}>{t('apr.clearSelection')}</Button>
          </Space>
        ) : undefined}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('apr.rowsEmpty')} /> }}
      />
    </div>
  )
}

function KindPanel({ kind }: { kind: ApprovalKind }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [target, setTarget] = useState<RejectTarget | null>(null)
  const [reason, setReason] = useState('')

  const pending = useQuery({ queryKey: ['apr', 'pending', kind], queryFn: () => approvals.pending(kind), retry: false, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 30_000 })
  // Mở từ thông báo: ?group=<mã lô> → đưa lô đó lên đầu, tô sáng và tự mở danh sách đơn để duyệt.
  const [params] = useSearchParams()
  const focus = params.get('group')
  const [expanded, setExpanded] = useState<string[]>([])
  const groups = useMemo(() => {
    const list = pending.data ?? []
    return focus ? [...list].sort((x, y) => Number(y.groupId === focus) - Number(x.groupId === focus)) : list
  }, [pending.data, focus])
  useEffect(() => {
    if (focus && pending.data) setExpanded(pending.data.filter((g) => g.groupId === focus).map((g) => `${g.level}|${g.groupId}`))
  }, [focus, pending.data])

  const errText = (e: unknown) => {
    const { code } = apiErrorCode(e)
    if (code === 'no_account') return t('apr.noAccount')
    if (code === 'not_found') return t('apr.notFound')
    if (code === 'invalid_input') return t('apr.needReason')
    return t('req.err.generic')
  }
  // Làm mới cả huy hiệu số đơn chờ duyệt trên menu (khoá ['approvals']) và tab Đã duyệt (nằm trong ['apr']).
  const refresh = () => { qc.invalidateQueries({ queryKey: ['apr'] }); qc.invalidateQueries({ queryKey: ['approvals'] }) }

  const approve = useMutation({
    mutationFn: (g: PendingGroup) => approvals.approve(kind, g.level, g.groupId),
    onSuccess: () => { msg.success(t('apr.approved')); refresh() },
    onError: (e) => { msg.error(errText(e)); refresh() },
  })
  const [pickedGroups, setPickedGroups] = useState<string[]>([])
  const approveMany = useMutation({
    mutationFn: () => approvals.approveMany(kind, pickedGroups.map((k) => { const [level, ...rest] = k.split('|'); return { level: Number(level), groupId: rest.join('|') } })),
    onSuccess: (r) => {
      msg.success(t('apr.approvedGroupsN', { g: r.groups, f: r.forms }))
      if (r.failed.length) msg.warning(t('apr.failedGroups', { n: r.failed.length }))
      setPickedGroups([]); refresh()
    },
    onError: (e) => { msg.error(errText(e)); refresh() },
  })
  const approveRecords = useMutation({
    mutationFn: (v: { g: PendingGroup; ids: number[] }) => approvals.approveRecords(kind, v.g.level, v.g.groupId, v.ids),
    onSuccess: (r) => { msg.success(t('apr.approvedN', { n: r.approved })); refresh() },
    onError: (e) => { msg.error(errText(e)); refresh() },
  })
  const reject = useMutation({
    mutationFn: () => target!.id == null
      ? approvals.rejectGroup(kind, target!.level, target!.groupId, reason.trim())
      : approvals.rejectRecord(kind, target!.level, target!.groupId, target!.id, reason.trim()),
    onSuccess: () => { msg.success(t('apr.rejected')); setTarget(null); setReason(''); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const levelName = (l: number) => (isSingleApprover(kind) ? t('sh.approver') : l === 1 ? t('req.shortOne') : l === 2 ? t('req.shortTwo') : l === 3 ? t('req.shortThree') : t('leave.shortFour'))

  const columns: ColumnsType<PendingGroup> = [
    { title: t('apr.level'), dataIndex: 'level', width: 130, render: (l: number) => <Tag color={l === 1 ? 'blue' : l === 2 ? 'purple' : l === 3 ? 'orange' : 'magenta'} variant="filled">{levelName(l)}</Tag> },
    { title: t('apr.group'), dataIndex: 'groupId', ellipsis: true },
    { title: t('att.dept'), dataIndex: 'department', width: 220, ellipsis: true },
    { title: t('att.date'), dataIndex: 'date', width: 110, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
    { title: t('apr.count'), dataIndex: 'count', width: 90, align: 'right' },
    {
      title: '', width: 250,
      render: (_: unknown, g: PendingGroup) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Popconfirm title={t('apr.confirmApprove', { n: g.count })} okText={t('apr.approve')} cancelText={t('req.cancel')} onConfirm={() => approve.mutate(g)}>
            <Button type="primary" size="small" loading={approve.isPending && approve.variables?.groupId === g.groupId}>{t('apr.approveAll')}</Button>
          </Popconfirm>
          <Button size="small" danger onClick={() => setTarget({ level: g.level, groupId: g.groupId, label: g.groupId })}>{t('apr.rejectAll')}</Button>
        </Space>
      ),
    },
  ]

  const errBanner = pending.isError ? (apiErrorCode(pending.error).code === 'no_account' ? t('apr.noAccount') : t('req.err.generic')) : ''

  return (
    <>
      {errBanner && <Alert type="warning" showIcon title={errBanner} style={{ marginBottom: 16 }} />}
      <div className="list-table">
        <DataTable<PendingGroup>
          rowKey={(g) => `${g.level}|${g.groupId}`} size="small" sticky={false} scroll={{ x: 900 }}
          loading={pending.isFetching} columns={columns} dataSource={groups}
          rowClassName={(g) => `row-expandable${focus && g.groupId === focus ? ' row-focus' : ''}`}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          rowSelection={{ selectedRowKeys: pickedGroups, onChange: (k) => setPickedGroups(k as string[]) }}
          locale={{ emptyText: <Empty description={t('apr.empty')} /> }}
          expandable={{ expandRowByClick: true, expandedRowRender: (g) => <GroupRows kind={kind} group={g} onReject={setTarget} onApprove={(grp, ids) => approveRecords.mutate({ g: grp, ids })} approving={approveRecords.isPending} />, expandedRowKeys: expanded, onExpandedRowsChange: (k) => setExpanded(k as string[]) }}
          toolbar={
            <Space>
              <Typography.Text strong>{t('apr.pending')}</Typography.Text>
              <Tag variant="filled" color="processing">{pending.data?.length ?? 0}</Tag>
              <Button size="small" onClick={refresh} loading={pending.isFetching}>{t('apr.reload')}</Button>
              {pickedGroups.length > 0 && (
                <Popconfirm title={t('apr.approveManyConfirm', { n: pickedGroups.length })} okText={t('apr.approve')} cancelText={t('req.cancel')} onConfirm={() => approveMany.mutate()}>
                  <Button size="small" type="primary" loading={approveMany.isPending}>{t('apr.approveManyBtn', { n: pickedGroups.length })}</Button>
                </Popconfirm>
              )}
            </Space>
          }
        />
      </div>

      <AppModal
        open={!!target} onClose={() => { setTarget(null); setReason('') }} size="sm" danger icon={<CloseCircleOutlined />}
        title={t('apr.rejectTitle')} subtitle={target?.label}
        onOk={() => reject.mutate()} okText={t('apr.reject')} okDisabled={!reason.trim()} okLoading={reject.isPending}
      >
        <Input.TextArea rows={4} maxLength={100} showCount value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('apr.reasonPlaceholder')} />
      </AppModal>
    </>
  )
}

/** Màn duyệt của một loại đơn (quên vân tay / tăng ca / nghỉ phép): lô chờ → xem từng đơn → duyệt cả lô, từ chối cả lô hoặc từng đơn (kèm lý do). */
export default function ApprovalsPage({ kind }: { kind: ApprovalKind }) {
  const { t } = useTranslation()
  const NAV: Record<ApprovalKind, string> = {
    finger: 'approvalFinger', overtime: 'approvalOvertime', leave: 'approvalLeave', goout: 'approvalGoOut', late: 'approvalLate', early: 'approvalEarly',
  }
  const title = t(`nav.${NAV[kind]}`)
  const subtitle = t(`nav.${NAV[kind]}Desc`)
  const tabs = [{ key: 'pending', label: t('apr.tabPending') }, { key: 'done', label: t('apr.tabDone') }]
  const [tab, setTab] = usePageTab(tabs)
  const icon = { finger: <CheckSquareOutlined />, overtime: <FieldTimeOutlined />, leave: <ScheduleOutlined />, goout: <LogoutOutlined />, late: <ClockCircleOutlined />, early: <RollbackOutlined /> }[kind]

  return (
    <>
      <PageTabs items={tabs} active={tab} onChange={setTab} />
      <div className="page wide">
        <PageBanner
          avatar={<Avatar size={56} icon={icon} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
          title={title}
          subtitle={subtitle}
          chips={isSingleApprover(kind) ? [t('sh.approver')] : [t('req.shortOne'), t('req.shortTwo'), t('req.shortThree'), ...(kind === 'leave' ? [t('leave.shortFour')] : [])]}
        />
        {tab === 'pending' ? <KindPanel key={kind} kind={kind} /> : <ApprovalDoneTab key={kind} kind={kind} />}
      </div>
    </>
  )
}
