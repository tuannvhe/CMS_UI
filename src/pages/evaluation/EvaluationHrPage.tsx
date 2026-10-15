import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Input, InputNumber, Popconfirm, Popover, Select, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleFilled, CheckOutlined, CloseCircleFilled, SendOutlined, SolutionOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { key, MAX_NOTE, MAX_RELATION, review, toKey, type CultureScore, type ReviewBatchResult, type ReviewSet } from '../../api/review'
import type { EvaluationItem } from '../../api/evaluations'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import { StatTiles } from '../../components/StatTiles'
import { deptColumn, personColumn } from '../../components/cells'
import { EvaluationDetailDrawer } from './EvaluationDetailDrawer'
import { EvaluationReportView } from './EvaluationReportPage'
import { EvaluationOverview } from './EvaluationOverview'
import { EmployeeHistoryDrawer } from './EmployeeHistoryDrawer'
import { useToast } from '../../hooks/useToast'

type Draft = { pass?: boolean; remark: string }
const MAX_REMARK = 500
const BULK_WARN = 20   // chốt từ chừng này đơn trở lên thì xác nhận kỹ hơn
const k = (r: ReviewSet) => key(toKey(r))
const BASE_CULTURE = 20
const DISCIPLINE = 35
const isOp = (r: ReviewSet) => r.position?.toUpperCase() === 'OP'

/** Ô điểm G (nhóm hỗ trợ quản lý) của đơn OP: hiện tổng G hoặc "Chưa nhập", bấm để nhập văn hoá + quan hệ. */
function CultureCell({ r, score, onSaved }: { r: ReviewSet; score?: CultureScore; onSaved: () => void }) {
  const { t } = useTranslation()
  const message = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<number | null>(score?.note ?? null)
  const [rel, setRel] = useState<number | null>(score?.relation ?? null)
  const save = useMutation({
    mutationFn: () => review.setCulture(toKey(r), note ?? 0, rel ?? 0),
    onSuccess: () => { message.success(t('rev.gSaved', { name: r.fullName })); setOpen(false); onSaved() },
    onError: () => message.error(t('req.err.generic')),
  })
  const reset = (o: boolean) => { if (o) { setNote(score?.note ?? null); setRel(score?.relation ?? null) } setOpen(o) }
  return (
    <Popover trigger="click" open={open} onOpenChange={reset} title={t('rev.gTitle')} content={(
      <div style={{ display: 'grid', gap: 10, width: 280 }}>
        <label className="g-field"><span>{t('rev.gNote', { max: MAX_NOTE })}</span><InputNumber min={0} max={MAX_NOTE} step={1} value={note} onChange={setNote} style={{ width: '100%' }} /></label>
        <label className="g-field"><span>{t('rev.gRelation', { max: MAX_RELATION })}</span><InputNumber min={0} max={MAX_RELATION} step={1} value={rel} onChange={setRel} style={{ width: '100%' }} /></label>
        <div className="g-sum">
          <div><span>{t('rev.gCulture')}</span><b>{BASE_CULTURE + (note ?? 0)}/{BASE_CULTURE + MAX_NOTE}</b></div>
          <div><span>{t('rev.gRel')}</span><b>{rel ?? 0}/{MAX_RELATION}</b></div>
          <div><span>{t('rev.gDiscipline')}</span><b>{DISCIPLINE}/{DISCIPLINE}</b></div>
          <div className="tot"><span>G</span><b>{BASE_CULTURE + (note ?? 0) + (rel ?? 0) + DISCIPLINE}/100</b></div>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('rev.gHint')}</Typography.Text>
        <Button type="primary" loading={save.isPending} disabled={note === null || rel === null} onClick={() => save.mutate()}>{t('req.saveChanges')}</Button>
      </div>
    )}>
      {score ? <Tag color="green" variant="filled" style={{ cursor: 'pointer' }}>G {score.g}</Tag> : <Tag color="warning" variant="filled" style={{ cursor: 'pointer' }}>{t('rev.gNone')}</Tag>}
    </Popover>
  )
}

/**
 * Đánh giá cuối cùng của HR: sau khi các người đánh giá làm đủ vòng, HR chọn các đơn (tick), chốt Đậu / Rớt kèm nhận xét
 * (bắt buộc khi rớt) rồi gửi. Các đơn đã tick được giữ nguyên khi đổi bộ lọc / tìm kiếm / ngày; chốt xong là hoàn tất.
 */
