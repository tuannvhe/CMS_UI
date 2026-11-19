import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Col, Empty, Form, Input, List, Popconfirm, Row, Select, Space, Spin, Tag, Upload } from 'antd'
import { DeleteOutlined, FileTextOutlined, MailOutlined, PaperClipOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { INTERNAL_MAIL_KEYS, recruit, type RecruitApplication, type RecruitMailTemplate } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'
import { isOfferViewer } from './RecruitCommon'

const MAX_FILE = 10 * 1024 * 1024
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png'
const PREVIEW_STYLE = { width: '100%', height: 'calc(100vh - 280px)', minHeight: 520, border: '1px solid var(--c-border, #d0d5dd)', borderRadius: 8, background: '#fff' } as const

/** Mẫu gợi ý theo trạng thái hồ sơ (HR vẫn chọn lại được). */
function defaultKey(app: RecruitApplication) {
  if (app.status === 'pass') return 'job_offer'
  if (app.status === 'fail' || app.status === 'screen_fail') return 'result_fail'
  return 'invite_v1'
}

function useErr() {
  const { t } = useTranslation()
  return (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
}

const toBase64 = (f: File) => new Promise<string>((ok, fail) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ''))
  r.onerror = () => fail(r.error)
  r.readAsDataURL(f)
})

/** Xem trước mẫu gửi người đánh giá: điền dữ liệu mẫu cho các chỗ trống để HR hình dung thư thật. */
const sampleReview = (html: string) => html
  .replace(/\{greeting\}/g, 'Dear Mr. Nguyen Van A - Manager,').replace(/\{position\}/g, 'Purchasing Staff').replace(/\{factory\}/g, 'Bac Ninh').replace(/\{name\}/g, 'Hoang Thi Linh')
  .replace(/\{deadline\}/g, '05/11/2026').replace(/\{note\}/g, 'Internal mail, do not forward outside the company.')
  .replace(/\{candidates\}/g, '<table style="border-collapse:collapse;font-size:12px"><tr>' + ['Full Name', 'D.O.B', 'Gender', 'Address', 'Degree', 'School', 'Major', 'Experience Details', 'Total of experience year'].map((h) => `<th style="background:#2e7d32;color:#fff;border:1px solid #fff;padding:6px 8px">${h}</th>`).join('') + '</tr><tr>' + ['Hoang Thi Linh', '28/11/1993', 'Female', 'Ha Dong, Ha Noi', 'University', 'Academy of Policy and Development', 'International Economics', '08/2025 - Present: LIEN MAI CO., LTD - Business Assistant', '10.8 years'].map((c) => `<td style="border:1px solid #bfbfbf;padding:6px 8px">${c}</td>`).join('') + '</tr></table>')

/** Xem trước mẫu báo IT: bảng mẫu 2 người nhận việc (giống bảng server dựng). */
const IT_BD = 'border:1px solid #d6e3d8;padding:9px 12px;vertical-align:top'
const sampleIt = (html: string) => html
  .replace(/\{greeting\}/g, 'Dear IT team,').replace(/\{count\}/g, '2').replace(/\{sender\}/g, 'Phùng Thị Thu Uyên').replace(/\{note\}/g, 'Thư nội bộ, vui lòng không chuyển tiếp ra ngoài công ty. / Internal mail, do not forward outside the company.')
  .replace(/\{candidates\}/g, '<table style="width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:13px"><thead><tr>'
    + [['STT / No.', 'center', '60px'], ['Họ và tên / Full name', 'left', ''], ['Chức vụ / Position', 'left', ''], ['Ngày đi làm / Start date', 'center', '130px']]
      .map(([h, al, w]) => `<td style="${IT_BD};background:#2e7d32;color:#fff;font-weight:700;text-align:${al}${w ? ';width:' + w : ''}">${h}</td>`).join('') + '</tr></thead><tbody>'
    + [['Nguyen Dinh Huy', 'Part Leader Staff', 'Bac Ninh', '02/11/2026'], ['Hoàng Thị Chinh', 'Interpreter Staff', 'Bac Ninh', '09/11/2026']]
      .map(([name, pos, place, d], i) => `<tr><td style="${IT_BD};background:#f1f8f2;font-weight:600;text-align:center">${i + 1}</td><td style="${IT_BD}"><b>${name}</b></td><td style="${IT_BD}">${pos}<br/><span style="color:#6b7280">${place}</span></td><td style="${IT_BD};text-align:center"><b>${d}</b></td></tr>`).join('') + '</tbody></table>')

