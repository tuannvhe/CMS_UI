import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, KeyOutlined, LockOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UnlockOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { hnAccountsApi, hnErrorKey, type HnAccount } from '../../api/hn'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { fmtCell } from '../../utils/hnFormat'

/*
 * 2026-11-26 [Truong] - HN account management like the old CMS_HN user screen (module "Quản lý tài khoản").
 * View: list / search; Add: create (sp_AddUsers, default password); Edit: group / lock / email / reset password; Delete: sp_DeleteUsers.
 * Passwords are never shown. Writing obeys Hn:WriteMode. The old job ConvertEmployeeToUserHN can undo lock / delete for active employees (warned on screen).
 */

const DEFAULT_PW = 'vinae123456'
const USER_ID_RE = /^[A-Za-z0-9._-]{3,50}$/
type Status = 'all' | 'active' | 'locked'
interface CreateForm { employeeId: string; userId?: string; groupId: string; email?: string }
interface EditForm { groupId: string; email?: string }

export default function HnAccountsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<HnAccount | null>(null)
  const [createForm] = Form.useForm<CreateForm>()
  const [editForm] = Form.useForm<EditForm>()

  const list = useQuery({ queryKey: ['hn', 'accounts', q], queryFn: () => hnAccountsApi.list(q), retry: false, staleTime: 30_000 })
  const d = list.data
  const mode = d?.writeMode
  const writable = mode !== undefined && mode !== 'off'
  const me = (d?.me ?? '').toLowerCase()
  const isSelf = (a: HnAccount) => a.userId.toLowerCase() === me
  const groups = useMemo(() => (d?.groups ?? []).map((g) => ({ value: g.id, label: `${g.name} (${g.id})` })), [d])
  const rows = useMemo(() => (d?.items ?? []).filter((a) => status === 'all' || (status === 'active' ? a.active : !a.active)), [d, status])

  const refresh = () => qc.invalidateQueries({ queryKey: ['hn', 'accounts'] })
  const fail = (e: unknown) => toast.error(t(hnErrorKey(e)))

  const create = useMutation({
    mutationFn: (v: CreateForm) => hnAccountsApi.create({ employeeId: v.employeeId.trim(), userId: v.userId?.trim() || undefined, groupId: v.groupId, email: v.email?.trim() || undefined }),
    onSuccess: (a) => { toast.success(t('hn.acc.created', { id: a.userId, pw: DEFAULT_PW })); setCreating(false); createForm.resetFields(); void refresh() },
    onError: fail,
  })
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { groupId?: string; active?: boolean; email?: string } }) => hnAccountsApi.update(id, body),
    onSuccess: (a, v) => {
      toast.success(v.body.active === undefined ? t('hn.acc.saved', { id: a.userId }) : t(v.body.active ? 'hn.acc.unlockDone' : 'hn.acc.lockDone', { id: a.userId }))
      setEditing(null); void refresh()
    },
    onError: fail,
  })
  const reset = useMutation({
    mutationFn: (a: HnAccount) => hnAccountsApi.resetPassword(a.id),
    onSuccess: (_, a) => toast.success(t('hn.acc.resetDone', { id: a.userId, pw: DEFAULT_PW })),
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (a: HnAccount) => hnAccountsApi.remove(a.id),
    onSuccess: (_, a) => { toast.success(t('hn.acc.delDone', { id: a.userId })); void refresh() },
    onError: fail,
  })

  const openEdit = (a: HnAccount) => { setEditing(a); editForm.setFieldsValue({ groupId: a.groupId ?? undefined, email: a.email ?? '' }) }
  const busyId = (m: { isPending: boolean; variables?: unknown }, a: HnAccount) => m.isPending && ((m.variables as HnAccount | { id: number } | undefined)?.id === a.id)

  const columns: ColumnsType<HnAccount> = [
    {
      title: t('hn.acc.userId'), dataIndex: 'userId', key: 'userId', fixed: 'left', width: 150,
      render: (v: string, a) => <Space size={6}><b>{v}</b>{isSelf(a) && <Tag color="green" bordered={false}>{t('hn.acc.me')}</Tag>}</Space>,
      sorter: (x, y) => x.userId.localeCompare(y.userId),
    },
    { title: t('hn.acc.employeeId'), dataIndex: 'employeeId', key: 'employeeId', width: 110, render: (v) => v || '—' },
    { title: t('hn.acc.fullName'), dataIndex: 'fullName', key: 'fullName', width: 190, ellipsis: true, render: (v) => v || '—' },
    { title: t('hn.acc.department'), dataIndex: 'department', key: 'department', width: 170, ellipsis: true, render: (v) => v || '—' },
    {
      title: t('hn.acc.group'), key: 'group', width: 170,
      render: (_, a) => (a.groupId ? <Tooltip title={a.groupId}><Tag bordered={false} color="blue">{a.groupName || a.groupId}</Tag></Tooltip> : '—'),
      filters: (d?.groups ?? []).map((g) => ({ text: g.name, value: g.id })), onFilter: (v, a) => a.groupId === v,
    },
    { title: t('hn.acc.email'), dataIndex: 'email', key: 'email', width: 200, ellipsis: true, render: (v) => v || '—' },
    {
      title: t('hn.acc.status'), key: 'active', width: 110,
      render: (_, a) => <Tag bordered={false} color={a.active ? 'success' : 'default'}>{t(a.active ? 'hn.acc.active' : 'hn.acc.locked')}</Tag>,
    },
    { title: t('hn.acc.failed'), dataIndex: 'failedLogins', key: 'failed', width: 80, align: 'right', render: (v: number | null) => (v ? <Typography.Text type="danger">{v}</Typography.Text> : '0') },
    { title: t('hn.acc.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (v) => fmtCell(v) || '—' },
  ]
  if (d && (d.canEdit || d.canDelete)) {
    columns.push({
      title: t('hn.acc.action'), key: 'action', fixed: 'right', width: 230,
      render: (_, a) => {
        const self = isSelf(a)
        const off = !writable
        return (
          <Space size={4} wrap>
            {d.canEdit && <Tooltip title={t('hn.acc.edit', { id: a.userId })}><Button size="small" icon={<EditOutlined />} disabled={off} onClick={() => openEdit(a)} aria-label={t('hn.acc.edit', { id: a.userId })} /></Tooltip>}
            {d.canEdit && (
              <Popconfirm title={t('hn.acc.resetAsk', { id: a.userId, pw: DEFAULT_PW })} onConfirm={() => reset.mutate(a)} disabled={off || self}>
                <Tooltip title={t('hn.acc.reset')}><Button size="small" icon={<KeyOutlined />} disabled={off || self} loading={busyId(reset, a)} aria-label={t('hn.acc.reset')} /></Tooltip>
              </Popconfirm>
            )}
            {d.canEdit && (
              <Tooltip title={t(a.active ? 'hn.acc.lock' : 'hn.acc.unlock')}>
                <Button size="small" icon={a.active ? <LockOutlined /> : <UnlockOutlined />} disabled={off || self}
                  loading={update.isPending && update.variables?.id === a.id && update.variables.body.active !== undefined}
                  onClick={() => update.mutate({ id: a.id, body: { active: !a.active } })} aria-label={t(a.active ? 'hn.acc.lock' : 'hn.acc.unlock')} />
              </Tooltip>
            )}
            {d.canDelete && (
              <Popconfirm title={t('hn.acc.delAsk', { id: a.userId })} okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(a)} disabled={off || self}>
                <Tooltip title={t('hn.acc.del')}><Button size="small" danger icon={<DeleteOutlined />} disabled={off || self} loading={busyId(remove, a)} aria-label={t('hn.acc.del')} /></Tooltip>
              </Popconfirm>
            )}
          </Space>
        )
      },
    })
  }

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<TeamOutlined />} />} title={t('hn.nav.accounts')} subtitle={t('hn.nav.accountsDesc')}
        chips={d ? [t('hn.acc.count', { n: d.items.length })] : undefined}
        extra={d?.canAdd ? <Button type="primary" icon={<PlusOutlined />} disabled={!writable} onClick={() => { createForm.resetFields(); setCreating(true) }}>{t('hn.acc.create')}</Button> : undefined} />

      {mode === 'off' && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('hn.acc.modeOff')} />}
      {mode === 'test' && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('hn.acc.modeTest', { list: d?.allowed.join(', ') || '—' })} />}
      {d && (d.canEdit || d.canDelete) && <Alert type="warning" showIcon closable style={{ marginBottom: 12 }} title={t('hn.acc.jobWarn')} />}
      {list.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={t(hnErrorKey(list.error))} />}
      {d?.truncated && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('hn.acc.truncated', { n: d.items.length })} />}

      <section className="pay-card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Input.Search allowClear style={{ maxWidth: 420, flex: '1 1 260px' }} placeholder={t('hn.acc.search')} aria-label={t('hn.acc.search')} value={text}
          onChange={(e) => { setText(e.target.value); if (!e.target.value) setQ('') }} onSearch={(v) => setQ(v.trim())} enterButton={<SearchOutlined />} />
        <Segmented<Status> value={status} onChange={setStatus}
          options={[{ value: 'all', label: t('hn.acc.all') }, { value: 'active', label: t('hn.acc.onlyActive') }, { value: 'locked', label: t('hn.acc.onlyLocked') }]} />
      </section>

      <Table<HnAccount> size="middle" rowKey="id" columns={columns} dataSource={rows} loading={list.isFetching} scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }} />

      <Modal open={creating} title={t('hn.acc.create')} okText={t('hn.acc.create')} confirmLoading={create.isPending} destroyOnHidden
        onCancel={() => setCreating(false)} onOk={() => createForm.submit()}>
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('hn.acc.defaultPw', { pw: DEFAULT_PW })} />
        <Form<CreateForm> form={createForm} layout="vertical" onFinish={(v) => create.mutate(v)} autoComplete="off">
          <Form.Item name="employeeId" label={t('hn.acc.employeeId')} rules={[{ required: true, whitespace: true, message: t('hn.acc.required') }]}>
            <Input maxLength={20} placeholder="VES-..." />
          </Form.Item>
          <Form.Item name="userId" label={t('hn.acc.userId')} extra={t('hn.acc.userIdHint')}
            rules={[{ validator: (_, v?: string) => (!v || USER_ID_RE.test(v.trim()) ? Promise.resolve() : Promise.reject(new Error(t('hn.acc.badUserId')))) }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="groupId" label={t('hn.acc.group')} rules={[{ required: true, message: t('hn.acc.required') }]}>
            <Select options={groups} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="email" label={t('hn.acc.email')} extra={t('hn.acc.emailHint')} rules={[{ type: 'email', message: t('hn.acc.badEmail') }]}>
            <Input maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={!!editing} title={editing ? t('hn.acc.edit', { id: editing.userId }) : ''} okText={t('hn.acc.save')} confirmLoading={update.isPending} destroyOnHidden
        onCancel={() => setEditing(null)} onOk={() => editForm.submit()}>
        {editing && (
          <Form<EditForm> form={editForm} layout="vertical" autoComplete="off"
            onFinish={(v) => update.mutate({ id: editing.id, body: { groupId: v.groupId !== editing.groupId ? v.groupId : undefined, email: (v.email ?? '').trim() } })}>
            <Typography.Paragraph type="secondary">{[editing.employeeId, editing.fullName, editing.department].filter(Boolean).join(' · ')}</Typography.Paragraph>
            <Form.Item name="groupId" label={t('hn.acc.group')} rules={[{ required: true, message: t('hn.acc.required') }]}>
              <Select options={groups} showSearch optionFilterProp="label" disabled={isSelf(editing)} />
            </Form.Item>
            <Form.Item name="email" label={t('hn.acc.email')} rules={[{ type: 'email', message: t('hn.acc.badEmail') }]}>
              <Input maxLength={50} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
