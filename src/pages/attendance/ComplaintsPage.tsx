import { Alert, Avatar, Button, Card, DatePicker, Form, Input, Select, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { MessageOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { complaints, COMPLAINT_CATEGORIES, COMPLAINT_TABLE_SQL, type ComplaintCategory, type ComplaintRow } from '../../api/complaints'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useToast } from '../../hooks/useToast'

interface FormValues { date: Dayjs; category: ComplaintCategory; message: string }
export const STATUS_TONE: Record<ComplaintRow['status'], string> = { new: 'warn', processing: 'warn', resolved: 'ok', rejected: 'bad' }

/** Phản hồi công của nhân viên: chọn ngày có vấn đề, mô tả; nhân sự xử lý và trả lời ngay trong hệ thống. */
export default function ComplaintsPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [form] = Form.useForm<FormValues>()
  const q = useQuery({ queryKey: ['complaints', 'mine'], queryFn: complaints.mine, retry: false })
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`cmp.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }

  const create = useMutation({
    mutationFn: (v: FormValues) => complaints.create({ workDate: v.date.format('YYYY-MM-DD'), category: v.category, message: v.message }),
    onSuccess: () => { msg.success(t('cmp.sent')); form.resetFields(['message']); qc.invalidateQueries({ queryKey: ['complaints'] }) },
    onError: (e) => msg.error(errText(e)),
  })

  const day = (v: string) => new Date(v + 'T00:00:00').toLocaleDateString(i18n.language)
  const initialDate = params.get('date') && dayjs(params.get('date')).isValid() ? dayjs(params.get('date')) : dayjs().subtract(1, 'day')

  const columns: ColumnsType<ComplaintRow> = [
    { title: t('cmp.workDate'), dataIndex: 'workDate', width: 120, render: day },
    { title: t('cmp.category'), dataIndex: 'category', width: 190, render: (v: string) => t(`cmp.cat.${v}`) },
    { title: t('cmp.message'), dataIndex: 'message', ellipsis: true },
    { title: t('cov.status'), dataIndex: 'status', width: 140, render: (v: ComplaintRow['status'], r) => <span className={`org-chip ${r.overdue ? 'bad' : STATUS_TONE[v]}`}>{r.overdue ? t('cmp.overdue') : t(`cmp.st.${v}`)}</span> },
    { title: t('cmp.reply'), dataIndex: 'reply', ellipsis: true, render: (v: string | null, r) => v ? <span><b>{r.handlerName ?? r.handler}</b>: {v}</span> : <span className="cell-muted">{t('cmp.due', { d: day(r.dueDate) })}</span> },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<MessageOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.complaints')} subtitle={t('nav.complaintsDesc')} />
      {q.data && !q.data.ready ? <SqlNotReady title={t('cmp.notReady')} sql={COMPLAINT_TABLE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('cmp.note')} />
          <Card title={t('cmp.new')} style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" autoComplete="off" onFinish={(v) => create.mutate(v)} initialValues={{ date: initialDate, category: 'missing_out' }}>
              <div className="dlg-form">
                <Form.Item name="date" label={t('cmp.workDate')} rules={[{ required: true }]}>
                  <DatePicker allowClear={false} style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs(), 'day') || d.isBefore(dayjs().subtract(62, 'day'), 'day')} />
                </Form.Item>
                <Form.Item name="category" label={t('cmp.category')} rules={[{ required: true }]}>
                  <Select options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: t(`cmp.cat.${c}`) }))} />
                </Form.Item>
              </div>
              <Form.Item name="message" label={t('cmp.message')} rules={[{ required: true }, { min: 5 }, { max: 1000 }]} extra={t('cmp.messageHint')}>
                <Input.TextArea rows={3} maxLength={1000} showCount />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={create.isPending} icon={<MessageOutlined />}>{t('cmp.send')}</Button>
            </Form>
          </Card>
          <DataTable<ComplaintRow>
            rowKey="id" loading={q.isLoading} columns={columns} dataSource={q.data?.items ?? []} pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: q.isError ? t('usr.err.generic') : t('cmp.empty') }}
            toolbar={<Typography.Text strong>{t('cmp.mine')}</Typography.Text>}
          />
        </>
      )}
    </div>
  )
}
