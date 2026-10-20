import { useEffect, useState } from 'react'
import { Alert, DatePicker, Descriptions, Input, Select, Skeleton, Space, Typography } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { AppModal } from '../../components/AppModal'
import { ApproverEmailWarning, approverOption, noEmailNames } from '../../components/ApproverEmailWarning'
import { ApproverChain, MIN_APPROVERS } from '../../components/ApproverChain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { apiErrorCode, lookups, requests, type DraftRow, type RequestKind } from '../../api/requests'
import { useToast } from '../../hooks/useToast'

const pick = (userId?: string) => (userId ? { userId } : undefined)

/** Chuyển lỗi máy chủ thành câu dễ hiểu (trùng đơn, thiếu người duyệt…). */
/** "2026-09-21 08:00 → 18:00" → "21/09/2026 08:00 → 18:00" */
export const otRangeText = (d?: string | null) => (d ?? '').replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1')

export function draftErrorText(e: unknown, t: (k: string, o?: Record<string, unknown>) => string): string {
  const { code, detail } = apiErrorCode(e)
  if (code === 'no_approver') return t('req.err.no_approver')
  if (code === 'not_found') return t('req.err.not_found')
  if (code === 'invalid_input') {
    const [reason, extra] = detail.split(': ')
    if (reason === 'overlap_ot') return t('req.skip.overlap_ot', { detail: otRangeText(extra) })
    if (reason === 'duplicate' || reason === 'overlap' || reason === 'employee_not_found') {
      return t(`req.skip.${reason}`, { detail: extra ? extra.split(' → ').map((d) => dayjs(d).format('DD/MM/YYYY')).join(' → ') : '' })
    }
    return `${t('req.err.invalid_input')}${detail ? ` (${detail})` : ''}`
  }
  return t('req.err.generic')
}

/** Sửa riêng đơn nháp của MỘT nhân viên (quên vân tay / tăng ca) trong cửa sổ popup. */
export function EditDraftModal({ kind, row, onClose }: { kind: RequestKind; row: DraftRow | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()

  const [date, setDate] = useState<Dayjs | null>(null)
  const [shift, setShift] = useState<string>()
  const [timeA, setTimeA] = useState<string>()
  const [timeB, setTimeB] = useState<string>()
  const [reasonCode, setReasonCode] = useState<string>()
  const [reasonText, setReasonText] = useState('')
  const [ap, setAp] = useState<(string | undefined)[]>([undefined, undefined, undefined])
  const [error, setError] = useState('')

  const long = 10 * 60 * 1000
  const draft = useQuery({ queryKey: ['req', 'draft', kind, row?.id], queryFn: () => requests.draft(kind, row!.id), enabled: !!row, gcTime: 0 })
  const shifts = useQuery({ queryKey: ['req', 'shifts'], queryFn: lookups.shifts, staleTime: long })
  const reasons = useQuery({ queryKey: ['req', 'reasons'], queryFn: lookups.fingerReasons, staleTime: long, enabled: kind === 'finger' })
  const times = useQuery({ queryKey: ['req', 'times', kind, shift], queryFn: () => lookups.times(kind, shift!), enabled: !!shift, staleTime: long })
  const approvers = useQuery({
    queryKey: ['req', 'approvers', row?.department], queryFn: () => lookups.approvers(row!.department!), enabled: !!row?.department, staleTime: 60000,
  })

  // Nạp nội dung đơn nháp vào form khi tải xong
  useEffect(() => {
    const d = draft.data
    if (!d) return
    setDate(dayjs(d.date)); setShift(d.shift); setTimeA(d.timeFrom); setTimeB(d.timeTo)
    setReasonCode(d.reasonCode ?? undefined); setReasonText(d.reasonText ?? '')
    setAp([0, 1, 2].map((i) => d.approverIds[i] || undefined)); setError('')
  }, [draft.data])

  const approverOptions = (approvers.data ?? []).map(approverOption)
  // Người duyệt đang lưu trong đơn nhưng không còn trong danh sách bộ phận (ví dụ đơn cũ lưu email) vẫn hiện để không bị mất
  const optionsFor = (current?: string) => (current && !approverOptions.some((o) => o.value === current) ? [...approverOptions, { value: current, label: current }] : approverOptions)

  const otherReason = kind === 'finger' && reasons.data?.find((r) => r.value === reasonCode)?.label === 'Lý do khác'
  const timeOptions = (list?: string[]) => (list ?? []).map((x) => ({ value: x, label: x }))
  const labelA = kind === 'finger' ? t('req.timeIn') : t('req.otFrom')
  const labelB = kind === 'finger' ? t('req.timeOut') : t('req.otTo')
  const reasonOk = kind === 'finger' ? !!reasonCode && (!otherReason || !!reasonText.trim()) : !!reasonText.trim()
  const canSave = !!date && !!shift && !!timeA && !!timeB && reasonOk && ap.filter(Boolean).length >= MIN_APPROVERS

  const save = useMutation({
    mutationFn: () => {
      const approvers = { one: pick(ap[0]), two: pick(ap[1]), three: pick(ap[2]) }
      const base = { employeeIds: [], date: date!.format('YYYY-MM-DD'), shift: shift!, approvers }
      return kind === 'finger'
        ? requests.updateDraft('finger', row!.id, { ...base, timeIn: timeA!, timeOut: timeB!, reasonCode: reasonCode!, reasonText: reasonText.trim() || undefined })
        : requests.updateDraft('overtime', row!.id, { ...base, timeStart: timeA!, timeEnd: timeB!, reasonText: reasonText.trim() })
    },
    onSuccess: () => { msg.success(t('req.editSaved')); qc.invalidateQueries({ queryKey: ['req', 'drafts', kind] }); onClose() },
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
          <Space.Compact style={full}>
            <DatePicker style={{ width: '50%' }} format="DD/MM/YYYY" value={date} onChange={setDate} placeholder={t('req.date')} allowClear={false} />
            <Select style={{ width: '50%' }} placeholder={t('att.shift')} value={shift} loading={shifts.isLoading}
              onChange={(v) => { setShift(v); setTimeA(undefined); setTimeB(undefined) }}
              options={(shifts.data ?? []).map((s) => ({ value: s.value, label: s.label }))} />
          </Space.Compact>
          <Space.Compact style={full}>
            <Select style={{ width: '50%' }} showSearch placeholder={labelA} value={timeA} onChange={setTimeA} disabled={!shift} options={timeOptions(times.data?.start)} />
            <Select style={{ width: '50%' }} showSearch placeholder={labelB} value={timeB} onChange={setTimeB} disabled={!shift} options={timeOptions(times.data?.end)} />
          </Space.Compact>
          {kind === 'finger' ? (
            <>
              <Select style={full} placeholder={t('req.reason')} value={reasonCode} onChange={setReasonCode} loading={reasons.isLoading}
                options={(reasons.data ?? []).map((r) => ({ value: r.value, label: r.label }))} />
              {otherReason && <Input.TextArea rows={2} value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder={t('req.reasonOtherPlaceholder')} />}
            </>
          ) : (
            <Input.TextArea rows={3} value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder={t('req.reasonPlaceholder')} />
          )}
          <Typography.Text strong>{t('req.sectionApprovers')}</Typography.Text>
          <ApproverChain count={3} values={ap} onChange={setAp} options={(_, cur) => optionsFor(cur)} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.approverHint')}</Typography.Text>
          <ApproverEmailWarning names={noEmailNames(approvers.data, ap)} />
          {error && <Alert type="error" showIcon title={error} />}
        </Space>
      )}
    </AppModal>
  )
}
