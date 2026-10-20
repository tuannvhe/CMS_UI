import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Form, Input, Popconfirm, Segmented, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, IdcardOutlined, KeyOutlined, SafetyCertificateOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { adminError, userAdmin, type AdminUser, type EmployeeBrief } from '../../api/userAdmin'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { UserAvatar } from '../../components/UserAvatar'
import { useToast } from '../../hooks/useToast'

interface CreateForm { employeeId: string; userId: string; password: string; email?: string; groupId: string; factoryCode?: string }
interface EditForm { groupId: string; email?: string; factoryCode?: string }

/** Quản lý tài khoản đăng nhập (Tbl_Users dùng chung với hệ thống cũ): tìm, thêm tài khoản cho nhân viên, đổi nhóm / email, khóa, đặt lại mật khẩu, xóa. */
export default function UsersPage() {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const msg = useToast()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string>()
  const [status, setStatus] = useState<'all' | 'active' | 'locked'>('all')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [applied, setApplied] = useState({ search: '', group: undefined as string | undefined })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<AdminUser | null>(null)
  const [emp, setEmp] = useState<EmployeeBrief | null>(null)
  const [empError, setEmpError] = useState('')
  const [createForm] = Form.useForm<CreateForm>()
  const [editForm] = Form.useForm<EditForm>()
  const [pwForm] = Form.useForm<{ password: string }>()

  const groups = useQuery({ queryKey: ['users', 'groups'], queryFn: userAdmin.groups, staleTime: 60_000 })
  const factories = useQuery({ queryKey: ['users', 'factories'], queryFn: userAdmin.factories, staleTime: 300_000 })
  const stats = useQuery({ queryKey: ['users', 'stats'], queryFn: userAdmin.stats })
  // Ai đang trực tuyến: làm mới mỗi 10 giây (người mở hệ thống hoặc vừa thao tác trong 2 phút)
  // Mật khẩu: bao nhiêu tài khoản đã băm, còn mật khẩu mặc định, còn kiểu cũ (đảo ngược được); chuyển hàng loạt sang băm
  const pw = useQuery({ queryKey: ['users', 'passwords'], queryFn: userAdmin.passwords, refetchInterval: (q) => (q.state.data?.running ? 2000 : 60_000), retry: false })
  const migrate = useMutation({ mutationFn: userAdmin.migratePasswords, onSuccess: () => { msg.success(t('usr.pwMigrateStarted')); pw.refetch() }, onError: (e) => msg.error(errText(e)) })
  const online = useQuery({ queryKey: ['users', 'online'], queryFn: userAdmin.online, refetchInterval: 10_000, retry: false })
  const onlineMap = useMemo(() => new Map((online.data?.users ?? []).map((x) => [x.user.userId.trim().toLowerCase(), x.lastSeen])), [online.data])
  const isOnline = (u: AdminUser) => onlineMap.has(u.userId.trim().toLowerCase())
  const q = useQuery({
    queryKey: ['users', 'list', applied, status, page, pageSize],
    queryFn: () => userAdmin.list(applied.search, applied.group, status, page, pageSize),
    placeholderData: (prev) => prev, retry: false,
  })

  const errText = (e: unknown) => {
    const { code, detail } = adminError(e)
    if (code === 'self_change') return t('usr.err.self_change')
    if (code === 'not_found') return t(`usr.err.nf_${detail}`, { defaultValue: t('usr.err.not_found') })
    if (code === 'conflict') return t('usr.err.conflict')
    if (code === 'invalid_input') return t(`usr.err.${detail}`, { defaultValue: t('usr.err.generic') })
    return t('usr.err.generic')
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const create = useMutation({
    mutationFn: (v: CreateForm) => userAdmin.create({ ...v, email: v.email?.trim() || undefined, factoryCode: v.factoryCode || undefined }),
    onSuccess: () => { msg.success(t('usr.created')); closeCreate(); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const save = useMutation({
    mutationFn: (v: EditForm) => userAdmin.update(editing!.id, { groupId: v.groupId, email: v.email?.trim() || undefined, factoryCode: v.factoryCode || undefined }),
    onSuccess: () => { msg.success(t('usr.saved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (u: AdminUser) => userAdmin.toggle(u.id),
    onSuccess: () => { msg.success(t('usr.saved')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const reset = useMutation({
    mutationFn: (v: { password: string }) => userAdmin.password(resetting!.id, v.password),
    onSuccess: () => { msg.success(t('usr.pwDone')); setResetting(null); pwForm.resetFields() },
    onError: (e) => msg.error(errText(e)),
  })
  const resetOtp = useMutation({ mutationFn: (id: number) => userAdmin.resetOtp(id), onSuccess: () => msg.success(t('usr.otpResetDone')), onError: (e) => msg.error(errText(e)) })
  const remove = useMutation({
    mutationFn: (u: AdminUser) => userAdmin.remove(u.id),
    onSuccess: () => { msg.success(t('usr.deleted')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const closeCreate = () => { setCreating(false); setEmp(null); setEmpError(''); createForm.resetFields() }
  const lookup = async (id: string) => {
    const v = id.trim()
    setEmp(null); setEmpError('')
    if (!v) return
    try {
      const e = await userAdmin.employee(v)
      setEmp(e)
      if (!e.active) setEmpError(t('usr.err.employee_inactive'))
      createForm.setFieldsValue({ email: e.email ?? undefined, factoryCode: e.factoryCode ?? undefined })
    } catch (e) { setEmpError(errText(e)) }
  }

  const apply = () => { setPage(1); setApplied({ search: search.trim(), group }) }
  const openEdit = (u: AdminUser) => { setEditing(u); editForm.setFieldsValue({ groupId: u.groupId, email: u.email, factoryCode: u.factoryCode || undefined }) }
  const isMe = (u: AdminUser) => u.userId.toLowerCase() === me?.userId.toLowerCase()
  const groupOptions = (groups.data ?? []).map((g) => ({ value: g.groupId, label: g.nameVi || g.name, disabled: !g.active }))
  const factoryOptions = (factories.data ?? []).map((f) => ({ value: f, label: f }))

  const columns: ColumnsType<AdminUser> = [
    {
      title: t('att.name'), dataIndex: 'fullName', width: 270,
      render: (_: unknown, u) => (
        <Space size={10}>
          <span className="uo-wrap">
            <UserAvatar name={u.fullName} src={u.avatarUrl} size={34} />
            {isOnline(u) && <span className="uo-dot" title={t('usr.onlineNow')} />}
          </span>
          <div style={{ lineHeight: 1.3, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{u.fullName}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{u.employeeId} · {u.userId}</Typography.Text>
          </div>
        </Space>
      ),
    },
    { title: t('att.dept'), dataIndex: 'department', width: 190, ellipsis: true, render: (v: string | null) => v || '-' },
    { title: t('usr.colOnline'), width: 130, render: (_: unknown, u: AdminUser) => (isOnline(u) ? <Tag color="success" variant="filled">{t('usr.onlineNow')}</Tag> : <span className="cell-muted">-</span>) },
    { title: t('usr.colEmail'), dataIndex: 'email', width: 220, ellipsis: true, render: (v: string) => v || <span className="cell-muted">{t('usr.noEmail')}</span> },
    { title: t('usr.colGroup'), dataIndex: 'groupName', width: 170, render: (v: string | null, u) => <Tag variant="filled" color="green">{v ?? u.groupId}</Tag> },
    { title: t('usr.colFactory'), dataIndex: 'factoryCode', width: 100, render: (v: string) => v || '-' },
    { title: t('usr.colCreated'), dataIndex: 'createdAt', width: 110, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '') },
    {
      title: t('usr.colActive'), width: 90, align: 'center',
      render: (_: unknown, u) => (
        <Popconfirm title={t(u.active ? 'usr.lockAsk' : 'usr.unlockAsk', { name: u.fullName || u.userId })} okText="OK" cancelText={t('req.cancel')} onConfirm={() => toggle.mutate(u)} disabled={isMe(u)}>
          <Switch size="small" checked={u.active} loading={toggle.isPending && toggle.variables?.id === u.id} disabled={isMe(u)} />
        </Popconfirm>
      ),
    },
    {
      title: '', width: 185, fixed: 'right',
      render: (_: unknown, u) => (
        <Space size={2}>
          <Tooltip title={t('req.edit')}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(u)} /></Tooltip>
          <Tooltip title={t('usr.resetPw')}><Button size="small" type="text" icon={<KeyOutlined />} onClick={() => { setResetting(u); pwForm.resetFields() }} /></Tooltip>
          <Popconfirm title={t('usr.otpResetAsk', { name: u.fullName || u.userId })} okText={t('usr.otpReset')} cancelText={t('req.cancel')} onConfirm={() => resetOtp.mutate(u.id)}>
            <Tooltip title={t('usr.otpReset')}><Button size="small" type="text" icon={<SafetyCertificateOutlined />} /></Tooltip>
          </Popconfirm>
          <Popconfirm title={t('usr.deleteAsk', { name: u.fullName || u.userId })} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(u)} disabled={isMe(u)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={isMe(u)} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const s = stats.data
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<IdcardOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.users')} subtitle={t('nav.usersDesc')}
        extra={<Button type="primary" icon={<UserAddOutlined />} onClick={() => setCreating(true)}>{t('usr.add')}</Button>} />

      {pw.data?.legacyMode && pw.data.counts.hashed + pw.data.counts.default > 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('usr.pwCompatTitle', { n: pw.data.counts.hashed + pw.data.counts.default })} description={t('usr.pwCompatDesc')} />
      )}
      {pw.data && !pw.data.legacyMode && (pw.data.counts.legacy > 0 || pw.data.running) && (
        <Alert type={pw.data.running ? 'info' : 'warning'} showIcon style={{ marginBottom: 16 }} title={t('usr.pwLegacyTitle', { n: pw.data.counts.legacy })}
          description={pw.data.running ? t('usr.pwRunning', { done: pw.data.processed, total: pw.data.total, failed: pw.data.failed }) : t('usr.pwLegacyDesc', { hashed: pw.data.counts.hashed, def: pw.data.counts.default })}
          action={<Popconfirm title={t('usr.pwMigrateAsk')} okText={t('usr.pwMigrate')} cancelText={t('req.cancel')} disabled={!pw.data.legacyKeyAvailable || pw.data.running} onConfirm={() => migrate.mutate()}>
            <Button type="primary" disabled={!pw.data.legacyKeyAvailable || pw.data.running} loading={migrate.isPending}>{t('usr.pwMigrate')}</Button>
          </Popconfirm>} />
      )}
      <div className="stat-grid">
        {([['total', s?.total, '#0F6B3E'], ['active', s?.active, '#2E9E4F'], ['locked', s?.locked, '#D92D20'], ['approvers', s?.approvers, '#2F6FB0'], ['online', online.data?.count, '#52C41A']] as const).map(([k, v, c]) => (
          <div key={k} className="stat-tile" style={{ ['--tile' as string]: c }}>
            <div className="st-label">{t(`usr.stat.${k}`)}</div>
            <div className="st-value">{v === undefined ? '…' : v.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <DataTable<AdminUser>
        rowKey="id" size="small" sticky={false} scroll={{ x: 1480 }} loading={onlineOnly ? online.isFetching && !online.data : q.isFetching} columns={columns} dataSource={onlineOnly ? (online.data?.users ?? []).map((x) => x.user) : (q.data?.rows ?? [])}
        rowClassName={(u) => (u.active ? '' : 'row-st-rejected')}
        pagination={{ current: page, pageSize, total: onlineOnly ? (online.data?.users.length ?? 0) : (q.data?.total ?? 0), showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: (n: number) => n.toLocaleString(), onChange: (p: number, sz: number) => { setPage(p); setPageSize(sz) } }}
        locale={{ emptyText: q.isError ? t('usr.err.generic') : t('req.submittedEmpty') }}
        toolbar={(
          <Space wrap>
            <Input.Search allowClear style={{ width: 320 }} placeholder={t('usr.search')} value={search} onChange={(e) => setSearch(e.target.value)} onSearch={apply} enterButton />
            <Select allowClear showSearch optionFilterProp="label" style={{ width: 220 }} placeholder={t('usr.allGroups')} value={group}
              onChange={(v) => { setGroup(v); setPage(1); setApplied({ search: search.trim(), group: v }) }} options={groupOptions} />
            <Button type={onlineOnly ? 'primary' : 'default'} onClick={() => { setOnlineOnly((v) => !v); setPage(1) }}><span className="uo-dot inline" /> {t('usr.onlineOnly')} ({online.data?.count ?? 0})</Button>
            <Segmented disabled={onlineOnly} value={status} onChange={(v) => { setStatus(v as typeof status); setPage(1) }}
              options={[{ value: 'all', label: t('usr.all') }, { value: 'active', label: t('usr.active') }, { value: 'locked', label: t('usr.locked') }]} />
          </Space>
        )}
      />

      {/* Thêm tài khoản */}
      <AppModal open={creating} onClose={closeCreate} size="md" icon={<UserAddOutlined />} title={t('usr.add')} subtitle={t('usr.addHint')}
        okText={t('usr.createBtn')} okLoading={create.isPending} onOk={() => { if (emp?.active) createForm.validateFields().then((v) => create.mutate(v)); else setEmpError(empError || t('usr.err.employee_required')) }}>
        <Form form={createForm} layout="vertical" autoComplete="off">
          <Form.Item name="employeeId" label={t('sys.colEmp')} rules={[{ required: true }]} validateStatus={empError ? 'error' : emp?.active ? 'success' : undefined} help={empError || undefined}>
            <Input.Search enterButton={t('usr.lookup')} maxLength={100} onSearch={lookup} onBlur={(e) => lookup(e.target.value)} />
          </Form.Item>
          {emp && (
            <div className="cl-person" style={{ marginBottom: 16 }}>
              <div className="cl-who"><UserAvatar name={emp.fullName} size={38} /><div><div className="cl-name">{emp.fullName}</div><div className="cl-meta">{[emp.employeeId, emp.department].filter(Boolean).join(' · ')}</div></div></div>
              <Tag color={emp.active ? 'green' : 'red'} variant="filled">{emp.active ? t('usr.active') : t('usr.locked')}</Tag>
            </div>
          )}
          <Form.Item name="userId" label={t('usr.colAccount')} rules={[{ required: true }, { pattern: /^[A-Za-z0-9._@-]{3,50}$/, message: t('usr.err.userId') }]}><Input maxLength={50} /></Form.Item>
          <Form.Item name="password" label={t('usr.password')} rules={[{ required: true }, { min: 6 }, { max: 24 }]} extra={t('usr.pwHint')}><Input.Password maxLength={24} autoComplete="new-password" /></Form.Item>
          <Form.Item name="groupId" label={t('usr.colGroup')} rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={groupOptions} /></Form.Item>
          <Form.Item name="email" label={t('usr.colEmail')} rules={[{ type: 'email' }, { max: 50 }]} extra={t('usr.emailHint')}><Input maxLength={50} /></Form.Item>
          <Form.Item name="factoryCode" label={t('usr.colFactory')}><Select allowClear options={factoryOptions} /></Form.Item>
        </Form>
      </AppModal>

      {/* Sửa */}
      <AppModal open={editing !== null} onClose={() => setEditing(null)} size="sm" icon={<EditOutlined />} title={t('usr.edit')} subtitle={editing ? `${editing.fullName} · ${editing.userId}` : undefined}
        okText={t('req.saveChanges')} okLoading={save.isPending} onOk={() => editForm.validateFields().then((v) => save.mutate(v))}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="groupId" label={t('usr.colGroup')} rules={[{ required: true }]} extra={editing && isMe(editing) ? t('usr.err.self_change') : undefined}>
            <Select showSearch optionFilterProp="label" options={groupOptions} disabled={!!editing && isMe(editing)} />
          </Form.Item>
          <Form.Item name="email" label={t('usr.colEmail')} rules={[{ type: 'email' }, { max: 50 }]} extra={t('usr.emailHint')}><Input maxLength={50} /></Form.Item>
          <Form.Item name="factoryCode" label={t('usr.colFactory')}><Select allowClear options={factoryOptions} /></Form.Item>
        </Form>
      </AppModal>

      {/* Đặt lại mật khẩu */}
      <AppModal open={resetting !== null} onClose={() => setResetting(null)} size="sm" icon={<KeyOutlined />} title={t('usr.resetPw')} subtitle={resetting ? `${resetting.fullName} · ${resetting.userId}` : undefined}
        okText={t('usr.resetBtn')} okLoading={reset.isPending} onOk={() => pwForm.validateFields().then((v) => reset.mutate(v))}>
        <Form form={pwForm} layout="vertical" autoComplete="off">
          <Form.Item name="password" label={t('usr.newPassword')} rules={[{ required: true }, { min: 6 }, { max: 24 }]} extra={t('usr.pwHint')}><Input.Password maxLength={24} autoComplete="new-password" /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
