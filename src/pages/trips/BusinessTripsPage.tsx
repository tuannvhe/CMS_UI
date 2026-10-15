import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Input, Popconfirm, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, DeleteOutlined, PlusOutlined, CompassOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { BUSINESS_TRIP_TABLE_SQL, businessTrips, type BusinessTripEntry, type BusinessTripMe } from '../../api/businessTrips'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { DeptField, PeoplePicker, useDepartments } from './HungYenPage'

const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
const days = (e: BusinessTripEntry) => dayjs(e.to).diff(dayjs(e.from), 'day') + 1

/** Modal đăng ký một đợt công tác: chọn bộ phận, người đi, từ ngày – đến ngày, nơi công tác và lý do. */
function RegisterModal({ open, onClose, me, onSaved }: { open: boolean; onClose: () => void; me: BusinessTripMe; onSaved: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(me.today), dayjs(me.today)])
  const [dept, setDept] = useState<string>()
  const [picked, setPicked] = useState<string[]>([])
  const [destination, setDestination] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) { setRange([dayjs(me.today), dayjs(me.today)]); setPicked([]); setDestination(''); setReason('') } }, [open, me.today])

  const { people, departments } = useDepartments(me, open)
  const current = dept ?? departments[0]
  const deptPeople = (people.data ?? []).filter((p) => same(p.department, current))
  const nDays = range[1].diff(range[0], 'day') + 1

  const save = useMutation({
    mutationFn: () => businessTrips.register({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), employeeIds: picked, destination: destination.trim(), reason: reason.trim() }),
    onSuccess: (r) => {
      if (r.added > 0) msg.success(r.pending ? t('bt.sentPending', { n: r.added }) : t('bt.saved', { n: r.added }))
      if (r.skipped.length > 0) msg.warning(t('bt.skipped', { ids: r.skipped.join(', ') }))
      if (r.added > 0) { onSaved(); onClose() }
    },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`bt.err.${code === 'table_missing' ? 'table_missing' : detail}`, { defaultValue: t('usr.err.generic') })) },
  })

  return (
    <AppModal open={open} onClose={onClose} size="lg" icon={<CompassOutlined />} title={t('bt.registerTitle')} subtitle={me.all ? t('bt.hrSub') : t('bt.headSub')}
      onOk={() => save.mutate()} okLoading={save.isPending} okText={me.all ? t('bt.save') : t('bt.send')} okDisabled={picked.length === 0 || reason.trim().length < 3}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <div className="cell-muted" style={{ marginBottom: 4 }}>{t('bt.dates')}</div>
          <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
          <span className="cell-muted" style={{ marginInlineStart: 8 }}>{t('bt.daysN', { n: nDays })}</span>
        </div>
        <DeptField departments={departments} value={current} onChange={(v) => { setDept(v); setPicked([]) }} loading={people.isLoading} />
        <PeoplePicker people={deptPeople} picked={picked} onChange={setPicked} loading={people.isLoading} />
        <Input value={destination} maxLength={200} onChange={(e) => setDestination(e.target.value)} placeholder={t('bt.destination')} />
        <Input.TextArea value={reason} rows={2} maxLength={300} showCount onChange={(e) => setReason(e.target.value)} placeholder={t('bt.reason')} />
        <Alert type="info" showIcon title={t('bt.help', { h: me.hoursPerDay })} />
      </Space>
    </AppModal>
  )
}

