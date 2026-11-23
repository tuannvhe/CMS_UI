import { useState } from 'react'
import { Alert, Avatar, Button, Card, DatePicker, Form, Input, InputNumber, Popconfirm, Radio, Select, Tag, Tooltip, Typography } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import { CoffeeOutlined, DeleteOutlined, MailOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { MEAL_CODES, MEAL_SITES, mealGroups, meals, parseMealDetail, type MealAdjust, type MealAdjustInput, type MealCode, type MealGroup, type MealSite } from '../../api/meals'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { trData } from '../../utils/dataText'

interface Line { key: string; site: MealSite; group: MealGroup; serve: string; auto: number | null; adjust: number; departments: { department: string; qty: number }[]; sources: Record<string, number> }
interface AdjustValues { site: MealSite; meal: MealCode; group: MealGroup; qty: number; note?: string }

/**
 * Ước lượng suất ăn Bắc Ninh / Hưng Yên: hệ thống tự đếm và gửi mail 4 lần mỗi ngày (sáng / trưa / tối / khuya).
 * Nhân sự xem số từng bữa, đếm lại khi cần (có thể gửi lại mail) và cộng / trừ tay cho khách hoặc sai lệch.
 */
export default function MealsPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [date, setDate] = useState<Dayjs>(dayjs())
  const [adding, setAdding] = useState(false)
  const [form] = Form.useForm<AdjustValues>()
  const formSite = Form.useWatch('site', form)
  const formMeal = Form.useWatch('meal', form)
  const day = date.format('YYYY-MM-DD')
  // Máy chủ tự đếm lại mỗi 30 phút theo lượt chấm mới; màn hình lấy lại mỗi 5 phút.
  const board = useQuery({ queryKey: ['meals', day], queryFn: () => meals.board(day), refetchInterval: 300_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['meals', day] })

  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    return t(`meal.err.${d?.detail ?? d?.title}`, { defaultValue: t('req.err.generic') })
  }
  const recount = useMutation({
    mutationFn: (v: { meal: MealCode; send: boolean }) => meals.recount(day, v.meal, v.send),
    onSuccess: (_, v) => { message.success(t(v.send ? 'meal.resent' : 'meal.recounted')); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const add = useMutation({
    mutationFn: (v: AdjustValues) => meals.addAdjust({ date: day, ...v } as MealAdjustInput),
    onSuccess: () => { message.success(t('meal.adjustAdded')); setAdding(false); refresh() },
    onError: (e) => message.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => meals.removeAdjust(id),
    onSuccess: () => refresh(),
    onError: (e) => message.error(errText(e)),
  })

  const manual = board.data?.mode === 'manual'
  const orders = board.data?.orders ?? []
  const counts = board.data?.counts ?? []
  const adjusts = board.data?.adjusts ?? []
  const linesOf = (meal: MealCode): Line[] => MEAL_SITES.flatMap((site) => mealGroups(site, meal).map((group) => {
    const c = counts.find((x) => x.mealCode === meal && x.site === site && x.groupCode === group)
    const d = parseMealDetail(c?.detail ?? null)
    const adj = adjusts.filter((a) => a.mealCode === meal && a.site === site && a.groupCode === group).reduce((s, a) => s + a.qty, 0)
    if (manual) {
      // Số đăng ký tính trực tiếp từ đơn đã tính (trước giờ khoá hoặc đã duyệt), không phải chờ lần đếm lúc gửi mail.
      const ok = orders.filter((o) => o.meal === meal && o.site === site && o.group === group && o.status === 'approved')
      const byDept = new Map<string, number>()
      ok.forEach((o) => byDept.set(o.department || '—', (byDept.get(o.department || '—') ?? 0) + o.qty))
      const late = ok.filter((o) => o.late).reduce((s, o) => s + o.qty, 0)
      return { key: `${site}-${group}`, site, group, serve: d.serve ?? c?.serveTime ?? '', auto: ok.reduce((s, o) => s + o.qty, 0), adjust: adj,
        departments: [...byDept].map(([department, qty]) => ({ department, qty })).sort((a, b) => b.qty - a.qty),
        sources: late ? { register: ok.reduce((s, o) => s + o.qty, 0) - late, late } : {} }
    }
    return { key: `${site}-${group}`, site, group, serve: d.serve ?? c?.serveTime ?? '', auto: c ? c.autoQty : null, adjust: adj, departments: d.departments ?? [], sources: d.sources ?? {} }
  }))
  const totalOf = (meal: MealCode, site: MealSite) => linesOf(meal).filter((l) => l.site === site).reduce((s, l) => s + (l.auto ?? 0) + l.adjust, 0)
  const isToday = date.isSame(dayjs(), 'day')
  const tooOld = date.isBefore(dayjs().subtract(7, 'day'), 'day')

  const openAdd = (meal?: MealCode, site?: MealSite, group?: MealGroup) => {
    form.resetFields()
    form.setFieldsValue({ site: site ?? 'BN', meal: meal ?? 'lunch', group: group ?? 'ALL', qty: 1 })
    setAdding(true)
  }

  const mealCard = (meal: MealCode) => {
    const rows = linesOf(meal)
    const sample = counts.find((c) => c.mealCode === meal)
    return (
      <Card key={meal} size="small" title={<span><CoffeeOutlined /> {t(`meal.code.${meal}`)}</span>}
        extra={(
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <Tooltip title={t('meal.recountHint')}>
              <Button size="small" icon={<ReloadOutlined />} disabled={date.isAfter(dayjs(), 'day') || tooOld} loading={recount.isPending && recount.variables?.meal === meal && !recount.variables.send}
                onClick={() => recount.mutate({ meal, send: false })}>{t('meal.recount')}</Button>
            </Tooltip>
            <Popconfirm title={t('meal.resendAsk')} okText={t('meal.resend')} cancelText={t('req.cancel')} onConfirm={() => recount.mutate({ meal, send: true })} disabled={!isToday}>
              <Button size="small" icon={<MailOutlined />} disabled={!isToday} loading={recount.isPending && recount.variables?.meal === meal && recount.variables.send}>{t('meal.resend')}</Button>
            </Popconfirm>
          </span>
        )}>
        <Table<Line> size="small" rowKey="key" pagination={false} dataSource={rows}
          expandable={{ rowExpandable: (l) => l.departments.length > 0, expandedRowRender: (l) => (
            <div>
              <div style={{ marginBottom: 6 }}>{Object.entries(l.sources).map(([k, n]) => <Tag key={k}>{t(`meal.src.${k}`, { defaultValue: k })}: {n}</Tag>)}</div>
              {l.departments.map((d) => <Tag key={d.department} color="blue" variant="filled">{trData(d.department)}: {d.qty}</Tag>)}
            </div>
          ) }}
          columns={[
            { title: t('meal.site'), dataIndex: 'site', render: (s: MealSite) => <b>{t(`meal.siteName.${s}`)}</b> },
            { title: t('meal.serve'), dataIndex: 'serve' },
            { title: t('meal.group'), dataIndex: 'group', render: (g: MealGroup) => t(`meal.groupName.${g}`) },
            { title: t(manual ? 'meal.registered' : 'meal.auto'), dataIndex: 'auto', align: 'right', render: (v: number | null) => (v === null ? <Typography.Text type="secondary">—</Typography.Text> : v) },
            { title: t('meal.adjust'), dataIndex: 'adjust', align: 'right', render: (v: number, l) => (
              <Button size="small" type="link" onClick={() => openAdd(meal, l.site, l.group)}>{v > 0 ? `+${v}` : v === 0 ? '+' : v}</Button>
            ) },
            { title: t('meal.total'), key: 'total', align: 'right', render: (_: unknown, l) => <b>{(l.auto ?? 0) + l.adjust}</b> },
          ]} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {sample ? t('meal.computedAt', { time: dayjs(sample.computedAt).format('HH:mm DD/MM') }) : t('meal.notYet')}
          {sample?.sentAt ? ` · ${t('meal.sentAt', { time: dayjs(sample.sentAt).format('HH:mm') })}` : ''}
        </Typography.Text>
      </Card>
    )
  }

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CoffeeOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.meals')} subtitle={t('nav.mealsDesc')} />
      <StatTiles items={MEAL_CODES.map((m, i) => ({ label: t(`meal.code.${m}`), value: `${totalOf(m, 'BN')} / ${totalOf(m, 'HY')}`, color: ['#F59E0B', '#2E9E4F', '#2563eb', '#6D5BD0'][i] }))} />
      <Alert type="info" showIcon title={t(manual ? 'meal.manualNote' : 'meal.note')} style={{ marginBottom: 16 }} />
      <div className="dt-row" style={{ marginBottom: 12 }}>
        <DatePicker format="DD/MM/YYYY" allowClear={false} value={date} onChange={(v) => v && setDate(v)} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>{t('meal.addAdjust')}</Button>
        {board.isError && <Typography.Text type="danger">{t('req.err.generic')}</Typography.Text>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 16 }}>
        {MEAL_CODES.map(mealCard)}
      </div>

      <DataTable<MealAdjust> rowKey="id" loading={board.isLoading} dataSource={adjusts} pagination={false}
        toolbar={<Typography.Title level={5} style={{ margin: 0 }}>{t('meal.adjustList')}</Typography.Title>}
        locale={{ emptyText: t('meal.noAdjust') }}
        columns={[
          { title: t('meal.meal'), dataIndex: 'mealCode', render: (m: MealCode) => t(`meal.code.${m}`) },
          { title: t('meal.site'), dataIndex: 'site', render: (s: MealSite) => t(`meal.siteName.${s}`) },
          { title: t('meal.group'), dataIndex: 'groupCode', render: (g: MealGroup) => t(`meal.groupName.${g}`) },
          { title: t('meal.qty'), dataIndex: 'qty', align: 'right', render: (v: number) => <b style={{ color: v < 0 ? '#D92D20' : '#2E9E4F' }}>{v > 0 ? `+${v}` : v}</b> },
          { title: t('meal.noteCol'), dataIndex: 'note' },
          { title: t('meal.by'), dataIndex: 'createdBy', render: (v: string, a) => `${v} · ${dayjs(a.createdAt).format('HH:mm DD/MM')}` },
          { title: '', width: 60, render: (_: unknown, a) => (
            <Popconfirm title={t('meal.deleteAsk')} okText={t('req.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(a.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ) },
        ]} />

      <AppModal open={adding} onClose={() => setAdding(false)} size="sm" icon={<PlusOutlined />} title={t('meal.addAdjust')} subtitle={date.format('DD/MM/YYYY')}
        onOk={() => form.validateFields().then((v) => add.mutate(v))} okText={t('meal.addOk')} okLoading={add.isPending}>
        <Form form={form} layout="vertical"
          onValuesChange={(c: Partial<AdjustValues>) => { if (c.site || c.meal) { const v = form.getFieldsValue(); form.setFieldValue('group', mealGroups(v.site, v.meal)[0]) } }}>
          <Form.Item name="meal" label={t('meal.meal')}><Radio.Group optionType="button" buttonStyle="solid" options={MEAL_CODES.map((m) => ({ value: m, label: t(`meal.code.${m}`) }))} /></Form.Item>
          <Form.Item name="site" label={t('meal.site')}><Radio.Group optionType="button" buttonStyle="solid" options={MEAL_SITES.map((s) => ({ value: s, label: t(`meal.siteName.${s}`) }))} /></Form.Item>
          <Form.Item name="group" label={t('meal.group')}>
            <Select options={mealGroups(formSite ?? 'BN', formMeal ?? 'lunch').map((g) => ({ value: g, label: t(`meal.groupName.${g}`) }))} />
          </Form.Item>
          <Form.Item name="qty" label={t('meal.qty')} extra={t('meal.qtyHint')} rules={[{ required: true }, { validator: (_, v: number) => (v && v !== 0 ? Promise.resolve() : Promise.reject(new Error(t('meal.err.qty')))) }]}>
            <InputNumber min={-2000} max={2000} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label={t('meal.noteCol')} rules={[{ max: 500 }]}><Input maxLength={500} placeholder={t('meal.notePh')} /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
