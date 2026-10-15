import { useEffect, useState } from 'react'
import { Alert, Button, Collapse, Dropdown, Input, InputNumber, Select, Skeleton, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { DeleteOutlined, DownOutlined, EditOutlined, FileAddOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { closingAuto, type ClosingAutoRow, type ClosingDay } from '../../api/closingAuto'
import { CLOSED_FIELDS } from '../../api/closedAttendance'
import { payroll, payrollError } from '../../api/payroll'
import { CLOSING_AUTO_DIRECT } from '../../config/features'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

type Num = Record<string, number | null>
type ItemRow = { key: string | null; value: number | null }

/** Mọi cột chốt công đều sửa được (HR nhập tay khi tự tính thiếu: chưa có đơn tăng ca, quên vân tay, đi công tác, người mới chưa có vân tay…). Thứ tự: chính thức, tổng hợp, rồi thử việc. */
const EDITABLE = [
  ...CLOSED_FIELDS.filter((f) => f.group === 'official').map((f) => f.key),
  ...CLOSED_FIELDS.filter((f) => f.group === 'summary').map((f) => f.key),
  ...CLOSED_FIELDS.filter((f) => f.group === 'probation').map((f) => f.key),
]

/** Số giờ cộng cho mỗi ngày đi công tác (một ngày công = 8 giờ). */
const TRIP_HOURS = 8

/** Chi tiết từng ngày của người đang sửa: tải khi mở mục. Tô đỏ ngày vắng không đơn, cam ngày OT tính ít hơn đăng ký (HR soát rồi nhập tay ở trên nếu cần). */
function DayDetail({ token, employeeId, onTrip, onOtByReg }: { token: string; employeeId: string; onTrip: (days: ClosingDay[]) => void; onOtByReg: (days: ClosingDay[]) => void }) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string[]>([])
  const q = useQuery({ queryKey: ['closing-auto', 'days', token, employeeId], queryFn: () => closingAuto.days(token, employeeId), retry: false, gcTime: 0 })
  const kindKey = (k: string) => (k === 'Ngày Lễ' ? 'holiday' : k === 'Ngày nghỉ' ? 'off' : 'work')
  const num = (v: number) => (v ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '')
  const note = (r: ClosingDay) => [
    r.absent && t('cad.absent'),
    r.status === 'Đã đăng ký vân tay' && t('cad.manual'),
    r.forms >= 2 && t('cad.multiForms', { n: r.forms }),
    r.otRegs >= 2 && t('cad.multiOt', { n: r.otRegs }),
    r.hungYen && t('cad.hungYen'),
    r.businessTrip && t('cad.businessTrip'),
    r.otRegistered - r.ot > 2 && t('cad.otShort', { reg: num(r.otRegistered), ot: num(r.ot) }),
  ].filter(Boolean).join(' · ')
  const rows = q.data ?? []
  const sel = rows.filter((r) => picked.includes(r.date))
  const otSel = sel.filter((r) => r.otRegistered - r.ot > 0)
  return (
    <>
    <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button size="small" disabled={sel.length === 0} onClick={() => { onTrip(sel); setPicked([]) }}>{t('cad.tripBtn', { n: sel.length, h: sel.length * TRIP_HOURS })}</Button>
      <Button size="small" disabled={otSel.length === 0} onClick={() => { onOtByReg(otSel); setPicked([]) }}>{t('cad.otBtn', { n: otSel.length })}</Button>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('cad.pickHint')}</Typography.Text>
    </div>
    <Table<ClosingDay>
      size="small" rowKey="date" loading={q.isLoading} dataSource={rows} pagination={false} scroll={{ x: 900, y: 320 }}
      rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as string[]) }}
      locale={{ emptyText: q.isError ? t('car.edit.errRange') : t('cad.empty') }}
      rowClassName={(r) => (r.absent ? 'car-day-absent' : r.otRegistered - r.ot > 2 ? 'car-day-short' : '')}
      columns={[
        { title: t('cad.date'), width: 96, render: (_: unknown, r) => <b>{dayjs(r.date).format('DD/MM ddd')}</b> },
        { title: t('cad.kind'), width: 90, render: (_: unknown, r) => <Tag variant="filled" color={r.dayKind === 'Ngày Lễ' ? 'red' : r.dayKind === 'Ngày nghỉ' ? 'blue' : undefined}>{t(`cad.kind_${kindKey(r.dayKind)}`)}</Tag> },
        { title: t('cad.inOut'), width: 110, align: 'center', render: (_: unknown, r) => (r.timeIn || r.timeOut ? `${r.timeIn ?? '—'} → ${r.timeOut ?? '—'}` : '') },
        { title: t('cad.dayH'), dataIndex: 'dayHours', width: 70, align: 'right', render: num },
        { title: t('cad.nightH'), dataIndex: 'nightHours', width: 70, align: 'right', render: num },
        { title: t('cad.ot'), dataIndex: 'ot', width: 70, align: 'right', render: num },
        { title: t('cad.otReg'), dataIndex: 'otRegistered', width: 90, align: 'right', render: num },
        { title: t('cad.leave'), dataIndex: 'leave', width: 70, align: 'right', render: num },
        { title: t('cad.note'), render: (_: unknown, r) => <span style={{ fontSize: 12 }}>{note(r)}</span> },
        {
          title: '', width: 110, fixed: 'right',
          render: (_: unknown, r) => (
            <Dropdown trigger={['click']} menu={{
              items: [
                { key: '/finger-forms', label: t('cad.formFinger') },
                { key: '/overtime', label: t('cad.formOt') },
                { key: '/leave', label: t('cad.formLeave') },
              ],
              onClick: ({ key }) => window.open(`${key}?employee=${encodeURIComponent(employeeId)}&date=${r.date}`, '_blank', 'noopener'),
            }}>
              <Button size="small" icon={<FileAddOutlined />} title={t('cad.formHint')}>{t('cad.createForm')} <DownOutlined /></Button>
            </Dropdown>
          ),
        },
      ]}
    />
    </>
  )
}

