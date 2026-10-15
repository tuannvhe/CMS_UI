import { useMemo, useState } from 'react'
import { Avatar, Button, Form, Input, Popconfirm, Select, Space, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, EyeOutlined, NotificationOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { announcementAdmin, type AnnouncementRow } from '../../api/announcementAdmin'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { RichTextEditor } from '../../components/RichTextEditor'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

interface FormValues { title: string; type: string }

/**
 * Quản lý thông báo của HR hiện ở trang chủ (Tbl_NotificationSystem, dùng chung với hệ thống cũ). Trang chủ hiện các thông báo đang bật mới nhất.
 * Không xoá thông báo: tắt là ẩn khỏi trang chủ nhưng vẫn còn trong danh sách để bật lại.
 */
export default function AnnouncementsPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null)
  const [preview, setPreview] = useState<AnnouncementRow | null>(null)
  const [html, setHtml] = useState('')
  const [form] = Form.useForm<FormValues>()

  const q = useQuery({ queryKey: ['announcement-admin'], queryFn: announcementAdmin.list })
  const rows = useMemo(() => q.data?.items ?? [], [q.data])
  const refresh = () => { qc.invalidateQueries({ queryKey: ['announcement-admin'] }); qc.invalidateQueries({ queryKey: ['announcements'] }) }
  const errText = (e: unknown) => t(`ann.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })

  const save = useMutation({
    mutationFn: (v: FormValues) => (editing && editing !== 'new' ? announcementAdmin.update(editing.id, { ...v, html }) : announcementAdmin.add({ ...v, html })),
    onSuccess: () => { msg.success(t('ann.saved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (r: AnnouncementRow) => announcementAdmin.toggle(r.id),
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
      <PageBanner avatar={<Avatar size={56} icon={<NotificationOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.announcements')} subtitle={t('nav.announcementsDesc')} />
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
          <Form.Item name="type" label={t('ann.type')} rules={[{ required: true }]}><Select options={(q.data?.types ?? []).map((x) => ({ value: x, label: x }))} /></Form.Item>
          <Form.Item label={t('ann.content')} required>
            <RichTextEditor value={html} onChange={setHtml} resetKey={editing === 'new' ? 'new' : (editing?.id ?? '')} />
          </Form.Item>
        </Form>
      </AppModal>

      <AppModal open={!!preview} onClose={() => setPreview(null)} size="lg" icon={<EyeOutlined />} title={preview?.title ?? ''} subtitle={preview ? `${preview.type} · ${when(preview.createdAt)}` : undefined}>
        {/* html đã được máy chủ lọc */}
        <div className="hn-body" style={{ padding: 4 }} dangerouslySetInnerHTML={{ __html: preview?.html ?? '' }} />
      </AppModal>
    </div>
  )
}
