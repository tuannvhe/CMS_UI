import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Col, DatePicker, Drawer, Form, Input, Row, Select, Skeleton, Space, TimePicker } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorKey, type HnApprover, type HnLevelRule, type HnPickEmployee, type HnRequestInput, type HnRequestKind, type HnRequestRules } from '../api/hn'

/* 2026-11-26 [Truong] - HN requests: shared create form (finger register, late/early, leave, overtime) */

const RULE_KEY: Record<HnRequestKind, keyof HnRequestRules['levelsFor']> = { overtime: 'overtime', leave: 'leave', 'finger-register': 'finger', 'late-early': 'lateEarly' }
const REASON_MAX: Record<HnRequestKind, number> = { overtime: 500, leave: 500, 'finger-register': 500, 'late-early': 50 }
const MODE_TYPE = { off: 'error', test: 'warning', live: 'info' } as const

interface Values {
  date?: Dayjs; range?: [Dayjs, Dayjs]; timeFrom?: Dayjs; timeTo?: Dayjs; shift?: string; reason?: string; handoverTo?: string
  employeeIds?: string[]; approvers?: (string | undefined)[]
}

/** Gõ để tìm (chờ 300 ms) rồi gọi máy chủ; giữ kết quả cũ trong lúc tải. */
function useDebounced(v: string, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => { const h = setTimeout(() => setD(v), ms); return () => clearTimeout(h) }, [v, ms])
  return d
}

function ApproverSelect({ value, onChange, exclude, placeholder }: { value?: string; onChange?: (v?: string) => void; exclude: string[]; placeholder: string }) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const r = useQuery({ queryKey: ['hn', 'approvers', dq], queryFn: () => hnApi.approvers(dq), staleTime: 60_000, retry: false })
  const [picked, setPicked] = useState<HnApprover | null>(null)
  const options = useMemo(() => {
    const list = [...(r.data ?? [])]
    if (picked && picked.id === value && !list.some((a) => a.id === picked.id)) list.unshift(picked)
    return list
      .filter((a) => a.id === value || !exclude.some((x) => x.toLowerCase() === a.id.toLowerCase()))
      .map((a) => ({ value: a.id, label: `${a.name ?? a.id} (${a.id})${a.department ? ` · ${a.department}` : ''}`, a }))
  }, [r.data, exclude, value, picked])
  return (
    <Select showSearch allowClear value={value} placeholder={placeholder} filterOption={false} loading={r.isFetching} onSearch={setQ}
      onChange={(v, opt) => { setPicked((opt as { a?: HnApprover } | undefined)?.a ?? null); onChange?.(v) }} options={options} />
  )
}

function EmployeesSelect({ value, onChange, onPicked, dept }: { value?: string[]; onChange?: (v: string[]) => void; onPicked: (list: HnPickEmployee[]) => void; dept?: string }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const r = useQuery({ queryKey: ['hn', 'otEmployees', dq, dept ?? ''], queryFn: () => hnApi.otEmployees(dq, dept), staleTime: 60_000, retry: false })
  const [known, setKnown] = useState<Record<string, HnPickEmployee>>({})
  useEffect(() => { if (r.data) setKnown((k) => { const n = { ...k }; r.data.forEach((e) => { n[e.id] = e }); return n }) }, [r.data])
  const options = useMemo(() => {
    const ids = new Set((r.data ?? []).map((e) => e.id))
    const extra = (value ?? []).filter((id) => !ids.has(id) && known[id]).map((id) => known[id])
    return [...extra, ...(r.data ?? [])].map((e) => ({ value: e.id, label: `${e.name ?? e.id} (${e.id})${e.isOp ? ' · OP' : ''}` }))
  }, [r.data, value, known])
  return (
    <Select mode="multiple" showSearch allowClear value={value} filterOption={false} loading={r.isFetching} onSearch={setQ} maxTagCount="responsive"
      placeholder={t('hn.reqForm.employeesPh')} options={options}
      onChange={(v: string[]) => { onChange?.(v); onPicked(v.map((id) => known[id]).filter(Boolean)) }} />
  )
}

