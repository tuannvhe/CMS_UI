import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Form, Input, Popconfirm, Radio, Select, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalendarOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { holidays, type Holiday, type HolidayKind } from '../../api/holidays'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

type EditableKind = Exclude<HolidayKind, 'rest'>
interface AddValues { kind: EditableKind; range: [Dayjs, Dayjs]; description?: string }
interface EditValues { kind: EditableKind; date: Dayjs; description?: string }

const KIND_COLOR: Record<HolidayKind, string> = { holiday: 'red', sunday: 'blue', biweekly: 'purple', rest: 'default' }
const nameOf = (h: Holiday) => (h.description.includes('/') ? h.description.split('/').pop()!.trim() : h.description)

/**
 * Lịch ngày nghỉ / ngày lễ (Tbl_Holidaycalendar, dùng chung với hệ thống cũ): thêm một ngày, một khoảng hoặc mọi Chủ nhật trong khoảng,
 * chuyển đổi (đổi loại nghỉ ↔ lễ, đổi tên, dời ngày) và xóa. Bảng công đọc thẳng bảng này nên thay đổi có hiệu lực ngay.
 */
export default function HolidaysPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [year, setYear] = useState(dayjs().year())
  const [kindFilter, setKindFilter] = useState<HolidayKind>()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [addForm] = Form.useForm<AddValues>()
  const [editForm] = Form.useForm<EditValues>()
  const addKind = Form.useWatch('kind', addForm)
  const editKind = Form.useWatch('kind', editForm)

  const list = useQuery({ queryKey: ['holidays', year], queryFn: () => holidays.list(year) })
  const all = useMemo(() => list.data ?? [], [list.data])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((h) => (!kindFilter || h.kind === kindFilter) && (!q || h.description.toLowerCase().includes(q) || dayjs(h.date).format('DD/MM/YYYY').includes(q)))
  }, [all, kindFilter, search])
  const count = (k: HolidayKind) => all.filter((h) => h.kind === k).length

  const refresh = () => qc.invalidateQueries({ queryKey: ['holidays'] })
  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    if (d?.title === 'duplicate') return t('cal.err.duplicate')
    return t(`cal.err.${d?.detail}`, { defaultValue: t('req.err.generic') })
  }

  const add = useMutation({
    mutationFn: (v: AddValues) => holidays.add({ kind: v.kind, from: v.range[0].format('YYYY-MM-DD'), to: v.range[1].format('YYYY-MM-DD'), description: v.description?.trim() }),
    onSuccess: (r) => {
      if (r.created === 0) message.warning(t('cal.addedNone'))
      else if (r.skipped.length) message.warning(t('cal.addedSome', { n: r.created, skipped: r.skipped.length }))
      else message.success(t('cal.added', { n: r.created }))
      setAdding(false); refresh()
    },
    onError: (e) => message.error(errText(e)),
  })
  const update = useMutation({
    mutationFn: (v: EditValues) => holidays.update(editing!.id, { kind: v.kind, date: v.date.format('YYYY-MM-DD'), description: v.description?.trim() }),
    onSuccess: () => { message.success(t('cal.updated')); setEditing(null); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (ids: number[]) => holidays.remove(ids),
    onSuccess: (r) => { message.success(t('cal.deleted', { n: r.deleted })); setPicked([]); refresh() },
    onError: (e) => message.error(errText(e)),
  })

  const openAdd = () => {
    addForm.resetFields()
    addForm.setFieldsValue({ kind: 'holiday', range: [dayjs(`${year}-01-01`), dayjs(`${year}-01-01`)] })
    setAdding(true)
  }
  const openEdit = (h: Holiday) => {
    setEditing(h)
    editForm.setFieldsValue({ kind: h.kind === 'rest' ? 'sunday' : h.kind, date: dayjs(h.date), description: h.kind === 'holiday' ? nameOf(h) : undefined })
  }
  const kindOptions = [
    { value: 'holiday', label: t('cal.kind.holiday') },
    { value: 'sunday', label: t('cal.kind.sunday') },
    { value: 'biweekly', label: t('cal.kind.biweekly') },
  ]

  const columns: ColumnsType<Holiday> = [
    { title: t('cal.date'), dataIndex: 'date', width: 130, render: (v: string) => <b>{dayjs(v).format('DD/MM/YYYY')}</b> },
    { title: t('cal.dow.label'), dataIndex: 'date', key: 'dow', width: 110, render: (v: string) => t(`cal.dow.${dayjs(v).day()}`) },
    { title: t('cal.type'), dataIndex: 'kind', width: 150, render: (k: HolidayKind) => <Tag color={KIND_COLOR[k]} variant="filled">{t(`cal.kind.${k}`)}</Tag> },
    { title: t('cal.desc'), dataIndex: 'description', ellipsis: true },
    { title: t('line.createdBy'), dataIndex: 'createdBy', width: 120, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    {
      title: '', width: 200, render: (_: unknown, h: Holiday) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Button size="small" icon={<SwapOutlined />} onClick={() => openEdit(h)}>{t('cal.convert')}</Button>
          <Popconfirm title={t('cal.deleteAsk')} okText={t('req.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate([h.id])}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ]

  const year0 = dayjs().year()
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CalendarOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.holidays')} subtitle={t('nav.holidaysDesc')} />
      <StatTiles items={[
        { label: t('cal.tileTotal'), value: all.length, color: '#2E9E4F' },
        { label: t('cal.kind.holiday'), value: count('holiday'), color: '#D92D20' },
        { label: t('cal.kind.sunday'), value: count('sunday'), color: '#2563eb' },
        { label: t('cal.kind.biweekly'), value: count('biweekly'), color: '#6D5BD0' },
      ]} />
      <Alert type="info" showIcon title={t('cal.note')} style={{ marginBottom: 16 }} />
      <DataTable<Holiday>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]), preserveSelectedRowKeys: true }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('cal.empty') }}
        toolbar={(
          <div className="dt-row">
            <Select style={{ width: 120 }} value={year} onChange={(v) => { setYear(v); setPicked([]) }}
              options={Array.from({ length: 7 }, (_, i) => year0 - 3 + i).map((y) => ({ value: y, label: y }))} />
            <Select allowClear style={{ width: 170 }} placeholder={t('cal.allTypes')} value={kindFilter} onChange={setKindFilter}
              options={[...kindOptions, { value: 'rest', label: t('cal.kind.rest') }]} />
            <Input.Search allowClear style={{ width: 240 }} placeholder={t('cal.search')} onSearch={setSearch} onChange={(e) => !e.target.value && setSearch('')} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>{t('cal.add')}</Button>
            <Popconfirm title={t('cal.deleteManyAsk', { n: picked.length })} okText={t('req.delete')} cancelText={t('req.cancel')} disabled={picked.length === 0} onConfirm={() => remove.mutate(picked)}>
              <Button danger icon={<DeleteOutlined />} disabled={picked.length === 0} loading={remove.isPending}>{t('cal.deleteN', { n: picked.length })}</Button>
            </Popconfirm>
            <Typography.Text type="secondary">{rows.length}/{all.length}</Typography.Text>
          </div>
        )}
      />

      <AppModal open={adding} onClose={() => setAdding(false)} size="sm" icon={<PlusOutlined />} title={t('cal.add')}
        onOk={() => addForm.validateFields().then((v) => add.mutate(v))} okText={t('cal.addOk')} okLoading={add.isPending}>
        <Form form={addForm} layout="vertical">
          <Form.Item name="kind" label={t('cal.type')}><Radio.Group optionType="button" buttonStyle="solid" options={kindOptions} /></Form.Item>
          <Form.Item name="range" label={t('cal.range')} extra={addKind === 'sunday' ? t('cal.rangeSundayHint') : t('cal.rangeHint')} rules={[{ required: true }]}>
            <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          {addKind === 'holiday' && (
            <Form.Item name="description" label={t('cal.holidayName')} rules={[{ required: true, whitespace: true, max: 150 }]}><Input maxLength={150} placeholder={t('cal.holidayNamePh')} /></Form.Item>
          )}
        </Form>
      </AppModal>

      <AppModal open={editing !== null} onClose={() => setEditing(null)} size="sm" icon={<EditOutlined />} title={t('cal.convertTitle')}
        subtitle={editing ? `${dayjs(editing.date).format('DD/MM/YYYY')} · ${t(`cal.kind.${editing.kind}`)}` : undefined}
        onOk={() => editForm.validateFields().then((v) => update.mutate(v))} okText={t('req.saveChanges')} okLoading={update.isPending}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="kind" label={t('cal.type')}><Radio.Group optionType="button" buttonStyle="solid" options={kindOptions} /></Form.Item>
          <Form.Item name="date" label={t('cal.date')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }} /></Form.Item>
          {editKind === 'holiday' && (
            <Form.Item name="description" label={t('cal.holidayName')} rules={[{ required: true, whitespace: true, max: 150 }]}><Input maxLength={150} /></Form.Item>
          )}
        </Form>
      </AppModal>
    </div>
  )
}
