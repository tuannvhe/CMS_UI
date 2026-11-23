import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AutoComplete, DatePicker, Form, Input } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { AppModal } from '../../components/AppModal'
import { ETHNICITIES } from '../../api/ethnicities'
import dayjs, { type Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { SITE_FACTORY, type IdCardInput, type IdCardRow } from '../../api/idCards'
import TempAddressPicker from './TempAddressPicker'
import { useErpMasters } from './erpMasters'
import OrgDeptFields from './OrgDeptFields'
import { foldFilter } from '../../utils/search'

interface Values {
  employeeId: string; fullName: string; dob: Dayjs | null; gender: string; ethnicity: string
  address: string; tempAddress: string; newAddress: string; startDate: Dayjs | null; position: string; department: string; factory: string
  issueDate: Dayjs | null; note: string; bankName: string; bankAccount: string; fingerCode: string; referrer: string; title: string; phone: string; emergencyPhone: string
}
const d = (s: string | null) => (s ? dayjs(s) : null)
const iso = (v: Dayjs | null) => (v ? v.format('YYYY-MM-DD') : null)
const txt = (s: string | null | undefined) => (s ?? '')

/** Sửa một dòng CCCD đã lưu: ghi đè các trường nhập tay (kể cả xoá trống); số CCCD / CMND chỉ xem. */
export default function IdCardEditModal({ row, saving, onClose, onSave }: { row: IdCardRow | null; saving: boolean; onClose: () => void; onSave: (item: IdCardInput) => void }) {
  const { t } = useTranslation()
  const erpM = useErpMasters()   // Bộ phận / Vị trí theo danh mục ERP
  const [form] = Form.useForm<Values>()

  useEffect(() => {
    if (!row) return
    form.setFieldsValue({
      employeeId: txt(row.employeeId), fullName: row.fullName, dob: d(row.dob), gender: txt(row.gender), ethnicity: txt(row.extra.ethnicity),
      address: txt(row.address), tempAddress: txt(row.extra.tempAddress),
      newAddress: txt(row.newAddress), startDate: d(row.extra.startDate), position: txt(row.extra.position), department: txt(row.extra.department),
      factory: txt(row.extra.factory), issueDate: d(row.issueDate), note: txt(row.note), bankName: txt(row.extra.bankName), bankAccount: txt(row.extra.bankAccount), fingerCode: txt(row.extra.fingerCode), referrer: txt(row.extra.referrer), title: txt(row.extra.title), phone: txt(row.extra.phone), emergencyPhone: txt(row.extra.emergencyPhone),
    })
  }, [row, form])

  const submit = (v: Values) => {
    if (!row) return
    const s = (x: string) => x.trim() || null
    onSave({
      idNo: row.idNo, oldIdNo: row.oldIdNo, fullName: v.fullName.trim(), dob: iso(v.dob), gender: s(v.gender), address: s(v.address), issueDate: iso(v.issueDate),
      employeeId: s(v.employeeId), note: s(v.note), newAddress: s(v.newAddress),
      extra: {
        startDate: iso(v.startDate), position: s(v.position), department: s(v.department), factory: s(v.factory), ethnicity: s(v.ethnicity),
        birthPlace: row.extra.birthPlace ?? null, birthRegPlace: row.extra.birthRegPlace ?? null,   // không còn nhập, giữ giá trị cũ
        tempAddress: s(v.tempAddress), bankName: s(v.bankName), bankAccount: v.bankAccount.replace(/\D/g, '') || null, fingerCode: s(v.fingerCode), referrer: s(v.referrer), title: s(v.title), phone: s(v.phone), emergencyPhone: s(v.emergencyPhone),
      },
    })
  }
  const L = (k: string) => t(`idc.col.${k}`)
  const date = <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 16 } as const
  const mono = { fontFamily: 'ui-monospace, Consolas, monospace' }
  const sec = (title: string, body: ReactNode) => (
    <section style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--ant-color-primary-text, #1d4ed8)', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', paddingBottom: 6, marginBottom: 12 }}>{title}</div>
      {body}
    </section>
  )

  return (
    <AppModal open={!!row} onClose={onClose} size="lg" icon={<EditOutlined />} title={t('idc.editTitle', { name: row?.fullName ?? '' })}
      subtitle={<span><span style={mono}>{row?.idNo}{row?.oldIdNo ? ` · ${row.oldIdNo}` : ''}</span> · {t('idc.idLocked')}</span>}
      onOk={() => form.submit()} okText={t('idc.editSave')} cancelText={t('idc.cancel')} okLoading={saving}>
      <Form<Values> form={form} layout="vertical" onFinish={submit} requiredMark={false}
        onValuesChange={(c: Partial<Values>) => { if (c.department === undefined) return; const s = erpM.siteOf(c.department); if (s) form.setFieldValue('factory', SITE_FACTORY[s]) }}>
        {sec(t('idc.sec.hr'), (
          <div style={grid}>
            <Form.Item name="employeeId" label={L('employeeId')} rules={[{ max: 20 }]}><Input style={mono} /></Form.Item>
            <Form.Item name="fullName" label={L('fullName')} rules={[{ required: true, whitespace: true }, { max: 100 }]}><Input /></Form.Item>
            <Form.Item name="startDate" label={L('startDate')}>{date}</Form.Item>
            <Form.Item name="position" label={L('position')} rules={[{ max: 100 }]}><AutoComplete options={erpM.posOptions} allowClear filterOption={foldFilter()} popupMatchSelectWidth={320} /></Form.Item>
            {erpM.useOrg
              ? <Form.Item name="department" noStyle><OrgDeptFields site={row?.site} onPart={() => { if (!String(form.getFieldValue('title') ?? '').trim()) form.setFieldValue('title', 'OP') }} /></Form.Item>
              : <Form.Item name="department" label={L('department')} rules={[{ max: 100 }]}><AutoComplete options={erpM.deptOptions} allowClear filterOption={foldFilter()} popupMatchSelectWidth={420} /></Form.Item>}
            <Form.Item name="title" label={L('title')} rules={[{ max: 50 }]}><AutoComplete options={erpM.titleOptions} allowClear filterOption={foldFilter()} /></Form.Item>
            <Form.Item name="factory" label={L('factory')} rules={[{ max: 100 }]}>
              <AutoComplete options={Object.values(SITE_FACTORY).map((v) => ({ value: v }))}><Input /></AutoComplete>
            </Form.Item>
          </div>
        ))}
        {sec(t('idc.sec.personal'), (
          <div style={grid}>
            <Form.Item name="dob" label={L('dob')}>{date}</Form.Item>
            <Form.Item name="gender" label={L('gender')} rules={[{ max: 10 }]}><Input /></Form.Item>
            <Form.Item name="ethnicity" label={L('ethnicity')} rules={[{ max: 50 }]}><AutoComplete options={ETHNICITIES.map((v) => ({ value: v }))}><Input /></AutoComplete></Form.Item>
            <Form.Item name="issueDate" label={L('issueDate')}>{date}</Form.Item>
            <Form.Item name="phone" label={L('phone')} rules={[{ pattern: /^\s*\+?[\d\s.-]{8,20}\s*$/, message: L('phone') }]}><Input inputMode="tel" style={mono} /></Form.Item>
            <Form.Item name="emergencyPhone" label={L('emergencyPhone')} rules={[{ pattern: /^\s*\+?[\d\s.-]{8,20}\s*$/, message: L('emergencyPhone') }]}><Input inputMode="tel" style={mono} /></Form.Item>
            <Form.Item name="referrer" label={L('referrer')} rules={[{ max: 100 }]}><Input /></Form.Item>
          </div>
        ))}
        {sec(t('idc.sec.bank'), (
          <div style={grid}>
            <Form.Item name="bankName" label={L('bankName')} rules={[{ max: 100 }]}><Input /></Form.Item>
            <Form.Item name="bankAccount" label={L('bankAccount')} rules={[{ pattern: /^\s*(\d[\s.-]?){6,20}\s*$/, message: t('idc.err.bank') }]}><Input style={mono} /></Form.Item>
            <Form.Item name="fingerCode" label={L('fingerCode')} rules={[{ max: 20 }]}><Input style={mono} /></Form.Item>
          </div>
        ))}
        {sec(t('idc.sec.address'), (
          <>
            <Form.Item name="address" label={L('address')} rules={[{ max: 300 }]}><Input /></Form.Item>
            <Form.Item name="newAddress" label={L('newAddress')} rules={[{ max: 300 }]}><Input /></Form.Item>
            <Form.Item name="tempAddress" label={L('tempAddress')} rules={[{ max: 300 }]}>
              <Input suffix={<TempAddressPicker value={form.getFieldValue('tempAddress') ?? ''} onApply={(v) => form.setFieldValue('tempAddress', v)} />} />
            </Form.Item>
            <Form.Item name="note" label={L('note')} rules={[{ max: 300 }]} style={{ marginBottom: 0 }}><Input.TextArea rows={2} /></Form.Item>
          </>
        ))}
      </Form>
    </AppModal>
  )
}
