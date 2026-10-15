import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Form, Input, Popconfirm, Select, Switch, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined, RetweetOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { swapDays, type SwapDay } from '../../api/swapDays'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

interface FormValues { date: Dayjs; note?: string; active: boolean }

/**
 * Danh sách ngày làm bù (Tbl_WorkSwapDays): ngày đi làm thay cho ngày khác. Người đi làm ngày này được tính công chuẩn của ngày làm bù
 * (trừ giờ phép) và OT theo ngày thường. Bảng công chỉ đọc các dòng đang bật.
 */
export default function SwapDaysPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [year, setYear] = useState(dayjs().year())
  const [picked, setPicked] = useState<number[]>([])
  const [editing, setEditing] = useState<SwapDay | 'new' | null>(null)
  const [form] = Form.useForm<FormValues>()

  const list = useQuery({ queryKey: ['swap-days', year], queryFn: () => swapDays.list(year) })
  const rows = useMemo(() => list.data ?? [], [list.data])
  const refresh = () => qc.invalidateQueries({ queryKey: ['swap-days'] })
  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    if (d?.title === 'table_missing') return t('swp.err.table_missing')
    if (d?.title === 'duplicate') return t('swp.err.duplicate')
    return t(`swp.err.${d?.detail}`, { defaultValue: t('req.err.generic') })
  }
  const body = (v: FormValues) => ({ date: v.date.format('YYYY-MM-DD'), note: v.note?.trim(), active: v.active })

  const save = useMutation({
    mutationFn: (v: FormValues) => (editing && editing !== 'new' ? swapDays.update(editing.id, body(v)) : swapDays.add(body(v)).then(() => undefined)),
    onSuccess: () => { message.success(t('swp.saved')); setEditing(null); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (s: SwapDay) => swapDays.update(s.id, { date: s.date.slice(0, 10), note: s.note ?? undefined, active: !s.active }),
    onSuccess: () => { message.success(t('swp.saved')); refresh() }, onError: (e) => message.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (ids: number[]) => swapDays.remove(ids),
    onSuccess: (r) => { message.success(t('swp.deleted', { n: r.deleted })); setPicked([]); refresh() },
    onError: (e) => message.error(errText(e)),
  })

  const open = (s: SwapDay | 'new') => {
    setEditing(s)
    form.setFieldsValue(s === 'new' ? { date: undefined, note: '', active: true } : { date: dayjs(s.date), note: s.note ?? '', active: s.active })
  }
  const columns: ColumnsType<SwapDay> = [
    { title: t('cal.date'), dataIndex: 'date', width: 130, render: (v: string) => <b>{dayjs(v).format('DD/MM/YYYY')}</b> },
    { title: t('cal.dow.label'), dataIndex: 'date', key: 'dow', width: 110, render: (v: string) => t(`cal.dow.${dayjs(v).day()}`) },
    { title: t('swp.note'), dataIndex: 'note', ellipsis: true, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    {
      title: t('ses.status'), width: 130, render: (_: unknown, s) => (!s.active ? <Tag variant="filled">{t('ses.off')}</Tag>
        : dayjs(s.date).isAfter(dayjs(), 'day') ? <Tag color="blue" variant="filled">{t('ses.upcoming')}</Tag> : <Tag color="success" variant="filled">{t('swp.applied')}</Tag>),
    },
    { title: t('line.active'), width: 100, align: 'center', render: (_: unknown, s) => <Switch size="small" checked={s.active} loading={toggle.isPending && toggle.variables?.id === s.id} onChange={() => toggle.mutate(s)} /> },
    { title: t('line.createdBy'), dataIndex: 'createdBy', width: 120, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    {
      title: '', width: 190, render: (_: unknown, s) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => open(s)}>{t('req.edit')}</Button>
          <Popconfirm title={t('swp.deleteAsk')} okText={t('req.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate([s.id])}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ]

  const year0 = dayjs().year()
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<RetweetOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.swapDays')} subtitle={t('nav.swapDaysDesc')} />
      <StatTiles items={[
        { label: t('swp.tileTotal'), value: rows.length, color: '#2E9E4F' },
        { label: t('swp.tileActive'), value: rows.filter((s) => s.active).length, color: '#2F6FB0' },
        { label: t('ses.tileOff'), value: rows.filter((s) => !s.active).length, color: '#D48806' },
      ]} />
      <Alert type="info" showIcon title={t('swp.info')} style={{ marginBottom: 16 }} />
      <DataTable<SwapDay>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]), preserveSelectedRowKeys: true }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('swp.empty') }}
        toolbar={(
          <div className="dt-row">
            <Select style={{ width: 120 }} value={year} onChange={(v) => { setYear(v); setPicked([]) }}
              options={Array.from({ length: 7 }, (_, i) => year0 - 3 + i).map((y) => ({ value: y, label: y }))} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('swp.add')}</Button>
            <Popconfirm title={t('cal.deleteManyAsk', { n: picked.length })} okText={t('req.delete')} cancelText={t('req.cancel')} disabled={picked.length === 0} onConfirm={() => remove.mutate(picked)}>
              <Button danger icon={<DeleteOutlined />} disabled={picked.length === 0} loading={remove.isPending}>{t('cal.deleteN', { n: picked.length })}</Button>
            </Popconfirm>
          </div>
        )}
      />
      <AppModal open={editing !== null} onClose={() => setEditing(null)} size="sm" icon={<RetweetOutlined />} title={editing === 'new' ? t('swp.add') : t('swp.edit')}
        onOk={() => form.validateFields().then((v) => save.mutate(v))} okText={t('req.saveChanges')} okLoading={save.isPending}>
        <Form form={form} layout="vertical" initialValues={{ active: true }}>
          <Form.Item name="date" label={t('cal.date')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="note" label={t('swp.note')} rules={[{ max: 200 }]}><Input maxLength={200} placeholder={t('swp.notePh')} /></Form.Item>
          <Form.Item name="active" label={t('line.active')} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