/** Đăng ký công tác: một đợt = người đi + từ ngày – đến ngày. Đợt đã xác nhận được bảng công tự cộng giờ công (ngày thường không vân tay), chốt công tự động không phải cộng tay. */
export default function BusinessTripsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['business-trips', 'me'], queryFn: businessTrips.me, retry: false })
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs().add(30, 'day')])
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const ready = !!me.data?.ready && !!me.data?.canRegister
  const list = useQuery({ queryKey: ['business-trips', 'list', from, to], queryFn: () => businessTrips.list(from, to), enabled: ready, retry: false })
  const rows = list.data ?? []
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['business-trips'] }); void qc.invalidateQueries({ queryKey: ['attendance'] }); setPicked([]) }
  const errText = (e: unknown) => { const { detail } = adminError(e); return t(`bt.err.${detail}`, { defaultValue: t('usr.err.generic') }) }

  const confirm = useMutation({ mutationFn: (ids: number[]) => businessTrips.confirm(ids), onSuccess: (r) => { msg.success(t('bt.confirmed', { n: r.confirmed })); refresh() }, onError: (e) => msg.error(errText(e)) })
  const remove = useMutation({ mutationFn: (ids: number[]) => businessTrips.remove(ids), onSuccess: (r) => { msg.success(t('bt.deleted', { n: r.deleted })); refresh() }, onError: (e) => msg.error(errText(e)) })

  const pending = rows.filter((r) => r.status === 'pending')
  const isAdmin = !!me.data?.all
  const columns: ColumnsType<BusinessTripEntry> = useMemo(() => [
    { title: t('bt.person'), width: 220, render: (_: unknown, r) => <div style={{ lineHeight: 1.3 }}><b>{r.employeeName}</b><div className="cell-muted">{r.employeeId} · {r.department ?? ''}</div></div> },
    { title: t('bt.period'), width: 190, render: (_: unknown, r) => <span>{dayjs(r.from).format('DD/MM/YYYY')}{r.to !== r.from ? ` → ${dayjs(r.to).format('DD/MM/YYYY')}` : ''} <span className="cell-muted">({t('bt.daysN', { n: days(r) })})</span></span> },
    { title: t('bt.destination'), dataIndex: 'destination', ellipsis: true, width: 160 },
    { title: t('bt.reasonCol'), dataIndex: 'reason', ellipsis: true },
    { title: t('bt.status'), width: 130, render: (_: unknown, r) => <Tag color={r.status === 'confirmed' ? 'success' : 'warning'} variant="filled">{t(`bt.st.${r.status}`)}</Tag> },
    { title: t('bt.by'), dataIndex: 'registeredBy', width: 110 },
    {
      title: '', width: 120, fixed: 'right',
      render: (_: unknown, r) => (isAdmin || r.status === 'pending') && (
        <Popconfirm title={t('bt.deleteAsk')} okText={t('bt.delete')} cancelText={t('req.cancel')} onConfirm={() => remove.mutate([r.id])}>
          <Button size="small" danger type="text" icon={<DeleteOutlined />}>{isAdmin ? t('bt.delete') : t('bt.withdraw')}</Button>
        </Popconfirm>
      ),
    },
  ], [t, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CompassOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.businessTrips')} subtitle={t('nav.businessTripsDesc')} />
      {me.data && !me.data.canRegister && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('bt.noRight')} />}
      {me.data?.canRegister && !me.data.ready && <SqlNotReady title={t('bt.tableTitle')} sql={BUSINESS_TRIP_TABLE_SQL} onRetry={() => me.refetch()} loading={me.isFetching} />}
      {ready && me.data && (
        <>
          <StatTiles items={[
            { label: t('bt.tileTrips'), value: rows.length },
            { label: t('bt.tilePending'), value: pending.length, color: pending.length ? '#D48806' : undefined },
            { label: t('bt.tileConfirmed'), value: rows.length - pending.length, color: '#2E9E4F' },
          ]} />
          <DataTable<BusinessTripEntry>
            rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} scroll={{ x: 1000 }} pagination={{ pageSize: 25, showSizeChanger: false }}
            rowSelection={isAdmin ? { selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]), getCheckboxProps: (r) => ({ disabled: r.status !== 'pending' }) } : undefined}
            locale={{ emptyText: list.isError ? t('usr.err.generic') : t('bt.empty') }}
            toolbar={(
              <Space wrap>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('bt.register')}</Button>
                <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
                {isAdmin && (
                  <Popconfirm title={t('bt.confirmAsk', { n: picked.length })} okText={t('bt.confirm')} cancelText={t('req.cancel')} disabled={picked.length === 0} onConfirm={() => confirm.mutate(picked)}>
                    <Button icon={<CheckOutlined />} disabled={picked.length === 0} loading={confirm.isPending}>{t('bt.confirmSelected', { n: picked.length })}</Button>
                  </Popconfirm>
                )}
              </Space>
            )}
          />
          <RegisterModal open={open} onClose={() => setOpen(false)} me={me.data} onSaved={refresh} />
        </>
      )}
    </div>
  )
}
