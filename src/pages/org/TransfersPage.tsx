import { invalidateOrgData } from '../../api/cache'
import { useMemo, useState } from 'react'
import { Avatar, Button, DatePicker, Form, Input, Popconfirm, Segmented, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowRightOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { departmentsApi } from '../../api/departments'
import { lines } from '../../api/lines'
import { transfers, TRANSFER_TABLE_SQL, type EmployeeBrief, type TransferRow } from '../../api/transfers'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

interface FormValues { employee: string; toDepartment: string; toPart?: string; date: Dayjs; reason?: string }
const TONE: Record<TransferRow['status'], string> = { done: 'ok', scheduled: 'warn', cancelled: '' }

/** Điều chuyển nhân sự có ngày hiệu lực và lịch sử: HR tạo điều chuyển (áp dụng ngay hoặc hẹn ngày), xem ai ở đâu qua từng thời kỳ. */
export default function TransfersPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState<'all' | 'scheduled' | 'done'>('all')
  const [emp, setEmp] = useState('')
  const [open, setOpen] = useState(false)
  const [found, setFound] = useState<EmployeeBrief[]>([])
  const [form] = Form.useForm<FormValues>()
  const toDep = Form.useWatch('toDepartment', form)

  const q = useQuery({ queryKey: ['transfers', status, emp], queryFn: () => transfers.list({ employeeId: emp.trim() || undefined, status: status === 'all' ? undefined : status }), retry: false })
  const deps = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list, staleTime: 60_000 })
  const lookups = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, refetchOnMount: 'always' })
  const refresh = () => invalidateOrgData(qc)
  const errText = (e: unknown) => t(`trf.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })

  const create = useMutation({
    mutationFn: (v: FormValues) => transfers.create({ employeeId: v.employee, toDepartment: v.toDepartment, toPart: v.toPart ?? '', effectiveDate: v.date.format('YYYY-MM-DD'), reason: v.reason?.trim() }),
    onSuccess: (r) => { msg.success(t(r.applied ? 'trf.appliedNow' : 'trf.scheduled')); setOpen(false); form.resetFields(); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const cancel = useMutation({
    mutationFn: (id: number) => transfers.cancel(id),
    onSuccess: () => { msg.success(t('usr.saved')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const search = async (s: string) => { if (s.trim().length >= 2) setFound(await transfers.employees(s)); else setFound([]) }
  const rows = useMemo(() => q.data?.items ?? [], [q.data])
  const parts = (lookups.data?.units ?? []).filter((u) => u.department.toLowerCase() === (toDep ?? '').toLowerCase())
  const day = (v: string) => new Date(v + 'T00:00:00').toLocaleDateString(i18n.language)
  const place = (d: string | null, p: string | null) => <span><b>{d || '—'}</b>{p ? <span className="cell-muted"> · {p}</span> : null}</span>

  const columns: ColumnsType<TransferRow> = [
    { title: t('trf.effective'), dataIndex: 'effectiveDate', width: 120, render: day },
    { title: t('org.colEmp'), width: 220, render: (_: unknown, r) => <span><b>{r.employeeName || '—'}</b> <span className="cell-muted">· {r.employeeId}</span></span> },
    { title: t('trf.change'), render: (_: unknown, r) => <Space size={8} wrap>{place(r.fromDepartment, r.fromPart)}<ArrowRightOutlined className="cell-muted" />{place(r.toDepartment, r.toPart)}</Space> },
    { title: t('cov.status'), dataIndex: 'status', width: 130, render: (v: TransferRow['status']) => <span className={`org-chip ${TONE[v]}`}>{t(`trf.st.${v}`)}</span> },
    { title: t('trf.source'), dataIndex: 'source', width: 130, render: (v: string) => <Tag variant="filled">{t(`trf.src.${v}`)}</Tag> },
    { title: t('trf.reason'), dataIndex: 'reason', ellipsis: true, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    {
      title: '', width: 110,
      render: (_: unknown, r) => r.status === 'scheduled' && (
        <Popconfirm title={t('trf.cancelAsk')} okText="OK" cancelText={t('req.cancel')} onConfirm={() => cancel.mutate(r.id)}><Button size="small" danger>{t('trf.cancel')}</Button></Popconfirm>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<SwapOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.transfers')} subtitle={t('nav.transfersDesc')} />
      {q.data && !q.data.ready ? <SqlNotReady title={t('trf.notReady')} sql={TRANSFER_TABLE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
        <>
          <StatTiles items={[
            { label: t('trf.tileAll'), value: rows.length },
            { label: t('trf.tileScheduled'), value: rows.filter((r) => r.status === 'scheduled').length, color: '#D48806' },
            { label: t('trf.tileDone'), value: rows.filter((r) => r.status === 'done').length, color: '#2E9E4F' },
          ]} />
          <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>{t('trf.note')}</Typography.Paragraph>
          <DataTable<TransferRow>
            rowKey="id" loading={q.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 25, showSizeChanger: false }}
            locale={{ emptyText: q.isError ? t('usr.err.generic') : t('trf.empty') }}
            toolbar={(
              <Space wrap>
                <Input.Search allowClear style={{ width: 200 }} placeholder={t('trf.empPh')} onSearch={setEmp} />
                <Segmented value={status} onChange={(v) => setStatus(v as typeof status)} options={[{ value: 'all', label: t('org.all') }, { value: 'scheduled', label: t('trf.st.scheduled') }, { value: 'done', label: t('trf.st.done') }]} />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setOpen(true); setFound([]) }}>{t('trf.add')}</Button>
              </Space>
            )}
          />
        </>
      )}

      <AppModal open={open} onClose={() => setOpen(false)} size="md" icon={<SwapOutlined />} title={t('trf.add')} subtitle={t('trf.hint')}
        okText={t('trf.create')} okLoading={create.isPending} onOk={() => form.validateFields().then((v) => create.mutate(v))}>
        <Form form={form} layout="vertical" autoComplete="off" initialValues={{ date: dayjs() }}>
          <Form.Item name="employee" label={t('trf.employee')} rules={[{ required: true }]}>
            <Select showSearch filterOption={false} onSearch={search} placeholder={t('trf.empSearch')} notFoundContent={null}
              options={found.map((e) => ({ value: e.employeeId, label: `${e.fullName} · ${e.employeeId} · ${e.department || '—'} / ${e.part || '—'}${e.active ? '' : ' (' + t('trf.quit') + ')'}` }))} />
          </Form.Item>
          <Form.Item name="toDepartment" label={t('trf.toDepartment')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" onChange={() => form.setFieldValue('toPart', undefined)} options={(deps.data ?? []).filter((d) => d.active).map((d) => ({ value: d.english, label: d.english }))} />
          </Form.Item>
          <Form.Item name="toPart" label={t('trf.toPart')} extra={t('trf.partHint')}>
            <Select showSearch allowClear optionFilterProp="label" disabled={!toDep} options={parts.map((u) => ({ value: u.name, label: u.name }))} />
          </Form.Item>
          <Form.Item name="date" label={t('trf.effective')} rules={[{ required: true }]} extra={t('trf.dateHint')}><DatePicker style={{ width: '100%' }} allowClear={false} /></Form.Item>
          <Form.Item name="reason" label={t('trf.reason')} rules={[{ max: 300 }]}><Input.TextArea rows={2} maxLength={300} showCount /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