/** Ngăn bên tạo đơn HN. Mọi giá trị tính toán (số giờ, thứ, tên người duyệt) đều do máy chủ tính lại; ở đây chỉ để xem trước. */
export function HnRequestForm({ kind, open, onClose }: { kind: HnRequestKind; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<Values>()
  const rules = useQuery({ queryKey: ['hn', 'requestRules'], queryFn: hnApi.requestRules, enabled: open, staleTime: 60_000, retry: false })
  const [picked, setPicked] = useState<HnPickEmployee[]>([])
  const [dept, setDept] = useState<string | undefined>()
  const [err, setErr] = useState<string | null>(null)

  const deptOptions = useQuery({ queryKey: ['hn', 'otEmployees', '', ''], queryFn: () => hnApi.otEmployees('', ''), enabled: open && kind === 'overtime', staleTime: 300_000, retry: false })
  const departments = useMemo(() => [...new Set((deptOptions.data ?? []).map((e) => e.department).filter((d): d is string => !!d))].sort(), [deptOptions.data])

  const isOp = kind === 'overtime' ? picked.some((e) => e.isOp) : !!rules.data?.me?.isOp
  const rule: HnLevelRule | undefined = rules.data?.levelsFor[RULE_KEY[kind]]
  const required = rule ? (isOp ? rule.op : rule.standard) : 1
  const maxLevels = rule ? (isOp ? rule.maxOp : rule.maxStandard) : 1

  const approvers = Form.useWatch('approvers', form) ?? []
  const timeFrom = Form.useWatch('timeFrom', form)
  const timeTo = Form.useWatch('timeTo', form)
  const range = Form.useWatch('range', form)
  const employeeIds = Form.useWatch('employeeIds', form) ?? []

  useEffect(() => {
    if (!open) return
    form.resetFields(); setPicked([]); setDept(undefined); setErr(null)
    form.setFieldsValue(kind === 'leave' ? { range: [dayjs(), dayjs()], shift: 'S01' } : { date: dayjs(), shift: 'S01' })
  }, [open, kind, form])

  const duration = useMemo(() => {
    if (kind === 'leave') return range?.[0] && range[1] ? t('hn.reqForm.days', { n: range[1].startOf('day').diff(range[0].startOf('day'), 'day') + 1 }) : ''
    if (!timeFrom || !timeTo) return ''
    const m = timeTo.hour() * 60 + timeTo.minute() - (timeFrom.hour() * 60 + timeFrom.minute())
    return m > 0 ? t('hn.reqForm.minutes', { h: (m / 60).toFixed(2), m }) : ''
  }, [kind, range, timeFrom, timeTo, t])

  const mode = rules.data?.writeMode ?? 'off'
  const submit = useMutation({
    mutationFn: (body: HnRequestInput) => hnApi.createRequest(kind, body),
    onSuccess: (r) => {
      message.success(kind === 'overtime' ? t('hn.reqForm.submittedOt', { n: r.count }) : t('hn.reqForm.submitted'))
      void qc.invalidateQueries({ queryKey: ['hn', 'requests'] })
      onClose()
    },
    onError: (e) => setErr(t(hnErrorKey(e))),
  })

  const onFinish = (v: Values) => {
    setErr(null)
    const hm = (d?: Dayjs) => (d ? d.format('HH:mm') : undefined)
    const list = (v.approvers ?? []).slice(0, maxLevels).map((a) => a ?? null)
    while (list.length > 0 && list[list.length - 1] == null) list.pop()
    const body: HnRequestInput = {
      date: (kind === 'leave' ? v.range?.[0] : v.date)?.format('YYYY-MM-DD') ?? '',
      dateTo: kind === 'leave' ? v.range?.[1]?.format('YYYY-MM-DD') : undefined,
      timeFrom: hm(v.timeFrom), timeTo: hm(v.timeTo),
      shift: kind === 'late-early' ? undefined : v.shift,
      reason: (v.reason ?? '').trim(),
      handoverTo: kind === 'leave' ? v.handoverTo?.trim() || undefined : undefined,
      approvers: list,
      employeeIds: kind === 'overtime' ? v.employeeIds : undefined,
    }
    submit.mutate(body)
  }

  const timeRequired = kind !== 'leave'
  const labels = kind === 'finger-register' ? ['timeIn', 'timeOut'] : kind === 'overtime' ? ['start', 'end'] : kind === 'leave' ? ['timeIn', 'timeOut'] : ['from', 'to']
  const me = rules.data?.me
  const exclude = (i: number) => [...approvers.filter((a, j) => j !== i && !!a) as string[], ...(kind === 'overtime' ? employeeIds : me ? [me.id] : [])]

  return (
    <Drawer open={open} onClose={onClose} size={720} title={t(`hn.reqForm.title.${kind}`)} destroyOnHidden
      footer={(
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{t('hn.common.cancel')}</Button>
          <Button type="primary" loading={submit.isPending} disabled={mode === 'off' || !rules.data} onClick={() => form.submit()}>{t('hn.reqForm.submit')}</Button>
        </Space>
      )}>
      {rules.isLoading ? <Skeleton active paragraph={{ rows: 8 }} />
        : rules.isError ? <Alert type="error" showIcon title={t(hnErrorKey(rules.error))} action={<Button size="small" onClick={() => void rules.refetch()}>{t('hn.common.retry')}</Button>} />
        : (
          <>
            {mode !== 'live' && <Alert type={MODE_TYPE[mode]} showIcon style={{ marginBottom: 16 }} title={t(`hn.reqForm.mode.${mode}`)} />}
            {err && <Alert type="error" showIcon closable style={{ marginBottom: 16 }} title={err} onClose={() => setErr(null)} />}
            <Form<Values> form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">
              {kind === 'overtime' ? (
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item label={t('hn.reqForm.department')}>
                      <Select allowClear showSearch value={dept} onChange={setDept} options={departments.map((d) => ({ value: d, label: d }))} loading={deptOptions.isFetching} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={16}>
                    <Form.Item name="employeeIds" label={t('hn.reqForm.employees')} rules={[{ required: true, type: 'array', min: 1, message: t('hn.err.employees_required') }]}>
                      <EmployeesSelect dept={dept} onPicked={setPicked} />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <Form.Item label={t('hn.reqForm.me')}>
                  <Input readOnly value={me ? `${me.name ?? me.id} (${me.id})${me.department ? ` · ${me.department}` : ''}` : ''} />
                </Form.Item>
              )}

              <Row gutter={16}>
                <Col xs={24} md={kind === 'leave' ? 12 : 8}>
                  {kind === 'leave' ? (
                    <Form.Item name="range" label={`${t('hn.reqForm.fromDate')} – ${t('hn.reqForm.toDate')}`} rules={[{ required: true }]}>
                      <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} allowClear={false} />
                    </Form.Item>
                  ) : (
                    <Form.Item name="date" label={t('hn.reqForm.date')} rules={[{ required: true }]}>
                      <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} allowClear={false} />
                    </Form.Item>
                  )}
                </Col>
                <Col xs={12} md={kind === 'leave' ? 6 : 8}>
                  <Form.Item name="timeFrom" label={t(`hn.reqForm.${labels[0]}`)} rules={[{ required: timeRequired }]}>
                    <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={kind === 'leave' ? 6 : 8}>
                  <Form.Item name="timeTo" label={t(`hn.reqForm.${labels[1]}`)} dependencies={['timeFrom']}
                    rules={[{ required: timeRequired }, ({ getFieldValue }) => ({
                      validator: (_, v?: Dayjs) => {
                        const f = getFieldValue('timeFrom') as Dayjs | undefined
                        if (kind === 'leave' && !!f !== !!v) return Promise.reject(new Error(t('hn.err.invalid_time')))
                        return !f || !v || (kind === 'leave' && range && !range[0].isSame(range[1], 'day')) || v.hour() * 60 + v.minute() > f.hour() * 60 + f.minute()
                          ? Promise.resolve() : Promise.reject(new Error(t('hn.err.invalid_time')))
                      },
                    })]}>
                    <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                {kind !== 'late-early' && (
                  <Col xs={12} md={8}>
                    <Form.Item name="shift" label={t('hn.reqForm.shift')} rules={[{ required: true }]}>
                      <Select options={(rules.data?.shifts ?? []).map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` }))} />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={12} md={8}>
                  <Form.Item label={t('hn.reqForm.duration')}><Input readOnly value={duration} /></Form.Item>
                </Col>
                {kind === 'leave' && (
                  <Col xs={24} md={8}>
                    <Form.Item name="handoverTo" label={t('hn.reqForm.handover')}><Input maxLength={200} /></Form.Item>
                  </Col>
                )}
              </Row>

              <Form.Item name="reason" label={t('hn.reqForm.reason')} extra={t('hn.reqForm.reasonMax', { n: REASON_MAX[kind] })}
                rules={[{ required: true, whitespace: true, message: t('hn.err.reason_required') }, { max: REASON_MAX[kind], message: t('hn.err.reason_too_long') }]}>
                <Input.TextArea rows={3} maxLength={REASON_MAX[kind]} showCount />
              </Form.Item>

              {isOp && required > (rule?.standard ?? required) && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('hn.reqForm.opHint')} />}
              <Row gutter={16}>
                {Array.from({ length: maxLevels }, (_, i) => (
                  <Col xs={24} md={12} key={i}>
                    <Form.Item name={['approvers', i]} label={`${t('hn.reqForm.approverLevel', { n: i + 1 })}${i >= required ? ` ${t('hn.reqForm.optional')}` : ''}`}
                      rules={[{ required: i < required, message: t('hn.err.levels_required') }]}>
                      <ApproverSelect exclude={exclude(i)} placeholder={t('hn.reqForm.approverPh')} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form>
          </>
        )}
    </Drawer>
  )
}
