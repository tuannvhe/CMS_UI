import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Col, DatePicker, Descriptions, Empty, Form, Input, Modal, Radio, Row, Skeleton, Space, Table, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, FileExcelOutlined, IdcardOutlined, PlusOutlined, SearchOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { hnEmployeesApi, hnErrorCode, hnErrorKey, type HnEmployeeDetail, type HnEmployeeListItem, type HnEmployeeUpdate } from '../../api/hn'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { fmtCell } from '../../utils/hnFormat'

/*
 * 2026-11-25 [Truong] - HN HR: employee management like the old CMS_HN Employee screen (module "Quản lý nhân viên").
 * List / search / detail for View, edit modal for Edit. Same fields as the old edit form, but every field is really saved
 * (the old sp_AddEmployees_Import call dropped 7 of them). Dates are sent as yyyy-MM-dd (no timezone shift). Saving obeys Hn:WriteMode.
 */

const DATE_FIELDS = ['startWork', 'endWork', 'birthday', 'identityIssued'] as const
const TEXT_FIELDS = ['fullName', 'department', 'position', 'process', 'title', 'workStatus', 'email', 'phone', 'nation', 'identityCard', 'identityPlace', 'place', 'address', 'taxCode', 'education'] as const
type FormValues = Partial<Record<(typeof TEXT_FIELDS)[number], string>> & Partial<Record<(typeof DATE_FIELDS)[number], Dayjs | null>> & { sex?: boolean; married?: boolean; employeeId?: string }

const MAX_AVATAR = 2 * 1024 * 1024

/** Nhãn trường: ưu tiên hn.emp.f, sau đó dùng chung nhãn của màn Thông tin cá nhân. */
function useLabel() {
  const { t, i18n } = useTranslation()
  return (k: string) => (i18n.exists(`hn.emp.f.${k}`) ? t(`hn.emp.f.${k}`) : t(`hn.profile.f.${k}`))
}

