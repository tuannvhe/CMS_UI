import { Alert, Button, Form, Input, Select, Space } from 'antd'
import { ApartmentOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { departmentsApi, type DepartmentInfo, type NewDepartment } from '../api/departments'
import { org } from '../api/org'
import { adminError } from '../api/userAdmin'
import { useToast } from '../hooks/useToast'
import { AppModal } from './AppModal'

/** Form thêm bộ phận chuẩn (danh mục Tbl_Departments), dùng ở màn Cơ cấu tổ chức và trong màn xem trước khi nhập nhân viên. */
export function AddDepartmentModal({ open, initial, onClose, onAdded }: { open: boolean; initial?: string; onClose: () => void; onAdded: (d: DepartmentInfo) => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const [form] = Form.useForm<NewDepartment>()
  const add = useMutation({
    mutationFn: (v: NewDepartment) => departmentsApi.add(v),
    onSuccess: (d) => { msg.success(t('dep.added')); form.resetFields(); onAdded(d) },
    onError: (e) => {
      const { code, detail } = adminError(e)
      msg.error(code === 'conflict' ? t('dep.err.conflict') : code === 'invalid_input' ? t('dep.err.name') : t(`dep.err.${detail}`, { defaultValue: t('usr.err.generic') }))
    },
  })
  return (
    <AppModal open={open} onClose={onClose} size="sm" icon={<ApartmentOutlined />} title={t('dep.addTitle')} subtitle={t('dep.addHint')}
      okText={t('dep.addBtn')} okLoading={add.isPending} onOk={() => form.validateFields().then((v) => add.mutate(v))}>
      <Form form={form} layout="vertical" initialValues={{ english: initial }} key={initial ?? 'new'} autoComplete="off">
        <Form.Item name="english" label={t('dep.english')} rules={[{ required: true }, { min: 2 }, { max: 50 }]} extra={t('dep.englishHint')}><Input maxLength={50} /></Form.Item>
        <Form.Item name="vietnamese" label={t('dep.vietnamese')} rules={[{ max: 50 }]}><Input maxLength={50} /></Form.Item>
        <Form.Item name="korean" label={t('dep.korean')} rules={[{ max: 50 }]}><Input maxLength={50} /></Form.Item>
      </Form>
    </AppModal>
  )
}

/** Form thêm phòng ban: chọn bộ phận cha rồi đặt tên (không trùng tên phòng ban hay bộ phận nào). */
export function AddUnitModal({ open, department, onClose, onAdded }: { open: boolean; department?: string; onClose: () => void; onAdded: (name: string, department: string) => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const [form] = Form.useForm<{ name: string; department: string }>()
  const deps = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list, enabled: open, staleTime: 60_000 })
  const add = useMutation({
    mutationFn: (v: { name: string; department: string }) => org.addUnit(v),
    onSuccess: (_, v) => { msg.success(t('org.unitAdded')); form.resetFields(); onAdded(v.name, v.department) },
    onError: (e) => {
      const { code, detail } = adminError(e)
      msg.error(code === 'conflict' ? t(`org.err.${detail}`, { defaultValue: t('org.err.name') }) : code === 'not_ready' ? t('org.err.not_ready') : t(`org.err.${detail}`, { defaultValue: t('usr.err.generic') }))
    },
  })
  return (
    <AppModal open={open} onClose={onClose} size="sm" icon={<ApartmentOutlined />} title={t('org.addUnitTitle')} subtitle={t('org.addUnitHint')}
      okText={t('org.addUnit')} okLoading={add.isPending} onOk={() => form.validateFields().then((v) => add.mutate(v))}>
      <Form form={form} layout="vertical" initialValues={{ department }} key={department ?? 'new'} autoComplete="off">
        <Form.Item name="department" label={t('org.parentDepartment')} rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" loading={deps.isLoading} options={(deps.data ?? []).filter((d) => d.active).map((d) => ({ value: d.english, label: d.english }))} />
        </Form.Item>
        <Form.Item name="name" label={t('org.unitName')} rules={[{ required: true }, { min: 2 }, { max: 100 }]} extra={t('org.unitNameHint')}><Input maxLength={100} /></Form.Item>
      </Form>
    </AppModal>
  )
}

/**
 * Nhắc bước tiếp theo sau khi thêm bộ phận mới: tạo line duyệt (nếu không, đơn của nhân viên bộ phận này không có người duyệt).
 */
export function NextStepModal({ department, onClose }: { department: DepartmentInfo | null; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <AppModal open={!!department} onClose={onClose} size="sm" icon={<ApartmentOutlined />} title={t('dep.nextTitle')} subtitle={department?.english}
      footer={(
        <Space>
          <Button onClick={onClose}>{t('dep.later')}</Button>
          <Button type="primary" onClick={() => { const d = department!.english; onClose(); navigate(`/lines/approval?department=${encodeURIComponent(d)}`) }}>{t('dep.createApproverLine')}</Button>
        </Space>
      )}>
      <Alert type="warning" showIcon title={t('dep.nextWarn')} style={{ marginBottom: 12 }} />
      <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
        <li>{t('dep.step1')}</li>
        <li>{t('dep.step2')}</li>
        <li>{t('dep.step3')}</li>
      </ol>
    </AppModal>
  )
}
