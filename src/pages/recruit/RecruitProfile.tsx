import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Popconfirm, Radio, Select, Space, Upload } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, LockOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { recruit, type ApplicantSalary, type RecruitPayslip, type Gender, type RecruitScreening, type ScreenDecision } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { isSalaryViewer } from './RecruitCommon'

const money = { formatter: (v: number | string | undefined) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'), parser: (v: string | undefined) => Number((v ?? '').replace(/\./g, '')) as 0 }

function useErrText() {
  const { t } = useTranslation()
  return (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
}

interface ProfileValues { gender?: Gender | null; address?: string; major?: string; languages?: string; availableFrom?: Dayjs | null; birthDate?: Dayjs | null }

/**
 * Thông tin vòng gọi sơ loại trong chi tiết hồ sơ (chỉ HR): giới tính, địa chỉ, chuyên ngành, ngoại ngữ, ngày có thể bắt đầu đi làm.
 * Lương hiện tại / mong muốn chỉ hiện với người có quyền "Xem lương ứng viên" (lưu mã hoá, không ghi số tiền vào lịch sử).
 */
export function ApplicantProfileBlock({ appId }: { appId: number }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const errText = useErrText()
  const { user } = useAuth()
  const salaryOk = isSalaryViewer(user)
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm<ProfileValues>()
  const [salForm] = Form.useForm<ApplicantSalary>()
  const pq = useQuery({ queryKey: ['recruit', 'profile', appId], queryFn: () => recruit.profile(appId), retry: false })
  const sq = useQuery({ queryKey: ['recruit', 'salary', appId], queryFn: () => recruit.salary(appId), retry: false, enabled: salaryOk, gcTime: 0, staleTime: 0 })
  useEffect(() => { if (sq.data) salForm.setFieldsValue(sq.data) }, [sq.data, salForm])
  const save = useMutation({
    mutationFn: (v: ProfileValues) => recruit.saveProfile(appId, { gender: v.gender ?? null, address: v.address || null, major: v.major || null, languages: v.languages || null, availableFrom: v.availableFrom?.format('YYYY-MM-DD') ?? null, birthDate: v.birthDate?.format('YYYY-MM-DD') ?? null }),
    onSuccess: () => { msg.success(t('usr.saved')); setEditing(false); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const saveSal = useMutation({
    mutationFn: (v: ApplicantSalary) => recruit.saveSalary(appId, { currentSalary: v.currentSalary ?? null, expectedSalary: v.expectedSalary ?? null }),
    onSuccess: () => { msg.success(t('usr.saved')); qc.invalidateQueries({ queryKey: ['recruit', 'salary', appId] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const p = pq.data
  const open = () => { form.setFieldsValue({ gender: p?.gender ?? null, address: p?.address ?? '', major: p?.major ?? '', languages: p?.languages ?? '', availableFrom: p?.availableFrom ? dayjs(p.availableFrom) : null, birthDate: p?.birthDate ? dayjs(p.birthDate) : null }); setEditing(true) }
  const show = (v: string | null | undefined) => v || <span className="cell-muted">—</span>
  const fmt = (n: number | null | undefined) => (n == null ? <span className="cell-muted">—</span> : n.toLocaleString(i18n.language))
  return (
    <div className="rec-profile">
      <div className="rec-section" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {t('rec.pf.title')}
        {!editing && <Button size="small" type="link" icon={<EditOutlined />} onClick={open} disabled={!p}>{t('rec.pf.edit')}</Button>}
      </div>
      {editing ? (
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Space wrap size={12} align="start">
            <Form.Item name="gender" label={t('rec.pf.gender')}><Radio.Group optionType="button" options={(['male', 'female', 'other'] as Gender[]).map((g) => ({ value: g, label: t(`rec.pf.g.${g}`) }))} /></Form.Item>
            <Form.Item name="birthDate" label={t('rec.pf.birthDate')}><DatePicker format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs().subtract(14, 'year'))} /></Form.Item>
            <Form.Item name="availableFrom" label={t('rec.pf.availableFrom')}><DatePicker format="DD/MM/YYYY" /></Form.Item>
          </Space>
          <Form.Item name="address" label={t('rec.pf.address')} rules={[{ max: 300 }]}><Input maxLength={300} /></Form.Item>
          <Space wrap size={12} style={{ width: '100%' }}>
            <Form.Item name="major" label={t('rec.pf.major')} rules={[{ max: 150 }]} style={{ minWidth: 240 }}><Input maxLength={150} /></Form.Item>
            <Form.Item name="languages" label={t('rec.pf.languages')} rules={[{ max: 200 }]} style={{ minWidth: 240 }}><Input maxLength={200} placeholder={t('rec.pf.languagesPh')} /></Form.Item>
          </Space>
          <Space><Button type="primary" htmlType="submit" loading={save.isPending}>{t('rec.hrReviewSave')}</Button><Button onClick={() => setEditing(false)}>{t('req.cancel')}</Button></Space>
        </Form>
      ) : (
        <div className="rec-info">
          <div><label>{t('rec.pf.gender')}</label><span>{p?.gender ? t(`rec.pf.g.${p.gender}`) : show(null)}</span></div>
          <div><label>{t('rec.pf.birthDate')}</label><span>{p?.birthDate ? dayjs(p.birthDate).format('DD/MM/YYYY') : show(null)}</span></div>
          <div><label>{t('rec.pf.availableFrom')}</label><span>{p?.availableFrom ? dayjs(p.availableFrom).format('DD/MM/YYYY') : show(null)}</span></div>
          <div><label>{t('rec.pf.major')}</label><span>{show(p?.major)}</span></div>
          <div><label>{t('rec.pf.languages')}</label><span>{show(p?.languages)}</span></div>
          <div className="wide"><label>{t('rec.pf.address')}</label><span>{show(p?.address)}</span></div>
        </div>
      )}
      {salaryOk && (
        <div className="rec-salary">
          <div className="rec-section"><LockOutlined /> {t('rec.pf.salaryTitle')}</div>
          <Form form={salForm} layout="inline" onFinish={(v) => saveSal.mutate(v)}>
            <Form.Item name="currentSalary" label={t('rec.pf.current')}><InputNumber min={0} max={1_000_000_000_000} step={100_000} style={{ width: 180 }} {...money} /></Form.Item>
            <Form.Item name="expectedSalary" label={t('rec.pf.expected')}><InputNumber min={0} max={1_000_000_000_000} step={100_000} style={{ width: 180 }} {...money} /></Form.Item>
            <Button htmlType="submit" loading={saveSal.isPending}>{t('rec.hrReviewSave')}</Button>
          </Form>
          {sq.data && (sq.data.currentSalary != null || sq.data.expectedSalary != null) && (
            <div className="cell-muted" style={{ marginTop: 4 }}>{t('rec.pf.current')}: {fmt(sq.data.currentSalary)} · {t('rec.pf.expected')}: {fmt(sq.data.expectedSalary)}</div>
          )}
          <PayslipFiles appId={appId} />
        </div>
      )}
    </div>
  )
}

/** HR sửa ý kiến duyệt CV của một người khi cần điều chỉnh: bắt buộc lý do, lịch sử giữ ý kiến và nhận xét cũ. */
export function ScreeningChangeButton({ appId, screening }: { appId: number; screening: RecruitScreening }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const errText = useErrText()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<{ decision: ScreenDecision; comment?: string; reason: string }>()
  const change = useMutation({
    mutationFn: (v: { decision: ScreenDecision; comment?: string; reason: string }) => recruit.changeScreening(appId, screening.id, v.decision, v.comment?.trim() || undefined, v.reason.trim()),
    onSuccess: () => { msg.success(t('usr.saved')); setOpen(false); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  return (
    <>
      <Button size="small" icon={<EditOutlined />} onClick={() => { form.setFieldsValue({ decision: screening.decision ?? 'invite', comment: screening.comment ?? '', reason: '' }); setOpen(true) }}>{t('rec.sc2.btn')}</Button>
      <AppModal open={open} onClose={() => setOpen(false)} size="sm" icon={<EditOutlined />} title={t('rec.sc2.title')} subtitle={screening.reviewerName ?? screening.reviewerId}
        okLoading={change.isPending} onOk={() => form.validateFields().then((v) => change.mutate(v))}>
        <p className="cell-muted">{t('rec.sc2.hint')}</p>
        <Form form={form} layout="vertical">
          <Form.Item name="decision" label={t('rec.decision')} rules={[{ required: true }]}>
            <Select options={(['invite', 'consider', 'reject'] as ScreenDecision[]).map((d) => ({ value: d, label: t(`rec.dec.${d}`) }))} />
          </Form.Item>
          <Form.Item name="comment" label={t('rec.comment')} rules={[{ max: 1000 }]}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
          <Form.Item name="reason" label={t('rec.sc2.reason')} rules={[{ required: true, whitespace: true, min: 5, message: t('rec.err.reason') }, { max: 1000 }]}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
        </Form>
      </AppModal>
    </>
  )
}

const PAYSLIP_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/**
 * Phiếu lương cũ của ứng viên (PDF, Word, ảnh): tải lên, xem, tải về, xoá. Chỉ hiện với người có quyền "Xem lương ứng viên"; máy chủ ghi nhật ký mỗi lần xem / tải.
 * Chưa có bảng trong CSDL thì hiện thông báo thay vì danh sách.
 */
function PayslipFiles({ appId }: { appId: number }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [view, setView] = useState<{ url: string; type: string; name: string } | null>(null)
  const q = useQuery({ queryKey: ['recruit', 'payslips', appId], queryFn: () => recruit.payslips(appId), retry: false, gcTime: 0 })
  const fail = (e: unknown) => {
    const { detail, code } = adminError(e)
    const k = detail || code
    msg.error(k === 'file_type' ? t('rec.ps.badType') : k === 'payslip_table' ? t('rec.ps.noTable') : t(`rec.err.${k}`, { defaultValue: t('usr.err.generic') }))
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['recruit', 'payslips', appId] })
  const add = useMutation({ mutationFn: (f: File) => recruit.addPayslip(appId, f), onSuccess: () => { msg.success(t('rec.ps.added')); refresh() }, onError: fail })
  const del = useMutation({ mutationFn: (id: number) => recruit.deletePayslip(appId, id), onSuccess: () => { msg.success(t('rec.ps.deleted')); refresh() }, onError: fail })
  const open = useMutation({
    mutationFn: async (v: { f: RecruitPayslip; download: boolean }) => ({ ...v, blob: await recruit.payslipBlob(appId, v.f.id, v.download) }),
    onSuccess: ({ f, download, blob }) => {
      const url = URL.createObjectURL(blob)
      if (!download && (blob.type === 'application/pdf' || blob.type.startsWith('image/'))) { setView({ url, type: blob.type, name: f.name }); return }
      const a = document.createElement('a'); a.href = url; a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
    onError: fail,
  })
  const closeView = () => { if (view) URL.revokeObjectURL(view.url); setView(null) }
  const noTable = q.isError && (adminError(q.error).detail === 'payslip_table')
  return (
    <div style={{ marginTop: 12 }}>
      <div className="rec-section">{t('rec.ps.title')}</div>
      {noTable ? <div className="cell-muted">{t('rec.ps.noTable')}</div> : (
        <>
          {(q.data ?? []).map((f) => (
            <div key={f.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <b style={{ wordBreak: 'break-all' }}>{f.name}</b>
              <span className="cell-muted">{kb(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()} · {f.uploadedBy}</span>
              <Button size="small" type="link" icon={<EyeOutlined />} loading={open.isPending && open.variables?.f.id === f.id && !open.variables.download} onClick={() => open.mutate({ f, download: false })}>{t('rec.ps.view')}</Button>
              <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => open.mutate({ f, download: true })}>{t('rec.ps.download')}</Button>
              <Popconfirm title={t('rec.ps.deleteAsk')} onConfirm={() => del.mutate(f.id)}><Button size="small" type="link" danger icon={<DeleteOutlined />}>{t('rec.ps.delete')}</Button></Popconfirm>
            </div>
          ))}
          {q.data?.length === 0 && <div className="cell-muted">{t('rec.ps.empty')}</div>}
          <Upload accept={PAYSLIP_ACCEPT} showUploadList={false} multiple beforeUpload={(f) => { add.mutate(f); return false }}>
            <Button icon={<UploadOutlined />} loading={add.isPending} style={{ marginTop: 6 }}>{t('rec.ps.upload')}</Button>
          </Upload>
          <div className="cell-muted" style={{ marginTop: 4 }}>{t('rec.ps.hint')}</div>
        </>
      )}
      <AppModal open={!!view} onClose={closeView} size="lg" title={view?.name ?? ''} footer={null}>
        {view && (view.type.startsWith('image/')
          ? <img src={view.url} alt={view.name} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
          : <iframe src={view.url} title={view.name} style={{ width: '100%', height: '70vh', border: 0 }} />)}
      </AppModal>
    </div>
  )
}