/** Ảnh đại diện tải qua API (cookie phiên), tự thu hồi object URL. */
function EmployeeAvatar({ id, has, size = 96, override }: { id: string; has: boolean; size?: number; override?: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!has) { setUrl(null); return }
    let live = true, made: string | null = null
    hnEmployeesApi.avatar(id).then((u) => { made = u; if (live) setUrl(u); else if (u) URL.revokeObjectURL(u) }).catch(() => undefined)
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [id, has])
  const src = override === undefined ? url : override
  return <Avatar size={size} icon={<UserOutlined />} src={src || undefined} />
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export default function HnEmployeesPage() {
  const { t } = useTranslation()
  const label = useLabel()
  const toast = useToast()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const list = useQuery({ queryKey: ['hn', 'admin', 'employees', q], queryFn: () => hnEmployeesApi.list(q || undefined), staleTime: 60_000, retry: false })
  const data = list.data
  const mode = data?.writeMode
  /* 2026-11-25 [Truong] - HN employee Excel export with the current search filter (empty = all, like the old export) */
  const exp = useMutation({ mutationFn: () => hnEmployeesApi.exportFile(q || undefined) })

  const columns = useMemo<ColumnsType<HnEmployeeListItem>>(() => [
    { title: label('employeeId'), dataIndex: 'employeeId', width: 120, fixed: 'left', render: (v: string) => <Typography.Text strong>{v}</Typography.Text>, sorter: (a, b) => a.employeeId.localeCompare(b.employeeId) },
    { title: label('fullName'), dataIndex: 'fullName', width: 200, ellipsis: true, sorter: (a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'vi') },
    { title: label('department'), dataIndex: 'department', width: 160, ellipsis: true, render: (v: string | null) => (v ? <Tag color="blue">{v}</Tag> : '') },
    { title: label('position'), dataIndex: 'position', width: 140, ellipsis: true },
    { title: label('process'), dataIndex: 'process', width: 130, ellipsis: true },
    { title: label('startWork'), dataIndex: 'startWork', width: 120, render: (v: string | null) => fmtCell(v) },
    { title: label('workStatus'), dataIndex: 'workStatus', width: 140, ellipsis: true },
    { title: t('hn.emp.createdAt'), dataIndex: 'createdAt', width: 120, render: (v: string | null) => fmtCell(v) },
    {
      title: t('hn.emp.action'), key: 'act', width: 170, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => setDetailId(r.employeeId)}>{t('hn.emp.detail')}</Button>
          {data?.canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => setEditId(r.employeeId)}>{t('hn.emp.edit')}</Button>}
        </Space>
      ),
    },
  ], [t, label, data?.canEdit])

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<IdcardOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('hn.nav.employees')} subtitle={t('hn.nav.employeesDesc')} chips={data ? [t('hn.emp.count', { n: data.items.length })] : undefined} />

      {(data?.canEdit || data?.canAdd) && mode && (
        <Alert style={{ marginBottom: 16 }} showIcon type={mode === 'live' ? 'warning' : 'info'}
          title={mode === 'off' ? t('hn.emp.modeOff') : mode === 'test' ? t('hn.emp.modeTest', { list: data.allowed.join(', ') || '—' }) : t('hn.emp.modeLive')} />
      )}

      <section className="pay-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap>
          <Input allowClear style={{ width: 320 }} prefix={<SearchOutlined />} placeholder={t('hn.emp.searchPh')} value={text}
            onChange={(e) => { setText(e.target.value); if (!e.target.value) setQ('') }} onPressEnter={() => setQ(text.trim())} />
          <Button type="primary" icon={<SearchOutlined />} loading={list.isFetching} onClick={() => setQ(text.trim())}>{t('hn.emp.search')}</Button>
          {data?.canAdd && <Button icon={<PlusOutlined />} onClick={() => setCreating(true)}>{t('hn.emp.create')}</Button>}
          {data?.canExport && <Button icon={<FileExcelOutlined />} loading={exp.isPending} onClick={() => exp.mutate()}>{t('hn.emp.export')}</Button>}
        </Space>
        {exp.isError && <Alert type="error" showIcon style={{ marginTop: 10 }} title={t(hnErrorKey(exp.error))} />}
        {data?.truncated && <Typography.Paragraph type="secondary" style={{ margin: '10px 0 0' }}>{t('hn.emp.truncated', { n: data.items.length })}</Typography.Paragraph>}
      </section>

      {list.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} title={t(hnErrorKey(list.error))} action={<Button size="small" onClick={() => void list.refetch()}>{t('hn.common.retry')}</Button>} />}

      <Table<HnEmployeeListItem> size="small" bordered rowKey={(r) => `${r.employeeId}|${r.id ?? ''}`} columns={columns} dataSource={data?.items ?? []} loading={list.isFetching}
        scroll={{ x: 'max-content' }} pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: (n, r) => `${r[0]}-${r[1]} / ${n}` }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.common.empty')} /> }} />

      <DetailDrawer id={detailId} canEdit={!!data?.canEdit} onClose={() => setDetailId(null)} onEdit={(id) => { setDetailId(null); setEditId(id) }} />
      <EditModal id={editId} creating={creating} onClose={() => { setEditId(null); setCreating(false) }}
        onSaved={(d, created) => {
          toast.success(t(created ? 'hn.emp.created' : 'hn.emp.saved', { id: d.employeeId }))
          qc.setQueryData(['hn', 'admin', 'employee', d.employeeId], d)
          void qc.invalidateQueries({ queryKey: ['hn', 'admin', 'employees'] })
          setEditId(null); setCreating(false)
        }} />
    </div>
  )
}