const emailOk = (x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.trim())

export function MailComposeModal({ app, onClose, initialKey }: { app: RecruitApplication; onClose: () => void; initialKey?: string }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const err = useErr()
  const { user } = useAuth()
  const templates = useQuery({ queryKey: ['recruit', 'mail-templates'], queryFn: recruit.mailTemplates })
  const [key, setKey] = useState(initialKey ?? defaultKey(app))
  const [values, setValues] = useState<Record<string, string>>({})
  const [subject, setSubject] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [debounced, setDebounced] = useState<Record<string, string>>({})
  useEffect(() => { const h = setTimeout(() => setDebounced(values), 400); return () => clearTimeout(h) }, [values])
  const draft = useQuery({
    queryKey: ['recruit', 'mail-draft', app.id, key, debounced], queryFn: () => recruit.mailDraft(app.id, { key, values: debounced }),
    retry: false, gcTime: 0, placeholderData: (prev) => prev,
  })
  const d = draft.data?.key === key ? draft.data : undefined
  // Tổng thu nhập: người có quyền Xem offer thì điền sẵn từ offer đã lưu (máy chủ không tự điền để lương không lộ cho HR thường)
  const offerFill = useRef(false)
  const needsPackage = !!d?.fields.includes('package') && !d.values.package
  const offer = useQuery({ queryKey: ['recruit', 'offer', app.id], queryFn: () => recruit.offer(app.id), enabled: needsPackage && isOfferViewer(user), retry: false })
  useEffect(() => {
    const v = offer.data?.totalOffer ?? offer.data?.salary
    if (!needsPackage || v == null || offerFill.current) return
    offerFill.current = true
    setValues((p) => ({ ...p, package: `${v.toLocaleString('vi-VN')} VND` }))
  }, [offer.data, needsPackage])
  const changeKey = (k: string) => { setKey(k); setValues({}); setDebounced({}); setSubject(null); offerFill.current = false }
  const send = useMutation({
    mutationFn: async () => recruit.sendMail(app.id, {
      key, values, subject: subject?.trim() || undefined,
      file: file ? { name: file.name, base64: await toBase64(file) } : null,
    }),
    onSuccess: () => { msg.success(t('rec.mt.sent')); qc.invalidateQueries({ queryKey: ['recruit', 'detail', app.id] }); onClose() },
    onError: (e) => msg.error(err(e)),
  })
  const missing = d ? d.fields.filter((f) => !(values[f] ?? d.values[f] ?? '').trim()) : []
  return (
    <AppModal open onClose={onClose} size="screen" icon={<MailOutlined />} title={t('rec.mt.title')} subtitle={`${app.fullName} · ${app.email ?? ''}`}
      okText={t('rec.mt.send')} okLoading={send.isPending} okDisabled={!d || missing.length > 0} onOk={() => send.mutate()}
      extra={missing.length > 0 ? <Tag color="orange">{t('rec.mt.missing', { n: missing.length })}</Tag> : null}>
      <Row gutter={20}>
        <Col xs={24} lg={9}>
          <Form layout="vertical">
            <Form.Item label={t('rec.mt.template')}>
              <Select value={key} onChange={changeKey} loading={templates.isLoading}
                options={(templates.data ?? []).filter((x) => !INTERNAL_MAIL_KEYS.includes(x.key)).map((x) => ({ value: x.key, label: x.name }))} />
            </Form.Item>
            {draft.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={err(draft.error)} />}
            {d?.lastSentAt && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('rec.mt.last', { d: dayjs(d.lastSentAt).format('DD/MM/YYYY HH:mm') })} />}
            <Form.Item label={t('rec.mt.subject')}>
              <Input value={subject ?? d?.subject ?? ''} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
            </Form.Item>
            {d && d.fields.length > 0 && <div className="rec-sec-title" style={{ fontWeight: 600, margin: '4px 0 8px' }}>{t('rec.mt.fields')}</div>}
            {d?.fields.map((f) => (
              <Form.Item key={f} label={t(`rec.mt.f.${f}`)} validateStatus={missing.includes(f) ? 'warning' : undefined} style={{ marginBottom: 10 }}
                extra={f === 'package' && offerFill.current ? t('rec.mt.offerFilled') : undefined}>
                <Input value={values[f] ?? d.values[f] ?? ''} maxLength={500} onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))} />
              </Form.Item>
            ))}
            <Form.Item label={t('rec.mt.file')} style={{ marginTop: 6 }}>
              <Space wrap>
                <Upload accept={FILE_ACCEPT} showUploadList={false} beforeUpload={(f) => {
                  if (f.size > MAX_FILE) msg.error(t('rec.err.mail_file')); else setFile(f)
                  return false
                }}>
                  <Button icon={<PaperClipOutlined />}>{t('rec.mt.pickFile')}</Button>
                </Upload>
                {file && <Tag closable onClose={() => setFile(null)}>{file.name}</Tag>}
              </Space>
            </Form.Item>
            {d?.withIcs && <Alert type="info" showIcon message={t('rec.mt.ics')} />}
          </Form>
        </Col>
        <Col xs={24} lg={15}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('rec.mt.preview')}</div>
          <Spin spinning={draft.isFetching}>
            {/* Thư dựng ở máy chủ (giá trị đã mã hoá); iframe sandbox không chạy script */}
            <iframe title="mail-preview" sandbox="" srcDoc={d?.html ?? ''} style={PREVIEW_STYLE} />
          </Spin>
        </Col>
      </Row>
    </AppModal>
  )
}

