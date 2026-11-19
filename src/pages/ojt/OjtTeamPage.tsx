import { useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import './ojt.css'
import { Alert, Button, Card, DatePicker, Empty, Input, Modal, Popconfirm, Progress, Segmented, Select, Skeleton, Table, Tabs, Tag } from 'antd'
import { CheckCircleOutlined, DownloadOutlined, PlayCircleOutlined, TeamOutlined, UserDeleteOutlined, WarningOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageBanner } from '../../components/PageBanner'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { ojt, type OjtDay, type OjtRow } from '../../api/ojt'
import { ConclusionTag, FinalPanel, WeeksPanel } from './OjtReviews'
import { MentorNote, OjtDayCard } from './OjtDayCard'
import { OjtAvatar, OjtStatusTag, PersonSelect, dmy, useOjtAvatars } from './OjtCommon'
import { foldFilter, foldText } from '../../utils/search'
import { useDebouncedValue } from '../../hooks/useDebounce'

function NoteBox({ planId, day }: { planId: number; day: OjtDay }) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [text, setText] = useState(day.log?.mentorNote ?? '')
  const save = useMutation({
    mutationFn: () => ojt.note(planId, day.date, text),
    onSuccess: () => { toast.success(t('ojt.noteSaved')); qc.invalidateQueries({ queryKey: ['ojt-detail', planId] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  return (
    <div className="ojt-note ojt-note-edit">
      <label>{t('ojt.mentorNote')}</label>
      <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={1000} showCount value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ojt.notePh')} />
      <Button size="small" type="primary" style={{ marginTop: 8 }} loading={save.isPending} disabled={text === (day.log?.mentorNote ?? '')} onClick={() => save.mutate()}>{t('ojt.noteSave')}</Button>
    </div>
  )
}

/** `readOnly` (màn Lập kế hoạch của HR): chỉ xem, không phân/đổi/gỡ mentor, không nhận xét, chấm điểm hay kết luận. */
function PlanDrawer({ id, onClose, readOnly = false }: { id: number; onClose: () => void; readOnly?: boolean }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['ojt-detail', id], queryFn: () => ojt.detail(id) })
  const [mentor, setMentor] = useState<string>()
  const assign = useMutation({
    mutationFn: () => ojt.setMentor(id, mentor!),
    onSuccess: () => { toast.success(t('ojt.assigned')); setMentor(undefined); qc.invalidateQueries({ queryKey: ['ojt-detail', id] }); qc.invalidateQueries({ queryKey: ['ojt-team'] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  const unassign = useMutation({
    mutationFn: (mentorId: string) => ojt.removeMentor(id, mentorId),
    onSuccess: () => { toast.success(t('ojt.mentorRemoved')); qc.invalidateQueries({ queryKey: ['ojt-detail', id] }); qc.invalidateQueries({ queryKey: ['ojt-team'] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  const [swapFrom, setSwapFrom] = useState<string | null>(null)
  const [swapTo, setSwapTo] = useState<string>()
  const swap = useMutation({
    mutationFn: () => ojt.replaceMentor(id, swapFrom!, swapTo!),
    onSuccess: () => { toast.success(t('ojt.swapped')); setSwapFrom(null); setSwapTo(undefined); qc.invalidateQueries({ queryKey: ['ojt-detail', id] }); qc.invalidateQueries({ queryKey: ['ojt-team'] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  const d = q.data && readOnly ? { ...q.data, canAssign: false, canReview: false, canConclude: false, isMentor: false, isApprover: false } : q.data
  const mentors = d?.mentors?.length ? d.mentors : d?.plan.mentorId ? [{ id: d.plan.mentorId, name: d.plan.mentorName ?? d.plan.mentorId }] : []
    const photos = useOjtAvatars([d?.plan.employeeId, ...mentors.map((m) => m.id), ...(d?.leaders ?? []).map((l) => l.id)])
  const canAssign = !readOnly && !!d && (d.canAssign ?? (d.isApprover || !!user?.isAdmin)) && d.plan.status !== 'done' && d.plan.status !== 'cancelled'
  const canNote = !readOnly && !!d && (d.isMentor || d.isApprover || !!user?.isAdmin || !!d.canAssign || !!d.canReview || !!d.canConclude)   // HR (không phải admin) do backend cho phép
  const today = dayjs().format('YYYY-MM-DD')
  const days = d?.days ?? []
  const past = days.filter((x) => x.date < today)
  const missing = past.filter((x) => !x.log && !x.onLeave).length
  let streak = 0
  for (const x of past) { if (x.log) break; if (!x.onLeave) streak++ }
  const uncommented = days.filter((x) => x.log && !x.log.mentorNote?.trim()).length
  const weeks = (d?.reviews ?? []).filter((r) => r.kind === 'week').sort((p, c) => c.periodStart.localeCompare(p.periodStart))
  const proposal = d?.reviews?.find((r) => r.kind === 'proposal')
  const final = d?.reviews?.find((r) => r.kind === 'final')
  const pct = d && d.due ? Math.round((d.plan.written / d.due) * 100) : 0
  return (
    <Modal open onCancel={onClose} footer={null} width="min(1400px, 97vw)" centered destroyOnHidden className="ojt-nb-modal ojt-wide ojt-v7" title={null}>
      <div className="ojt-nb">
        <header className="ojt-hd">
          <div className="ojt-hd-id">
            {d && <OjtAvatar name={d.plan.employeeName} src={photos[d.plan.employeeId]} size={68} />}
            <div className="ojt-hd-name">
              <h2>{d ? d.plan.employeeName : '…'}</h2>
              <p>{d ? `${d.plan.employeeId} · ${d.plan.department ?? '—'} · ${dmy(d.plan.startDate)} → ${dmy(d.plan.endDate)}` : ''}</p>
              {d && <div className="ojt-hd-chips">
                <OjtStatusTag status={d.plan.status} />
                {final ? <ConclusionTag value={final.conclusion} /> : proposal && <span className="ojt-hd-prop">{t('ojt.proposalShort')}: <ConclusionTag value={proposal.conclusion} /></span>}
              </div>}
            </div>
          </div>
          <div className="ojt-hd-kpis">
            <div className="ojt-hd-k"><b>{d ? d.plan.written : '…'}<small>/{d ? d.due : '…'}</small></b><span>{t('ojt.colProgress')}</span><i><u style={{ width: `${pct}%` }} /></i></div>
            <div className={`ojt-hd-k ${streak >= 2 ? 'bad' : streak === 1 ? 'warn' : ''}`}><b>{streak}</b><span>{t('ojt.colStreak')}</span></div>
            <div className={`ojt-hd-k ${uncommented > 0 ? 'warn' : ''}`}><b>{uncommented}</b><span>{t('ojt.colUncommented')}</span></div>
            <div className="ojt-hd-k"><b>{weeks[0]?.avg != null ? weeks[0].avg.toFixed(1) : '—'}</b><span>{t('ojt.colScore')}</span></div>
          </div>
        </header>
        {q.isLoading && <div style={{ padding: 28 }}><Skeleton active /></div>}
        {d && (
          <div className="ojt-split">
            <aside className="ojt-side">
              {missing > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`${t('ojt.missing')}: ${missing}`} />}
              <section className="ojt-info">
                <b className="ojt-sec-title">{t('ojt.mentorsHead')}</b>
                {mentors.length === 0 && <p className="ojt-muted" style={{ marginTop: 6 }}>{t('ojt.noMentor')}</p>}
                <div className="ojt-mentor-list">
                  {mentors.map((m) => (
                    <div key={m.id} className="ojt-mentor-card">
                      <div className="ojt-mentor-row">
                        <OjtAvatar name={m.name} src={photos[m.id]} size={36} /><span><b>{m.name}</b><em>{m.id}</em></span>
                        {canAssign && swapFrom !== m.id && (
                          <span className="ojt-mentor-acts">
                            <Button size="small" onClick={() => { setSwapFrom(m.id); setSwapTo(undefined) }}>{t('ojt.swapMentor')}</Button>
                            <Popconfirm title={t('ojt.removeMentorConfirm', { name: m.name })} okText={t('ojt.removeMentor')} okButtonProps={{ danger: true }} onConfirm={() => unassign.mutate(m.id)}>
                              <Button size="small" danger loading={unassign.isPending && unassign.variables === m.id}>{t('ojt.removeMentor')}</Button>
                            </Popconfirm>
                          </span>
                        )}
                      </div>
                      {swapFrom === m.id && (
                        <div className="ojt-swap">
                          <PersonSelect value={swapTo} onChange={setSwapTo} placeholder={t('ojt.swapPick')} />
                          <div className="ojt-swap-btns">
                            <Button size="small" onClick={() => setSwapFrom(null)}>{t('ojt.cancel')}</Button>
                            <Button size="small" type="primary" disabled={!swapTo || swapTo === m.id} loading={swap.isPending} onClick={() => swap.mutate()}>{t('ojt.swapConfirm')}</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {canAssign && (
                  <div className="ojt-add-mentor">
                    <PersonSelect value={mentor} onChange={setMentor} placeholder={t('ojt.pickMentor')} />
                    <Button type="primary" block style={{ marginTop: 8 }} disabled={!mentor || mentors.some((m) => m.id === mentor)} loading={assign.isPending} onClick={() => assign.mutate()}>{t('ojt.addMentorBtn')}</Button>
                  </div>
                )}
              </section>
              <section className="ojt-info">
                <b className="ojt-sec-title">{t('ojt.leadersLabel')}</b>
                <div className="ojt-people" style={{ marginTop: 8 }}>
                  {(d.leaders?.length ? d.leaders : (d.plan.approverIds ?? []).map((x) => ({ id: x, name: x }))).map((l) => (
                    <span key={l.id} className="ojt-person-chip" title={l.id}><OjtAvatar name={l.name} src={photos[l.id]} size={22} />{l.name}</span>
                  ))}
                  {!d.leaders?.length && !(d.plan.approverIds ?? []).length && <span className="ojt-muted">—</span>}
                </div>
              </section>
            </aside>
            <main className="ojt-main">
              <Tabs className="ojt-nb-tabs" items={[
                { key: 'diary', label: t('ojt.tabDiary'), children: (
                  <>
                    {d.days.length === 0 && <Empty description={t('ojt.noDays')} />}
                    <div className="ojt-days">
                      {d.days.map((day) => (
                        <OjtDayCard key={day.date} day={day} today={today}
                          footer={day.log && (canNote ? <NoteBox planId={d.plan.id} day={day} /> : <MentorNote note={day.log.mentorNote} />)} />
                      ))}
                    </div>
                  </>
                ) },
                { key: 'weeks', label: <span>{t('ojt.tabWeeks')}{d.canReview && weeks.length === 0 ? ' •' : ''}</span>, children: <WeeksPanel detail={d} /> },
                { key: 'final', label: <span>{t('ojt.tabFinal')} <ConclusionTag value={final?.conclusion} /></span>, children: <FinalPanel detail={d} /> },
              ]} />
            </main>
          </div>
        )}
      </div>
    </Modal>
  )
}

type Focus = 'all' | 'attn' | 'nomentor' | 'conclude'

function Kpi({ label, value, tone, active, onClick, icon }: { label: string; value: number; tone: 'blue' | 'orange' | 'red' | 'green'; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button type="button" className={`ojt-kpi ojt-kpi-${tone}${active ? ' on' : ''}`} onClick={onClick}>
      <i className="ojt-kpi-ic">{icon}</i><div><b>{value}</b><span>{label}</span></div>
    </button>
  )
}

/** Mentor / leader bộ phận (và HR) theo dõi nhân viên mới: tiến độ viết, thiếu liên tiếp, chưa nhận xét, điểm tuần, đề xuất và kết luận; mở modal để nhận xét, chấm tuần, kết luận. */
export default function OjtTeamPage() {
  const { t } = useTranslation()
  return (
    <div className="page wide ojt-root">
      <PageBanner avatar={<TeamOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.ojtTeam')} subtitle={t('nav.ojtTeamDesc')} />
      <OjtOverview />
    </div>
  )
}

/** Thẻ số liệu + bộ lọc + bảng tiến độ OJT; `manage` (màn Kế hoạch OJT của HR) thêm nút huỷ kế hoạch. */
export function OjtOverview({ manage = false }: { manage?: boolean }) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [mentorF, setMentorF] = useState<string>()
  const [range, setRange] = useState<[string, string] | null>(null)
  const cancel = useMutation({
    mutationFn: (id: number) => ojt.cancel(id),
    onSuccess: () => { toast.success(t('ojt.cancelled')); qc.invalidateQueries({ queryKey: ['ojt-team'] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  const [status, setStatus] = useState<string>('all')
  const [dept, setDept] = useState<string>()
  const [text, setText] = useState('')
  const dText = useDebouncedValue(text)   // gõ xong mới lọc, không lọc lại sau mỗi phím
  const [focus, setFocus] = useState<Focus>('all')
  const [open, setOpen] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const q = useQuery({ queryKey: ['ojt-team', 'overview', status], queryFn: () => ojt.overview(status === 'all' ? undefined : status) })
  const rows = (q.data ?? []).filter((r) => r?.plan)   // máy chủ cũ trả dòng không có plan thì bỏ qua, không làm trắng trang
  const depts = [...new Set(rows.map((r) => r.plan.department).filter((x): x is string => !!x))].sort()
  const kw = foldText(dText.trim())
  const isAttn = (r: OjtRow) => r.streak >= 2 || r.uncommented > 0 || (r.weeksOwed ?? 0) > 0
  const isConclude = (r: OjtRow) => !!r.proposal && !r.final && r.plan.status !== 'done'
  const isNoMentor = (r: OjtRow) => !r.plan.mentorId && !r.plan.mentorIds?.length && r.plan.status !== 'cancelled' && r.plan.status !== 'done'
  const counts = { active: rows.filter((r) => r.plan.status === 'active').length, nomentor: rows.filter(isNoMentor).length, attn: rows.filter(isAttn).length, conclude: rows.filter(isConclude).length }
  const pass = (r: OjtRow) => focus === 'all' || (focus === 'attn' ? isAttn(r) : focus === 'nomentor' ? isNoMentor(r) : isConclude(r))
  const mentorOpts = [...new Map(rows.flatMap((r) => r.mentors ?? []).map((m) => [m.id, m])).values()].sort((x, y) => x.name.localeCompare(y.name))
  const rowMentors = (r: OjtRow) => (r.mentors?.length ? r.mentors : r.plan.mentorId ? [{ id: r.plan.mentorId, name: r.plan.mentorName ?? r.plan.mentorId }] : [])
  const photos = useOjtAvatars(rows.flatMap((r) => [r.plan.employeeId, ...rowMentors(r).map((m) => m.id)]))
  const shown = rows.filter((r) => pass(r) && (!dept || r.plan.department === dept) && (!mentorF || rowMentors(r).some((m) => m.id === mentorF)) && (!range || (r.plan.startDate >= range[0] && r.plan.startDate <= range[1])) && (!kw || foldText(`${r.plan.employeeName ?? ''} ${r.plan.employeeId}`).includes(kw)))
  const toggle = (f: Focus) => setFocus((cur) => (cur === f ? 'all' : f))
  return (
    <>
      <div className="ojt-kpis">
        <Kpi icon={<PlayCircleOutlined />} label={t('ojt.kpiActive')} value={counts.active} tone="blue" active={false} onClick={() => { setFocus('all'); setStatus('active') }} />
        <Kpi icon={<UserDeleteOutlined />} label={t('ojt.kpiNoMentor')} value={counts.nomentor} tone="orange" active={focus === 'nomentor'} onClick={() => toggle('nomentor')} />
        <Kpi icon={<WarningOutlined />} label={t('ojt.kpiAttention')} value={counts.attn} tone="red" active={focus === 'attn'} onClick={() => toggle('attn')} />
        <Kpi icon={<CheckCircleOutlined />} label={t('ojt.kpiConclude')} value={counts.conclude} tone="green" active={focus === 'conclude'} onClick={() => toggle('conclude')} />
      </div>
      <Card className="ojt-table-card">
        <div className="ojt-filter">
          <Segmented value={status} onChange={(v) => setStatus(String(v))}
            options={[{ value: 'all', label: t('ojt.all') }, { value: 'pending', label: t('ojt.status.pending') }, { value: 'active', label: t('ojt.status.active') }, { value: 'done', label: t('ojt.status.done') }]} />
          <Select allowClear showSearch filterOption={foldFilter()} placeholder={t('ojt.deptAll')} value={dept} onChange={setDept} style={{ minWidth: 200 }} options={depts.map((d) => ({ value: d, label: d }))} />
          <Select allowClear showSearch filterOption={foldFilter('label')} placeholder={t('ojt.mentorAll')} value={mentorF} onChange={setMentorF} style={{ minWidth: 200 }} options={mentorOpts.map((m) => ({ value: m.id, label: `${m.name} (${m.id})` }))} />
          <DatePicker.RangePicker allowEmpty={[true, true]} placeholder={[t('ojt.startFrom'), t('ojt.startTo')]} format="DD/MM/YYYY" onChange={(v) => setRange(v && v[0] && v[1] ? [v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')] : null)} />
          <Input.Search allowClear placeholder={t('ojt.search')} style={{ maxWidth: 260 }} onChange={(e) => setText(e.target.value)} />
          {manage && <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => { setExporting(true); ojt.report(status === 'all' ? undefined : status).catch((e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) }).finally(() => setExporting(false)) }}>{t('ojt.exportReport')}</Button>}
          {focus !== 'all' && <Tag closable color="processing" onClose={() => setFocus('all')}>{t(`ojt.kpi${focus === 'attn' ? 'Attention' : focus === 'nomentor' ? 'NoMentor' : 'Conclude'}`)}</Tag>}
        </div>
        <Table<OjtRow> rowKey={(r) => r.plan.id} size="middle" loading={q.isLoading} dataSource={shown} scroll={{ x: 980 }} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description={t('ojt.teamEmpty')} /> }} rowClassName={() => 'ojt-row'}
          onRow={(r) => ({ onClick: () => setOpen(r.plan.id) })}
          columns={[
            { title: t('ojt.employee'), render: (_: unknown, r) => (
              <div className="ojt-cell-person"><OjtAvatar name={r.plan.employeeName} src={photos[r.plan.employeeId]} size={38} /><div className="ojt-cell-name"><b>{r.plan.employeeName}</b><span>{r.plan.employeeId}{r.plan.department ? ` · ${r.plan.department}` : ''}</span></div></div>) },
            { title: t('ojt.mentor'), render: (_: unknown, r) => {
              const ms = rowMentors(r)
              return ms.length
                ? <div className="ojt-cell-person">{ms.slice(0, 2).map((m) => <OjtAvatar key={m.id} name={m.name} src={photos[m.id]} size={26} />)}<span className="ojt-cell-mentor">{ms[0].name}{ms.length > 1 ? ` +${ms.length - 1}` : ''}</span></div>
                : <Tag color="orange">{t('ojt.noMentor')}</Tag>
            } },
            { title: t('ojt.colProgress'), width: 210, render: (_: unknown, r) => (
              <div className="ojt-cell-progress"><div className="ojt-cp-top"><b>{r.plan.written}/{r.due}</b><span>{dayjs(r.plan.startDate).format('DD/MM/YY')} → {dayjs(r.plan.endDate).format('DD/MM/YY')}</span></div>
                <Progress percent={r.due ? Math.round((r.plan.written / r.due) * 100) : 0} size="small" showInfo={false} strokeColor="var(--c-primary)" /></div>) },
            { title: t('ojt.colAttention'), render: (_: unknown, r) => (
              <div className="ojt-flags">
                {r.streak > 0 && <Tag color={r.streak >= 2 ? 'red' : 'orange'}>{t('ojt.flagStreak', { n: r.streak })}</Tag>}
                {r.uncommented > 0 && <Tag color="orange">{t('ojt.flagUncommented', { n: r.uncommented })}</Tag>}
                {(r.weeksOwed ?? 0) > 0 && <Tag color="volcano">{t('ojt.flagOwed', { n: r.weeksOwed })}</Tag>}
                {(r.viDays ?? 0) > 0 && <Tag color="red" title={t('ojt.viTagTip')}>{t('ojt.flagVi', { n: r.viDays })}</Tag>}
                {r.streak === 0 && r.uncommented === 0 && !r.weeksOwed && !r.viDays && <span className="ojt-muted">—</span>}
              </div>) },
            { title: t('ojt.colScore'), align: 'center' as const, width: 96, render: (_: unknown, r) => (r.lastAvg != null ? <span className="ojt-score-pill">{r.lastAvg.toFixed(1)}</span> : '—') },
            { title: t('ojt.colConclusion'), render: (_: unknown, r) => (r.final ? <ConclusionTag value={r.final} /> : r.proposal ? <span><Tag>{t('ojt.proposalShort')}</Tag><ConclusionTag value={r.proposal} /></span> : '—') },
            { title: t('ojt.statusLabel'), render: (_: unknown, r) => <OjtStatusTag status={r.plan.status} /> },
            ...(manage ? [{ title: '', render: (_: unknown, r: OjtRow) => r.plan.status !== 'cancelled' && r.plan.status !== 'done' && (
              <span onClick={(e) => e.stopPropagation()}><Popconfirm title={t('ojt.cancelAsk')} onConfirm={() => cancel.mutate(r.plan.id)}><Button size="small" danger>{t('ojt.cancelPlan')}</Button></Popconfirm></span>) }] : []),
          ]} />
      </Card>
      {open !== null && <PlanDrawer id={open} readOnly={manage} onClose={() => setOpen(null)} />}
    </>
  )
}
