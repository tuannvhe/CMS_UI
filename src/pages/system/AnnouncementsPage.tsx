import { useMemo, useState } from 'react'
import { Avatar, Button, Form, Input, Popconfirm, Select, Space, Switch, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, EyeOutlined, FileTextOutlined, NotificationOutlined, PlusOutlined, TeamOutlined, TranslationOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { announcementAdmin, ehsAnnouncements, ehsPosters, generalPosters, unionAnnouncements, unionPosters, type AnnouncementRow, type UnionPoster } from '../../api/announcementAdmin'
import { userAdmin } from '../../api/userAdmin'
import { adminError } from '../../api/userAdmin'
import { AnnouncementBody, joinHtmlPage, splitHtmlPage } from '../../components/AnnouncementBody'
import { AppModal } from '../../components/AppModal'
import { AnnouncementTranslationsModal } from '../../components/AnnouncementTranslationsModal'
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
export default function AnnouncementsPage({ union = false, ehs = false }: { union?: boolean; ehs?: boolean }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const own = union || ehs   // trang của nhóm đăng ngoài HR: loại thông báo cố định
  const api = union ? unionAnnouncements : ehs ? ehsAnnouncements : announcementAdmin
  const [postersOpen, setPostersOpen] = useState<'union' | 'ehs' | 'general' | null>(null)
  const canEhsPosters = !union && (ehs ? !!user?.ehsLead || !!user?.isAdmin : !!user?.isAdmin)   // trưởng bộ phận EHS (ở trang EHS) và quản trị thêm người đăng EHS
  const msg = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null)
  const [preview, setPreview] = useState<AnnouncementRow | null>(null)
  const [translating, setTranslating] = useState<AnnouncementRow | null>(null)   // bản dịch EN / KO (chỉ trang thông báo chung của HR)
  const [html, setHtml] = useState('')
  const [page, setPage] = useState<string | null>(null)   // tệp HTML đính kèm (mã tệp), hiện trong iframe sandbox
  const [pagePreview, setPagePreview] = useState(false)
  const [form] = Form.useForm<FormValues>()

  const q = useQuery({ queryKey: ['announcement-admin', union ? 'union' : ehs ? 'ehs' : 'all'], queryFn: api.list })
  const rows = useMemo(() => q.data?.items ?? [], [q.data])
  const refresh = () => { qc.invalidateQueries({ queryKey: ['announcement-admin'] }); qc.invalidateQueries({ queryKey: ['announcements'] }) }
  const errText = (e: unknown) => t(`ann.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })

  const save = useMutation({
    mutationFn: (v: FormValues) => (editing && editing !== 'new' ? api.update(editing.id, { ...v, html: joinHtmlPage(html, page) }) : api.add({ ...v, html: joinHtmlPage(html, page) })),
    onSuccess: () => { msg.success(t('ann.saved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const uploadHtml = useMutation({
    mutationFn: (f: File) => api.uploadHtml(f),
    onSuccess: (key) => { setPage(key); msg.success(t('ann.htmlDone')) },
    onError: (e) => msg.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (r: AnnouncementRow) => api.toggle(r.id),
    onSuccess: () => { msg.success(t('ann.saved')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const open = (r: AnnouncementRow | 'new') => {
    setEditing(r)
    const parts = splitHtmlPage(r === 'new' ? '' : r.html)
    setHtml(parts.rest)
    setPage(parts.page)
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
      title: '', width: own ? 150 : 250,
      render: (_: unknown, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(r)}>{t('ann.preview')}</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => open(r)}>{t('req.edit')}</Button>
          {!own && <Button size="small" icon={<TranslationOutlined />} onClick={() => setTranslating(r)}>{t('ctr.button')}</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<NotificationOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t(union ? 'nav.unionAnnouncements' : ehs ? 'nav.ehsAnnouncements' : 'nav.announcements')} subtitle={t(union ? 'nav.unionAnnouncementsDesc' : ehs ? 'nav.ehsAnnouncementsDesc' : 'nav.announcementsDesc')}
        extra={(!own && user?.isAdmin) || canEhsPosters ? (
          <Space size={8} wrap>
            {!own && user?.isAdmin && <Button icon={<TeamOutlined />} onClick={() => setPostersOpen('general')}>{t('ann.generalPosters')}</Button>}
            {!own && user?.isAdmin && <Button icon={<TeamOutlined />} onClick={() => setPostersOpen('union')}>{t('ann.unionPosters')}</Button>}
            {canEhsPosters && <Button icon={<TeamOutlined />} onClick={() => setPostersOpen('ehs')}>{t('ann.ehsPosters')}</Button>}
          </Space>
        ) : undefined} />
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
          <Form.Item name="type" label={t('ann.type')} rules={[{ required: true }]}><Select disabled={own} options={(q.data?.types ?? []).map((x) => ({ value: x, label: x }))} /></Form.Item>
          <Form.Item label={t('ann.content')} required>
            <RichTextEditor value={html} onChange={setHtml} onUploadImages={api.uploadImages} resetKey={editing === 'new' ? 'new' : (editing?.id ?? '')} />
          </Form.Item>
          <Form.Item label={t('ann.htmlFile')} extra={t('ann.htmlHint')}>
            {page ? (
              <div className="ann-html-file">
                <FileTextOutlined /><span style={{ flex: 1 }}>{t('ann.htmlAttached')}</span>
                <Button size="small" icon={<EyeOutlined />} onClick={() => setPagePreview(true)}>{t('ann.preview')}</Button>
                <Upload accept=".html,.htm,text/html" showUploadList={false} beforeUpload={(f) => { uploadHtml.mutate(f); return false }}>
                  <Button size="small" icon={<UploadOutlined />} loading={uploadHtml.isPending}>{t('ann.htmlReplace')}</Button>
                </Upload>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setPage(null)}>{t('req.delete')}</Button>
              </div>
            ) : (
              <Upload accept=".html,.htm,text/html" showUploadList={false} beforeUpload={(f) => { uploadHtml.mutate(f); return false }}>
                <Button icon={<UploadOutlined />} loading={uploadHtml.isPending}>{t('ann.htmlUpload')}</Button>
              </Upload>
            )}
          </Form.Item>
        </Form>
      </AppModal>

      {!own && user?.isAdmin && <PostersModal kind="union" open={postersOpen === 'union'} onClose={() => setPostersOpen(null)} />}
      {canEhsPosters && <PostersModal kind="ehs" open={postersOpen === 'ehs'} onClose={() => setPostersOpen(null)} />}

      <AppModal open={!!preview} onClose={() => setPreview(null)} size="lg" icon={<EyeOutlined />} title={preview?.title ?? ''} subtitle={preview ? `${preview.type} · ${when(preview.createdAt)}` : undefined}>
        <AnnouncementBody html={preview?.html ?? ''} style={{ padding: 4 }} frameHeight="65vh" />
      </AppModal>

      {!own && <AnnouncementTranslationsModal id={translating?.id ?? null} title={translating?.title ?? ''} sourceHtml={translating?.html ?? ''} onClose={() => setTranslating(null)} />}

      <AppModal open={pagePreview && !!page} onClose={() => setPagePreview(false)} size="lg" icon={<FileTextOutlined />} title={t('ann.htmlFile')}>
        {page && <AnnouncementBody html={joinHtmlPage('', page)} frameHeight="65vh" />}
      </AppModal>
    </div>
  )
}

/**
 * Thêm / bỏ người được đăng thông báo của một nhóm ngoài HR; người được thêm chỉ đăng / sửa được loại của nhóm đó.
 * Công đoàn: quản trị chọn bất kỳ tài khoản nào. EHS: trưởng bộ phận EHS / quản trị chỉ chọn được người trong bộ phận EHS.
 */
function PostersModal({ kind, open, onClose }: { kind: 'union' | 'ehs' | 'general'; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [pick, setPick] = useState<string>()
  const [search, setSearch] = useState('')
  const ehs = kind === 'ehs'
  const posters = ehs ? ehsPosters : kind === 'general' ? generalPosters : unionPosters
  const key = ehs ? 'ehs-posters' : kind === 'general' ? 'general-posters' : 'union-posters'
  const list = useQuery({ queryKey: [key], queryFn: posters.list, enabled: open })
  const found = useQuery({
    queryKey: [key, 'find', search],
    queryFn: async (): Promise<{ value: string; label: string }[]> => ehs
      ? (await ehsPosters.candidates(search)).map((u: UnionPoster) => ({ value: u.userId.trim(), label: `${u.fullName} · ${u.userId}${u.department ? ` · ${u.department}` : ''}` }))
      : (await userAdmin.list(search, undefined, 'active', 1, 20)).rows.map((u) => ({ value: u.userId.trim(), label: `${u.fullName} · ${u.employeeId}${u.department ? ` · ${u.department}` : ''}` })),
    enabled: open && (ehs || search.trim().length >= 2),   // EHS: bộ phận nhỏ nên hiện luôn danh sách
  })
  const refresh = () => qc.invalidateQueries({ queryKey: [key] })
  const errText = (e: unknown) => t(`ann.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })
  const add = useMutation({ mutationFn: () => posters.add(pick!), onSuccess: () => { msg.success(t('ann.saved')); setPick(undefined); setSearch(''); refresh() }, onError: (e) => msg.error(errText(e)) })
  const remove = useMutation({ mutationFn: (id: string) => posters.remove(id), onSuccess: () => { msg.success(t('ann.saved')); refresh() }, onError: (e) => msg.error(errText(e)) })
  return (
    <AppModal open={open} onClose={onClose} size="md" icon={<TeamOutlined />} title={t(ehs ? 'ann.ehsPosters' : kind === 'general' ? 'ann.generalPosters' : 'ann.unionPosters')} subtitle={t(ehs ? 'ann.ehsPostersHint' : kind === 'general' ? 'ann.generalPostersHint' : 'ann.unionPostersHint')} footer={null}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Select showSearch filterOption={false} style={{ width: '100%' }} placeholder={t('ann.unionPick')} value={pick} onSearch={setSearch} onChange={setPick}
          options={found.data ?? []} loading={found.isFetching} notFoundContent={!ehs && search.trim().length < 2 ? t('ann.unionTypeMore') : undefined} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!pick} loading={add.isPending} onClick={() => add.mutate()}>{t('line.add')}</Button>
      </Space.Compact>
      <DataTable<{ userId: string; fullName: string; department: string | null }>
        rowKey="userId" size="small" sticky={false} loading={list.isLoading} dataSource={list.data ?? []} pagination={false}
        locale={{ emptyText: t('ann.unionNone') }}
        columns={[
          { title: t('line.person'), render: (_: unknown, r) => <span><b>{r.fullName}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span> },
          { title: t('att.dept'), dataIndex: 'department', ellipsis: true, render: (v: string | null) => v || '-' },
          { title: '', width: 90, render: (_: unknown, r) => (
            <Popconfirm title={t(ehs ? 'ann.ehsRemoveAsk' : 'ann.unionRemoveAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.userId)}>
              <Button size="small" danger>{t('req.delete')}</Button>
            </Popconfirm>
          ) },
        ]}
      />
    </AppModal>
  )
}
