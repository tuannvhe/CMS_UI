import { Alert, Input, Select, Space, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Dayjs } from 'dayjs'
import type { LateSubmit, SelfServiceRule, WindowKind } from '../api/requests'
import { isPastSelfService } from '../utils/selfService'

/** Báo trước cho người thường: ngày đã chọn quá hạn tự gửi, hướng dẫn gửi phản hồi công. */
export function LateWarning({ date, rule, kind }: { date: Dayjs | null | undefined; rule: SelfServiceRule | undefined; kind: WindowKind }) {
  const { t } = useTranslation()
  if (!date || !rule || rule.bypass || !isPastSelfService(date, rule, kind)) return null
  return (
    <Alert type="warning" showIcon style={{ marginTop: 14 }} title={t('late.warnTitle')}
      description={<>{t('late.warnText', { period: date.format('MM/YYYY'), day: rule.untilDay })} <Link to={`/attendance/complaints?date=${date.format('YYYY-MM-DD')}`}>{t('req.sendFeedback')}</Link></>} />
  )
}

/** Ô nhập của HR khi gửi đơn bổ sung trễ hạn (đặt trong hộp xác nhận gửi). */
export function LateSubmitFields({ count, value, onChange, complaintId }: { count: number; value: LateSubmit; onChange: (v: LateSubmit) => void; complaintId?: number }) {
  const { t } = useTranslation()
  return (
    <Space orientation="vertical" size={6} style={{ width: 320, marginTop: 6 }}>
      <Typography.Text type="warning">{t('late.hrText', { n: count })}</Typography.Text>
      {complaintId ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('late.fromComplaint', { id: complaintId })}</Typography.Text> : null}
      <Select size="small" style={{ width: '100%' }} value={value.lateFault ?? 'personal'} onChange={(v) => onChange({ ...value, lateFault: v })}
        options={[{ value: 'personal', label: t('late.faultPersonal') }, { value: 'company', label: t('late.faultCompany') }]} prefix={`${t('late.fault')}:`} />
      <Input.TextArea size="small" rows={2} maxLength={500} placeholder={t('late.note')} value={value.lateNote ?? ''} onChange={(e) => onChange({ ...value, lateNote: e.target.value })} />
    </Space>
  )
}