/** Sửa một người trên bản tự tổng hợp: ghi đè giờ công, nhập khoản riêng của tháng, ghi đè kết quả một dòng lương, kèm ghi chú. */
export function ClosingAutoEdit({ token, row, onClose, onSaved }: { token: string; row: ClosingAutoRow | null; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const [closing, setClosing] = useState<Num>({})
  const [inputs, setInputs] = useState<Num>({})
  const [items, setItems] = useState<ItemRow[]>([])
  const [note, setNote] = useState('')

  const detail = useQuery({ queryKey: ['closing-auto', 'detail', token, row?.employeeId], queryFn: () => closingAuto.detail(token, row!.employeeId), enabled: !!row, retry: false, gcTime: 0 })
  const cfg = useQuery({ queryKey: ['payroll', 'config'], queryFn: () => payroll.config(), enabled: !!row, staleTime: 5 * 60 * 1000 })
  const version = cfg.data?.versions?.[cfg.data.versions.length - 1]
  const monthlyInputs = CLOSING_AUTO_DIRECT ? (version?.config.inputs ?? []).filter((i) => i.persist === false) : []
  const payItems = (version?.config.items ?? []).filter((i) => i.kind === 'income' || i.kind === 'deduction')

  useEffect(() => {
    const a = detail.data?.adjustment
    setClosing({ ...(a?.closing ?? {}) }); setInputs({ ...(a?.inputs ?? {}) })
    setItems(Object.entries(a?.items ?? {}).map(([key, value]) => ({ key, value })))
    setNote(a?.note ?? '')
  }, [detail.data])

  const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 2 }))
  const label = (key: string) => {
    const f = CLOSED_FIELDS.find((x) => x.key === key)
    return f ? `${t(`cls.f.${f.label}`)}${key.endsWith('CT') ? ' (CT)' : key.endsWith('TV') ? ' (TV)' : ''}` : key
  }
  const compact = (m: Num) => Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)) as Record<string, number>

  const save = useMutation({
    mutationFn: (clear: boolean) => closingAuto.adjust(token, row!.employeeId, clear
      ? { closing: {}, inputs: {}, items: {}, note: null }
      : { closing: compact(closing), inputs: compact(inputs), items: Object.fromEntries(items.filter((i) => i.key && i.value != null).map((i) => [i.key!, i.value!])), note: note.trim() || null }),
    onSuccess: () => { msg.success(t('car.edit.saved')); onSaved() },
    onError: (e) => { const { code } = payrollError(e); msg.error(code === 'locked' ? t('car.edit.errLocked') : code === 'table_missing' ? t('car.edit.errTable') : code === 'expired' ? t('cls.err.expired') : t('car.edit.errRange')) },
  })

  const auto = detail.data?.auto ?? {}
  const hr = detail.data?.hr ?? {}
  const usedItems = new Set(items.map((i) => i.key))
  const dmy = (d: string) => dayjs(d).format('DD/MM')
  /** Cộng giờ vào một cột: lấy số đang nhập, chưa nhập thì lấy số tự tính. */
  const addTo = (key: string, hours: number) => setClosing((s) => ({ ...s, [key]: Math.round(((s[key] ?? auto[key] ?? 0) + hours) * 2) / 2 }))
  const addNote = (text: string) => setNote((n) => (n ? `${n}; ${text}` : text).slice(0, 300))
  // Đi công tác: mỗi ngày cộng 8 giờ vào tổng giờ ca ngày (HR cộng tay như chốt công hiện nay)
  const trip = (days: ClosingDay[]) => {
    addTo('tongGioCaNgayCT', days.length * TRIP_HOURS)
    // Ngày vắng không đơn được tính 9 giờ "nghỉ không phép": đi công tác thì bỏ phần đó (và thưởng chuyên cần được xét lại)
    const absent = days.filter((x) => x.absent).length
    if (absent > 0 && (auto.nghiKhongLuongKhongPhep ?? 0) > 0) setClosing((s) => ({ ...s, nghiKhongLuongKhongPhep: Math.max(0, (s.nghiKhongLuongKhongPhep ?? auto.nghiKhongLuongKhongPhep ?? 0) - absent * 9) }))
    addNote(t('cad.tripNote', { n: days.length, d: days.slice(0, 6).map((x) => dmy(x.date)).join(', ') })) }
  // OT theo đơn đăng ký (HR có bằng chứng ngoài vân tay): cộng phần đơn nhiều hơn số tính ra vào cột ngày của loại ngày đó; ca đêm thì HR sửa lại cột
  const otByReg = (days: ClosingDay[]) => {
    const add: Record<string, number> = {}
    for (const d of days) {
      const col = d.dayKind === 'Ngày Lễ' ? 'tangCaNgayLeCT' : d.dayKind === 'Ngày nghỉ' ? 'tangCaNgayChuNhatCT' : 'tangCaNgayTruoc22hCT'
      add[col] = (add[col] ?? 0) + (d.otRegistered - d.ot)
    }
    Object.entries(add).forEach(([k, h]) => addTo(k, h))
    addNote(t('cad.otNote', { n: days.length, d: days.slice(0, 6).map((x) => dmy(x.date)).join(', ') }))
  }
  const diffKeys = EDITABLE.filter((k) => hr[k] != null && Math.abs((hr[k] ?? 0) - (auto[k] ?? 0)) > 0.01)

  return (
    <AppModal open={!!row} onClose={onClose} size="lg" icon={<EditOutlined />} title={t('car.edit.title')} subtitle={row ? `${row.employeeId} – ${row.fullName}` : undefined}
      onOk={() => save.mutate(false)} okLoading={save.isPending} okText={t('car.edit.save')}
      extra={detail.data?.adjustment ? <Button danger icon={<DeleteOutlined />} loading={save.isPending} onClick={() => save.mutate(true)}>{t('car.edit.clear')}</Button> : undefined}>
      {detail.isLoading || !detail.data ? <Skeleton active /> : (
        <div className="car-edit">
          <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('car.edit.help')} />
          {detail.data.issues.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {detail.data.issues.map((i) => <Tag key={i.code} color="gold">{t(`car.issue.${i.code}`)}{i.detail ? `: ${i.detail}` : ''}</Tag>)}
            </div>
          )}

          <Collapse ghost size="small" style={{ marginBottom: 8 }} destroyOnHidden
            items={[{ key: 'days', label: <b>{t('cad.title')}</b>, children: <DayDetail token={token} employeeId={row!.employeeId} onTrip={trip} onOtByReg={otByReg} /> }]} />

          <Typography.Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {t('car.edit.secClosing')}
            {diffKeys.length > 0 && <Button size="small" onClick={() => setClosing((s) => ({ ...s, ...Object.fromEntries(diffKeys.map((k) => [k, hr[k]])) }))}>{t('cad.applyHr', { n: diffKeys.length })}</Button>}
          </Typography.Title>
          <div className="car-edit-grid">
            {EDITABLE.map((k) => (
              <label key={k} className="car-edit-field">
                <span>{label(k)}</span>
                <InputNumber style={{ width: '100%' }} min={0} max={100000000} step={0.5} value={closing[k] ?? null} placeholder={fmt(auto[k])} onChange={(v) => setClosing((s) => ({ ...s, [k]: v }))} />
                <small>{t('car.edit.auto')}: {fmt(auto[k])}{hr[k] != null ? ` · HR: ${fmt(hr[k])}` : ''}
                  {hr[k] != null && Math.abs((hr[k] ?? 0) - (closing[k] ?? auto[k] ?? 0)) > 0.01 && <> · <a onClick={() => setClosing((s) => ({ ...s, [k]: hr[k] }))}>{t('cad.useHr')}</a></>}</small>
              </label>
            ))}
          </div>
          <Typography.Text type="secondary">{t('car.edit.closingHint')}</Typography.Text>

          {monthlyInputs.length > 0 && (
            <>
              <Typography.Title level={5} style={{ marginTop: 16 }}>{t('car.edit.secInputs')}</Typography.Title>
              <div className="car-edit-grid">
                {monthlyInputs.map((i) => (
                  <label key={i.key} className="car-edit-field">
                    <span>{i.label}</span>
                    <InputNumber style={{ width: '100%' }} value={inputs[i.key] ?? null} placeholder={fmt(i.default)} onChange={(v) => setInputs((s) => ({ ...s, [i.key]: v }))}
                      formatter={(v) => (v == null ? '' : Number(v).toLocaleString('en-US'))} parser={(v) => Number(String(v ?? '').replace(/,/g, '')) as never} />
                  </label>
                ))}
              </div>
            </>
          )}

          {CLOSING_AUTO_DIRECT && <>
          <Typography.Title level={5} style={{ marginTop: 16 }}>{t('car.edit.secItems')}</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>{t('car.edit.itemsHint')}</Typography.Paragraph>
          {items.map((it, idx) => (
            <div key={idx} className="car-edit-item">
              <Select showSearch style={{ flex: 1, minWidth: 0 }} value={it.key} placeholder={t('car.edit.pickItem')} optionFilterProp="label"
                options={payItems.filter((p) => p.key === it.key || !usedItems.has(p.key)).map((p) => ({ value: p.key, label: p.label }))}
                onChange={(v) => setItems((s) => s.map((x, i) => (i === idx ? { ...x, key: v } : x)))} />
              <InputNumber style={{ width: 180 }} value={it.value} placeholder={t('car.edit.itemValue')} onChange={(v) => setItems((s) => s.map((x, i) => (i === idx ? { ...x, value: v } : x)))}
                formatter={(v) => (v == null ? '' : Number(v).toLocaleString('en-US'))} parser={(v) => Number(String(v ?? '').replace(/,/g, '')) as never} />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setItems((s) => s.filter((_, i) => i !== idx))} />
            </div>
          ))}
          <Button icon={<PlusOutlined />} onClick={() => setItems((s) => [...s, { key: null, value: null }])}>{t('car.edit.addItem')}</Button>
          </>}

          <Typography.Title level={5} style={{ marginTop: 16 }}>{t('car.edit.note')}</Typography.Title>
          <Input.TextArea rows={2} maxLength={300} showCount value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('car.edit.notePlaceholder')} />
          {detail.data.adjustment?.updatedBy && <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>{t('car.edit.by', { by: detail.data.adjustment.updatedBy })}</Typography.Text>}
        </div>
      )}
    </AppModal>
  )
}
