import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Checkbox, Col, Empty, Popconfirm, Row, Select, Space, Switch, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined, UndoOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { permissions, type PageAccess, type UserGrant } from '../../api/permissions'

type Row = PageAccess & { fixed?: 'admin' | 'security' }
import { adminError, userAdmin } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { MiniTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { ALL_PAGES } from '../../config/navigation'
import { useToast } from '../../hooks/useToast'

/**
 * Phân quyền trang của hệ thống MỚI theo nhóm. Mặc định theo menu của nhóm ở hệ thống cũ (chỉ đọc);
 * bật / tắt từng trang được lưu riêng cho hệ thống mới nên không đổi gì ở hệ thống cũ.
 */
export default function PermissionsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [selected, setSelected] = useState<string>()
  const [draft, setDraft] = useState<Record<string, boolean>>({})

  const groups = useQuery({ queryKey: ['perm', 'groups'], queryFn: permissions.groups })
  const access = useQuery({ queryKey: ['perm', 'access', selected], queryFn: () => permissions.access(selected!), enabled: !!selected, retry: false })

  useEffect(() => {
    if (access.data) setDraft(Object.fromEntries(access.data.pages.map((p) => [p.key, p.allowed])))
  }, [access.data])

  const dirty = useMemo(() => (access.data?.pages ?? []).some((p) => draft[p.key] !== undefined && draft[p.key] !== p.allowed), [access.data, draft])
  const refresh = () => qc.invalidateQueries({ queryKey: ['perm'] })
  const onError = (e: unknown) => msg.error(adminError(e).code === 'table_missing' ? t('sys.err.noTable') : t('sys.err.generic'))

  const save = useMutation({ mutationFn: () => permissions.save(selected!, draft), onSuccess: () => { msg.success(t('sys.saved')); refresh() }, onError })
  const reset = useMutation({ mutationFn: () => permissions.reset(selected!), onSuccess: () => { msg.success(t('sys.resetDone')); refresh() }, onError })

  // Mọi màn của hệ thống mới đều được liệt kê: màn người dùng chỉnh được; màn quản trị / bảo vệ chỉ xem (do nhóm quản trị / bảo vệ trong cấu hình quyết định).
  const rows = useMemo<Row[]>(() => {
    const editable = access.data?.pages ?? []
    const have = new Set(editable.map((p) => p.key))
    const fixed: Row[] = ALL_PAGES.filter((p) => (p.adminOnly || p.securityOnly) && !have.has(p.key ?? ''))
      .map((p) => ({ key: p.key ?? p.path, legacyPages: [], default: true, override: null, allowed: true, approval: false, admin: false, fixed: p.adminOnly ? 'admin' : 'security' }))
    const order = (k: string) => { const i = ALL_PAGES.findIndex((x) => x.key === k); return i < 0 ? 9999 : i }
    return [...editable, ...fixed].sort((a, b) => order(a.key) - order(b.key))
  }, [access.data])

  const label = (key: string) => { const p = ALL_PAGES.find((x) => x.key === key); return p ? t(p.labelKey) : t(`sys.pageKey.${key}`, { defaultValue: key }) }
  const group = access.data?.group ?? groups.data?.find((x) => x.groupId === selected)

  const columns: ColumnsType<Row> = [
    {
      title: t('sys.colPage'), dataIndex: 'key', width: 260,
      render: (k: string, p) => <Space size={6} wrap><b>{label(k)}</b>{p.approval && <Tag variant="filled">{t('sys.approvalTag')}</Tag>}{p.admin && <Tag color="purple" variant="filled">{t('sys.adminTag')}</Tag>}<Typography.Text type="secondary" style={{ fontSize: 12 }}>{t(ALL_PAGES.find((x) => x.key === k)?.workspace.labelKey ?? 'ws.home')}</Typography.Text></Space>,
    },
    { title: t('sys.colFile'), dataIndex: 'legacyPages', render: (l: string[], p) => (l.length ? l.map((x) => <Typography.Text code key={x}>{x}</Typography.Text>) : <Typography.Text type="secondary">{t(p.admin ? 'sys.adminDefaultOff' : 'sys.newOnly')}</Typography.Text>) },
    { title: t('sys.colDefault'), dataIndex: 'default', width: 130, align: 'center', render: (v: boolean, p) => (p.fixed ? <Tag variant="filled">{t(p.fixed === 'admin' ? 'sys.adminOnlyTag' : 'sys.securityOnlyTag')}</Tag> : <Tag color={v ? 'green' : 'default'} variant="filled">{v ? t('sys.on') : t('sys.off')}</Tag>) },
    {
      title: t('sys.colAllowed'), width: 170, align: 'center',
      render: (_: unknown, p) => {
        if (p.fixed) return <Switch size="small" checked disabled />
        const v = draft[p.key] ?? p.allowed
        return <Space size={8}><Switch size="small" checked={v} onChange={(c) => setDraft((d) => ({ ...d, [p.key]: c }))} />{v !== p.default && <Tag color="gold" variant="filled">{t('sys.custom')}</Tag>}</Space>
      },
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<KeyOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.permissions')} subtitle={t('nav.permissionsDesc')} />
      <Alert type="info" showIcon title={t('sys.note')} style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8} xl={7}>
          <Card title={t('sys.groups')} loading={groups.isLoading}>
            <div style={{ display: 'grid', gap: 8 }}>
              {(groups.data ?? []).map((x) => (
                <button key={x.groupId} type="button" onClick={() => setSelected(x.groupId)} aria-pressed={x.groupId === selected}
                  style={{
                    textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 10, background: x.groupId === selected ? 'color-mix(in srgb, var(--c-primary) 12%, var(--c-surface))' : 'var(--c-surface)',
                    border: `1px solid ${x.groupId === selected ? 'var(--c-primary)' : 'var(--cell-line, #e5e7eb)'}`, opacity: x.active ? 1 : 0.6,
                  }}>
                  <div style={{ fontWeight: 600 }}>{x.nameVi || x.name}</div>
                  <Space size={6} wrap style={{ marginTop: 4 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{x.groupId}</Typography.Text>
                    <Tag variant="filled">{t('sys.usersN', { n: x.users })}</Tag>
                    {x.customized > 0 && <Tag color="gold" variant="filled">{t('sys.customN', { n: x.customized })}</Tag>}
                  </Space>
                </button>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={16} xl={17}>
          {!selected ? <Card><Empty description={t('sys.selectGroup')} /></Card> : (
            <Card
              title={t('sys.accessOf', { name: group ? group.nameVi || group.name : selected })} loading={access.isLoading}
              extra={(
                <Space>
                  <Popconfirm title={t('sys.resetAsk')} okText="OK" cancelText={t('req.cancel')} onConfirm={() => reset.mutate()}>
                    <Button icon={<UndoOutlined />} loading={reset.isPending} disabled={!group?.customized}>{t('sys.reset')}</Button>
                  </Popconfirm>
                  <Button type="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>{t('req.saveChanges')}</Button>
                </Space>
              )}>
              <MiniTable<PageAccess> rowKey="key" size="small" pagination={false} columns={columns} dataSource={rows} />
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>{t('sys.adminNote')}</Typography.Paragraph>
            </Card>
          )}
        </Col>
      </Row>
      <UserGrantsCard />
    </div>
  )
}

/**
 * Cấp riêng một số màn quản trị cho TỪNG NGƯỜI (ngoài nhóm quyền của họ): dùng khi chỉ muốn quản trị và vài người được chọn vào một màn.
 * Chỉ quản trị thật mới thêm / bỏ được; người được cấp thấy màn trong menu và dùng được API tương ứng.
 */
function UserGrantsCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [editing, setEditing] = useState<{ userId: string; fullName: string; pages: string[]; isNew: boolean } | null>(null)
  const [search, setSearch] = useState('')
  const data = useQuery({ queryKey: ['perm', 'users'], queryFn: permissions.userGrants, retry: false })
  const found = useQuery({
    queryKey: ['perm', 'users', 'find', search],
    queryFn: async () => (await userAdmin.list(search, undefined, 'active', 1, 20)).rows.map((u) => ({ value: u.userId.trim(), label: `${u.fullName} · ${u.employeeId}${u.department ? ` · ${u.department}` : ''}`, name: u.fullName })),
    enabled: !!editing?.isNew && search.trim().length >= 2,
  })
  const label = (key: string) => { const p = ALL_PAGES.find((x) => x.key === key); return p ? t(p.labelKey) : t(`sys.pageKey.${key}`, { defaultValue: key }) }
  const errText = (e: unknown) => (adminError(e).code === 'table_missing' ? t('sys.err.noTable') : t('sys.err.generic'))
  const save = useMutation({
    mutationFn: (v: { userId: string; pages: string[] }) => permissions.saveUser(v.userId, v.pages),
    onSuccess: () => { msg.success(t('sys.saved')); setEditing(null); setSearch(''); qc.invalidateQueries({ queryKey: ['perm', 'users'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const grantable = data.data?.grantable ?? []
  // Sắp theo thứ tự menu cho dễ đọc
  const order = (k: string) => { const i = ALL_PAGES.findIndex((x) => x.key === k); return i < 0 ? 9999 : i }
  const options = [...grantable].sort((a, b) => order(a) - order(b)).map((k) => ({ value: k, label: label(k) }))

  const columns: ColumnsType<UserGrant> = [
    { title: t('line.person'), width: 260, render: (_: unknown, r) => <span><b>{r.fullName}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span> },
    { title: t('att.dept'), dataIndex: 'department', width: 200, ellipsis: true, render: (v: string | null) => v || '-' },
    { title: t('sys.colPage'), render: (_: unknown, r) => <Space size={[4, 4]} wrap>{[...r.pages].sort((a, b) => order(a) - order(b)).map((k) => <Tag key={k} color="purple" variant="filled">{label(k)}</Tag>)}</Space> },
    {
      title: '', width: 190,
      render: (_: unknown, r) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing({ userId: r.userId, fullName: r.fullName, pages: r.pages, isNew: false })}>{t('req.edit')}</Button>
          <Popconfirm title={t('sys.userGrantRemoveAsk', { name: r.fullName })} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => save.mutate({ userId: r.userId, pages: [] })}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('sys.userGrantRemove')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card style={{ marginTop: 16 }} title={<Space><UserAddOutlined />{t('sys.userGrants')}</Space>} loading={data.isLoading}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ userId: '', fullName: '', pages: [], isNew: true })}>{t('sys.userGrantAdd')}</Button>}>
      <Typography.Paragraph type="secondary">{t('sys.userGrantsHint')}</Typography.Paragraph>
      <MiniTable<UserGrant> rowKey="userId" size="small" pagination={false} columns={columns} dataSource={data.data?.users ?? []} locale={{ emptyText: t('sys.userGrantNone') }} />
      <AppModal open={!!editing} onClose={() => { setEditing(null); setSearch('') }} size="md" icon={<UserAddOutlined />} title={t('sys.userGrants')}
        subtitle={editing && !editing.isNew ? `${editing.fullName} · ${editing.userId}` : undefined} okText={t('req.saveChanges')}
        okDisabled={!editing?.userId || (editing.pages.length === 0 && editing.isNew)} okLoading={save.isPending}
        onOk={() => editing && save.mutate({ userId: editing.userId, pages: editing.pages })}>
        {editing?.isNew && (
          <Select showSearch filterOption={false} style={{ width: '100%', marginBottom: 12 }} placeholder={t('ann.unionPick')} value={editing.userId || undefined} onSearch={setSearch}
            onChange={(v) => setEditing((e) => (e ? { ...e, userId: v } : e))} options={found.data ?? []} loading={found.isFetching}
            notFoundContent={search.trim().length < 2 ? t('ann.unionTypeMore') : undefined} />
        )}
        <Checkbox.Group value={editing?.pages ?? []} onChange={(v) => setEditing((e) => (e ? { ...e, pages: v as string[] } : e))} options={options}
          style={{ display: 'grid', gap: 8 }} />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>{t('sys.userGrantNote')}</Typography.Paragraph>
      </AppModal>
    </Card>
  )
}
