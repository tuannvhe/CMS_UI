import { useState } from 'react'
import { Alert, Button, DatePicker, Form, Modal } from 'antd'
import { ReadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { ojt, type OjtCreateResult, type OjtPerson } from '../../api/ojt'
import { PeopleSelect, PersonSelect } from './OjtCommon'

/** Nút "Lập OJT" trong khối nhận việc của hồ sơ Pass: chọn tài khoản CMS của nhân viên mới, ngày lấy sẵn từ lịch nhận việc. */
export default function OjtFromApplication({ applicationId, startDate, probationEnd }: { applicationId: number; startDate: string; probationEnd: string | null }) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<OjtCreateResult | null>(null)
  const [picked, setPicked] = useState<OjtPerson | undefined>()
  const [form] = Form.useForm<{ employeeId: string; approverIds: string[]; start: Dayjs; end?: Dayjs }>()
  const create = useMutation({
    mutationFn: (v: { employeeId: string; approverIds: string[]; start: Dayjs; end?: Dayjs }) =>
      ojt.create({ employeeId: v.employeeId, approverIds: v.approverIds, startDate: v.start.format('YYYY-MM-DD'), endDate: v.end?.format('YYYY-MM-DD'), applicationId }),
    onSuccess: (r) => { setDone(r); toast.success(t('ojt.created')); qc.invalidateQueries({ queryKey: ['ojt-team'] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  const show = () => { setDone(null); setPicked(undefined); form.setFieldsValue({ employeeId: undefined, start: dayjs(startDate), end: probationEnd ? dayjs(probationEnd) : undefined }); setOpen(true) }
  return (
    <>
      <Button icon={<ReadOutlined />} onClick={show}>{t('ojt.btn')}</Button>
      <Modal open={open} title={t('ojt.create')} onCancel={() => setOpen(false)} destroyOnHidden
        okText={t('ojt.createBtn')} cancelText={t('ojt.cancel')} confirmLoading={create.isPending} okButtonProps={{ disabled: !!done || !picked }}
        onOk={() => form.validateFields().then((v) => create.mutate(v))}>
        <Form form={form} layout="vertical" disabled={!!done}>
          <Form.Item name="employeeId" label={t('ojt.employeeAccount')} rules={[{ required: true, message: t('ojt.err.employee') }]}><PersonSelect placeholder={t('ojt.pickEmployee')} onChange={(_, pr) => setPicked(pr)} /></Form.Item>
          <Form.Item name="approverIds" label={t('ojt.notifyWho')} extra={t('ojt.notifyWhoHint')} rules={[{ required: true, type: 'array', min: 1, message: t('ojt.err.approvers') }]}><PeopleSelect placeholder={t('ojt.pickEmployee')} /></Form.Item>
          <Form.Item name="start" label={t('ojt.start')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end" label={t('ojt.end')} extra={t('ojt.endHint')}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        </Form>
        {picked && !done && <Alert style={{ marginBottom: 12 }} type="warning" showIcon message={t('ojt.confirmPerson', { name: picked.name, id: picked.id, dept: picked.department ?? '—', pos: picked.position ?? '—' })} description={t('ojt.confirmHint')} />}
        {done && <Alert type="success" showIcon message={t('ojt.notified', { n: done.approvers.length, ids: done.approvers.join(', ') })} />}
      </Modal>
    </>
  )
}
