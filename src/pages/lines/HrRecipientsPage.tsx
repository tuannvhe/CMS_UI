import { useMemo, useState } from 'react'
import { Alert, App, Avatar, Button, Form, Input, Popconfirm, Select, Space, Switch, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BellOutlined, MailOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { hrRecipients, type HrRecipient, type UserHit } from '../../api/notifications'
import { lines } from '../../api/lines'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { lineErrorText } from './ApprovalLinePage'
import { useToast } from '../../hooks/useToast'

/**
 * Nhân sự nhận cảnh báo (mail + chuông) khi có nhân viên sắp đến hạn đánh giá mà chưa có line đánh giá, và khi đánh giá xong.
 * Có thể giới hạn theo bộ phận và nhà máy; để trống = nhận tất cả.
 */
export default function HrRecipientsPage() {
  const { t } = useTranslation()
  const { modal } = App.useApp()
  const message = useToast()
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [hits, setHits] = useState<UserHit[]>([])
  const [form] = Form.useForm<{ userId: string; fullName: string; email: string; department?: string; factory?: string }>()

  const list = useQuery({ queryKey: ['hr-recipients'], queryFn: hrRecipients.list })
  const factories = useQuery({ queryKey: ['hr-recipients', 'factories'], queryFn: hrRecipients.factories, staleTime: 10 * 60 * 1000 })
  const lookups = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, refetchOnMount: 'always' })
  const refresh = () => qc.invalidateQueries({ queryKey: ['hr-recipients'] })

  const add = useMutation({
    mutationFn: hrRecipients.add,
    onSuccess: () => { message.success(t('line.added')); setAddOpen(false); form.resetFields(); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const toggle = useMutation({ mutationFn: (v: { id: number; active: boolean }) => hrRecipients.setActive(v.id, v.active), onSuccess: () => { message.success(t('line.updated')); refresh() }, onError: () => message.error(t('req.err.generic')) })
  const remove = useMutation({ mutationFn: hrRecipients.remove, onSuccess: () => { message.success(t('line.deleted')); refresh() }, onError: () => message.error(t('req.err.generic')) })
  const check = useMutation({
    mutationFn: () => hrRecipients.runNow(true, true),
    onSuccess: (r) => modal.info({ title: t('hrr.checkResultTitle'), content: t('hrr.checkResult', { candidates: r.candidates, eligible: r.eligible, held: r.held.length }) }),
    onError: () => message.error(t('req.err.generic')),
  })

  const testMail = useMutation({
    mutationFn: () => hrRecipients.testMail(testTo.trim()),
    onSuccess: (r) => { setTestResult(r); if (r.ok) message.success(t('hrr.testOk')); else message.error(t('hrr.testFail')) },
    onError: () => setTestResult({ ok: false, error: 'request_failed' }),
  })

  const searchUsers = async (q: string) => { try { setHits(await hrRecipients.users(q)) } catch { setHits([]) } }
  const rows = list.data ?? []
  const stats = useMemo(() => ({ total: rows.length, active: rows.filter((r) => r.active).length, scoped: rows.filter((r) => r.department || r.factory).length }), [rows])

  const columns: ColumnsType<HrRecipient> = [
    { title: t('line.person'), width: 260, render: (_: unknown, r) => <span><b>{r.fullName}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span> },
    { title: 'Email', dataIndex: 'email', width: 260 },
    { title: t('line.department'), dataIndex: 'department', width: 240, render: (v: string | null) => v ?? <Tag variant="filled">{t('hrr.all')}</Tag> },
    { title: t('hrr.factory'), dataIndex: 'factory', width: 140, render: (v: string | null) => v ?? <Tag variant="filled">{t('hrr.all')}</Tag> },
    { title: t('hrr.receiving'), dataIndex: 'active', width: 120, render: (v: boolean, r) => <Switch checked={v} size="small" onChange={(c) => toggle.mutate({ id: r.id, active: c })} /> },
    {
      title: '', width: 100,
      render: (_: unknown, r) => (
        <Popconfirm title={t('line.confirmDelete')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.id)}>
          <Button size="small" danger>{t('req.delete')}</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<BellOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.hrRecipients')} subtitle={t('nav.hrRecipientsDesc')}
      />
      <StatTiles items={[
        { label: t('hrr.tileTotal'), value: stats.total, color: '#2E9E4F' },
        { label: t('hrr.tileActive'), value: stats.active, color: '#2F6FB0' },
        { label: t('hrr.tileScoped'), value: stats.scoped, color: '#D48806' },
      ]} />
      <Alert type="info" showIcon title={t('hrr.note')} style={{ marginBottom: 16 }} />
      <DataTable<HrRecipient>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('hrr.empty') }}
        toolbar={(
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>{t('hrr.add')}</Button>
            <Button icon={<MailOutlined />} onClick={() => { setTestResult(null); setTestOpen(true) }}>{t('hrr.testMail')}</Button>
            <Popconfirm title={t('hrr.checkConfirm')} okText={t('hrr.checkNow')} cancelText={t('req.cancel')} onConfirm={() => check.mutate()}>
              <Button icon={<SendOutlined />} loading={check.isPending}>{t('hrr.checkNow')}</Button>
            </Popconfirm>
          </Space>
        )}
      />

      <AppModal open={testOpen} onClose={() => setTestOpen(false)} size="sm" icon={<MailOutlined />} title={t('hrr.testMail')} subtitle={t('hrr.testMailSub')}
        onOk={() => testMail.mutate()} okText={t('hrr.testSend')} okDisabled={!testTo.includes('@')} okLoading={testMail.isPending}>
        <Input placeholder="name@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} maxLength={80} />
        {testResult && (
          <Alert style={{ marginTop: 12 }} showIcon type={testResult.ok ? 'success' : 'error'}
            title={testResult.ok ? t('hrr.testOk') : t(`hrr.testErr.${testResult.error}`, { defaultValue: t('hrr.testFail') })}
            description={!testResult.ok && !['not_configured', 'invalid_address', 'request_failed'].includes(testResult.error ?? '') ? testResult.error : undefined} />
        )}
      </AppModal>

      <AppModal open={addOpen} onClose={() => setAddOpen(false)} size="sm" icon={<PlusOutlined />} title={t('hrr.add')}
        onOk={() => form.validateFields().then((v) => add.mutate(v))} okText={t('line.add')} okLoading={add.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="userId" label={t('line.person')} rules={[{ required: true }]}>
            <Select showSearch filterOption={false} placeholder={t('hrr.searchUser')} onSearch={searchUsers} notFoundContent={null}
              options={hits.map((h) => ({ value: h.userId, label: `${h.fullName} · ${h.userId}` }))}
              onChange={(uid: string) => { const h = hits.find((x) => x.userId === uid); if (h) form.setFieldsValue({ fullName: h.fullName, email: h.email ?? '' }) }} />
          </Form.Item>
          <Form.Item name="fullName" hidden><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', max: 50 }]}><Input maxLength={50} /></Form.Item>
          <Form.Item name="department" label={t('line.department')} extra={t('hrr.emptyMeansAll')}>
            <Select showSearch allowClear optionFilterProp="label" placeholder={t('hrr.all')} options={(lookups.data?.parts ?? []).map((p) => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="factory" label={t('hrr.factory')} extra={t('hrr.emptyMeansAll')}>
            <Select allowClear placeholder={t('hrr.all')} options={(factories.data ?? []).map((f) => ({ value: f, label: f }))} />
          </Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
