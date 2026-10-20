import { useState } from 'react'
import { Button, Form, Input, InputNumber, Popconfirm, Switch, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { feed, feedError, type FeedTopic } from '../../api/feed'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

interface FormValues { name: string; description?: string; group?: string; sort: number; active: boolean }

/** Quản lý chủ đề của diễn đàn (quản trị): thêm, sửa tên / mô tả / nhóm / thứ tự, tắt bật, xóa chủ đề chưa có bài. */
export function TopicAdmin() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<FeedTopic | 'new' | null>(null)
  const [form] = Form.useForm<FormValues>()
  const q = useQuery({ queryKey: ['feed', 'admin-topics'], queryFn: feed.adminTopics, retry: false })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['feed'] }) }
  const err = (e: unknown) => { const { code, detail } = feedError(e); toast.error(code === 'invalid_input' ? t(`forum.err.${detail}`, { defaultValue: t('feed.err.generic') }) : t('feed.err.generic')) }
  const save = useMutation({
    mutationFn: (v: FormValues) => (editing && editing !== 'new' ? feed.updateTopic(editing.id, v).then(() => undefined) : feed.addTopic(v).then(() => undefined)),
    onSuccess: () => { toast.success(t('forum.topicSaved')); setEditing(null); refresh() }, onError: err,
  })
  const del = useMutation({ mutationFn: (id: number) => feed.deleteTopic(id), onSuccess: () => { toast.success(t('forum.topicDeleted')); refresh() }, onError: err })
  const toggle = useMutation({ mutationFn: (x: FeedTopic) => feed.updateTopic(x.id, { name: x.name, description: x.description ?? undefined, group: x.group ?? undefined, sort: x.sort, active: !x.active }), onSuccess: refresh, onError: err })

  const open = (x: FeedTopic | 'new') => {
    setEditing(x)
    form.setFieldsValue(x === 'new' ? { name: '', description: '', group: '', sort: ((q.data ?? []).reduce((m, r) => Math.max(m, r.sort), 0) + 1), active: true } : { name: x.name, description: x.description ?? '', group: x.group ?? '', sort: x.sort, active: x.active })
  }

  const columns: ColumnsType<FeedTopic> = [
    { title: t('forum.topicName'), dataIndex: 'name', render: (v: string, r) => <span><b>{v}</b>{r.description && <div style={{ opacity: 0.65, fontSize: 12 }}>{r.description}</div>}</span> },
    { title: t('forum.group'), dataIndex: 'group', width: 160, render: (v: string | null) => v ?? '—' },
    { title: t('forum.sort'), dataIndex: 'sort', width: 80, align: 'center' },
    { title: t('forum.threads'), dataIndex: 'threads', width: 90, align: 'center' },
    { title: t('forum.active'), dataIndex: 'active', width: 90, align: 'center', render: (v: boolean, r) => <Switch size="small" checked={v} onChange={() => toggle.mutate(r)} /> },
    {
      title: '', width: 110, align: 'right',
      render: (_: unknown, r) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => open(r)} />
          <Popconfirm title={t('forum.deleteTopicAsk')} disabled={r.threads > 0} okButtonProps={{ danger: true }} onConfirm={() => del.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.threads > 0} title={r.threads > 0 ? t('forum.err.topic_not_empty') : undefined} />
          </Popconfirm>
        </span>
      ),
    },
  ]

  return (
    <div>
      <p className="fm-note">{t('forum.topicAdminNote')}</p>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => open('new')}>{t('forum.addTopic')}</Button>
      <Table<FeedTopic> rowKey="id" size="small" loading={q.isLoading} columns={columns} dataSource={q.data ?? []} pagination={false} />
      <AppModal open={editing !== null} onClose={() => setEditing(null)} size="sm" title={editing === 'new' ? t('forum.addTopic') : t('forum.editTopic')} icon={<EditOutlined />}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, description: v.description?.trim() || undefined, group: v.group?.trim() || undefined }))} okLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('forum.topicName')} rules={[{ required: true, min: 2, max: 80 }]}><Input maxLength={80} /></Form.Item>
          <Form.Item name="description" label={t('forum.description')}><Input.TextArea rows={2} maxLength={300} /></Form.Item>
          <Form.Item name="group" label={t('forum.group')} extra={t('forum.groupHint')}><Input maxLength={60} /></Form.Item>
          <Form.Item name="sort" label={t('forum.sort')} rules={[{ required: true }]}><InputNumber min={0} max={9999} style={{ width: 120 }} /></Form.Item>
          <Form.Item name="active" label={t('forum.active')} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
