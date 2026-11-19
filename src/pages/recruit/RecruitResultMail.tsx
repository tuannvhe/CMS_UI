import { useState } from 'react'
import { Alert, Button, Form, Input, Radio } from 'antd'
import { EditOutlined, MailOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { recruit, type RecruitApplication } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'
import { MailComposeModal } from './RecruitMailCompose'

/** Nút gửi mail báo kết quả: tự dùng mẫu của HR (Đạt → "Đạt vòng 2 - xin phiếu lương", Trượt / trượt vòng CV → "Thông báo không đạt"); HR xem trước, sửa ô rồi gửi. */
export function ResultMailButton({ app }: { app: RecruitApplication }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!['pass', 'fail', 'screen_fail'].includes(app.status)) return null
  return (
    <>
      <Button icon={<MailOutlined />} disabled={!app.email} title={app.email ? undefined : t('rec.rm.noEmail')} onClick={() => setOpen(true)}>{t('rec.rm.btn')}</Button>
      {open && <MailComposeModal app={app} initialKey={app.status === 'pass' ? 'round2_pass' : 'result_fail'} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Trưởng HR sửa kết quả đã chốt khi chốt nhầm: chọn kết quả đúng + lý do; nhắc nếu đã gửi mail kết quả cho ứng viên. */
export function CorrectFinalButton({ app, mailed, viaEdit = false }: { app: RecruitApplication; mailed: boolean; viaEdit?: boolean }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState<'pass' | 'fail' | 'consider'>(app.status === 'pass' ? 'fail' : 'pass')   // từ chối offer → mặc định đưa về Đạt
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: () => recruit.correctFinal(app.id, to, reason.trim(), viaEdit),
    onSuccess: () => { msg.success(t('rec.cf.done')); setOpen(false); setReason(''); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  if (app.status !== 'pass' && app.status !== 'fail' && app.status !== 'offer_declined') return null
  return (
    <>
      <Button type="text" icon={<EditOutlined />} onClick={() => { setTo(app.status === 'pass' ? 'fail' : 'pass'); setOpen(true) }}>{t('rec.cf.btn')}</Button>
      <AppModal open={open} onClose={() => setOpen(false)} size="sm" icon={<EditOutlined />} title={t('rec.cf.title')} subtitle={app.fullName}
        okDisabled={reason.trim().length < 5 || to === app.status} okLoading={m.isPending} onOk={() => m.mutate()}>
        <p className="cell-muted">{t('rec.cf.hint')}</p>
        {mailed && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('rec.cf.mailed')} />}
        <Form layout="vertical">
          <Form.Item label={t('rec.cf.to')}>
            <Radio.Group value={to} onChange={(e) => setTo(e.target.value)} optionType="button"
              options={(['pass', 'fail', 'consider'] as const).filter((x) => x !== app.status).map((x) => ({ value: x, label: x === 'consider' ? t('rec.dec.consider') : t(`rec.rm.${x}`) }))} />
          </Form.Item>
          <Form.Item label={t('rec.cf.reason')}><Input.TextArea rows={3} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>
    </>
  )
}
