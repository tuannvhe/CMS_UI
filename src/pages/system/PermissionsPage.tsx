import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Checkbox, Col, Empty, Popconfirm, Row, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CaretRightOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, FolderOpenOutlined, FolderOutlined, KeyOutlined, LockOutlined, PlusOutlined, UndoOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { permissions, type PageAccess, type UserGrant } from '../../api/permissions'

type Row = PageAccess & { fixed?: 'admin' | 'security' }
import { adminError, userAdmin } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { MiniTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { ALL_PAGES, WORKSPACES } from '../../config/navigation'
import { useToast } from '../../hooks/useToast'
import { useDebouncedValue } from '../../hooks/useDebounce'

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
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})

  const groups = useQuery({ queryKey: ['perm', 'groups'], queryFn: permissions.groups })
  // Chỉ hiện nhóm đang dùng: nhóm không có người dùng hoặc đã ngừng hoạt động thì ẩn (khi có người được gán vào nhóm, nhóm tự hiện lại).
  const usedGroups = useMemo(() => (groups.data ?? []).filter((x) => x.active && x.users > 0), [groups.data])
  const hiddenGroups = (groups.data?.length ?? 0) - usedGroups.length
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

  // Gom các màn theo workspace (menu) thành "thư mục"; màn không thuộc workspace nào vào thư mục cuối.
  const folders = useMemo(() => {
    const wsOf = (k: string) => ALL_PAGES.find((x) => x.key === k)?.workspace.key ?? '__other'
    const by = new Map<string, Row[]>()
    rows.forEach((r) => { const w = wsOf(r.key); by.set(w, [...(by.get(w) ?? []), r]) })
    const list = WORKSPACES.filter((w) => by.has(w.key)).map((w) => ({ key: w.key, name: t(w.labelKey), rows: by.get(w.key)! }))
    if (by.has('__other')) list.push({ key: '__other', name: t('sys.folderOther'), rows: by.get('__other')! })
    return list
  }, [rows, t])

  const valueOf = (p: Row) => draft[p.key] ?? p.allowed
  const toggleFolder = (k: string) => setOpenFolders((o) => ({ ...o, [k]: !o[k] }))
  const allOpen = folders.length > 0 && folders.every((f) => openFolders[f.key])
  const setAllOpen = (v: boolean) => setOpenFolders(Object.fromEntries(folders.map((f) => [f.key, v])))

  const renderFolder = (f: (typeof folders)[number]) => {
    const editable = f.rows.filter((p) => !p.fixed)
    const on = editable.filter(valueOf).length
    const custom = editable.filter((p) => valueOf(p) !== p.default).length
    const open = !!openFolders[f.key]
    const setFolder = (c: boolean) => setDraft((d) => ({ ...d, ...Object.fromEntries(editable.map((p) => [p.key, c])) }))
    return (
      <div key={f.key} style={{ border: '1px solid var(--cell-line, #e5e7eb)', borderRadius: 10, background: 'var(--c-surface)', overflow: 'hidden' }}>
        <div role="button" tabIndex={0} aria-expanded={open} onClick={() => toggleFolder(f.key)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleFolder(f.key) } }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: open ? 'color-mix(in srgb, var(--c-primary) 6%, var(--c-surface))' : undefined }}>
          <CaretRightOutlined style={{ fontSize: 11, transition: 'transform .15s', transform: open ? 'rotate(90deg)' : undefined }} />
          <span onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={editable.length > 0 && on === editable.length} indeterminate={on > 0 && on < editable.length} disabled={editable.length === 0} onChange={(e) => setFolder(e.target.checked)} />
          </span>
          <span style={{ fontSize: 18, color: 'var(--c-primary)', display: 'inline-flex' }}>{open ? <FolderOpenOutlined /> : <FolderOutlined />}</span>
          <b style={{ flex: 1 }}>{f.name}</b>
          {custom > 0 && <Tag color="gold" variant="filled">{t('sys.customN', { n: custom })}</Tag>}
          <Tag variant="filled">{t('sys.folderCount', { on: on + (f.rows.length - editable.length), total: f.rows.length })}</Tag>
        </div>
        {open && (
          <div style={{ borderTop: '1px solid var(--cell-line, #e5e7eb)' }}>
            {f.rows.map((p) => {
              const v = p.fixed ? true : valueOf(p)
              return (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px 44px', cursor: p.fixed ? 'default' : 'pointer', borderTop: '1px dashed var(--cell-line, #e5e7eb)' }}>
                  <Checkbox checked={v} disabled={!!p.fixed} onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.checked }))} />
                  {p.fixed ? <LockOutlined style={{ color: 'var(--c-muted)' }} /> : <FileTextOutlined style={{ color: 'var(--c-muted)' }} />}
                  <Space size={6} wrap style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontWeight: 500 }}>{label(p.key)}</b>
                    {p.approval && <Tag variant="filled">{t('sys.approvalTag')}</Tag>}
                    {p.admin && <Tag color="purple" variant="filled">{t('sys.adminTag')}</Tag>}
                    {p.legacyPages.length > 0 ? p.legacyPages.map((x) => <Typography.Text code key={x} style={{ fontSize: 12 }}>{x}</Typography.Text>) : !p.fixed && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t(p.admin ? 'sys.adminDefaultOff' : 'sys.newOnly')}</Typography.Text>}
                  </Space>
                  {p.fixed
                    ? <Tag variant="filled">{t(p.fixed === 'admin' ? 'sys.adminOnlyTag' : 'sys.securityOnlyTag')}</Tag>
                    : <Space size={6}>{v !== p.default && <Tag color="gold" variant="filled">{t('sys.custom')}</Tag>}<Tag color={p.default ? 'green' : 'default'} variant="filled">{t('sys.colDefault')}: {p.default ? t('sys.on') : t('sys.off')}</Tag></Space>}
                </label>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<KeyOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.permissions')} subtitle={t('nav.permissionsDesc')} />
      <Alert type="info" showIcon title={t('sys.note')} style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8} xl={7}>
          <Card title={t('sys.groups')} loading={groups.isLoading}>
            <div style={{ display: 'grid', gap: 8 }}>
              {usedGroups.map((x) => (
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
            {hiddenGroups > 0 && <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>{t('sys.hiddenGroupsN', { n: hiddenGroups })}</Typography.Paragraph>}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Button size="small" type="link" onClick={() => setAllOpen(!allOpen)}>{allOpen ? t('sys.collapseAll') : t('sys.expandAll')}</Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>{folders.map(renderFolder)}</div>
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
  const dSearch = useDebouncedValue(search)   // chỉ gọi API khi ngừng gõ
  const data = useQuery({ queryKey: ['perm', 'users'], queryFn: permissions.userGrants, retry: false })
  const found = useQuery({
    queryKey: ['perm', 'users', 'find', dSearch],
    queryFn: async () => (await userAdmin.list(dSearch, undefined, 'active', 1, 20)).rows.map((u) => ({ value: u.userId.trim(), label: `${u.fullName} · ${u.employeeId}${u.department ? ` · ${u.department}` : ''}`, name: u.fullName })),
    enabled: !!editing?.isNew && dSearch.trim().length >= 2,
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