function DetailDrawer({ id, canEdit, onClose, onEdit }: { id: string | null; canEdit: boolean; onClose: () => void; onEdit: (id: string) => void }) {
  const { t } = useTranslation()
  const label = useLabel()
  const q = useQuery({ queryKey: ['hn', 'admin', 'employee', id], queryFn: () => hnEmployeesApi.get(id!), enabled: !!id, retry: false })
  const d = q.data
  const yn = (v: boolean | null, a: string, b: string) => (v == null ? '' : v ? t(a) : t(b))
  const rows: [string, string][] = d ? [
    ['employeeId', d.employeeId], ['fullName', d.fullName ?? ''], ['department', d.department ?? ''], ['position', d.position ?? ''], ['process', d.process ?? ''], ['title', d.title ?? ''],
    ['startWork', fmtCell(d.startWork)], ['endWork', fmtCell(d.endWork)], ['workStatus', d.workStatus ?? ''], ['birthday', fmtCell(d.birthday)],
    ['sex', yn(d.sex, 'hn.emp.male', 'hn.emp.female')], ['married', yn(d.married, 'hn.emp.married', 'hn.emp.single')], ['nation', d.nation ?? ''],
    ['email', d.email ?? ''], ['phone', d.phone ?? ''], ['identityCard', d.identityCard ?? ''], ['identityIssued', fmtCell(d.identityIssued)], ['identityPlace', d.identityPlace ?? ''],
    ['place', d.place ?? ''], ['address', d.address ?? ''], ['taxCode', d.taxCode ?? ''], ['education', d.education ?? ''], ['school', d.school ?? ''], ['major', d.major ?? ''],
  ] : []
  return (
    /* 2026-11-25 [Truong] - HN employee detail shown as a centered modal instead of a side drawer */
    <Modal open={!!id} onCancel={onClose} centered width={720} destroyOnHidden title={id ? t('hn.emp.detailTitle', { id }) : ''}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      footer={[
        <Button key="close" onClick={onClose}>{t('hn.common.cancel')}</Button>,
        ...(canEdit && d ? [<Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => onEdit(d.employeeId)}>{t('hn.emp.edit')}</Button>] : []),
      ]}>
      {q.isLoading ? <Skeleton active paragraph={{ rows: 12 }} />
        : q.isError ? <Alert type="error" showIcon title={t(hnErrorKey(q.error))} />
        : d && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}><EmployeeAvatar id={d.employeeId} has={d.hasAvatar} size={112} /></div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} items={rows.map(([k, v]) => ({ key: k, label: label(k), children: v || '—' }))} />
          </>
        )}
    </Modal>
  )
}

