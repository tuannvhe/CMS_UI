import { useEffect, useRef, useState } from 'react'
import { Alert, Avatar, DatePicker, Button, Card, Col, Empty, Form, Input, Popconfirm, Radio, Row, Segmented, Space, Tabs, Tag, Grid } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AppstoreOutlined, AuditOutlined, CheckCircleOutlined, FileExcelOutlined, PrinterOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { averageOfPanel, exportSlotUrl, recruit, SCORE_CRITERIA, type AllInterview, type InkField, type MyInterview, type RecruitScores } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { AppModal } from '../../components/AppModal'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { CandidatePhoto, CvPane, isRecruitLead, ScoreAverageBox, ScoreLine, ScorePicker, ScoreTag, UnlockButton } from './RecruitCommon'
import { AgeCell, EduCell, EduRows, ExpCell, ExpRows } from './RecruitCvFacts'
import { printSlotList } from './RecruitPrint'
import { InkImages, InkToggle, type InkPadHandle } from './InkPad'

/** Điểm / ghi chú riêng của nhân sự cho một lượt (không vào hội đồng, không tính vào điểm trung bình). */
function HrReviewCard({ item, me }: { item: AllInterview; me?: string }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const mineRev = item.hrReviews?.find((r) => r.userId === me)
  const [form] = Form.useForm<{ scores?: Partial<RecruitScores>; note?: string }>()
  useEffect(() => { form.setFieldsValue({ scores: mineRev?.scores ?? undefined, note: mineRev?.note ?? '' }) }, [form, mineRev])
  const save = useMutation({
    mutationFn: (v: { scores?: Partial<RecruitScores>; note?: string }) => {
      const sc = v.scores && SCORE_CRITERIA.every((k) => v.scores![k]) ? (v.scores as RecruitScores) : null
      if (v.scores && Object.values(v.scores).some(Boolean) && !sc) return Promise.reject(new Error('scores'))
      return recruit.hrReview(item.interview.id, sc, v.note ?? '')
    },
    onSuccess: () => { msg.success(t('usr.saved')); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code || (e as Error).message}`, { defaultValue: t('usr.err.generic') })) },
  })
  const others = (item.hrReviews ?? []).filter((r) => r.userId !== me)
  return (
    <Card title={t('rec.hrReview')} style={{ marginBottom: 16 }}>
      <div className="cell-muted" style={{ marginBottom: 10 }}>{t('rec.hrReviewHint')}</div>
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
        {SCORE_CRITERIA.map((k) => <Form.Item key={k} name={['scores', k]} label={t(`rec.sc.${k}`)} style={{ marginBottom: 8 }}><ScorePicker /></Form.Item>)}
        <Form.Item name="note" label={t('rec.hrReviewNote')} rules={[{ max: 1000 }]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending}>{t('rec.hrReviewSave')}</Button>
      </Form>
      {others.length > 0 && (
        <Space direction="vertical" style={{ width: '100%', marginTop: 14 }}>
          {others.map((r) => <div key={r.userId}><b>{r.name ?? r.userId}</b> {r.scores && <ScoreTag scores={r.scores} />}{r.note && <div>{r.note}</div>}</div>)}
        </Space>
      )}
    </Card>
  )
}

/**
 * Người phỏng vấn (máy tính / tablet): lịch của mình, xem CV ngay trong lúc phỏng vấn và nhập đánh giá. Nút lớn, bố cục xếp dọc trên màn hẹp.
 * Mỗi người chỉ thấy phần đánh giá của chính mình, không thấy ý kiến người khác.
 */
export default function RecruitInterviewsPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canAll = !!user?.isAdmin || !!user?.grantedPages?.includes('recruitManage')
  const lead = isRecruitLead(user)
  // HR / quản trị mặc định vào tab Tất cả; người được mời phỏng vấn chỉ có tab Của tôi
  const [all, setAll] = useState(canAll)
  const [viewing, setViewing] = useState<AllInterview | null>(null)
  const [pending, setPending] = useState(true)
  const wide = Grid.useBreakpoint().xl ?? false
  const [active, setActive] = useState<MyInterview | null>(null)
  type EvalForm = { result: 'pass' | 'fail'; strengths?: string; weaknesses?: string; comment?: string; scores?: RecruitScores }
  const [form] = Form.useForm<EvalForm>()
  const result = Form.useWatch('result', form)
  const scores = Form.useWatch('scores', form) as Partial<RecruitScores> | undefined
  const scoreSum = SCORE_CRITERIA.reduce((n, k) => n + (scores?.[k] ?? 0), 0)
  // Khung viết tay: có nét viết thì được thay cho chữ gõ ở lý do "Không đạt"
  const padS = useRef<InkPadHandle>(null), padW = useRef<InkPadHandle>(null), padC = useRef<InkPadHandle>(null)
  const [ink, setInk] = useState<Record<InkField, boolean>>({ strengths: false, weaknesses: false, comment: false })
  const inked = Object.values(ink).some(Boolean)
  useEffect(() => { if (!active) setInk({ strengths: false, weaknesses: false, comment: false }) }, [active])
  // Bảng gọn (nhiều ứng viên một buổi) hoặc thẻ lớn (tablet); nhớ lựa chọn trên máy này.
  const [layout, setLayout] = useState<'cards' | 'table'>(() => { try { return localStorage.getItem('rec.ivLayout') === 'cards' ? 'cards' : 'table' } catch { return 'table' } })
  const pickLayout = (v: 'cards' | 'table') => { setLayout(v); try { localStorage.setItem('rec.ivLayout', v) } catch { /* bỏ qua */ } }

  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  // Xem ngày cũ: chọn khoảng ngày (chỉ khi xem "Tất cả"); không chọn thì lấy 300 lượt gần nhất
  const [range, setRange] = useState<[string, string] | null>(null)
  const rf = range?.[0], rt = range?.[1]
  const pendingEff = pending && !range
  const q = useQuery({ queryKey: ['recruit', 'myInterviews', pendingEff, rf, rt], queryFn: () => recruit.myInterviews(pendingEff, rf, rt), retry: false, refetchInterval: 60_000 })
  const sq = useQuery({ queryKey: ['recruit', 'scoring'], queryFn: recruit.scoring, staleTime: 5 * 60_000, retry: false })
  const scoringOn = !!sq.data?.enabled
  const qa = useQuery({ queryKey: ['recruit', 'allInterviews', pendingEff, rf, rt], queryFn: () => recruit.allInterviews(pendingEff, rf, rt), retry: false, enabled: all, refetchInterval: 60_000 })
  const submit = useMutation({
    mutationFn: async (v: EvalForm) => {
      const id = active!.interview.id
      const inkFields: InkField[] = []
      for (const [field, pad] of [['strengths', padS], ['weaknesses', padW], ['comment', padC]] as const) {
        const png = await pad.current?.png()
        if (png) { await recruit.uploadInk(id, field, png); inkFields.push(field) }
      }
      return recruit.evaluate(id, { ...v, inkFields })
    },
    onSuccess: () => { msg.success(t('rec.evaluated')); setActive(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(errText(e)),
  })

  const attend = useMutation({
    mutationFn: (v: { id: number; present: boolean }) => recruit.attend(v.id, v.present),
    onSuccess: (_d, v) => { msg.success(t(v.present ? 'rec.presentOk' : 'usr.saved')); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  // HR mở một lượt ở tab Tất cả để chấm điểm / ghi chú như người phỏng vấn: chưa trong hội đồng thì tự thêm mình vào, rồi mở phiếu của mình
  const joinAndEvaluate = useMutation({
    mutationFn: async (v: AllInterview) => {
      const me = user?.userId ?? ''
      if (!v.interview.panel.some((p) => p.interviewerId === me)) await recruit.addInterviewers(v.interview.id, [me])
      const mine = await recruit.myInterviews(false)
      const found = mine.find((m) => m.interview.id === v.interview.id)
      if (!found) throw new Error('not_found')
      return found
    },
    onSuccess: (m) => { setViewing(null); setActive(m); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const time = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  // Quá hạn nhập (hết ngày phỏng vấn, chưa được gia hạn): phiếu khoá, chỉ xem
  const expired = (m: MyInterview) => m.interview.status === 'planned' && !m.mine.result && !!m.evalUntil && Date.now() >= new Date(m.evalUntil).getTime()
  const canEvaluate = (m: MyInterview) => m.interview.status === 'planned' && !m.mine.result && m.application.status === 'scheduled' && !expired(m)
  // Chia theo ca phỏng vấn: mỗi tab là một khung giờ bắt đầu (ngày + giờ); mặc định mở ca sắp tới gần nhất
  const slotOf = (v: string) => { const d = new Date(v); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }
  const slotLabel = (v: string) => new Date(v).toLocaleString(i18n.language, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const source: { interview: { startAt: string } }[] = (all ? qa.data : q.data) ?? []
  const slots = Array.from(new Map(source.map((m) => [slotOf(m.interview.startAt), m.interview.startAt])).entries()).sort(([a], [b]) => a.localeCompare(b))
  const [slotPick, setSlotPick] = useState<string | null>(null)
  const upcoming = slots.find(([, v]) => new Date(v).getTime() >= Date.now() - 90 * 60_000)?.[0] ?? ''
  const slot = slotPick !== null && (slotPick === '' || slots.some(([k]) => k === slotPick)) ? slotPick : upcoming
  const inSlot = <T extends { interview: { startAt: string } }>(list: T[]) => (slot ? list.filter((m) => slotOf(m.interview.startAt) === slot) : list)
  const items = inSlot(q.data ?? [])
  const allItems = inSlot(qa.data ?? [])

  /** Điểm danh có mặt / vắng của HR cho từng lượt, ngay trên lịch. */
  const attendCell = (m: AllInterview) => {
    if (m.interview.status !== 'planned') return <Tag>{t(`rec.iv.${m.interview.status}`)}</Tag>
    const busy = attend.isPending && attend.variables?.id === m.interview.id
    if (m.attended) return <Tag color="green" icon={<CheckCircleOutlined />}>{t('rec.presentTag')}</Tag>
    return (
      // Chặn click nổi bọt lên dòng (cả từ hộp xác nhận hiện ra ngoài bảng), nếu không bấm nút lại mở chi tiết ứng viên
      <Space size={4} wrap onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <Popconfirm title={t('rec.presentAsk')} onConfirm={() => attend.mutate({ id: m.interview.id, present: true })}><Button type="primary" size="small" icon={<CheckCircleOutlined />} loading={busy}>{t('rec.present')}</Button></Popconfirm>
        <Popconfirm title={t('rec.noShowAsk')} description={t('rec.absentHint')} onConfirm={() => attend.mutate({ id: m.interview.id, present: false })}><Button danger size="small" loading={busy}>{t('rec.noShow')}</Button></Popconfirm>
      </Space>
    )
  }
  const myStatus = (m: MyInterview) => m.mine.result ? <Tag color={m.mine.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${m.mine.result}`)}</Tag> : m.interview.status === 'planned' ? <Tag color="blue">{t('rec.waiting')}</Tag> : <Tag>{t(`rec.iv.${m.interview.status}`)}</Tag>
  const who = (a: MyInterview['application']) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {a.hasFile ? <CandidatePhoto id={a.id} name={a.fullName} /> : null}
      <span><b>{a.fullName}</b><div className="cell-muted">{a.position}{a.department ? ` · ${a.department}` : ''}</div></span>
    </div>
  )
  const where = (i: { round: number; location: string | null }) => <span>{t('rec.round')} {i.round}{i.location ? <div className="cell-muted">{i.location}</div> : null}</span>
  // Cột so sánh nhanh giữa các ứng viên (đọc từ CV / HR nhập): kinh nghiệm, năm sinh, học vấn
  const factCols = <T extends { application: MyInterview['application']; cv?: MyInterview['cv'] }>(): ColumnsType<T> => [
    { title: t('rec.cvf.exp'), key: 'exp', width: 300, sorter: (a, b) => (a.application.expMonths ?? -1) - (b.application.expMonths ?? -1), render: (_: unknown, m) => <div><b><ExpCell app={m.application} /></b><ExpRows cv={m.cv} /></div> },
    { title: t('rec.cvf.edu'), key: 'edu', width: 280, render: (_: unknown, m) => <div><b><EduCell value={m.application.education} /></b><EduRows cv={m.cv} /></div> },
    { title: t('rec.cvf.birth'), key: 'birth', width: 90, render: (_: unknown, m) => <AgeCell app={m.application} /> },
  ]
  const mineCols: ColumnsType<MyInterview> = [
    { title: t('rec.when'), width: 170, render: (_: unknown, m) => time(m.interview.startAt), sorter: (a, b) => a.interview.startAt.localeCompare(b.interview.startAt), defaultSortOrder: 'ascend' },
    { title: t('rec.fullName'), width: 260, render: (_: unknown, m) => who(m.application) },
    ...factCols<MyInterview>(),
    { title: t('rec.round'), width: 160, render: (_: unknown, m) => where(m.interview) },
    { title: t('cov.status'), width: 170, render: (_: unknown, m) => <Space size={4} wrap>{myStatus(m)}{m.mine.scores && <ScoreTag scores={m.mine.scores} />}{m.average && <Tag color="green">{t('rec.avg.short')} {m.average.total}/20</Tag>}</Space> },
    { title: '', width: 150, render: (_: unknown, m) => <Button type={canEvaluate(m) ? 'primary' : 'default'} onClick={() => setActive(m)}>{t(canEvaluate(m) ? 'rec.evaluateShort' : 'rec.open')}</Button> },
  ]
  const allCols: ColumnsType<AllInterview> = [
    { title: t('rec.when'), width: 170, render: (_: unknown, m) => time(m.interview.startAt), sorter: (a, b) => a.interview.startAt.localeCompare(b.interview.startAt), defaultSortOrder: 'ascend' },
    { title: t('rec.fullName'), width: 260, render: (_: unknown, m) => who(m.application) },
    ...factCols<AllInterview>(),
    { title: t('rec.round'), width: 160, render: (_: unknown, m) => where(m.interview) },
    { title: t('rec.attendance'), width: 170, render: (_: unknown, m) => attendCell(m) },
    { title: t('rec.panel'), render: (_: unknown, m) => <Space size={4} wrap>{m.interview.panel.map((p) => <Tag key={p.id} color={p.result === 'pass' ? 'green' : p.result === 'fail' ? 'red' : undefined}>{p.interviewerName ?? p.interviewerId}{p.scores ? ` · ${SCORE_CRITERIA.reduce((n, k) => n + p.scores![k], 0)}` : ''}</Tag>)}</Space> },
    { title: '', width: 110, render: (_: unknown, m) => <Button onClick={() => setViewing(m)}>{t('rec.open')}</Button> },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<AuditOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.recruitInterviews')} subtitle={t('nav.recruitInterviewsDesc')} />
      <Space wrap style={{ marginBottom: 16 }}>
        {canAll && <Segmented value={all ? 'all' : 'mine'} onChange={(v) => setAll(v === 'all')} options={[{ value: 'mine', label: t('rec.viewMine') }, { value: 'all', label: t('rec.viewAll') }]} />}
        <Segmented value={pending ? 'p' : 'a'} onChange={(v) => setPending(v === 'p')} options={[{ value: 'p', label: t('rec.fPending') }, { value: 'a', label: t('org.all') }]} />
        <DatePicker.RangePicker allowClear placeholder={[t('rec.fFrom', { defaultValue: 'Từ ngày' }), t('rec.fTo', { defaultValue: 'Đến ngày' })]} onChange={(_, s) => setRange(s[0] && s[1] ? [s[0], s[1]] : null)} />
        {canAll && all && <Button icon={<FileExcelOutlined />} href={exportSlotUrl(slot)}>{t('rec.slot.excel')}</Button>}
        {canAll && all && <Button icon={<PrinterOutlined />} disabled={allItems.length === 0} onClick={() => { const label = slot ? slotLabel(slots.find(([k]) => k === slot)![1]) : t('rec.slot.all'); if (!printSlotList(t, i18n.language, `${t('nav.recruitInterviews')} · ${label}`, allItems)) msg.error(t('rec.popupBlocked')) }}>{t('rec.slot.print')}</Button>}
        <Segmented value={layout} onChange={(v) => pickLayout(v as 'cards' | 'table')} options={[{ value: 'cards', icon: <AppstoreOutlined />, label: t('rec.layoutCards') }, { value: 'table', icon: <UnorderedListOutlined />, label: t('rec.layoutTable') }]} />
      </Space>
      {slots.length > 0 && (
        <Tabs className="rec-slots" activeKey={slot} onChange={setSlotPick} items={[
          { key: '', label: <span>{t('rec.slot.all')} <span className="n">{source.length}</span></span> },
          ...slots.map(([k, v]) => ({ key: k, label: <span>{slotLabel(v)} <span className="n">{source.filter((m) => slotOf(m.interview.startAt) === k).length}</span></span> })),
        ]} />
      )}
      {layout === 'table' ? (all
        ? <DataTable<AllInterview> className="rec-list" rowKey={(m) => m.interview.id} size="small" loading={qa.isLoading} columns={allCols} dataSource={allItems} pagination={{ pageSize: 50, showSizeChanger: false }}
            onRow={(m) => ({ onClick: () => setViewing(m), style: { cursor: 'pointer' } })} locale={{ emptyText: qa.isError ? t('usr.err.generic') : t('rec.emptyInterviews') }} />
        : <DataTable<MyInterview> className="rec-list" rowKey={(m) => m.interview.id} size="small" loading={q.isLoading} columns={mineCols} dataSource={items} pagination={{ pageSize: 50, showSizeChanger: false }}
            onRow={(m) => ({ onDoubleClick: () => setActive(m) })} locale={{ emptyText: q.isError ? t('usr.err.generic') : t('rec.emptyInterviews') }} />
      ) : all ? (allItems.length === 0 ? <Empty description={qa.isError ? t('usr.err.generic') : t('rec.emptyInterviews')} /> : (
        <Row gutter={[16, 16]}>
          {allItems.map((m) => (
            <Col xs={24} md={12} xl={8} key={m.interview.id}>
              <Card hoverable onClick={() => setViewing(m)} title={time(m.interview.startAt)} extra={<Tag>{t(`rec.iv.${m.interview.status}`)}</Tag>}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {m.application.hasFile && <CandidatePhoto id={m.application.id} name={m.application.fullName} height={84} />}
                  <div>
                    <b style={{ fontSize: 16 }}>{m.application.fullName}</b>
                    <div className="cell-muted">{m.application.position}{m.application.department ? ` · ${m.application.department}` : ''}</div>
                    <div className="cell-muted">{t('rec.round')} {m.interview.round}{m.interview.location ? ` · ${m.interview.location}` : ''}</div>
                  </div>
                </div>
                <Space size={4} wrap style={{ marginTop: 8 }}>{m.interview.panel.map((p) => <Tag key={p.id} color={p.result === 'pass' ? 'green' : p.result === 'fail' ? 'red' : undefined}>{p.interviewerName ?? p.interviewerId}</Tag>)}</Space>
              </Card>
            </Col>
          ))}
        </Row>
      )) : items.length === 0 ? <Empty description={q.isError ? t('usr.err.generic') : t('rec.emptyInterviews')} /> : (
        <Row gutter={[16, 16]}>
          {items.map((m) => (
            <Col xs={24} md={12} xl={8} key={m.interview.id}>
              <Card hoverable onClick={() => setActive(m)} title={<span>{time(m.interview.startAt)}</span>} extra={m.mine.result ? <Tag color={m.mine.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${m.mine.result}`)}</Tag> : expired(m) ? <Tag color="orange">{t('rec.el.expired')}</Tag> : m.interview.status === 'planned' ? <Tag color="blue">{t('rec.waiting')}</Tag> : <Tag>{t(`rec.iv.${m.interview.status}`)}</Tag>}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {m.application.hasFile && <CandidatePhoto id={m.application.id} name={m.application.fullName} height={84} />}
                  <div>
                    <b style={{ fontSize: 16 }}>{m.application.fullName}</b>
                    <div className="cell-muted">{m.application.position}{m.application.department ? ` · ${m.application.department}` : ''}</div>
                    <div className="cell-muted">{t('rec.round')} {m.interview.round}{m.interview.location ? ` · ${m.interview.location}` : ''}</div>
                    <div className="cell-muted"><ExpCell app={m.application} /> · <EduCell value={m.application.education} /></div>
                  </div>
                </div>
                {m.average && <div style={{ marginTop: 6 }}>{t('rec.avg.title')}: <b>{m.average.total}/20</b></div>}
                <Button type={canEvaluate(m) ? 'primary' : 'default'} size="large" block style={{ marginTop: 12 }}>{t(canEvaluate(m) ? 'rec.openAndEvaluate' : 'rec.open')}</Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      <AppModal
        open={!!active} onClose={() => { setActive(null); form.resetFields() }} size="full" icon={<AuditOutlined />}
        title={active?.application.fullName ?? ''}
        subtitle={active ? `${active.application.position} · ${time(active.interview.startAt)}${active.interview.location ? ` · ${active.interview.location}` : ''}` : undefined}
        onOk={active && canEvaluate(active) ? () => form.submit() : undefined} okText={t('rec.submit')} okLoading={submit.isPending}
      >
        {active && (
          <Row gutter={[16, 16]} className="iv-eval">
            <Col xs={24} xl={14}>{canEvaluate(active) || ['evaluated', 'consider'].includes(active.application.status) ? <CvPane id={active.application.id} admin={false} hideTools height={wide ? '74vh' : '52vh'} /> : <Empty description={t('rec.noCv')} />}</Col>
            <Col xs={24} xl={10}>
              <div className="iv-eval-form"><div className="rec-section">{t('rec.myEvaluation')}</div>
                {active.profile && (active.profile.availableFrom || active.profile.languages) && (
                  <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('rec.ivProfile.title')} description={
                    <div>
                      <div><b>{t('rec.pf.availableFrom')}:</b> {active.profile.availableFrom ? active.profile.availableFrom.slice(0, 10).split('-').reverse().join('/') : '—'}</div>
                      <div><b>{t('rec.pf.languages')}:</b> {active.profile.languages || '—'}</div>
                    </div>} />
                )}
                {expired(active) && active.application.status === 'scheduled' && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('rec.el.expired')} description={t('rec.el.expiredHint')} />}
                {canEvaluate(active) ? (
                  <Form form={form} layout="vertical" onFinish={(v) => submit.mutate(v)}>
                    <Form.Item name="result" label={t('rec.result')} rules={[{ required: true, message: t('rec.err.result') }]}>
                      <Radio.Group size="large" optionType="button" buttonStyle="solid" options={[{ value: 'pass', label: t('rec.res.pass') }, { value: 'fail', label: t('rec.res.fail') }]} />
                    </Form.Item>
                    {scoringOn && (
                      <div style={{ marginBottom: 16 }}>
                        {SCORE_CRITERIA.map((k) => (
                          <Form.Item key={k} name={['scores', k]} label={t(`rec.scLabel.${k}`)} extra={t(`rec.scHint.${k}`)} rules={[{ required: true, message: t('rec.err.scores') }]} style={{ marginBottom: 10 }}>
                            <ScorePicker />
                          </Form.Item>
                        ))}
                        <div>{t('rec.scoreTotal')}: <b style={{ fontSize: 18 }}>{scoreSum}</b>/20</div>
                      </div>
                    )}
                    <Form.Item name="strengths" label={t('rec.strengths')} rules={[{ max: 1000 }]} style={{ marginBottom: 8 }}><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
                    <div style={{ marginBottom: 16 }}><InkToggle ref={padS} onChange={(v) => setInk((s) => ({ ...s, strengths: v }))} /></div>
                    <Form.Item name="weaknesses" label={t('rec.weaknesses')} rules={[{ max: 1000 }]} style={{ marginBottom: 8 }}><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
                    <div style={{ marginBottom: 16 }}><InkToggle ref={padW} onChange={(v) => setInk((s) => ({ ...s, weaknesses: v }))} /></div>
                    <Form.Item name="comment" label={t('rec.bgkComment')} rules={[{ max: 1000 }, ...(result === 'fail' && !inked ? [{ required: true, min: 2, message: t('rec.reasonRequired') }] : [])]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>
                    <div style={{ marginBottom: 16 }}><InkToggle ref={padC} onChange={(v) => setInk((s) => ({ ...s, comment: v }))} /></div>
                  </Form>
                ) : active.mine.result ? (
                  <Space direction="vertical">
                    <Tag color={active.mine.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${active.mine.result}`)}</Tag>
                    {active.mine.scores && <ScoreLine scores={active.mine.scores} />}
                    {active.mine.strengths && <div><b>{t('rec.strengths')}:</b> {active.mine.strengths}</div>}
                    {active.mine.weaknesses && <div><b>{t('rec.weaknesses')}:</b> {active.mine.weaknesses}</div>}
                    {active.mine.comment && <div><b>{t('rec.bgkComment')}:</b> {active.mine.comment}</div>}
                    {active.average && <ScoreAverageBox avg={active.average} />}
                    {user?.userId && <InkImages interviewId={active.interview.id} interviewerId={user.userId} />}
                  </Space>
                ) : <span className="cell-muted">{t('rec.ivClosed')}</span>}
              </div>
            </Col>
          </Row>
        )}
      </AppModal>
      <AppModal
        open={!!viewing} onClose={() => setViewing(null)} size="full" icon={<AuditOutlined />} footer={null}
        title={viewing?.application.fullName ?? ''}
        subtitle={viewing ? `${viewing.application.position} · ${time(viewing.interview.startAt)}${viewing.interview.location ? ` · ${viewing.interview.location}` : ''}` : undefined}
      >
        {viewing && (() => {
          const a = viewing.application
          return (
          <Row gutter={[16, 16]} className="iv-eval">
            <Col xs={24} xl={14}>{a.hasFile ? <CvPane id={a.id} admin height={wide ? '74vh' : '52vh'} /> : <Empty description={t('rec.noCv')} />}</Col>
            <Col xs={24} xl={10}>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {a.hasFile ? <CandidatePhoto id={a.id} name={a.fullName} height={104} /> : null}
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 16 }}>{a.fullName}</b>
                    <div className="cell-muted">{a.position}{a.department ? ` · ${a.department}` : ''}</div>
                    <div style={{ marginTop: 8 }}><AgeCell app={a} /></div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}><b>{t('rec.cvf.exp')}: <ExpCell app={a} /></b><ExpRows cv={viewing.cv} /></div>
                <div style={{ marginTop: 8 }}><b>{t('rec.cvf.edu')}: <EduCell value={a.education} /></b><EduRows cv={viewing.cv} /></div>
              </Card>
              <HrReviewCard item={viewing} me={user?.userId} />
              {viewing.interview.status === 'planned' && a.status === 'scheduled' && viewing.interview.panel.some((p) => p.interviewerId === user?.userId) && (
                <Button type="primary" size="large" block style={{ marginBottom: 16 }} loading={joinAndEvaluate.isPending} onClick={() => joinAndEvaluate.mutate(viewing)}>{t('rec.evaluateShort')}</Button>
              )}
              <Card title={t('rec.panel')}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {viewing.interview.panel.map((p) => (
                    <div key={p.id}><b>{p.interviewerName ?? p.interviewerId}</b> {p.result ? <Tag color={p.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${p.result}`)}</Tag> : <Tag>{t('rec.waiting')}</Tag>}
                      {p.scores && <ScoreTag scores={p.scores} />}
                      {p.result && lead && !['pass', 'fail', 'withdrawn', 'screen_fail'].includes(a.status) && <UnlockButton interviewId={viewing.interview.id} interviewerId={p.interviewerId} name={p.interviewerName ?? p.interviewerId} />}
                      {p.scores && <ScoreLine scores={p.scores} />}
                      {p.strengths && <div>+ {p.strengths}</div>}{p.weaknesses && <div>− {p.weaknesses}</div>}{p.comment && <div>{p.comment}</div>}
                      {p.result && <InkImages interviewId={viewing.interview.id} interviewerId={p.interviewerId} />}</div>
                  ))}
                </Space>
                {(() => { const avg = averageOfPanel(viewing.interview.panel); return avg ? <ScoreAverageBox avg={avg} /> : null })()}
              </Card>
            </Col>
          </Row>
          )
        })()}
      </AppModal>
    </div>
  )
}