/** Nút gửi mail theo mẫu của HR (mời PV, đạt vòng 2, offer, hướng dẫn nhận việc, không đạt) cho ứng viên có email. */
export function MailComposeButton({ app }: { app: RecruitApplication }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon={<MailOutlined />} disabled={!app.email} title={app.email ? undefined : t('rec.rm.noEmail')} onClick={() => setOpen(true)}>{t('rec.mt.btn')}</Button>
      {open && <MailComposeModal app={app} onClose={() => setOpen(false)} />}
    </>
  )
}

const NEW_KEY = '__new'

function MailTemplatesModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const err = useErr()
  const q = useQuery({ queryKey: ['recruit', 'mail-templates'], queryFn: recruit.mailTemplates })
  const [sel, setSel] = useState<string | null>(null)
  const [form, setForm] = useState({ key: '', name: '', subject: '', html: '', to: [] as string[], cc: [] as string[] })
  const list = useMemo(() => q.data ?? [], [q.data])
  const cur: RecruitMailTemplate | undefined = list.find((x) => x.key === sel)
  useEffect(() => { if (!sel && list.length > 0) setSel(list[0].key) }, [list, sel])
  useEffect(() => {
    if (sel === NEW_KEY) setForm({ key: '', name: '', subject: '', html: '<p>Dear Mr./Ms. {name},</p>\n<p></p>', to: [], cc: [] })
    else if (cur) setForm({ key: cur.key, name: cur.name, subject: cur.subject, html: cur.html, to: cur.to ?? [], cc: cur.cc ?? [] })
  }, [sel, cur])
  const refresh = () => qc.invalidateQueries({ queryKey: ['recruit', 'mail-templates'] })
  const save = useMutation({
    mutationFn: () => recruit.saveMailTemplate(form.key.trim().toLowerCase(), { name: form.name, subject: form.subject, html: form.html, ...(isIt ? { to: form.to, cc: form.cc } : {}) }),
    onSuccess: (r) => { msg.success(t('rec.mt.saved')); refresh(); setSel(r.key) },
    onError: (e) => msg.error(err(e)),
  })
  const reset = useMutation({
    mutationFn: (k: string) => recruit.resetMailTemplate(k),
    onSuccess: () => { refresh(); if (cur && !cur.builtin) setSel(null) },
    onError: (e) => msg.error(err(e)),
  })
  const tag = (x: RecruitMailTemplate) => x.builtin ? (x.custom ? <Tag color="orange">{t('rec.mt.edited')}</Tag> : <Tag>{t('rec.mt.builtin')}</Tag>) : <Tag color="blue">{t('rec.mt.custom')}</Tag>
  const isNew = sel === NEW_KEY
  const isIt = form.key === 'it_newhire'
  return (
    <AppModal open onClose={onClose} size="screen" icon={<FileTextOutlined />} title={t('rec.mt.manageTitle')}
      okText={t('rec.mt.save')} okLoading={save.isPending} okDisabled={!form.key.trim() || !form.name.trim() || !form.subject.trim() || !form.html.trim()} onOk={() => save.mutate()}
      extra={cur && cur.custom ? (
        <Popconfirm title={cur.builtin ? t('rec.mt.resetAsk') : t('rec.mt.delAsk')} onConfirm={() => reset.mutate(cur.key)}>
          <Button danger={!cur.builtin} icon={cur.builtin ? <UndoOutlined /> : <DeleteOutlined />} loading={reset.isPending}>{cur.builtin ? t('rec.mt.reset') : t('rec.mt.del')}</Button>
        </Popconfirm>
      ) : null}>
      <Spin spinning={q.isLoading}>
        <Row gutter={20}>
          <Col xs={24} lg={6}>
            <List size="small" bordered dataSource={list} locale={{ emptyText: <Empty /> }}
              footer={<Button type="dashed" block icon={<PlusOutlined />} onClick={() => setSel(NEW_KEY)}>{t('rec.mt.add')}</Button>}
              renderItem={(x) => (
                <List.Item onClick={() => setSel(x.key)} style={{ cursor: 'pointer', background: x.key === sel ? 'var(--c-primary-bg, #e8f3ee)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%' }}><span>{x.name}</span>{tag(x)}</div>
                </List.Item>
              )} />
          </Col>
          <Col xs={24} lg={9}>
            <Form layout="vertical">
              {isNew && <Form.Item label={t('rec.mt.key')}><Input value={form.key} maxLength={40} placeholder="vd: invite_v3" onChange={(e) => setForm({ ...form, key: e.target.value })} /></Form.Item>}
              <Form.Item label={t('rec.mt.name')}><Input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Form.Item>
              {isIt && (
                <>
                  <Form.Item label={t('rec.mt.itTo')} extra={t('rec.mt.itToHint')}>
                    <Select mode="tags" tokenSeparators={[',', ';', ' ']} value={form.to} open={false} placeholder="it@vina.co.kr"
                      onChange={(v: string[]) => setForm({ ...form, to: v.map((x) => x.trim().toLowerCase()).filter(emailOk) })} />
                  </Form.Item>
                  <Form.Item label={t('rec.mt.itCc')}>
                    <Select mode="tags" tokenSeparators={[',', ';', ' ']} value={form.cc} open={false}
                      onChange={(v: string[]) => setForm({ ...form, cc: v.map((x) => x.trim().toLowerCase()).filter(emailOk) })} />
                  </Form.Item>
                </>
              )}
              <Form.Item label={t('rec.mt.subject')}><Input value={form.subject} maxLength={300} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Form.Item>
              <Form.Item label={t('rec.mt.html')} extra={t('rec.mt.htmlHint')}>
                <Input.TextArea value={form.html} autoSize={{ minRows: 14, maxRows: 24 }} style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}
                  onChange={(e) => setForm({ ...form, html: e.target.value })} />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} lg={9}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('rec.mt.preview')}</div>
            <iframe title="template-preview" sandbox="" srcDoc={form.key === 'review_cv' ? sampleReview(form.html) : isIt ? sampleIt(form.html) : form.html} style={PREVIEW_STYLE} />
          </Col>
        </Row>
      </Spin>
    </AppModal>
  )
}

/** Nút mở màn sửa mẫu mail gửi ứng viên (HR). */
export function MailTemplatesButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon={<FileTextOutlined />} onClick={() => setOpen(true)}>{t('rec.mt.manage')}</Button>
      {open && <MailTemplatesModal onClose={() => setOpen(false)} />}
    </>
  )
}
