import { useState } from 'react'
import { Avatar, Button, Form, Input, Radio, Segmented, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, MessageOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { complaints, COMPLAINT_TABLE_SQL, type ComplaintRow } from '../../api/complaints'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { STATUS_TONE } from './ComplaintsPage'

/** Nhân sự xử lý phản hồi công: nhận xử lý, trả lời và đóng (đã xử lý / từ chối); quá hạn nổi bật. */
export default function ComplaintsManagePage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [status, setStatus] = useState<'open' | 'new' | 'processing' | 'closed' | ''>('open')
  const [search, setSearch] = useState('')
  const [answering, setAnswering] = useState<ComplaintRow | null>(null)
  const [form] = Form.useForm<{ verdict: 'resolved' | 'rejected'; reply: string }>()

  const q = useQuery({ queryKey: ['complaints', 'manage', search], queryFn: () => complaints.manage({ search: search.trim() || undefined }), retry: false })
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`cmp.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const refresh = () => qc.invalidateQueries({ queryKey: ['complaints'] })

  const take = useMutation({ mutationFn: (id: number) => complaints.take(id), onSuccess: () => { msg.success(t('usr.saved')); refresh() }, onError: (e) => msg.error(errText(e)) })
  const close = useMutation({
    mutationFn: (v: { verdict: 'resolved' | 'rejected'; reply: string }) => complaints.close(answering!.id, v.verdict, v.reply),
    onSuccess: () => { msg.success(t('cmp.answered')); setAnswering(null); form.resetFields(); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const all = q.data?.items ?? []
  const rows = all.filter((r) => status === '' ? true : status === 'open' ? r.status === 'new' || r.status === 'processing' : status === 'closed' ? r.status === 'resolved' || r.status === 'rejected' : r.status === status)
  const day = (v: string) => new Date(v + 'T00:00:00').toLocaleDateString(i18n.language)
  // Sau khi duyệt phản hồi là đúng, nhân sự tạo luôn đơn bổ sung cho nhân viên đó (form mở sẵn mã nhân viên và ngày).
  const FIX_PATH: Partial<Record<ComplaintRow['category'], string>> = { missing_in: '/finger-forms', missing_out: '/finger-forms', wrong_ot: '/overtime', wrong_leave: '/leave' }
  const fix = (r: ComplaintRow) => navigate(`${FIX_PATH[r.category]}?employee=${encodeURIComponent(r.employeeId)}&date=${r.workDate}`)

  const columns: ColumnsType<ComplaintRow> = [
    { title: t('cmp.workDate'), dataIndex: 'workDate', width: 110, render: day },
    { title: t('org.colEmp'), width: 220, render: (_: unknown, r) => <span><b>{r.employeeName}</b> <span className="cell-muted">· {r.employeeId}</span>{r.department ? <div className="cell-muted">{r.department}</div> : null}</span> },
    { title: t('cmp.category'), dataIndex: 'category', width: 170, render: (v: string) => t(`cmp.cat.${v}`) },
    { title: t('cmp.message'), dataIndex: 'message', ellipsis: true },
    { title: t('cov.status'), dataIndex: 'status', width: 150, render: (v: ComplaintRow['status'], r) => <span className={`org-chip ${r.overdue ? 'bad' : STATUS_TONE[v]}`}>{r.overdue ? t('cmp.overdue') : t(`cmp.st.${v}`)}</span> },
    { title: t('cmp.dueDate'), dataIndex: 'dueDate', width: 110, render: day },
    {
      title: '', width: 300,
      render: (_: unknown, r) => (r.status === 'new' || r.status === 'processing') ? (
        <Space size={4}>
          {r.status === 'new' && <Button size="small" onClick={() => take.mutate(r.id)} loading={take.isPending && take.variables === r.id}>{t('cmp.take')}</Button>}
          {FIX_PATH[r.category] && <Button size="small" onClick={() => fix(r)}>{t('cmp.createForm')}</Button>}
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => { setAnswering(r); form.setFieldsValue({ verdict: 'resolved', reply: '' }) }}>{t('cmp.answer')}</Button>
        </Space>
      ) : <span className="cell-muted">{r.handlerName ?? r.handler}</span>,
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<MessageOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.complaintsManage')} subtitle={t('nav.complaintsManageDesc')} />
      {q.data && !q.data.ready ? <SqlNotReady title={t('cmp.notReady')} sql={COMPLAINT_TABLE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
        <>
          <StatTiles items={[
            { label: t('cmp.tileNew'), value: all.filter((r) => r.status === 'new').length, color: '#D48806' },
            { label: t('cmp.tileProcessing'), value: all.filter((r) => r.status === 'processing').length, color: '#2F6FB0' },
            { label: t('cmp.tileOverdue'), value: all.filter((r) => r.overdue).length, color: all.some((r) => r.overdue) ? '#D92D20' : undefined },
            { label: t('cmp.tileClosed'), value: all.filter((r) => r.status === 'resolved' || r.status === 'rejected').length, color: '#2E9E4F' },
          ]} />
          <DataTable<ComplaintRow>
            rowKey="id" loading={q.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
            rowClassName={(r) => (r.overdue ? 'row-focus' : '')}
            locale={{ emptyText: q.isError ? t('usr.err.generic') : t('cmp.emptyManage') }}
            expandable={{ expandedRowRender: (r) => <div className="aud-detail"><div><b>{t('cmp.message')}:</b> {r.message}</div>{r.reply && <div><b>{t('cmp.reply')}:</b> {r.reply}</div>}</div> }}
            toolbar={(
              <Space wrap>
                <Segmented value={status} onChange={(v) => setStatus(v as typeof status)} options={[{ value: 'open', label: t('cmp.fOpen') }, { value: 'new', label: t('cmp.st.new') }, { value: 'processing', label: t('cmp.st.processing') }, { value: 'closed', label: t('cmp.fClosed') }, { value: '', label: t('org.all') }]} />
                <Input.Search allowClear style={{ width: 240 }} placeholder={t('cmp.searchPh')} onSearch={setSearch} />
              </Space>
            )}
          />
        </>
      )}

      <AppModal open={!!answering} onClose={() => setAnswering(null)} size="md" icon={<MessageOutlined />} title={t('cmp.answerTitle')} subtitle={answering ? `${answering.employeeName} · ${day(answering.workDate)}` : undefined}
        okText={t('cmp.sendAnswer')} okLoading={close.isPending} onOk={() => form.validateFields().then((v) => close.mutate(v))}>
        {answering && <p style={{ marginTop: 0 }}><b>{t(`cmp.cat.${answering.category}`)}:</b> {answering.message}</p>}
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item name="verdict" label={t('cmp.verdict')} rules={[{ required: true }]}>
            <Radio.Group options={[{ value: 'resolved', label: t('cmp.st.resolved') }, { value: 'rejected', label: t('cmp.st.rejected') }]} />
          </Form.Item>
          <Form.Item name="reply" label={t('cmp.reply')} rules={[{ required: true, min: 2 }, { max: 1000 }]} extra={t('cmp.replyHint')}><Input.TextArea rows={4} maxLength={1000} showCount /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
