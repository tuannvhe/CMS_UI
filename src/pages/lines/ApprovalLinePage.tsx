import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Form, Input, Popconfirm, Select, Space, Switch, Tag } from 'antd'
import { AppModal } from '../../components/AppModal'
import type { ColumnsType } from 'antd/es/table'
import { ApartmentOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { lines, type ApproverLineRow } from '../../api/lines'
import { apiErrorCode } from '../../api/requests'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

export function lineErrorText(e: unknown, t: (k: string, o?: Record<string, unknown>) => string) {
  const { code, detail } = apiErrorCode(e)
  if (code === 'duplicate') return t('line.err.duplicate')
  if (code === 'not_found') return t('line.err.notFound')
  if (code === 'invalid_input') return t(`line.err.${detail}`, { defaultValue: t('req.err.invalid_input') })
  return t('req.err.generic')
}

/** Line phê duyệt: người duyệt của từng bộ phận theo cấp (bảng dùng chung với hệ thống cũ). Thay đổi có hiệu lực ngay ở các form đăng ký đơn. */
export default function ApprovalLinePage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [department, setDepartment] = useState<string | undefined>(params.get('department') ?? undefined)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<{ department: string; userId: string; level: string }>()

  const lookups = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, refetchOnMount: 'always' })
  const list = useQuery({ queryKey: ['lines', 'approvers', department, search], queryFn: () => lines.approvers({ department, search: search.trim() || undefined }) })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lines', 'approvers'] }); qc.invalidateQueries({ queryKey: ['req', 'approvers'] }) }

  const add = useMutation({
    mutationFn: (v: { department: string; userId: string; level: string }) => lines.addApprover(v),
    onSuccess: () => { message.success(t('line.added')); setOpen(false); form.resetFields(); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const toggle = useMutation({ mutationFn: (id: number) => lines.toggleApprover(id), onSuccess: refresh, onError: (e) => message.error(lineErrorText(e, t)) })
  const remove = useMutation({
    mutationFn: (id: number) => lines.deleteApprover(id),
    onSuccess: () => { message.success(t('line.deleted')); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })

  const rows = list.data ?? []
  // Mở từ nhắc sau khi thêm bộ phận mới (chưa có line): mở sẵn hộp thêm người duyệt cho bộ phận đó.
  const target = params.get('department')
  useEffect(() => {
    if (target && list.isSuccess && (list.data?.length ?? 0) === 0) { form.setFieldsValue({ department: target }); setOpen(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, list.isSuccess])

  // Danh sách phẳng: mỗi phòng ban một dòng, các bộ phận con của nó ngay dưới (thụt vào). Không dùng nhóm vì tên nhóm trùng với dòng đầu tiên nên mỗi phòng ban hiện hai lần.
  const targetOptions = useMemo(() => {
    const units = lookups.data?.units ?? []
    return (lookups.data?.departments ?? []).flatMap((d) => [
      { value: d.name, label: d.name },
      ...units.filter((u) => u.department.toLowerCase() === d.name.toLowerCase() && u.name.toLowerCase() !== d.name.toLowerCase()).map((u) => ({ value: u.name, label: `↳ ${u.name}` })),
    ])
  }, [lookups.data])
  const stats = useMemo(() => ({ total: rows.length, active: rows.filter((r) => r.active).length, deps: new Set(rows.map((r) => r.department)).size, noEmail: rows.filter((r) => r.active && !r.email).length }), [rows])

  const levelColor = (lv: number) => (['', 'green', 'blue', 'purple', 'orange', 'red'][lv] ?? 'default')
  const columns: ColumnsType<ApproverLineRow> = [
    { title: t('line.department'), dataIndex: 'department', width: 240 },
    { title: t('line.person'), width: 260, render: (_: unknown, r: ApproverLineRow) => <span><b>{r.fullName}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span> },
    {
      title: 'Email', width: 230,
      render: (_: unknown, r: ApproverLineRow) => (r.email ? <span>{r.email}</span> : <Tag color="warning" variant="filled">{t('line.noEmail')}</Tag>),
    },
    { title: t('line.level'), width: 170, render: (_: unknown, r: ApproverLineRow) => <Tag color={levelColor(r.level)} variant="filled">{r.levelName || r.level}</Tag> },
    {
      title: t('line.active'), width: 110, align: 'center',
      render: (_: unknown, r: ApproverLineRow) => (
        <Popconfirm title={r.active ? t('line.confirmDeactivate') : t('line.confirmActivate')} onConfirm={() => toggle.mutate(r.id)}>
          <Switch checked={r.active} loading={toggle.isPending && toggle.variables === r.id} />
        </Popconfirm>
      ),
    },
    { title: t('line.createdAt'), width: 150, render: (_: unknown, r: ApproverLineRow) => (r.createdAt ? dayjs(r.createdAt).format('DD/MM/YYYY HH:mm') : '') },
    { title: t('line.createdBy'), dataIndex: 'createdBy', width: 110 },
    {
      title: '', width: 100,
      render: (_: unknown, r: ApproverLineRow) => (
        <Popconfirm title={t('line.confirmDelete')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.id)}>
          <Button size="small" danger>{t('req.delete')}</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<ApartmentOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.approvalLine')} subtitle={t('nav.approvalLineDesc')}
      />
      <StatTiles items={[
        { label: t('line.tileTotal'), value: stats.total, color: '#2E9E4F' },
        { label: t('line.tileActive'), value: stats.active, color: '#2F6FB0' },
        { label: t('line.tileDepts'), value: stats.deps, color: '#D48806' },
        { label: t('line.tileNoEmail'), value: stats.noEmail, color: '#D92D20' },
      ]} />
      <Alert type="info" showIcon title={t('line.approvalNote')} style={{ marginBottom: 16 }} />
      <DataTable<ApproverLineRow>
        rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: list.isError ? t('req.err.generic') : t('line.empty') }}
        toolbar={(
          <Space wrap>
            <Select showSearch allowClear style={{ width: 260 }} placeholder={t('req.deptPlaceholder')} value={department} onChange={setDepartment}
              loading={lookups.isLoading} options={targetOptions} optionFilterProp="label" popupMatchSelectWidth={false} />
            <Input.Search allowClear style={{ width: 240 }} placeholder={t('line.searchPlaceholder')} onSearch={setSearch} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ department }); setOpen(true) }}>{t('line.addApprover')}</Button>
          </Space>
        )}
      />
      <AppModal open={open} onClose={() => setOpen(false)} size="sm" icon={<PlusOutlined />} title={t('line.addApprover')}
        onOk={() => form.validateFields().then((v) => add.mutate(v))} okText={t('line.add')} okLoading={add.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="department" label={t('line.department')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={targetOptions} />
          </Form.Item>
          <Form.Item name="userId" label={t('line.person')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={(lookups.data?.people ?? []).map((p) => ({ value: p.value, label: `${p.label} · ${p.value}` }))} />
          </Form.Item>
          <Form.Item name="level" label={t('line.level')} rules={[{ required: true }]}>
            <Select options={(lookups.data?.levels ?? []).map((l) => ({ value: l.value, label: l.label }))} />
          </Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