export default function EvaluationHrPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const tabs = [{ key: 'pending', label: t('rev.tabPending') }, { key: 'done', label: t('rev.tabDone') }]
  const [tab, setTab] = usePageTab(tabs)
  const stage = tab === 'done' ? 'done' : 'pending'
  const [from, setFrom] = useState<Dayjs>(dayjs().subtract(365, 'day'))
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState<string>()
  const [type, setType] = useState<string>()
  const [picked, setPicked] = useState<Record<string, ReviewSet>>({})      // các đơn đã tick, giữ qua mọi lần lọc
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [viewing, setViewing] = useState<EvaluationItem | null>(null)
  const [profile, setProfile] = useState<ReviewSet | null>(null)

  const q = useQuery({ queryKey: ['evaluations', 'review', stage, from.format('YYYY-MM-DD'), search], queryFn: () => review.list(stage, from.format('YYYY-MM-DD'), search), staleTime: 0, enabled: stage === 'pending' })
  const counts = useQuery({ queryKey: ['evaluations', 'review-counts'], queryFn: review.counts, staleTime: 0 })
  // Đề xuất theo điểm tải riêng (proc báo cáo chậm) rồi ghép vào danh sách, không làm chậm danh sách chính.
  const sugg = useQuery({ queryKey: ['evaluations', 'review-suggest', from.format('YYYY-MM-DD')], queryFn: () => review.suggestions(from.format('YYYY-MM-DD')), enabled: stage === 'pending', staleTime: 5 * 60_000 })
  const culture = useQuery({ queryKey: ['evaluations', 'review-culture', from.format('YYYY-MM-DD')], queryFn: () => review.culture(from.format('YYYY-MM-DD')), enabled: stage === 'pending', staleTime: 0 })
  const cultureMap = useMemo(() => new Map((culture.data ?? []).map((c) => [`${c.employeeId.toLowerCase()}|${c.dateRate.slice(0, 10)}`, c])), [culture.data])
  const suggMap = useMemo(() => new Map((sugg.data ?? []).map((x) => [key({ employeeId: x.employeeId, dateRate: x.dateRate.slice(0, 10), typeRate: x.typeRate }), x])), [sugg.data])
  const all = useMemo(() => (q.data ?? []).map((r) => { const x = suggMap.get(k(r)); return x ? { ...r, suggest: x.suggest, suggestReason: x.suggestReason, total: x.total, culture: x.culture, overall: x.overall } : r }), [q.data, suggMap])
  const depts = useMemo(() => Array.from(new Set(all.map((r) => r.department).filter(Boolean))).sort(), [all])
  const types = useMemo(() => Array.from(new Set(all.map((r) => r.typeRate).filter(Boolean))).sort(), [all])
  const rows = useMemo(() => all.filter((r) => (!dept || r.department === dept) && (!type || r.typeRate === type)), [all, dept, type])

  /** Kết quả mặc định = đề xuất theo điểm (Không đạt thì điền sẵn lý do); HR đổi thì giá trị HR chọn được ưu tiên. */
  const defaultDraft = (r: ReviewSet): Draft => (r.suggest ? { pass: r.suggest === 'pass', remark: r.suggest === 'fail' ? (r.suggestReason ?? '') : '' } : { remark: '' })
  const draftOf = (r: ReviewSet): Draft => drafts[k(r)] ?? defaultDraft(r)
  const setDraft = (r: ReviewSet, d: Partial<Draft>) => setDrafts((o) => ({ ...o, [k(r)]: { ...(o[k(r)] ?? defaultDraft(r)), ...d } }))
  const selected = Object.values(picked)
  const valid = (r: ReviewSet) => { const d = draftOf(r); return d.pass !== undefined && (d.pass || d.remark.trim().length > 0) }
  const incomplete = selected.filter((r) => !valid(r)).length
  // Tóm tắt trước khi chốt: số Đạt / Không đạt, và cảnh báo thêm khi chốt nhiều đơn một lần (không sửa lại được)
  const nFail = selected.filter((r) => draftOf(r).pass === false).length
  const sendAsk = t(selected.length >= BULK_WARN ? 'rev.sendAskBulk' : 'rev.sendAskDetail', { n: selected.length, pass: selected.length - nFail, fail: nFail })

  const toggle = (rs: ReviewSet[], on: boolean) => setPicked((o) => {
    const n = { ...o }
    for (const r of rs) { if (on) n[k(r)] = r; else delete n[k(r)] }
    return n
  })
  /** Chọn Đậu/Rớt cho một đơn cũng tự tick đơn đó. */
  const decide = (r: ReviewSet, pass: boolean) => { setDraft(r, { pass }); toggle([r], true) }
  const decideAll = (pass: boolean) => setDrafts((o) => Object.fromEntries([...Object.entries(o), ...selected.map((r) => [k(r), { ...(o[k(r)] ?? defaultDraft(r)), pass }] as const)]))

  const send = useMutation({
    mutationFn: () => review.finalize(selected.map((r) => ({ ...toKey(r), pass: draftOf(r).pass as boolean, remark: draftOf(r).remark.trim() }))),
    onSuccess: (r: ReviewBatchResult) => {
      if (r.skipped.length) message.warning(t('rev.partial', { n: r.done, skipped: r.skipped.length }))
      else message.success(t('rev.decided', { n: r.done }))
      setPicked({}); setDrafts({}); qc.invalidateQueries({ queryKey: ['evaluations'] })
    },
    onError: () => message.error(t('req.err.generic')),
  })

  const open = (r: ReviewSet) => setViewing({
    id: '', employeeId: r.employeeId, fullName: r.fullName, position: r.position, startWork: r.startWork, department: r.department,
    typeRate: r.typeRate, dateRate: r.dateRate, round: r.rounds,
  })

  const base: ColumnsType<ReviewSet> = [
    personColumn<ReviewSet>(t('att.name'), 240),
    deptColumn<ReviewSet>(t('att.dept'), 200),
    { title: t('eva.typeRate'), dataIndex: 'typeRate', width: 270, render: (v: string) => <Tag color="green" variant="filled">{v}</Tag> },
    { title: t('eva.dateRate'), dataIndex: 'dateRate', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('rev.rounds'), dataIndex: 'rounds', width: 90, align: 'center', render: (v: number) => <Tag variant="filled">{v}</Tag> },
  ]
  const view: ColumnsType<ReviewSet>[number] = { title: '', width: 170, render: (_: unknown, r: ReviewSet) => <Space size={6}><Button size="small" onClick={() => open(r)}>{t('eva.view')}</Button><Button size="small" onClick={() => setProfile(r)}>{t('emh.button')}</Button></Space> }

  const columns: ColumnsType<ReviewSet> = stage === 'pending'
    ? [
      ...base,
      {
        title: t('rev.gScore'), width: 120, align: 'center',
        render: (_: unknown, r: ReviewSet) => isOp(r)
          ? <CultureCell key={`${k(r)}|${cultureMap.get(`${r.employeeId.toLowerCase()}|${r.dateRate.slice(0, 10)}`)?.g ?? 'x'}`} r={r} score={cultureMap.get(`${r.employeeId.toLowerCase()}|${r.dateRate.slice(0, 10)}`)}
              onSaved={() => { qc.invalidateQueries({ queryKey: ['evaluations', 'review-culture'] }); qc.invalidateQueries({ queryKey: ['evaluations', 'review-suggest'] }) }} />
          : <span className="cell-muted">—</span>,
      },
      {
        title: t('rev.score'), width: 150, align: 'center',
        render: (_: unknown, r: ReviewSet) => {
          if (r.total == null) return <span className="cell-muted">—</span>
          if (!isOp(r)) return <Tooltip title={t('rev.avgTip')}><b>{r.total}</b></Tooltip>
          return r.overall != null
            ? <Tooltip title={t('rev.overallTip', { f: r.total, g: r.culture })}><b>{r.overall}</b></Tooltip>
            : <Tooltip title={t('rev.noGTip', { f: r.total })}><span>{r.total} <Tag color="warning" variant="filled" style={{ marginInlineEnd: 0 }}>{t('rev.gNone')}</Tag></span></Tooltip>
        },
      },
      {
        title: t('rev.result'), width: 200,
        render: (_: unknown, r: ReviewSet) => (
          <Tooltip title={r.suggest && !drafts[k(r)] ? `${t('rev.autoByScore')}: ${r.suggestReason ?? ''}` : undefined}>
          <Select<'pass' | 'fail'> className={`res-select${draftOf(r).pass === undefined ? '' : draftOf(r).pass ? ' pass' : ' fail'}`} style={{ width: 170 }} allowClear
            placeholder={t('rev.notChosen')} value={draftOf(r).pass === undefined ? undefined : draftOf(r).pass ? 'pass' : 'fail'}
            options={[
              { value: 'pass', label: <span className="res-opt pass"><CheckCircleFilled /> {t('rev.pass')}</span> },
              { value: 'fail', label: <span className="res-opt fail"><CloseCircleFilled /> {t('rev.fail')}</span> },
            ]}
            onChange={(v) => { if (v) decide(r, v === 'pass'); else setDraft(r, { pass: undefined }) }} />
          </Tooltip>
        ),
      },
      {
        title: t('rev.remark'), width: 300,
        render: (_: unknown, r: ReviewSet) => {
          const d = draftOf(r)
          return <Input size="small" maxLength={MAX_REMARK} value={d.remark} status={d.pass === false && !d.remark.trim() ? 'error' : undefined}
            placeholder={d.pass === false ? t('rev.remarkRequired') : t('rev.remarkOptional')} onChange={(e) => setDraft(r, { remark: e.target.value })} />
        },
      },
      view,
    ]
    : [
      ...base,
      { title: t('rev.result'), dataIndex: 'hqResult', width: 120, render: (v: string | null) => (v ? <Tag variant="filled" color={v === 'Y' ? 'success' : 'error'}>{v === 'Y' ? t('rev.pass') : t('rev.fail')}</Tag> : <span className="cell-muted">—</span>) },
      { title: t('rev.remark'), dataIndex: 'hqRemark', ellipsis: true, render: (v: string | null) => (v ? <Tooltip title={v}>{v}</Tooltip> : '') },
      { title: t('rev.hrDate'), dataIndex: 'hrDate', width: 160, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '') },
      view,
    ]

  const filtering = !!dept || !!type || search.trim() !== ''

  if (stage === 'done') {
    return (
      <>
        <PageTabs items={tabs} active={stage} onChange={(x) => { setPicked({}); setDrafts({}); setTab(x) }} />
        <div className="page wide">
          <PageBanner
            avatar={<Avatar size={56} icon={<SolutionOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
            title={t('nav.evaluationHr')} subtitle={t('rev.noteDone')}
          />
        </div>
        <EvaluationReportView />
      </>
    )
  }

  return (
    <>
      <PageTabs items={tabs} active={stage} onChange={(x) => { setPicked({}); setDrafts({}); setTab(x) }} />
      <div className="page wide">
        <PageBanner
          avatar={<Avatar size={56} icon={<SolutionOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
          title={t('nav.evaluationHr')} subtitle={t('nav.evaluationHrDesc')}
        />
        <StatTiles items={[
          { label: t('rev.tabPending'), value: counts.data?.pending ?? 0, color: '#D48806' },
          { label: t('rev.tileSelected'), value: selected.length, color: '#2F6FB0' },
          { label: t('rev.tileReady'), value: selected.length - incomplete, color: '#2E9E4F' },
        ]} />
        <EvaluationOverview />
        <Alert type="info" showIcon title={t(stage === 'pending' ? 'rev.notePending' : 'rev.noteDone')} style={{ marginBottom: 16 }} />
        <DataTable<ReviewSet>
          rowKey={k} loading={q.isFetching} columns={columns} dataSource={rows}
          rowSelection={stage === 'pending' ? {
            selectedRowKeys: Object.keys(picked),
            preserveSelectedRowKeys: true,
            onSelect: (r, on) => toggle([r], on),
            onSelectAll: (on, _sel, changed) => toggle(changed, on),
          } : undefined}
          locale={{ emptyText: q.isError ? t('req.err.generic') : t('rev.empty') }}
          toolbar={(
            <div className="dt-rows">
              <div className="dt-row">
                <DatePicker allowClear={false} format="DD/MM/YYYY" value={from} onChange={(v) => v && setFrom(v)} placeholder={t('rev.fromDate')} />
                <Input.Search allowClear style={{ width: 240 }} placeholder={t('eva.search')} onSearch={setSearch} />
                <Select allowClear showSearch style={{ width: 220 }} placeholder={t('att.allDepts')} value={dept} onChange={setDept} options={depts.map((d) => ({ value: d, label: d }))} />
                <Select allowClear showSearch style={{ width: 280 }} placeholder={t('rev.allTypes')} value={type} onChange={setType} options={types.map((x) => ({ value: x, label: x }))} />
                {filtering && <Typography.Text type="secondary">{rows.length}/{all.length}</Typography.Text>}
                {filtering && <Button type="link" size="small" onClick={() => { setDept(undefined); setType(undefined); setSearch('') }}>{t('req.clearFilter')}</Button>}
              </div>
              {stage === 'pending' && (
                <div className="dt-row dt-row-filters">
                  <Button onClick={() => toggle(rows, true)} disabled={rows.length === 0}>{t('rev.selectShown', { n: rows.length })}</Button>
                  <Button onClick={() => setPicked({})} disabled={selected.length === 0}>{t('rev.clearSelected')}</Button>
                  <Button disabled={selected.length === 0} icon={<CheckOutlined />} onClick={() => decideAll(true)}>{t('rev.passSelected')}</Button>
                  <Typography.Text type="secondary">{t('rev.selectedN', { n: selected.length })}</Typography.Text>
                  {incomplete > 0 && <Tag color="warning" variant="filled">{t('rev.incompleteN', { n: incomplete })}</Tag>}
                  <Popconfirm title={sendAsk} okText={t('rev.send')} cancelText={t('req.cancel')} onConfirm={() => send.mutate()} disabled={selected.length === 0 || incomplete > 0}>
                    <Button type="primary" icon={<SendOutlined />} disabled={selected.length === 0 || incomplete > 0} loading={send.isPending}>{t('rev.send')} ({selected.length})</Button>
                  </Popconfirm>
                </div>
              )}
            </div>
          )}
        />
        <EvaluationDetailDrawer item={viewing} onClose={() => setViewing(null)} readOnly />
        <EmployeeHistoryDrawer employeeId={profile?.employeeId ?? null} name={profile?.fullName} onClose={() => setProfile(null)} />
      </div>
    </>
  )
}
