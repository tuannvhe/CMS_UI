import { useState } from 'react'
import { Avatar, Button, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Radio, Segmented, Select, Space, Switch, Tag, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalendarOutlined, CheckCircleOutlined, PlusOutlined, SendOutlined, SolutionOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Dayjs } from 'dayjs'
import { cvUrl, importTemplateUrl, recruit, type ImportResult, RECRUIT_STATUSES, RECRUIT_TABLES_SQL, STATUS_TONE, type RecruitApplication, type RecruitDetail, type RecruitInterview, type RecruitLevel } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { CvViewer } from './RecruitCommon'
import { RecruitReport } from './RecruitReport'

interface CreateValues { fullName: string; phone?: string; email?: string; position: string; level: RecruitLevel; department?: string; factory?: string; note?: string; restricted?: boolean }

/** HR tuyển dụng: tạo hồ sơ + CV, gửi CV tới người đánh giá ở bộ phận, theo dõi kết quả sàng lọc. HR là người duy nhất tải / thay CV và cấp / thu hồi quyền xem. */
export default function RecruitPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRes, setImportRes] = useState<ImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [reviewers, setReviewers] = useState<string[]>([])
  const [dueDays, setDueDays] = useState(2)
  const [userQ, setUserQ] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [when, setWhen] = useState<Dayjs | null>(null)
  const [where, setWhere] = useState('')
  const [ivNote, setIvNote] = useState('')
  const [panelIds, setPanelIds] = useState<string[]>([])
  const [panelQ, setPanelQ] = useState('')
  const [finalizing, setFinalizing] = useState<'pass' | 'fail' | null>(null)
  const [finalNote, setFinalNote] = useState('')
  const [form] = Form.useForm<CreateValues>()
  const level = Form.useWatch('level', form)

  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const refresh = () => { qc.invalidateQueries({ queryKey: ['recruit'] }) }
  const q = useQuery({ queryKey: ['recruit', 'list', status, search], queryFn: () => recruit.list({ status: status || undefined, search: search.trim() || undefined }), retry: false })
  const lookups = useQuery({ queryKey: ['recruit', 'lookups'], queryFn: recruit.lookups, staleTime: 5 * 60_000, retry: false })
  const opts = (xs?: string[]) => (xs ?? []).map((x) => ({ value: x, label: x }))
  const detail = useQuery({ queryKey: ['recruit', 'detail', openId], queryFn: () => recruit.get(openId!), enabled: openId !== null, retry: false })
  const panelUsers = useQuery({ queryKey: ['recruit', 'users', panelQ], queryFn: () => recruit.users(panelQ), enabled: scheduling && panelQ.trim().length >= 2 })
  const users = useQuery({ queryKey: ['recruit', 'users', userQ], queryFn: () => recruit.users(userQ), enabled: sending && userQ.trim().length >= 2 })

  const done = (text: string) => () => { msg.success(text); refresh() }
  const onError = (e: unknown) => msg.error(errText(e))
  const create = useMutation({
    mutationFn: (v: CreateValues) => recruit.create({ ...v, file: file ?? undefined }),
    onSuccess: (r) => { msg.success(t('rec.created')); setCreating(false); form.resetFields(); setFile(null); setOpenId(r.id); refresh() }, onError,
  })
  const importOp = useMutation({ mutationFn: (f: File) => recruit.importOp(f), onSuccess: (r) => { setImportRes(r); setImportFile(null); refresh() }, onError })
  const replace = useMutation({ mutationFn: (f: File) => recruit.replaceCv(openId!, f), onSuccess: done(t('rec.cvSaved')), onError })
  const send = useMutation({
    mutationFn: () => recruit.send(openId!, reviewers, dueDays),
    onSuccess: () => { msg.success(t('rec.sent')); setSending(false); setReviewers([]); refresh() }, onError,
  })
  const revoke = useMutation({ mutationFn: (uid: string) => recruit.revoke(openId!, uid), onSuccess: done(t('rec.revoked')), onError })
  const reopen = useMutation({ mutationFn: () => recruit.reopen(openId!), onSuccess: done(t('usr.saved')), onError })
  const schedule = useMutation({
    mutationFn: () => recruit.schedule(openId!, { startAt: when!.format('YYYY-MM-DDTHH:mm:ss'), location: where.trim() || undefined, note: ivNote.trim() || undefined, interviewers: panelIds }),
    onSuccess: () => { msg.success(t('rec.scheduledOk')); setScheduling(false); setWhen(null); setWhere(''); setIvNote(''); setPanelIds([]); refresh() }, onError,
  })
  const invite = useMutation({ mutationFn: (id: number) => recruit.invite(id), onSuccess: done(t('rec.inviteSent')), onError })
  const closeIv = useMutation({ mutationFn: (v: { id: number; kind: 'cancel' | 'no_show' }) => recruit.closeInterview(v.id, v.kind), onSuccess: done(t('usr.saved')), onError })
  const finalize = useMutation({
    mutationFn: () => recruit.finalize(openId!, finalizing!, finalNote.trim() || undefined),
    onSuccess: () => { msg.success(t('rec.finalOk')); setFinalizing(null); setFinalNote(''); refresh() }, onError,
  })
  const withdraw = useMutation({ mutationFn: () => recruit.withdraw(openId!), onSuccess: done(t('usr.saved')), onError })
  const canSchedule = (a: RecruitApplication) => ['to_schedule', 'scheduled', 'evaluated'].includes(a.status) || (a.level === 'op' && a.status === 'new')
  const canFinal = (a: RecruitApplication) => ['to_schedule', 'scheduled', 'evaluated'].includes(a.status)
  const ivTime = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })

  const all = q.data?.items ?? []
  const day = (v: string | null) => (v ? new Date(v).toLocaleDateString(i18n.language) : '')
  const chip = (s: RecruitApplication['status']) => <span className={`org-chip ${STATUS_TONE[s]}`}>{t(`rec.st.${s}`)}</span>

  const columns: ColumnsType<RecruitApplication> = [
    { title: t('rec.fullName'), render: (_: unknown, r) => <span><b>{r.fullName}</b>{r.restricted && <Tag color="red" style={{ marginLeft: 6 }}>{t('rec.restricted')}</Tag>}<div className="cell-muted">{r.phone ?? ''}</div></span> },
    { title: t('rec.position'), width: 220, render: (_: unknown, r) => <span>{r.position}<div className="cell-muted">{[r.department, r.factory].filter(Boolean).join(' · ')}</div></span> },
    { title: t('rec.level'), dataIndex: 'level', width: 90, render: (v: RecruitLevel) => t(`rec.lv.${v}`) },
    { title: t('rec.cv'), dataIndex: 'hasFile', width: 70, render: (v: boolean) => (v ? '✓' : '—') },
    { title: t('cov.status'), dataIndex: 'status', width: 150, render: (_: unknown, r) => chip(r.status) },
    { title: t('rec.createdAt'), dataIndex: 'createdAt', width: 110, render: day },
    { title: '', width: 90, render: (_: unknown, r) => <Button size="small" onClick={() => setOpenId(r.id)}>{t('rec.open')}</Button> },
  ]

  const [view, setView] = useState<'list' | 'report'>('list')
  const d: RecruitDetail | undefined = detail.data
  const app = d?.application

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<SolutionOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.recruit')} subtitle={t('nav.recruitDesc')} />
      <Segmented style={{ marginBottom: 12 }} value={view} onChange={(v) => setView(v as 'list' | 'report')} options={[{ value: 'list', label: t('rec.view.list') }, { value: 'report', label: t('rec.view.report') }]} />
      {view === 'report' ? <RecruitReport /> : q.data && !q.data.ready ? <SqlNotReady title={t('rec.notReady')} sql={RECRUIT_TABLES_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
        <>
          <StatTiles items={[
            { label: t('rec.st.new'), value: all.filter((r) => r.status === 'new').length, color: '#D48806' },
            { label: t('rec.st.screening'), value: all.filter((r) => r.status === 'screening').length, color: '#2F6FB0' },
            { label: t('rec.st.to_schedule'), value: all.filter((r) => r.status === 'to_schedule').length, color: '#2E9E4F' },
            { label: t('rec.st.screen_fail'), value: all.filter((r) => r.status === 'screen_fail').length },
          ]} />
          <DataTable<RecruitApplication>
            rowKey="id" loading={q.isLoading} columns={columns} dataSource={all} pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: q.isError ? t('usr.err.generic') : t('rec.empty') }}
            toolbar={(
              <Space wrap>
                <Segmented value={status} onChange={(v) => setStatus(String(v))} options={[{ value: '', label: t('org.all') }, ...RECRUIT_STATUSES.map((s) => ({ value: s, label: t(`rec.st.${s}`) }))]} />
                <Input.Search allowClear style={{ width: 240 }} placeholder={t('rec.searchPh')} onSearch={setSearch} />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ level: 'staff' }); setCreating(true) }}>{t('rec.new')}</Button>
                <Button icon={<FileExcelOutlined />} onClick={() => { setImportRes(null); setImportFile(null); setImporting(true) }}>{t('rec.import.btn')}</Button>
              </Space>
            )}
          />
        </>
      )}

      <AppModal open={importing} onClose={() => setImporting(false)} size="md" icon={<FileExcelOutlined />} title={t('rec.import.title')} okText={t('rec.import.run')} okLoading={importOp.isPending} onOk={() => { if (importFile) importOp.mutate(importFile) }}>
        <p>{t('rec.import.hint')} <a href={importTemplateUrl}>{t('rec.import.template')}</a></p>
        <Upload accept=".xlsx" maxCount={1} beforeUpload={(f) => { setImportFile(f); setImportRes(null); return false }} onRemove={() => setImportFile(null)}>
          <Button icon={<UploadOutlined />}>{t('rec.import.pick')}</Button>
        </Upload>
        {importRes && (
          <div style={{ marginTop: 12 }}>
            <b>{t('rec.import.done', { n: importRes.created })}</b>
            {importRes.errors.map((e) => <div key={e.row} className="cell-muted">{t('rec.import.rowErr', { row: e.row, reason: t(`rec.import.err.${e.reason}`, { defaultValue: e.reason }) })}</div>)}
          </div>
        )}
      </AppModal>

      <AppModal open={creating} onClose={() => setCreating(false)} size="md" icon={<SolutionOutlined />} title={t('rec.new')} okText={t('rec.create')} okLoading={create.isPending} onOk={() => form.validateFields().then((v) => create.mutate(v))}>
        <Form form={form} layout="vertical" autoComplete="off" initialValues={{ level: 'staff', restricted: false }}>
          <Form.Item name="level" label={t('rec.level')} rules={[{ required: true }]}>
            <Radio.Group options={[{ value: 'staff', label: t('rec.lv.staff') }, { value: 'op', label: t('rec.lv.op') }]} />
          </Form.Item>
          <Form.Item name="fullName" label={t('rec.fullName')} rules={[{ required: true }, { max: 100 }]}><Input /></Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="phone" label={t('rec.phone')} rules={[{ max: 30 }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input style={{ width: 260 }} /></Form.Item>
          </Space>
          <Form.Item name="position" label={t('rec.position')} rules={[{ required: true }, { max: 100 }]}><Input /></Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="department" label={t('rec.department')}><Select allowClear showSearch optionFilterProp="label" style={{ width: 260 }} options={opts(lookups.data?.departments)} loading={lookups.isLoading} /></Form.Item>
            <Form.Item name="factory" label={t('rec.factory')}><Select allowClear showSearch optionFilterProp="label" style={{ width: 200 }} options={opts(lookups.data?.factories)} loading={lookups.isLoading} /></Form.Item>
          </Space>
          <Form.Item label={t('rec.cv')} required={level === 'staff'} extra={level === 'op' ? t('rec.cvOptional') : t('rec.cvHint')}>
            <Upload accept=".pdf,application/pdf" maxCount={1} beforeUpload={(f) => { setFile(f); return false }} onRemove={() => setFile(null)}>
              <Button icon={<UploadOutlined />}>{t('rec.pickPdf')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="note" label={t('rec.note')} rules={[{ max: 1000 }]}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
          <Form.Item name="restricted" label={t('rec.restricted')} valuePropName="checked" extra={t('rec.restrictedHint')}><Switch /></Form.Item>
        </Form>
      </AppModal>

      <Drawer open={openId !== null} onClose={() => setOpenId(null)} width={720} title={app ? `${app.fullName} · ${app.position}` : ''} destroyOnClose>
        {app && d && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              {chip(app.status)}
              {app.level === 'staff' && ['new', 'screening'].includes(app.status) && <Button type="primary" icon={<SendOutlined />} disabled={!app.hasFile} onClick={() => setSending(true)}>{t('rec.send')}</Button>}
              {canSchedule(app) && <Button type="primary" icon={<CalendarOutlined />} onClick={() => setScheduling(true)}>{t('rec.schedule')}</Button>}
              {canFinal(app) && <Button icon={<CheckCircleOutlined />} onClick={() => setFinalizing('pass')}>{t('rec.finalize')}</Button>}
              {app.status === 'screen_fail' && <Button loading={reopen.isPending} onClick={() => reopen.mutate()}>{t('rec.reopen')}</Button>}
              {['new', 'screening', 'to_schedule', 'scheduled', 'evaluated'].includes(app.status) && <Popconfirm title={t('rec.withdrawAsk')} onConfirm={() => withdraw.mutate()}><Button danger>{t('rec.withdraw')}</Button></Popconfirm>}
              {!['screen_fail', 'withdrawn', 'pass', 'fail'].includes(app.status) && (
                <Upload accept=".pdf,application/pdf" showUploadList={false} beforeUpload={(f) => { replace.mutate(f); return false }}>
                  <Button icon={<UploadOutlined />} loading={replace.isPending}>{app.hasFile ? t('rec.replaceCv') : t('rec.addCv')}</Button>
                </Upload>
              )}
            </Space>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label={t('rec.phone')}>{app.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{app.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('rec.level')}>{t(`rec.lv.${app.level}`)}</Descriptions.Item>
              <Descriptions.Item label={t('rec.department')}>{[app.department, app.factory].filter(Boolean).join(' · ') || '—'}</Descriptions.Item>
              {app.note && <Descriptions.Item label={t('rec.note')} span={2}>{app.note}</Descriptions.Item>}
              {app.hrNote && <Descriptions.Item label={t('rec.hrNote')} span={2}>{app.hrNote}</Descriptions.Item>}
            </Descriptions>
            {d.screenings.length > 0 && (
              <DataTable<RecruitDetail['screenings'][number]> rowKey="id" size="small" pagination={false} dataSource={d.screenings} columns={[
                { title: t('rec.reviewer'), render: (_: unknown, s) => s.reviewerName ?? s.reviewerId },
                { title: t('rec.dueDate'), dataIndex: 'dueDate', width: 110, render: day },
                { title: t('rec.decision'), render: (_: unknown, s) => s.revoked ? <Tag>{t('rec.revokedTag')}</Tag> : s.decision ? <Tag color={s.decision === 'invite' ? 'green' : 'red'}>{t(`rec.dec.${s.decision}`)}</Tag> : <Tag color={s.overdue ? 'red' : 'blue'}>{s.overdue ? t('rec.overdue') : t('rec.waiting')}</Tag> },
                { title: t('rec.comment'), dataIndex: 'comment', ellipsis: true },
                { title: '', width: 90, render: (_: unknown, s) => !s.revoked && !s.decision ? <Popconfirm title={t('rec.revokeAsk')} onConfirm={() => revoke.mutate(s.reviewerId)}><Button size="small" danger>{t('rec.revoke')}</Button></Popconfirm> : null },
              ]} />
            )}
            {d.interviews.length > 0 && (
              <DataTable<RecruitInterview> rowKey="id" size="small" pagination={false} dataSource={d.interviews} columns={[
                { title: t('rec.round'), dataIndex: 'round', width: 60 },
                { title: t('rec.when'), width: 150, render: (_: unknown, r) => <span>{ivTime(r.startAt)}<div className="cell-muted">{r.location ?? ''}</div></span> },
                { title: t('cov.status'), dataIndex: 'status', width: 110, render: (v: RecruitInterview['status']) => <Tag>{t(`rec.iv.${v}`)}</Tag> },
                { title: t('rec.panel'), render: (_: unknown, r) => (
                  <Space direction="vertical" size={2}>
                    {r.panel.map((p) => (
                      <span key={p.id}>{p.interviewerName ?? p.interviewerId}: {p.result ? <Tag color={p.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${p.result}`)}</Tag> : <Tag>{t('rec.waiting')}</Tag>}
                        {(p.comment || p.strengths || p.weaknesses) && <div className="cell-muted">{[p.strengths && `+ ${p.strengths}`, p.weaknesses && `− ${p.weaknesses}`, p.comment].filter(Boolean).join(' · ')}</div>}</span>
                    ))}
                  </Space>) },
                { title: '', width: 230, render: (_: unknown, r) => r.status === 'planned' ? (
                  <Space size={4} wrap>
                    <Popconfirm title={t('rec.inviteAsk', { email: app.email ?? '' })} disabled={!app.email} onConfirm={() => invite.mutate(r.id)}><Button size="small" icon={<SendOutlined />} disabled={!app.email} loading={invite.isPending && invite.variables === r.id}>{t('rec.invite')}</Button></Popconfirm>
                    <Popconfirm title={t('rec.cancelIvAsk')} onConfirm={() => closeIv.mutate({ id: r.id, kind: 'cancel' })}><Button size="small">{t('rec.cancelIv')}</Button></Popconfirm>
                    <Popconfirm title={t('rec.noShowAsk')} onConfirm={() => closeIv.mutate({ id: r.id, kind: 'no_show' })}><Button size="small" danger>{t('rec.noShow')}</Button></Popconfirm>
                  </Space>) : null },
              ]} />
            )}
            {app.hasFile ? <CvViewer src={cvUrl(app.id, true)} /> : <span className="cell-muted">{t('rec.noCv')}</span>}
            <DataTable<RecruitDetail['events'][number]> rowKey="id" size="small" pagination={false} dataSource={d.events} columns={[
              { title: t('rec.when'), dataIndex: 'at', width: 150, render: (v: string) => new Date(v).toLocaleString(i18n.language) },
              { title: t('rec.event'), dataIndex: 'kind', width: 160, render: (v: string) => t(`rec.ev.${v}`, { defaultValue: v }) },
              { title: t('rec.by'), dataIndex: 'byUser', width: 110 },
              { title: t('rec.note'), dataIndex: 'note', ellipsis: true },
            ]} />
          </Space>
        )}
      </Drawer>

      <AppModal open={scheduling} onClose={() => setScheduling(false)} size="sm" icon={<CalendarOutlined />} title={t('rec.schedule')} subtitle={t('rec.scheduleHint')} okText={t('rec.schedule')} okDisabled={!when || panelIds.length === 0} okLoading={schedule.isPending} onOk={() => schedule.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.startAt')} required><DatePicker showTime={{ format: 'HH:mm', minuteStep: 5 }} format="DD/MM/YYYY HH:mm" value={when} onChange={setWhen} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('rec.location')}><Input value={where} maxLength={100} onChange={(e) => setWhere(e.target.value)} /></Form.Item>
          <Form.Item label={t('rec.interviewers')} required>
            <Select mode="multiple" showSearch filterOption={false} value={panelIds} onChange={setPanelIds} onSearch={setPanelQ} maxCount={6} placeholder={t('rec.reviewerPh')}
              notFoundContent={panelQ.trim().length < 2 ? t('rec.typeMore') : null}
              options={(panelUsers.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))} />
          </Form.Item>
          <Form.Item label={t('rec.note')}><Input.TextArea rows={2} maxLength={1000} value={ivNote} onChange={(e) => setIvNote(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>

      <AppModal open={finalizing !== null} onClose={() => setFinalizing(null)} size="sm" icon={<CheckCircleOutlined />} title={t('rec.finalize')} subtitle={t('rec.finalizeHint')} okText={t('rec.finalize')} danger={finalizing === 'fail'} okLoading={finalize.isPending} onOk={() => finalize.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.finalResult')}><Radio.Group size="large" optionType="button" buttonStyle="solid" value={finalizing} onChange={(e) => setFinalizing(e.target.value)} options={[{ value: 'pass', label: t('rec.st.pass') }, { value: 'fail', label: t('rec.st.fail') }]} /></Form.Item>
          <Form.Item label={t('rec.hrNote')} extra={t('rec.finalNoteHint')}><Input.TextArea rows={3} maxLength={1000} showCount value={finalNote} onChange={(e) => setFinalNote(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>

      <AppModal open={sending} onClose={() => setSending(false)} size="sm" icon={<SendOutlined />} title={t('rec.send')} subtitle={t('rec.sendHint')} okText={t('rec.send')} okDisabled={reviewers.length === 0} okLoading={send.isPending} onOk={() => send.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.reviewers')}>
            <Select mode="multiple" showSearch filterOption={false} value={reviewers} onChange={setReviewers} onSearch={setUserQ} maxCount={5} placeholder={t('rec.reviewerPh')}
              notFoundContent={userQ.trim().length < 2 ? t('rec.typeMore') : null}
              options={(users.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))} />
          </Form.Item>
          <Form.Item label={t('rec.dueDays')}><InputNumber min={1} max={14} value={dueDays} onChange={(v) => setDueDays(v ?? 2)} /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
