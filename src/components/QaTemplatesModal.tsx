import { useState } from 'react'
import { Button, Form, Input, Popconfirm, Select, Space, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { qa, QA_TEMPLATE_SQL, type QaTemplate } from '../api/qa'
import { adminError } from '../api/userAdmin'
import { useToast } from '../hooks/useToast'
import { AppModal } from './AppModal'
import { SqlNotReady } from './SqlNotReady'

type Values = { title: string; content: string; channel: QaTemplate['channel'] }

/** Quản lý mẫu trả lời nhanh dùng chung cho nhân sự: thêm, sửa, xóa. Nội dung có thể dùng {ten} = tên người hỏi. */
export function QaTemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [form] = Form.useForm<Values>()
  const [editing, setEditing] = useState<QaTemplate | 'new' | null>(null)
  const q = useQuery({ queryKey: ['qa-templates'], queryFn: () => qa.templates(), enabled: open, retry: false })
  const refresh = () => qc.invalidateQueries({ queryKey: ['qa-templates'] })
  const errText = (e: unknown) => t(`qa.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })

  const save = useMutation({
    mutationFn: (v: Values) => (editing && editing !== 'new' ? qa.updateTemplate(editing.id, v) : qa.addTemplate(v)),
    onSuccess: () => { msg.success(t('qa.tpl.saved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const remove = useMutation({ mutationFn: (id: number) => qa.deleteTemplate(id), onSuccess: () => { msg.success(t('qa.tpl.deleted')); refresh() }, onError: (e) => msg.error(errText(e)) })

  const start = (row: QaTemplate | 'new') => {
    setEditing(row)
    form.setFieldsValue(row === 'new' ? { title: '', content: '', channel: 'all' } : { title: row.title, content: row.content, channel: row.channel })
  }
  const items = q.data?.items ?? []

  return (
    <AppModal open={open} onClose={() => { setEditing(null); onClose() }} size="md" icon={<ThunderboltOutlined />} title={t('qa.tpl.manage')} subtitle={t('qa.tpl.hint')}
      onOk={editing ? () => form.validateFields().then((v) => save.mutate(v)) : undefined} okText={t('qa.tpl.save')} okLoading={save.isPending}
      footer={editing ? undefined : null}>
      {q.data && !q.data.ready ? <SqlNotReady title={t('qa.tpl.notReady')} sql={QA_TEMPLATE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : editing ? (
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item name="title" label={t('qa.tpl.name')} rules={[{ required: true }, { min: 2 }, { max: 80 }]}><Input maxLength={80} showCount /></Form.Item>
          <Form.Item name="channel" label={t('qa.tpl.channel')}>
            <Select options={[{ value: 'all', label: t('qa.tpl.all') }, { value: 'salary', label: t('qa.ch.salary') }, { value: 'common', label: t('qa.ch.common') }]} />
          </Form.Item>
          <Form.Item name="content" label={t('qa.content')} rules={[{ required: true }, { min: 2 }, { max: 4000 }]} extra={t('qa.tpl.placeholderHint')}><Input.TextArea rows={7} maxLength={4000} showCount /></Form.Item>
        </Form>
      ) : (
        <>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => start('new')} style={{ marginBottom: 12 }}>{t('qa.tpl.add')}</Button>
          {items.length === 0 ? <div className="cell-muted">{t('qa.tpl.empty')}</div> : items.map((x) => (
            <div key={x.id} className="qa-tpl-row">
              <div className="qt-main">
                <b>{x.title}</b> <Tag variant="filled">{x.channel === 'all' ? t('qa.tpl.all') : t(`qa.ch.${x.channel}`)}</Tag>
                <div className="cell-muted qt-text">{x.content}</div>
              </div>
              <Space size={4}>
                <Button size="small" icon={<EditOutlined />} onClick={() => start(x)} aria-label={t('qa.tpl.edit')} />
                <Popconfirm title={t('qa.tpl.deleteAsk', { name: x.title })} okText={t('qa.tpl.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(x.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('qa.tpl.delete')} />
                </Popconfirm>
              </Space>
            </div>
          ))}
        </>
      )}
    </AppModal>
  )
}
