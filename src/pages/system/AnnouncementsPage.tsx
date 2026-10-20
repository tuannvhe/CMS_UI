import { useMemo, useState } from 'react'
import { Avatar, Button, Form, Input, Popconfirm, Select, Space, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, EyeOutlined, NotificationOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { announcementAdmin, unionAnnouncements, unionPosters, type AnnouncementRow } from '../../api/announcementAdmin'
import { userAdmin } from '../../api/userAdmin'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { RichTextEditor } from '../../components/RichTextEditor'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../auth/AuthContext'

interface FormValues { title: string; type: string }

/**
 * Quản lý thông báo của HR hiện ở trang chủ (Tbl_NotificationSystem, dùng chung với hệ thống cũ). Trang chủ hiện các thông báo đang bật mới nhất.
 * Không xoá thông báo: tắt là ẩn khỏi trang chủ nhưng vẫn còn trong danh sách để bật lại.
 */
export default function AnnouncementsPage({ union = false }: { union?: boolean }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const api = union ? unionAnnouncements : announcementAdmin
  const [postersOpen, setPostersOpen] = useState(false)
  const msg = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null)
  const [preview, setPreview] = useState<AnnouncementRow | null>(null)
  const [html, setHtml] = useState('')
  const [form] = Form.useForm<FormValues>()

  const q = useQuery({ queryKey: ['announcement-admin', union ? 'union' : 'all'], queryFn: api.list })
  const rows = useMemo(() => q.data?.items ?? [], [q.data])
  const refresh = () => { qc.invalidateQueries({ queryKey: ['announcement-admin'] }); qc.invalidateQueries({ queryKey: ['announcements'] }) }
  const errText = (e: unknown) => t(`ann.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })

  const save = useMutation({
    mutationFn: (v: FormValues) => (editing && editing !== 'new' ? api.update(editing.id, { ...v, html }) : api.add({ ...v, html })),
    onSuccess: () => { msg.success(t('ann.saved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (r: AnnouncementRow) => api.toggle(r.id),
    onSuccess: () => { msg.success(t('ann.saved')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const open = (r: AnnouncementRow | 'new') => {
    setEditing(r)
    setHtml(r === 'new' ? '' : r.html)
    form.setFieldsValue(r === 'new' ? { title: '', type: q.data?.types[0] } : { title: r.title, type: r.type })
  }
  const when = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  const columns: ColumnsType<AnnouncementRow> = [
    { title: t('ann.title'), dataIndex: 'title', render: (v: string) => <b>{v}</b> },
    { title: t('ann.type'), dataIndex: 'type', width: 220, render: (v: string) => <span className="org-chip ok">{v}</span> },
    { title: t('ann.createdAt'), dataIndex: 'createdAt', width: 170, render: when },
    { title: t('ann.createdBy'), dataIndex: 'createdBy', width: 120 },
    {
      title: t('ann.shown'), dataIndex: 'active', width: 110,
      render: (v: boolean, r) => (
        <Popconfirm title={t(v ? 'ann.hideAsk' : 'ann.showAsk')} okText="OK" cancelText={t('req.cancel')} onConfirm={() => toggle.mutate(r)}>
          <Switch checked={v} loading={toggle.isPending && toggle.variables?.id === r.id} />
        </Popconfirm>
      ),
    },
    {
      title: '', width: 150,
      render: (_: unknown, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(r)}>{t('ann.preview')}</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => open(r)}>{t('req.edit')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<NotificationOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t(union ? 'nav.unionAnnouncements' : 'nav.announcements')} subtitle={t(union ? 'nav.unionAnnouncementsDesc' : 'nav.announcementsDesc')}
        extra={!union && user?.isAdmin ? <Button icon={<TeamOutlined />} onClick={() => setPostersOpen(true)}>{t('ann.unionPosters')}</Button> : undefined} />
      <StatTiles items={[
        { label: t('ann.tileAll'), value: rows.length },
        { label: t('ann.tileShown'), value: rows.filter((r) => r.active).length, color: '#2E9E4F' },
        { label: t('ann.tileHidden'), value: rows.filter((r) => !r.active).length, color: 'var(--c-muted)' },
      ]} />
      <DataTable<AnnouncementRow>
        rowKey="id" loading={q.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: q.isError ? t('usr.err.generic') : t('ann.empty') }}
        toolbar={<Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('ann.add')}</Button>}
      />

      <AppModal open={!!editing} onClose={() => setEditing(null)} size="lg" icon={<NotificationOutlined />} title={editing === 'new' ? t('ann.add') : t('ann.edit')} subtitle={t('ann.hint')}
        okText={t('req.saveChanges')} okLoading={save.isPending} onOk={() => form.validateFields().then((v) => save.mutate(v))}>
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item name="title" label={t('ann.title')} rules={[{ required: true }, { min: 3 }, { max: 500 }]}><Input maxLength={500} showCount /></Form.Item>
          <Form.Item name="type" label={t('ann.type')} rules={[{ required: true }]}><Select disabled={union} options={(q.data?.types ?? []).map((x) => ({ value: x, label: x }))} /></Form.Item>
          <Form.Item label={t('ann.content')} required>
            <RichTextEditor value={html} onChange={setHtml} onUploadImages={api.uploadImages} resetKey={editing === 'new' ? 'new' : (editing?.id ?? '')} />
          </Form.Item>
        </Form>
      </AppModal>

      {!union && user?.isAdmin && <UnionPostersModal open={postersOpen} onClose={() => setPostersOpen(false)} />}

      <AppModal open={!!preview} onClose={() => setPreview(null)} size="lg" icon={<EyeOutlined />} title={preview?.title ?? ''} subtitle={preview ? `${preview.type} · ${when(preview.createdAt)}` : undefined}>
        {/* html đã được máy chủ lọc */}
        <div className="hn-body" style={{ padding: 4 }} dangerouslySetInnerHTML={{ __html: preview?.html ?? '' }} />
      </AppModal>
    </div>
  )
}

/** Quản trị chọn thêm người (ngoài nhân sự) được đăng thông báo công đoàn; người này chỉ đăng / sửa được thông báo loại công đoàn. */
function UnionPostersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [pick, setPick] = useState<string>()
  const [search, setSearch] = useState('')
  const list = useQuery({ queryKey: ['union-posters'], queryFn: unionPosters.list, enabled: open })
  const found = useQuery({ queryKey: ['union-posters', 'find', search], queryFn: () => userAdmin.list(search, undefined, 'active', 1, 20), enabled: open && search.trim().length >= 2 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['union-posters'] })
  const errText = (e: unknown) => t(`ann.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })
  const add = useMutation({ mutationFn: () => unionPosters.add(pick!), onSuccess: () => { msg.success(t('ann.saved')); setPick(undefined); setSearch(''); refresh() }, onError: (e) => msg.error(errText(e)) })
  const remove = useMutation({ mutationFn: (id: string) => unionPosters.remove(id), onSuccess: () => { msg.success(t('ann.saved')); refresh() }, onError: (e) => msg.error(errText(e)) })
  const options = (found.data?.rows ?? []).map((u) => ({ value: u.userId.trim(), label: `${u.fullName} · ${u.employeeId}${u.department ? ` · ${u.department}` : ''}` }))
  return (
    <AppModal open={open} onClose={onClose} size="md" icon={<TeamOutlined />} title={t('ann.unionPosters')} subtitle={t('ann.unionPostersHint')} footer={null}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Select showSearch filterOption={false} style={{ width: '100%' }} placeholder={t('ann.unionPick')} value={pick} onSearch={setSearch} onChange={setPick}
          options={options} loading={found.isFetching} notFoundContent={search.trim().length < 2 ? t('ann.unionTypeMore') : undefined} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!pick} loading={add.isPending} onClick={() => add.mutate()}>{t('line.add')}</Button>
      </Space.Compact>
      <DataTable<{ userId: string; fullName: string; department: string | null }>
        rowKey="userId" size="small" sticky={false} loading={list.isLoading} dataSource={list.data ?? []} pagination={false}
        locale={{ emptyText: t('ann.unionNone') }}
        columns={[
          { title: t('line.person'), render: (_: unknown, r) => <span><b>{r.fullName}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span> },
          { title: t('att.dept'), dataIndex: 'department', ellipsis: true, render: (v: string | null) => v || '-' },
          { title: '', width: 90, render: (_: unknown, r) => (
            <Popconfirm title={t('ann.unionRemoveAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.userId)}>
              <Button size="small" danger>{t('req.delete')}</Button>
            </Popconfirm>
          ) },
        ]}
      />
    </AppModal>
  )
}
