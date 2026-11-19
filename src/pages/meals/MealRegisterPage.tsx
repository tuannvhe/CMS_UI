import { useState } from 'react'
import { Alert, Avatar, Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Tabs, Tag, Tooltip } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import { CheckOutlined, CloseOutlined, CoffeeOutlined, EditOutlined, FileExcelOutlined, BarChartOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { MEAL_STATUS_COLOR, mealLocked, mealRegister, type MealCode, type MealOrder, type MealOrderStatus, type MealSite } from '../../api/meals'
import { lookups } from '../../api/requests'
import { MealStats } from './MealStats'
import { MealGrid } from './MealGrid'
import { MealBoardList } from './MealBoardList'
import { MealRangeRules } from './MealRangeRules'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { foldFilter } from '../../utils/search'

interface EditValues { qty: number; department?: string; otherDept?: string; note?: string }
/** Mục "Khác" trong ô bộ phận: bộ phận không có trong danh sách, gõ tên ở ô bên cạnh (để trống thì lưu "Khác"). */
const OTHER = '__other__'

/**
 * Đăng ký SỐ LƯỢNG suất ăn (nhóm "Người dùng" và nhân sự): chọn ngày, bữa, nhà máy, bộ phận và số suất.
 * Đăng ký trước 9h hằng ngày cho trưa / tối / khuya hôm đó và bữa sáng hôm sau thì được tính ngay; sau 9h đăng ký mới,
 * sửa hoặc huỷ đăng ký đã tính đều chờ nhân sự duyệt. Xem theo khoảng ngày và xuất Excel báo cáo.
 */
export default function MealRegisterPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()])
  const [editing, setEditing] = useState<MealOrder>()
  const [picked, setPicked] = useState<number[]>([])
  const [rejecting, setRejecting] = useState<number[]>()
  const [reason, setReason] = useState('')
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState('register')
  const [editForm] = Form.useForm<EditValues>()
  const { user } = useAuth()
  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')

  const me = useQuery({ queryKey: ['meal-reg-me'], queryFn: mealRegister.me, retry: false })
  const can = !!me.data?.canRegister
  const approver = !!me.data?.approver
  const depts = useQuery({ queryKey: ['lookup-departments'], queryFn: lookups.departments, enabled: can, staleTime: 600_000 })
  // Người duyệt thấy mọi đăng ký trong khoảng ngày, người khác chỉ thấy của mình.
  // Bữa sáng lưu theo NGÀY ĂN (D+1) nhưng thuộc ngày đăng ký D: lấy thêm một ngày để bữa sáng của ngày cuối khoảng không bị sót.
  const toPlus = range[1].add(1, 'day').format('YYYY-MM-DD')
  const list = useQuery({ queryKey: ['meal-reg', from, toPlus], queryFn: () => mealRegister.list(from, toPlus), enabled: can, retry: false })
  const excluded = useQuery({ queryKey: ['meal-range-excluded'], queryFn: mealRegister.rangeExcluded, enabled: can, retry: false, staleTime: 60_000 })
  const pending = useQuery({ queryKey: ['meals-pending'], queryFn: mealRegister.pending, enabled: approver, retry: false })
  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    return t(`mealReg.err.${d?.detail ?? d?.title}`, { defaultValue: t('req.err.generic') })
  }
  const refresh = () => ['meal-reg', 'meals-pending', 'meals'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
  const update = useMutation({
    mutationFn: ({ otherDept, ...v }: EditValues) => mealRegister.update(editing!.id, { ...v, department: deptOf(v.department, otherDept) }),
    onSuccess: (r) => {
      if (r.status === 'pending' && editing?.status === 'approved') message.warning(t('mealReg.savedPending')); else message.success(t('mealReg.saved'))
      setEditing(undefined); refresh()
    },
    onError: (e) => message.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => mealRegister.remove(id),
    onSuccess: (r) => { if (r.status === 'pending') message.warning(t('mealReg.deletedPending')); else message.success(t('mealReg.deleted')); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const decide = useMutation({
    mutationFn: (v: { ids: number[]; approve: boolean; reason?: string }) => mealRegister.decide(v.ids, v.approve, v.reason),
    onSuccess: (r) => { message.success(t('meal.decided', { n: r.done })); setPicked([]); setRejecting(undefined); setReason(''); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const doExport = async () => {
    setExporting(true)
    try { await mealRegister.exportXlsx(from, to) } catch (e) { message.error(errText(e)) } finally { setExporting(false) }
  }

  const banner = <PageBanner avatar={<Avatar size={56} icon={<CoffeeOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.mealRegister')} subtitle={t('nav.mealRegisterDesc')} />
  if (me.isLoading) return <div className="page" />
  if (!can) return <div className="page">{banner}<Alert type="info" showIcon title={t('mealReg.noAccess')} /></div>
  if (list.isError && axios.isAxiosError(list.error) && list.error.response?.status === 503) {
    return <div className="page">{banner}<Alert type="warning" showIcon title={t('mealReg.tableMissing')} /></div>
  }

  const lockTime = me.data?.lockTime ?? '09:00'
  const fetched = list.data ?? []
  // Theo ngày ĂN (thống kê, Excel): tới ngày cuối khoảng. Theo ngày ĐĂNG KÝ (bảng danh sách): bữa sáng tính vào ngày hôm trước.
  const rows = fetched.filter((o) => o.date.slice(0, 10) <= to)
  const boardRows = fetched.filter((o) => { const d = o.meal === 'breakfast' ? dayjs(o.date).subtract(1, 'day').format('YYYY-MM-DD') : o.date.slice(0, 10); return d >= from && d <= to })
  const deptOptions = [...(depts.data ?? []).map((d) => ({ value: d, label: d })), { value: OTHER, label: t('mealReg.deptOther') }]
  const deptOf = (d?: string, other?: string) => d === OTHER ? (other?.trim() || t('mealReg.deptOther')) : d
  const isLocked = (o: MealOrder) => !!me.data && mealLocked(me.data, o.date.slice(0, 10), o.meal)
  /** Sau giờ khoá, người đăng ký sửa / huỷ đăng ký đã tính thì thành yêu cầu chờ duyệt. */
  const asRequest = (o: MealOrder) => !approver && o.status === 'approved' && o.replacesId == null && isLocked(o)
  // Ai cũng xem tất cả; chỉ sửa / xoá đơn của chính mình (người duyệt / bộ phận quản lý suất ăn sửa xoá được mọi đơn)
  const mine = (o: MealOrder) => (o.registeredBy ?? '').trim().toLowerCase() === (user?.userId ?? '').trim().toLowerCase()
  const canEdit = (o: MealOrder) => !o.cancel && (approver || (mine(o) && o.status !== 'rejected'))
  const canDelete = (o: MealOrder) => approver || (mine(o) && (o.status !== 'rejected' || o.replacesId == null))

  const kindTag = (o: MealOrder) => o.replacesId != null && <Tag color={o.cancel ? 'red' : 'blue'}>{t(o.cancel ? 'mealReg.kindCancel' : 'mealReg.kindEdit', { id: o.replacesId })}</Tag>
  const statusCell = (st: MealOrderStatus, o: MealOrder) => (
    <Space size={4} wrap>
      <Tooltip title={o.rejectReason ? t('mealReg.reason', { r: o.rejectReason }) : undefined}><Tag color={MEAL_STATUS_COLOR[st]}>{t(`mealReg.status.${st}`)}</Tag></Tooltip>
      {kindTag(o)}
      {o.late && o.replacesId == null && <Tag>{t('mealReg.late')}</Tag>}
    </Space>
  )
  const baseCols = [
    { title: t('meal.date'), dataIndex: 'date', render: (v: string) => dayjs(v).format('DD/MM') },
    { title: t('meal.meal'), dataIndex: 'meal', render: (m: MealCode) => t(`meal.code.${m}`) },
    { title: t('meal.site'), dataIndex: 'site', render: (v: MealSite) => t(`meal.siteName.${v}`) },
    { title: t('meal.dept'), dataIndex: 'department' },
    { title: t('meal.qty'), dataIndex: 'qty', align: 'right' as const, render: (v: number, o: MealOrder) => <b style={o.cancel ? { textDecoration: 'line-through' } : undefined}>{v}</b> },
    { title: t('meal.registeredBy'), dataIndex: 'registeredBy', render: (v: string, o: MealOrder) => `${o.registeredByName || v} · ${dayjs(o.createdAt).format('HH:mm DD/MM')}` },
    { title: t('meal.noteCol'), dataIndex: 'note' },
  ]
  const openEdit = (o: MealOrder) => {
    const known = !o.department || (depts.data ?? []).includes(o.department)   // bộ phận gõ tay (mục Khác) thì mở lại ở ô Khác
    editForm.setFieldsValue({ qty: o.qty, department: known ? o.department ?? undefined : OTHER, otherDept: known ? undefined : o.department ?? undefined, note: o.note ?? undefined }); setEditing(o)
  }
  const rangeTools = (
    <Space wrap>
      <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
        disabledDate={(d, info) => !!info?.from && Math.abs(d.diff(info.from, 'day')) > 92} />
      <Button icon={<FileExcelOutlined />} loading={exporting} onClick={doExport}>{t('mealReg.export')}</Button>
    </Space>
  )

  const registerTab = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('mealReg.note', { time: lockTime })} />

      {me.data && <MealGrid me={me.data} approver={approver} departments={depts.data ?? []} userId={user?.userId} excluded={excluded.data} />}

      {approver && (pending.data?.length ?? 0) > 0 && (
        <Card size="small" style={{ marginTop: 16, borderColor: '#F59E0B' }}
          title={<span>{t('meal.pendingTitle')} <Tag color="orange">{pending.data?.length}</Tag></span>}
          extra={(
            <Space size={6}>
              <Button size="small" type="primary" icon={<CheckOutlined />} disabled={!picked.length} loading={decide.isPending && decide.variables?.approve}
                onClick={() => decide.mutate({ ids: picked, approve: true })}>{t('meal.approveSel', { n: picked.length })}</Button>
              <Button size="small" danger icon={<CloseOutlined />} disabled={!picked.length} onClick={() => setRejecting(picked)}>{t('meal.rejectSel', { n: picked.length })}</Button>
            </Space>
          )}>
          <Table<MealOrder> size="small" rowKey="id" pagination={false} dataSource={pending.data} scroll={{ x: 'max-content' }}
            rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]) }}
            columns={[
              ...baseCols,
              { title: '', dataIndex: 'replacesId', render: (_: unknown, o) => kindTag(o) || <Tag>{t('mealReg.late')}</Tag> },
              { title: '', width: 90, render: (_: unknown, o) => (
                <Space size={4}>
                  <Button size="small" type="primary" icon={<CheckOutlined />} title={t('meal.approve')} onClick={() => decide.mutate({ ids: [o.id], approve: true })} />
                  <Button size="small" danger icon={<CloseOutlined />} title={t('meal.reject')} onClick={() => setRejecting([o.id])} />
                </Space>
              ) },
            ]} />
        </Card>
      )}

      <MealBoardList rows={boardRows} loading={list.isLoading} toolbar={rangeTools} userId={user?.userId}
        canEdit={canEdit} canDelete={canDelete} asRequest={asRequest} onEdit={openEdit} onDelete={(id) => remove.mutate(id)}
        statusCell={(o) => statusCell(o.status, o)} />
    </>
  )

  return (
    <div className="page wide">
      {banner}
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'register', icon: <EditOutlined />, label: t('mealStats.tabRegister'), children: registerTab },
        { key: 'stats', icon: <BarChartOutlined />, label: t('mealStats.tabStats'), children: <MealStats rows={rows} loading={list.isLoading} toolbar={rangeTools} /> },
        ...(approver ? [{ key: 'rules', icon: <StopOutlined />, label: t('mealReg.rulesTab'), children: <MealRangeRules departments={depts.data ?? []} saved={excluded.data ?? []} /> }] : []),
      ]} />

      <AppModal open={!!rejecting} onClose={() => setRejecting(undefined)} size="sm" icon={<CloseOutlined />} title={t('meal.rejectSel', { n: rejecting?.length ?? 0 })}
        onOk={() => rejecting && decide.mutate({ ids: rejecting, approve: false, reason: reason.trim() || undefined })} okText={t('meal.reject')} okLoading={decide.isPending}>
        <Input.TextArea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('meal.rejectReason')} />
      </AppModal>

      <AppModal open={!!editing} onClose={() => setEditing(undefined)} size="sm" icon={<EditOutlined />} title={t('mealReg.editTitle')}
        subtitle={editing ? `${t(`meal.code.${editing.meal}`)} · ${t(`meal.siteName.${editing.site}`)} · ${dayjs(editing.date).format('DD/MM/YYYY')}` : ''}
        onOk={() => editForm.validateFields().then((v) => update.mutate(v))} okText={t('meal.addOk')} okLoading={update.isPending}>
        {editing && asRequest(editing) && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('mealReg.editLate', { time: lockTime })} />}
        <Form form={editForm} layout="vertical">
          <Form.Item name="qty" label={t('meal.qty')} rules={[{ required: true }]}><InputNumber min={1} max={2000} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="department" label={t('meal.dept')}>
            <Select showSearch allowClear options={deptOptions} filterOption={foldFilter('label')} placeholder={t('mealReg.deptPh')} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.department !== b.department}>
            {({ getFieldValue }) => getFieldValue('department') === OTHER && (
              <Form.Item name="otherDept" label={t('mealReg.deptOtherName')} rules={[{ max: 100 }]}>
                <Input maxLength={100} placeholder={t('mealReg.deptOtherPh')} />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="note" label={t('meal.noteCol')} rules={[{ max: 300 }]}><Input maxLength={300} /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
