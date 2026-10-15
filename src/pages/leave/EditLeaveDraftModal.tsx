import { useEffect, useState } from 'react'
import { Alert, DatePicker, Descriptions, Input, InputNumber, Select, Skeleton, Space, Typography } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { AppModal } from '../../components/AppModal'
import { ApproverEmailWarning, approverOption, noEmailNames } from '../../components/ApproverEmailWarning'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { leave, lookups, type LeaveDraftRow } from '../../api/requests'
import { draftErrorText } from '../requests/EditDraftModal'
import { useToast } from '../../hooks/useToast'

const pick = (userId?: string) => (userId ? { userId } : undefined)

/** Sửa riêng đơn nghỉ phép nháp của MỘT nhân viên trong cửa sổ popup. */
export function EditLeaveDraftModal({ row, onClose }: { row: LeaveDraftRow | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()

  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [totalDays, setTotalDays] = useState<number | null>(null)
  const [shift, setShift] = useState<string>()
  const [timeIn, setTimeIn] = useState<string>()
  const [timeOut, setTimeOut] = useState<string>()
  const [reasonCode, setReasonCode] = useState<string>()
  const [other, setOther] = useState('')
  const [person, setPerson] = useState('')
  const [ap, setAp] = useState<(string | undefined)[]>([undefined, undefined, undefined, undefined])
  const [error, setError] = useState('')

  const long = 10 * 60 * 1000
  const draft = useQuery({ queryKey: ['req', 'leave-draft', row?.id], queryFn: () => leave.draft(row!.id), enabled: !!row, gcTime: 0 })
  const shifts = useQuery({ queryKey: ['req', 'shifts'], queryFn: lookups.shifts, staleTime: long })
  const reasons = useQuery({ queryKey: ['req', 'leave-reasons'], queryFn: leave.reasons, staleTime: long })
  const times = useQuery({ queryKey: ['req', 'times', 'finger', shift], queryFn: () => lookups.times('finger', shift!), enabled: !!shift, staleTime: long })
  const approvers = useQuery({ queryKey: ['req', 'approvers', row?.department], queryFn: () => lookups.approvers(row!.department!), enabled: !!row?.department, staleTime: 60000 })

  useEffect(() => {
    const d = draft.data
    if (!d) return
    setRange([dayjs(d.date), dayjs(d.dateTo ?? d.date)]); setTotalDays(d.totalDays ? Number(d.totalDays.replace(',', '.')) : null)
    setShift(d.shift); setTimeIn(d.timeFrom); setTimeOut(d.timeTo); setReasonCode(d.reasonCode ?? undefined)
    setPerson(d.personTakeJob ?? ''); setOther(d.reasonText ?? ''); setError('')
    setAp([0, 1, 2, 3].map((i) => d.approverIds[i] || undefined))
  }, [draft.data])

  const approverOptions = (approvers.data ?? []).map(approverOption)
  const optionsFor = (current?: string) => (current && !approverOptions.some((o) => o.value === current) ? [...approverOptions, { value: current, label: current }] : approverOptions)
  const timeOptions = (list?: string[]) => (list ?? []).map((x) => ({ value: x, label: x }))

  const daysOk = totalDays != null && totalDays > 0 && (Number.isInteger(totalDays) || totalDays === 0.5)
  const canSave = !!range && daysOk && !!shift && !!timeIn && !!timeOut && !!reasonCode && !!person.trim() && ap.some(Boolean)

  const save = useMutation({
    mutationFn: () => leave.updateDraft(row!.id, {
      employeeIds: [], from: range![0].format('YYYY-MM-DD'), to: range![1].format('YYYY-MM-DD'), totalDays: totalDays!, shift: shift!,
      timeIn: timeIn!, timeOut: timeOut!, reasonCode: reasonCode!, otherReason: other.trim() || undefined, personTakeJob: person.trim(),
      approvers: { one: pick(ap[0]), two: pick(ap[1]), three: pick(ap[2]), four: pick(ap[3]) },
    }),
    onSuccess: () => { msg.success(t('req.editSaved')); qc.invalidateQueries({ queryKey: ['req', 'leave-drafts'] }); onClose() },
    onError: (e) => setError(draftErrorText(e, t)),
  })

  const full = { width: '100%' }
  return (
    <AppModal open={!!row} onClose={onClose} size="md" icon={<EditOutlined />} title={t('req.editTitle')} subtitle={row ? `${row.employeeId} – ${row.fullName}` : undefined}
      onOk={() => save.mutate()} okText={t('req.saveChanges')} okDisabled={!canSave || draft.isLoading} okLoading={save.isPending}>
      {draft.isLoading ? <Skeleton active /> : draft.isError ? <Alert type="error" showIcon title={t('req.err.generic')} /> : (
        <Space orientation="vertical" style={full} size={12}>
          <Descriptions size="small" column={2} items={[
            { key: 'e', label: t('att.empId'), children: row?.employeeId },
            { key: 'd', label: t('att.dept'), children: row?.department },
          ]} />
          <DatePicker.RangePicker style={full} format="DD/MM/YYYY" value={range}
            onChange={(v) => { if (v?.[0] && v?.[1]) { setRange([v[0], v[1]]); setTotalDays(v[1].diff(v[0], 'day') + 1) } }} allowClear={false} />
          <Space.Compact style={full}>
            <InputNumber style={{ width: '60%' }} min={0.5} max={90} step={0.5} value={totalDays} onChange={setTotalDays} addonBefore={t('leave.totalDays')} status={totalDays != null && !daysOk ? 'error' : undefined} />
            <Select style={{ width: '40%' }} placeholder={t('att.shift')} value={shift} loading={shifts.isLoading}
              onChange={(v) => { setShift(v); setTimeIn(undefined); setTimeOut(undefined) }} options={(shifts.data ?? []).map((s) => ({ value: s.value, label: s.label }))} />
          </Space.Compact>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: -6 }}>{t('leave.totalDaysHint')}</Typography.Text>
          <Space.Compact style={full}>
            <Select style={{ width: '50%' }} showSearch placeholder={t('req.timeIn')} value={timeIn} onChange={setTimeIn} disabled={!shift} options={timeOptions(times.data?.start)} />
            <Select style={{ width: '50%' }} showSearch placeholder={t('req.timeOut')} value={timeOut} onChange={setTimeOut} disabled={!shift} options={timeOptions(times.data?.end)} />
          </Space.Compact>
          <Select style={full} placeholder={t('leave.reasonSelect')} value={reasonCode} onChange={setReasonCode} loading={reasons.isLoading}
            options={(reasons.data ?? []).map((r) => ({ value: r.value, label: r.label }))} />
          <Input.TextArea rows={2} maxLength={500} value={person} onChange={(e) => setPerson(e.target.value)} placeholder={t('leave.personTakeJob')} />
          <Input.TextArea rows={2} maxLength={500} value={other} onChange={(e) => setOther(e.target.value)} placeholder={t('leave.otherReason')} />
          <Typography.Text strong>{t('req.sectionApprovers')}</Typography.Text>
          {[t('req.approverOne'), t('req.approverTwo'), t('req.approverThree'), t('leave.approverFour')].map((label, i) => (
            <Select key={i} style={full} allowClear showSearch optionFilterProp="label" placeholder={label} value={ap[i]}
              onChange={(v) => setAp((p) => p.map((x, j) => (j === i ? v : x)))} options={optionsFor(ap[i])} />
          ))}
          <ApproverEmailWarning names={noEmailNames(approvers.data, ap)} />
          {error && <Alert type="error" showIcon title={error} />}
        </Space>
      )}
    </AppModal>
  )
}
