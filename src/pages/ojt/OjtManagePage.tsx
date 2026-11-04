import { useState } from 'react'
import { Alert, Button, Card, DatePicker, Form, Popconfirm, Table } from 'antd'
import { SolutionOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Dayjs } from 'dayjs'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { OJT_SQL, ojt, type OjtCreateResult, type OjtPerson, type OjtPlan } from '../../api/ojt'
import { OjtStatusTag, PeopleSelect, PersonSelect, dmy } from './OjtCommon'

/** HR: lập kế hoạch OJT cho nhân viên mới (đã có tài khoản CMS), huỷ kế hoạch, cấu hình người duyệt OJT theo bộ phận. */
export default function OjtManagePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const ready = useQuery({ queryKey: ['ojt-ready'], queryFn: ojt.ready })
  const plans = useQuery({ queryKey: ['ojt-team', 'all'], queryFn: () => ojt.team(), enabled: ready.data === true })
  const [form] = Form.useForm<{ employeeId: string; approverIds: string[]; start?: Dayjs; end?: Dayjs }>()
  const [last, setLast] = useState<OjtCreateResult | null>(null)
  const [picked, setPicked] = useState<OjtPerson | undefined>()
  const onError = (e: unknown) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) }
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ojt-team'] }) }

  const create = useMutation({
    mutationFn: (v: { employeeId: string; approverIds: string[]; start?: Dayjs; end?: Dayjs }) => ojt.create({ employeeId: v.employeeId, approverIds: v.approverIds, startDate: v.start?.format('YYYY-MM-DD'), endDate: v.end?.format('YYYY-MM-DD') }),
    onSuccess: (r) => { setLast(r); setPicked(undefined); form.resetFields(); toast.success(t('ojt.created')); refresh() },
    onError,
  })
  const cancel = useMutation({ mutationFn: (id: number) => ojt.cancel(id), onSuccess: () => { toast.success(t('ojt.cancelled')); refresh() }, onError })

  return (
    <div className="page wide">
      <PageBanner avatar={<SolutionOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.ojtManage')} subtitle={t('nav.ojtManageDesc')} />
      {ready.data === false && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t('ojt.notReady')}
          description={<pre style={{ maxHeight: 260, overflow: 'auto', margin: 0, fontSize: 12 }}>{OJT_SQL}</pre>} />
      )}
      <Card title={t('ojt.create')} style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)} disabled={ready.data !== true}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Form.Item name="employeeId" label={t('ojt.employeeAccount')} rules={[{ required: true, message: t('ojt.err.employee') }]}><PersonSelect placeholder={t('ojt.pickEmployee')} onChange={(_, p) => setPicked(p)} /></Form.Item>
            <Form.Item name="approverIds" label={t('ojt.notifyWho')} extra={t('ojt.notifyWhoHint')} rules={[{ required: true, type: 'array', min: 1, message: t('ojt.err.approvers') }]}><PeopleSelect placeholder={t('ojt.pickEmployee')} /></Form.Item>
            <Form.Item name="start" label={t('ojt.start')} extra={t('ojt.startHint')}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="end" label={t('ojt.end')} extra={t('ojt.endHint')}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
          </div>
          {picked && <Alert style={{ marginBottom: 12 }} type="warning" showIcon message={t('ojt.confirmPerson', { name: picked.name, id: picked.id, dept: picked.department ?? '—', pos: picked.position ?? '—' })} description={t('ojt.confirmHint')} />}
          <Popconfirm title={t('ojt.confirmAsk', { name: picked?.name ?? '' })} okText={t('ojt.createBtn')} cancelText={t('ojt.cancel')} disabled={!picked}
            onConfirm={() => form.validateFields().then((v) => create.mutate(v))}>
            <Button type="primary" loading={create.isPending} disabled={!picked}>{t('ojt.createBtn')}</Button>
          </Popconfirm>
        </Form>
        {last && <Alert style={{ marginTop: 12 }} type="success" showIcon message={t('ojt.notified', { n: last.approvers.length, ids: last.approvers.join(', ') })} />}
      </Card>

      <Card title={t('ojt.plans')} style={{ marginBottom: 16 }}>
        <Table<OjtPlan> rowKey="id" size="small" loading={plans.isLoading} dataSource={plans.data ?? []} scroll={{ x: 760 }}
          columns={[
            { title: t('ojt.employee'), render: (_: unknown, r) => `${r.employeeName ?? ''} (${r.employeeId})` },
            { title: t('ojt.department'), dataIndex: 'department' },
            { title: t('ojt.mentor'), render: (_: unknown, r) => (r.mentorId ? `${r.mentorName ?? ''} (${r.mentorId})` : '—') },
            { title: t('ojt.period'), render: (_: unknown, r) => `${dmy(r.startDate)} → ${dmy(r.endDate)}` },
            { title: t('ojt.written'), dataIndex: 'written', align: 'right' as const },
            { title: t('ojt.statusLabel'), render: (_: unknown, r) => <OjtStatusTag status={r.status} /> },
            { title: '', render: (_: unknown, r) => r.status !== 'cancelled' && r.status !== 'done' && (
              <Popconfirm title={t('ojt.cancelAsk')} onConfirm={() => cancel.mutate(r.id)}><Button size="small" danger>{t('ojt.cancelPlan')}</Button></Popconfirm>) },
          ]} />
      </Card>
    </div>
  )
}
