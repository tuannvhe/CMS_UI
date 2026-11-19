import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Form, Input, Popconfirm, Tabs, Tag, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, TeamOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { workSpecial, type SpecialImportResult, type SpecialKind, type SpecialRow } from '../../api/workSpecial'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { foldText } from '../../utils/search'
import { useDebouncedValue } from '../../hooks/useDebounce'

interface FormValues { empId: string; date: Dayjs; noChild?: string }

/** Một tab: danh sách + thêm / sửa / xoá + nhập Excel cho chế độ con nhỏ hoặc Học viện Vina. */
function KindTab({ kind }: { kind: SpecialKind }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const dSearch = useDebouncedValue(search)   // gõ xong mới lọc, không lọc lại sau mỗi phím
  const [picked, setPicked] = useState<number[]>([])
  const [editing, setEditing] = useState<SpecialRow | 'new' | null>(null)
  const [result, setResult] = useState<SpecialImportResult | null>(null)
  const [form] = Form.useForm<FormValues>()
  const isChild = kind === 'child'

  const list = useQuery({ queryKey: ['work-special', kind], queryFn: () => workSpecial.list(kind) })
  const all = useMemo(() => list.data ?? [], [list.data])
  const rows = useMemo(() => {
    const q = foldText(dSearch.trim())
    return q ? all.filter((r) => foldText(`${r.empId} ${r.fullName ?? ''} ${r.department ?? ''}`).includes(q)) : all
  }, [all, dSearch])
  const refresh = () => qc.invalidateQueries({ queryKey: ['work-special', kind] })
  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    if (d?.title === 'table_missing') return t('wsp.err.table_missing')
    if (d?.title === 'duplicate') return t(`wsp.err.duplicate_${kind}`)
    if (d?.title === 'too_large') return t('wsp.err.too_large')
    return t(`wsp.err.${d?.detail}`, { defaultValue: t('req.err.generic') })
  }
  const body = (v: FormValues) => ({ empId: v.empId.trim(), date: v.date.format('YYYY-MM-DD'), noChild: isChild ? v.noChild?.trim() : undefined })

  const save = useMutation({
    mutationFn: (v: FormValues) => (editing && editing !== 'new' ? workSpecial.update(kind, editing.id, body(v)) : workSpecial.add(kind, body(v)).then(() => undefined)),
    onSuccess: () => { message.success(t('wsp.saved')); setEditing(null); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (ids: number[]) => workSpecial.remove(kind, ids),
    onSuccess: (r) => { message.success(t('wsp.deleted', { n: r.deleted })); setPicked([]); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const upload = useMutation({
    mutationFn: (f: File) => workSpecial.import(kind, f),
    onSuccess: (r) => { setResult(r); refresh() },
    onError: (e) => message.error(errText(e)),
  })

  const open = (r: SpecialRow | 'new') => {
    setEditing(r)
    form.setFieldsValue(r === 'new' ? { empId: '', date: undefined, noChild: '' } : { empId: r.empId, date: dayjs(r.date), noChild: r.noChild ?? '' })
  }
  const today = dayjs()
  const columns: ColumnsType<SpecialRow> = [
    { title: t('wsp.empId'), dataIndex: 'empId', width: 120, render: (v: string) => <b>{v}</b> },
    { title: t('wsp.name'), dataIndex: 'fullName', render: (v: string | null) => v || <span className="cell-muted">{t('wsp.unknownEmp')}</span> },
    { title: t('wsp.dept'), dataIndex: 'department', ellipsis: true, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    ...(isChild ? [{ title: t('wsp.noChild'), dataIndex: 'noChild', width: 100, align: 'center' as const, render: (v: string | null) => v || <span className="cell-muted">—</span> }] : []),
    { title: isChild ? t('wsp.expiry') : t('wsp.joinDate'), dataIndex: 'date', width: 140, sorter: (a, b) => a.date.localeCompare(b.date), render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    ...(isChild ? [{
      title: t('ses.status'), width: 130,
      render: (_: unknown, r: SpecialRow) => (dayjs(r.date).isBefore(today, 'day') ? <Tag variant="filled">{t('wsp.expired')}</Tag> : <Tag color="success" variant="filled">{t('wsp.active')}</Tag>),
    }] : []),
    { title: t('line.createdBy'), dataIndex: 'createdBy', width: 120, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    {
      title: '', width: 190, render: (_: unknown, r) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => open(r)}>{t('req.edit')}</Button>
          <Popconfirm title={t('wsp.deleteAsk')} okText={t('req.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate([r.id])}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ]

  return (
    <>
      <StatTiles items={isChild ? [
        { label: t('wsp.tileTotal'), value: all.length, color: '#2E9E4F' },
        { label: t('wsp.active'), value: all.filter((r) => !dayjs(r.date).isBefore(today, 'day')).length, color: '#2F6FB0' },
        { label: t('wsp.expired'), value: all.filter((r) => dayjs(r.date).isBefore(today, 'day')).length, color: '#D48806' },
      ] : [
        { label: t('wsp.tileTotal'), value: all.length, color: '#2E9E4F' },
        { label: t('wsp.tilePeople'), value: new Set(all.map((r) => r.empId)).size, color: '#2F6FB0' },
      ]} />
      <Alert type="info" showIcon title={t(`wsp.info_${kind}`)} style={{ marginBottom: 16 }} />
      <DataTable<SpecialRow>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]), preserveSelectedRowKeys: true }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('wsp.empty') }}
        toolbar={(
          <div className="dt-row">
            <Input.Search allowClear style={{ width: 240 }} placeholder={t('wsp.searchPh')} value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('wsp.add')}</Button>
            <Upload accept=".xlsx" showUploadList={false} multiple={false} beforeUpload={(f) => { upload.mutate(f); return false }}>
              <Button icon={<UploadOutlined />} loading={upload.isPending}>{t('wsp.import')}</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={() => workSpecial.template(kind)}>{t('wsp.template')}</Button>
            <Popconfirm title={t('cal.deleteManyAsk', { n: picked.length })} okText={t('req.delete')} cancelText={t('req.cancel')} disabled={picked.length === 0} onConfirm={() => remove.mutate(picked)}>
              <Button danger icon={<DeleteOutlined />} disabled={picked.length === 0} loading={remove.isPending}>{t('cal.deleteN', { n: picked.length })}</Button>
            </Popconfirm>
          </div>
        )}
      />
      <AppModal open={editing !== null} onClose={() => setEditing(null)} size="sm" icon={<TeamOutlined />} title={editing === 'new' ? t('wsp.add') : t('wsp.edit')}
        onOk={() => form.validateFields().then((v) => save.mutate(v))} okText={t('req.saveChanges')} okLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="empId" label={t('wsp.empId')} rules={[{ required: true }, { max: 20 }]}><Input maxLength={20} /></Form.Item>
          {isChild && <Form.Item name="noChild" label={t('wsp.noChild')} rules={[{ max: 10 }]}><Input maxLength={10} placeholder={t('wsp.noChildPh')} /></Form.Item>}
          <Form.Item name="date" label={isChild ? t('wsp.expiry') : t('wsp.joinDate')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </AppModal>
      <AppModal open={result !== null} onClose={() => setResult(null)} size="sm" icon={<UploadOutlined />} title={t('wsp.importDone')} onOk={() => setResult(null)} okText={t('req.close', { defaultValue: 'OK' })}>
        {result && (
          <>
            <p>{t('wsp.importSummary', { added: result.added, updated: result.updated, skipped: result.skipped })}</p>
            {result.errors.length > 0 && (
              <Alert type="warning" showIcon title={t('wsp.importErrors', { n: result.errors.length })}
                description={<ul style={{ margin: 0, paddingLeft: 18, maxHeight: 220, overflow: 'auto' }}>
                  {result.errors.slice(0, 100).map((e, i) => <li key={i}>{t('wsp.rowErr', { row: e.excelRow, msg: t(`wsp.err.${e.code}`, { defaultValue: e.code }), emp: e.detail ?? '' })}</li>)}
                </ul>} />
            )}
          </>
        )}
      </AppModal>
    </>
  )
}

/** Chế độ con nhỏ (Tbl_ChildMode) và Học viện Vina (Tbl_VinaAcademy): HR nhập, bảng công / tăng ca đọc trực tiếp. Thay tab cũ trong Form_Allowance. */
export default function WorkSpecialPage() {
  const { t } = useTranslation()
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<TeamOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.workSpecial')} subtitle={t('nav.workSpecialDesc')} />
      <Tabs destroyOnHidden items={[
        { key: 'child', label: t('wsp.tabChild'), children: <KindTab kind="child" /> },
        { key: 'academy', label: t('wsp.tabAcademy'), children: <KindTab kind="academy" /> },
      ]} />
    </div>
  )
}
