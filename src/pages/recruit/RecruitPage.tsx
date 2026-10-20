import { useState } from 'react'
import { Avatar, Button, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Radio, Segmented, Select, Space, Switch, Tag, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, SendOutlined, SolutionOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cvUrl, recruit, RECRUIT_STATUSES, RECRUIT_TABLES_SQL, STATUS_TONE, type RecruitApplication, type RecruitDetail, type RecruitLevel } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { CvViewer } from './RecruitCommon'

interface CreateValues { fullName: string; phone?: string; email?: string; position: string; level: RecruitLevel; department?: string; factory?: string; note?: string; restricted?: boolean }

/** HR tuyển dụng: tạo hồ sơ + CV, gửi CV tới người đánh giá ở bộ phận, theo dõi kết quả sàng lọc. HR là người duy nhất tải / thay CV và cấp / thu hồi quyền xem. */
export default function RecruitPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [reviewers, setReviewers] = useState<string[]>([])
  const [dueDays, setDueDays] = useState(2)
  const [userQ, setUserQ] = useState('')
  const [form] = Form.useForm<CreateValues>()
  const level = Form.useWatch('level', form)

  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const refresh = () => { qc.invalidateQueries({ queryKey: ['recruit'] }) }
  const q = useQuery({ queryKey: ['recruit', 'list', status, search], queryFn: () => recruit.list({ status: status || undefined, search: search.trim() || undefined }), retry: false })
  const detail = useQuery({ queryKey: ['recruit', 'detail', openId], queryFn: () => recruit.get(openId!), enabled: openId !== null, retry: false })
  const users = useQuery({ queryKey: ['recruit', 'users', userQ], queryFn: () => recruit.users(userQ), enabled: sending && userQ.trim().length >= 2 })

  const done = (text: string) => () => { msg.success(text); refresh() }
  const onError = (e: unknown) => msg.error(errText(e))
  const create = useMutation({
    mutationFn: (v: CreateValues) => recruit.create({ ...v, file: file ?? undefined }),
    onSuccess: (r) => { msg.success(t('rec.created')); setCreating(false); form.resetFields(); setFile(null); setOpenId(r.id); refresh() }, onError,
  })
  const replace = useMutation({ mutationFn: (f: File) => recruit.replaceCv(openId!, f), onSuccess: done(t('rec.cvSaved')), onError })
  const send = useMutation({
    mutationFn: () => recruit.send(openId!, reviewers, dueDays),
    onSuccess: () => { msg.success(t('rec.sent')); setSending(false); setReviewers([]); refresh() }, onError,
  })
  const revoke = useMutation({ mutationFn: (uid: string) => recruit.revoke(openId!, uid), onSuccess: done(t('rec.revoked')), onError })
  const toSchedule = useMutation({ mutationFn: () => recruit.toSchedule(openId!), onSuccess: done(t('usr.saved')), onError })
  const reopen = useMutation({ mutationFn: () => recruit.reopen(openId!), onSuccess: done(t('usr.saved')), onError })
  const withdraw = useMutation({ mutationFn: () => recruit.withdraw(openId!), onSuccess: done(t('usr.saved')), onError })

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

  const d: RecruitDetail | undefined = detail.data
  const app = d?.application

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<SolutionOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.recruit')} subtitle={t('nav.recruitDesc')} />
      {q.data && !q.data.ready ? <SqlNotReady title={t('rec.notReady')} sql={RECRUIT_TABLES_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
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
              </Space>
            )}
          />
        </>
      )}

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
            <Form.Item name="department" label={t('rec.department')}><Input /></Form.Item>
            <Form.Item name="factory" label={t('rec.factory')}><Input /></Form.Item>
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
              {app.level === 'op' && app.status === 'new' && <Button type="primary" loading={toSchedule.isPending} onClick={() => toSchedule.mutate()}>{t('rec.toSchedule')}</Button>}
              {app.status === 'screen_fail' && <Button loading={reopen.isPending} onClick={() => reopen.mutate()}>{t('rec.reopen')}</Button>}
              {['new', 'screening', 'to_schedule'].includes(app.status) && <Popconfirm title={t('rec.withdrawAsk')} onConfirm={() => withdraw.mutate()}><Button danger>{t('rec.withdraw')}</Button></Popconfirm>}
              {!['screen_fail', 'withdrawn'].includes(app.status) && (
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