/** Modal sửa (id có giá trị) hoặc thêm mới (creating). */
function EditModal({ id, creating, onClose, onSaved }: { id: string | null; creating: boolean; onClose: () => void; onSaved: (d: HnEmployeeDetail, created: boolean) => void }) {
  const { t } = useTranslation()
  const label = useLabel()
  const [form] = Form.useForm<FormValues>()
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined)   // undefined = giữ ảnh cũ, null = xoá, chuỗi = ảnh mới (data URL)
  const [error, setError] = useState('')
  const q = useQuery({ queryKey: ['hn', 'admin', 'employee', id], queryFn: () => hnEmployeesApi.get(id!), enabled: !!id && !creating, retry: false })
  const d = creating ? undefined : q.data
  const ready = creating || !!d

  /* 2026-11-25 [Truong] - HN employee create: empty form with the old defaults (male, single) */
  useEffect(() => {
    if (!creating) return
    setAvatar(undefined); setError('')
    form.resetFields()
    form.setFieldsValue({ sex: true, married: false })
  }, [creating, form])

  useEffect(() => {
    if (creating || !id || !d) return
    setAvatar(undefined); setError('')
    const v: FormValues = { sex: d.sex ?? true, married: d.married ?? false }
    for (const k of TEXT_FIELDS) v[k] = d[k] ?? undefined
    for (const k of DATE_FIELDS) v[k] = d[k] ? dayjs(d[k]) : null
    form.setFieldsValue(v)
  }, [creating, id, d, form])

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body: HnEmployeeUpdate = { fullName: '', department: '', position: '' }
      for (const k of TEXT_FIELDS) (body as unknown as Record<string, unknown>)[k] = v[k]?.trim() || null
      for (const k of DATE_FIELDS) (body as unknown as Record<string, unknown>)[k] = v[k] ? v[k]!.format('YYYY-MM-DD') : null
      body.sex = v.sex ?? null
      body.married = v.married ?? null
      if (avatar === null && !creating) body.removeAvatar = true
      else if (avatar) body.avatarBase64 = avatar
      return creating ? hnEmployeesApi.create({ ...body, employeeId: (v.employeeId ?? '').trim() }) : hnEmployeesApi.update(id!, body)
    },
    onMutate: () => setError(''),
    onSuccess: (r) => onSaved(r, creating),
    onError: (e) => {
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      setError(hnErrorCode(e) === 'invalid_input' && detail ? t('hn.emp.invalidField', { field: label(detail) }) : t(hnErrorKey(e)))
    },
  })

  const req = [{ required: true, whitespace: true, message: t('hn.emp.required') }]
  const reqPick = [{ required: true, message: t('hn.emp.required') }]
  const txt = (k: (typeof TEXT_FIELDS)[number], rules?: object[], extra?: object[]) => (
    <Col xs={24} md={12} key={k}><Form.Item name={k} label={label(k)} rules={[...(rules ?? []), ...(extra ?? [])]}><Input maxLength={255} /></Form.Item></Col>
  )
  const date = (k: (typeof DATE_FIELDS)[number], rules?: object[]) => (
    <Col xs={24} md={12} key={k}><Form.Item name={k} label={label(k)} rules={rules}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
  )
  const sec = (key: string) => <Typography.Title level={5} style={{ margin: '8px 0 12px' }}>{t(key)}</Typography.Title>

  return (
    <Modal open={!!id || creating} onCancel={onClose} width={900} destroyOnHidden centered styles={{ body: { maxHeight: '75vh', overflowY: 'auto', paddingRight: 8 } }} title={creating ? t('hn.emp.createTitle') : id ? t('hn.emp.editTitle', { id }) : ''}
      okText={t('hn.emp.save')} cancelText={t('hn.common.cancel')} okButtonProps={{ loading: save.isPending, disabled: !ready }}
      onOk={() => { form.validateFields().then((v) => save.mutate(v)).catch(() => undefined) }}>
      {!creating && q.isLoading ? <Skeleton active paragraph={{ rows: 14 }} />
        : !creating && q.isError ? <Alert type="error" showIcon title={t(hnErrorKey(q.error))} />
        : ready && (
          <Form form={form} layout="vertical" requiredMark>
            {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
            <Space align="center" size={16} style={{ marginBottom: 12 }}>
              <EmployeeAvatar id={d?.employeeId ?? ''} has={!!d?.hasAvatar} size={88} override={avatar} />
              <div>
                <Space>
                  <Upload accept="image/png,image/jpeg" showUploadList={false}
                    beforeUpload={async (file) => {
                      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > MAX_AVATAR) { setError(t('hn.emp.avatarBad')); return Upload.LIST_IGNORE }
                      setAvatar(await readBase64(file)); setError('')
                      return false
                    }}>
                    <Button icon={<UploadOutlined />}>{t('hn.emp.upload')}</Button>
                  </Upload>
                  {(avatar || (d?.hasAvatar && avatar !== null)) &&<Button danger icon={<DeleteOutlined />} onClick={() => setAvatar(null)}>{t('hn.emp.removeAvatar')}</Button>}
                </Space>
                <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 4 }}>{t('hn.emp.avatarHint')}</div>
              </div>
            </Space>

            {sec('hn.emp.secBasic')}
            <Row gutter={16}>
              {creating
                ? <Col xs={24} md={12}><Form.Item name="employeeId" label={label('employeeId')} rules={[...req, { pattern: /^[A-Za-z0-9._-]{1,30}$/, message: t('hn.emp.badId') }]}><Input maxLength={30} placeholder="VD: 32611001" /></Form.Item></Col>
                : <Col xs={24} md={12}><Form.Item label={label('employeeId')}><Input value={d?.employeeId} disabled /></Form.Item></Col>}
              {txt('fullName', req)}
              {txt('department', req)}
              {txt('position', req)}
              {date('birthday', reqPick)}
              <Col xs={24} md={12}><Form.Item name="sex" label={label('sex')} rules={reqPick}><Radio.Group><Radio value={true}>{t('hn.emp.male')}</Radio><Radio value={false}>{t('hn.emp.female')}</Radio></Radio.Group></Form.Item></Col>
            </Row>

            {sec('hn.emp.secContact')}
            <Row gutter={16}>
              {txt('email', undefined, [{ type: 'email', message: t('hn.emp.badEmail') }])}
              {txt('phone', req)}
              {txt('identityCard', req)}
              {date('identityIssued')}
              {txt('identityPlace')}
              {txt('nation')}
            </Row>

            {sec('hn.emp.secJob')}
            <Row gutter={16}>
              {date('startWork', reqPick)}
              {date('endWork')}
              {txt('workStatus', req)}
              {txt('process')}
              {txt('title')}
            </Row>

            {sec('hn.emp.secOther')}
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item name="married" label={label('married')}><Radio.Group><Radio value={true}>{t('hn.emp.married')}</Radio><Radio value={false}>{t('hn.emp.single')}</Radio></Radio.Group></Form.Item></Col>
              {txt('place')}
              {txt('address')}
              {txt('taxCode')}
              {txt('education')}
            </Row>
          </Form>
        )}
    </Modal>
  )
}
