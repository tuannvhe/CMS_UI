import { useState } from 'react'
import { Alert, Avatar, Button, Card, DatePicker, Form, Input, Popconfirm, Select, Space, Switch, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SwapRightOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuth } from '../../auth/AuthContext'
import { delegations, DELEGATION_TABLE_SQL, type DelegationRow, type PersonHit } from '../../api/delegations'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useToast } from '../../hooks/useToast'

interface FormValues { toUser: string; range: [Dayjs, Dayjs]; reason?: string; fromUser?: string }
const TONE: Record<DelegationRow['status'], string> = { active: 'ok', upcoming: 'warn', expired: '', cancelled: '' }

/** Ủy quyền duyệt khi vắng: trong khoảng ngày, người được chọn thấy và duyệt được các đơn đang chờ bạn. */
export default function DelegationPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const msg = useToast()
  const qc = useQueryClient()
  const [all, setAll] = useState(false)
  const [hits, setHits] = useState<PersonHit[]>([])
  const [fromHits, setFromHits] = useState<PersonHit[]>([])
  const [form] = Form.useForm<FormValues>()

  const q = useQuery({ queryKey: ['delegations', all], queryFn: () => delegations.list(all), retry: false })
  const refresh = () => qc.invalidateQueries({ queryKey: ['delegations'] })
  const errText = (e: unknown) => { const { code, detail } = adminError(e); return t(`dlg.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }

  const create = useMutation({
    mutationFn: (v: FormValues) => delegations.create({ toUser: v.toUser, startDate: v.range[0].format('YYYY-MM-DD'), endDate: v.range[1].format('YYYY-MM-DD'), reason: v.reason?.trim(), fromUser: v.fromUser }),
    onSuccess: () => { msg.success(t('dlg.created')); form.resetFields(); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const cancel = useMutation({
    mutationFn: (id: number) => delegations.cancel(id),
    onSuccess: () => { msg.success(t('usr.saved')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const find = (set: (h: PersonHit[]) => void) => async (s: string) => { if (s.trim().length >= 2) set(await delegations.people(s)); else set([]) }
  const day = (v: string) => new Date(v + 'T00:00:00').toLocaleDateString(i18n.language)
  const items = q.data?.items ?? []
  const mine = (r: DelegationRow) => r.fromUser.toLowerCase() === (user?.userId ?? '').toLowerCase()

  const columns: ColumnsType<DelegationRow> = [
    { title: t('dlg.who'), render: (_: unknown, r) => <Space size={8} wrap><b>{r.fromName}</b><SwapRightOutlined className="cell-muted" /><b>{r.toName}</b></Space> },
    { title: t('dlg.period'), width: 230, render: (_: unknown, r) => `${day(r.startDate)} – ${day(r.endDate)}` },
    { title: t('dlg.reason'), dataIndex: 'reason', ellipsis: true, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    { title: t('cov.status'), dataIndex: 'status', width: 130, render: (v: DelegationRow['status']) => <span className={`org-chip ${TONE[v]}`}>{t(`dlg.st.${v}`)}</span> },
    {
      title: '', width: 110,
      render: (_: unknown, r) => (r.status === 'active' || r.status === 'upcoming') && (mine(r) || user?.isAdmin) && (
        <Popconfirm title={t('dlg.cancelAsk')} okText="OK" cancelText={t('req.cancel')} onConfirm={() => cancel.mutate(r.id)}><Button size="small" danger>{t('dlg.cancel')}</Button></Popconfirm>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<UserSwitchOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.delegation')} subtitle={t('nav.delegationDesc')} />
      {q.data && !q.data.ready ? <SqlNotReady title={t('dlg.notReady')} sql={DELEGATION_TABLE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('dlg.note')} />
          <Card title={t('dlg.new')} style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" autoComplete="off" onFinish={(v) => create.mutate(v)} initialValues={{ range: [dayjs(), dayjs().add(6, 'day')] }}>
              <div className="dlg-form">
                {user?.isAdmin && (
                  <Form.Item name="fromUser" label={t('dlg.fromUser')} extra={t('dlg.fromHint')}>
                    <Select allowClear showSearch filterOption={false} onSearch={find(setFromHits)} notFoundContent={null} placeholder={t('dlg.me')}
                      options={fromHits.map((p) => ({ value: p.userId, label: `${p.fullName} · ${p.userId}` }))} />
                  </Form.Item>
                )}
                <Form.Item name="toUser" label={t('dlg.toUser')} rules={[{ required: true }]}>
                  <Select showSearch filterOption={false} onSearch={find(setHits)} notFoundContent={null} placeholder={t('dlg.search')}
                    options={hits.map((p) => ({ value: p.userId, label: `${p.fullName} · ${p.userId}` }))} />
                </Form.Item>
                <Form.Item name="range" label={t('dlg.period')} rules={[{ required: true }]}><DatePicker.RangePicker allowClear={false} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="reason" label={t('dlg.reason')} rules={[{ max: 200 }]}><Input maxLength={200} placeholder={t('dlg.reasonPh')} /></Form.Item>
              </div>
              <Button type="primary" htmlType="submit" loading={create.isPending} icon={<UserSwitchOutlined />}>{t('dlg.create')}</Button>
            </Form>
          </Card>
          <DataTable<DelegationRow>
            rowKey="id" loading={q.isLoading} columns={columns} dataSource={items} pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: q.isError ? t('usr.err.generic') : t('dlg.empty') }}
            toolbar={user?.isAdmin ? <span><Switch checked={all} onChange={setAll} /> <Typography.Text>{t('dlg.showAll')}</Typography.Text></span> : <Typography.Text type="secondary">{t('dlg.mineList')}</Typography.Text>}
          />
        </>
      )}
    </div>
  )
}
