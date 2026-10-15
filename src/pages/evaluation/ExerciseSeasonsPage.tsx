import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Form, Input, Popconfirm, Switch, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { seasons, type ExerciseSeason } from '../../api/seasons'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

interface FormValues { name: string; start: Dayjs; end?: Dayjs | null; active: boolean }
const today = () => dayjs().startOf('day')

/**
 * Các đợt tập thể dục buổi sáng (Tbl_ExerciseSeasons). Chỉ trong các đợt đang bật, mỗi lần đi trễ 07:45–08:00
 * bị trừ 0,2 điểm văn hóa trong điểm G của OP; ngoài đợt không trừ. Các đợt không được chồng lên nhau.
 */
export default function ExerciseSeasonsPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ExerciseSeason | 'new' | null>(null)
  const [form] = Form.useForm<FormValues>()
  const list = useQuery({ queryKey: ['exercise-seasons'], queryFn: seasons.list })
  const rows = list.data ?? []
  const refresh = () => { qc.invalidateQueries({ queryKey: ['exercise-seasons'] }); qc.invalidateQueries({ queryKey: ['evaluations', 'review-culture'] }) }
  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    if (d?.title === 'table_missing') return t('ses.err.table_missing')
    return t(`ses.err.${d?.detail}`, { defaultValue: t('req.err.generic') })
  }
  const body = (v: FormValues) => ({ name: v.name.trim(), startDate: v.start.format('YYYY-MM-DD'), endDate: v.end ? v.end.format('YYYY-MM-DD') : null, active: v.active })

  const save = useMutation({
    mutationFn: (v: FormValues) => (editing && editing !== 'new' ? seasons.update(editing.id, body(v)) : seasons.add(body(v)).then(() => undefined)),
    onSuccess: () => { message.success(t('ses.saved')); setEditing(null); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (s: ExerciseSeason) => seasons.update(s.id, { name: s.name, startDate: s.startDate.slice(0, 10), endDate: s.endDate?.slice(0, 10) ?? null, active: !s.active }),
    onSuccess: () => { message.success(t('ses.saved')); refresh() }, onError: (e) => message.error(errText(e)),
  })
  /** Kết thúc đợt đang mở: điền ngày kết thúc = hôm nay (không sớm hơn ngày bắt đầu). */
  const finish = useMutation({
    mutationFn: (s: ExerciseSeason) => {
      const end = today().isBefore(dayjs(s.startDate)) ? dayjs(s.startDate) : today()
      return seasons.update(s.id, { name: s.name, startDate: s.startDate.slice(0, 10), endDate: end.format('YYYY-MM-DD'), active: s.active })
    },
    onSuccess: () => { message.success(t('ses.finished')); refresh() }, onError: (e) => message.error(errText(e)),
  })
  const remove = useMutation({ mutationFn: seasons.remove, onSuccess: () => { message.success(t('ses.deleted')); refresh() }, onError: (e) => message.error(errText(e)) })

  const open = (s: ExerciseSeason | 'new') => {
    setEditing(s)
    form.setFieldsValue(s === 'new' ? { name: '', start: today(), end: null, active: true } : { name: s.name, start: dayjs(s.startDate), end: s.endDate ? dayjs(s.endDate) : null, active: s.active })
  }
  const status = (s: ExerciseSeason) => {
    if (!s.active) return <Tag variant="filled">{t('ses.off')}</Tag>
    const n = today()
    if (n.isBefore(dayjs(s.startDate))) return <Tag color="blue" variant="filled">{t('ses.upcoming')}</Tag>
    if (s.endDate && n.isAfter(dayjs(s.endDate))) return <Tag variant="filled">{t('ses.ended')}</Tag>
    return <Tag color="success" variant="filled">{t('ses.running')}</Tag>
  }
  const columns: ColumnsType<ExerciseSeason> = [
    { title: t('ses.name'), dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: t('ses.from'), dataIndex: 'startDate', width: 130, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: t('ses.to'), dataIndex: 'endDate', width: 150, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : <span className="cell-muted">{t('ses.notEnded')}</span>) },
    { title: t('ses.days'), width: 90, align: 'center', render: (_: unknown, s) => Math.max(0, (s.endDate ? dayjs(s.endDate) : today()).diff(dayjs(s.startDate), 'day') + 1) },
    { title: t('ses.status'), width: 130, render: (_: unknown, s) => status(s) },
    { title: t('line.active'), width: 100, align: 'center', render: (_: unknown, s) => <Switch size="small" checked={s.active} loading={toggle.isPending && toggle.variables?.id === s.id} onChange={() => toggle.mutate(s)} /> },
    {
      title: '', width: 290, render: (_: unknown, s) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          {!s.endDate && (
            <Popconfirm title={t('ses.finishAsk')} okText={t('ses.finish')} cancelText={t('req.cancel')} onConfirm={() => finish.mutate(s)}>
              <Button size="small" loading={finish.isPending && finish.variables?.id === s.id}>{t('ses.finish')}</Button>
            </Popconfirm>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => open(s)}>{t('req.edit')}</Button>
          <Popconfirm title={t('ses.deleteAsk')} okText={t('req.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(s.id)}>
            <Button size="small" danger>{t('req.delete')}</Button>
          </Popconfirm>
        </span>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<ThunderboltOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.exerciseSeasons')} subtitle={t('nav.exerciseSeasonsDesc')} />
      <StatTiles items={[
        { label: t('ses.tileTotal'), value: rows.length, color: '#2E9E4F' },
        { label: t('ses.tileRunning'), value: rows.filter((s) => s.active && !today().isBefore(dayjs(s.startDate)) && (!s.endDate || !today().isAfter(dayjs(s.endDate)))).length, color: '#2F6FB0' },
        { label: t('ses.tileOff'), value: rows.filter((s) => !s.active).length, color: '#D48806' },
      ]} />
      <Alert type="info" showIcon title={t('ses.note')} style={{ marginBottom: 16 }} />
      <DataTable<ExerciseSeason>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('ses.empty') }}
        toolbar={<Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('ses.add')}</Button>}
      />
      <AppModal open={editing !== null} onClose={() => setEditing(null)} size="sm" icon={<ThunderboltOutlined />} title={editing === 'new' ? t('ses.add') : t('ses.edit')}
        onOk={() => form.validateFields().then((v) => save.mutate(v))} okText={t('req.saveChanges')} okLoading={save.isPending}>
        <Form form={form} layout="vertical" initialValues={{ active: true }}>
          <Form.Item name="name" label={t('ses.name')} rules={[{ required: true, whitespace: true, max: 100 }]}><Input maxLength={100} placeholder={t('ses.namePh')} /></Form.Item>
          <Form.Item name="start" label={t('ses.from')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end" label={t('ses.to')} extra={t('ses.endHint')} dependencies={['start']}
            rules={[({ getFieldValue }) => ({ validator: (_, v: Dayjs | null) => (!v || !getFieldValue('start') || !v.isBefore(getFieldValue('start'), 'day') ? Promise.resolve() : Promise.reject(new Error(t('ses.err.range')))) })]}>
            <DatePicker format="DD/MM/YYYY" placeholder={t('ses.notEnded')} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label={t('line.active')} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
