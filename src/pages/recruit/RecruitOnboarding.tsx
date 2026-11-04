import { useEffect, useState } from 'react'
import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select, Space, Switch, Tag } from 'antd'
import { CheckCircleOutlined, EyeOutlined, LockOutlined, MailOutlined, PrinterOutlined, RocketOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { offerHourly, offerKrw, recruit, type MailLang, type Onboarding, type OnboardingTrack, type RecruitApplication, type RecruitCcGroup, type RecruitOffer } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { useToast } from '../../hooks/useToast'
import { isOfferViewer } from './RecruitCommon'
import { RecruitExportMenu } from './RecruitSummaryCard'
import OjtFromApplication from '../ojt/OjtFromApplication'

const useErr = () => {
  const { t } = useTranslation()
  return (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
}
const ymd = (d: Dayjs | null | undefined) => (d ? d.format('YYYY-MM-DD') : undefined)
const dmy = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')
const money = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('vi-VN')} đ`)
const esc = (v: string | null | undefined) => (v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const isEmail = (x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)

/** Phiếu nhân viên mới dạng trang in (trình duyệt "Lưu thành PDF"); phần offer chỉ có khi người in có quyền và chọn kèm. */
function printSheet(t: (k: string) => string, app: RecruitApplication, ob: Onboarding, offer: RecruitOffer | null) {
  const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(app.fullName)}</title><style>
    body{font-family:"Segoe UI",Arial,sans-serif;margin:32px;color:#1f1f1f} h1{font-size:20px;margin:0 0 4px} .sub{color:#666;margin-bottom:20px}
    h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#666;margin:24px 0 8px} table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;font-size:13px;vertical-align:top} th{width:34%;background:#fafafa;font-weight:600}
    .conf{color:#b42318;font-size:12px;margin-top:6px} .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:13px;text-align:center} .sign div{width:30%}
    @media print{body{margin:12mm}}</style></head><body>
    <h1>${esc(t('rec.ob.sheetTitle'))}</h1><div class="sub">${esc(app.fullName)} · ${esc(app.position)}</div>
    <h2>${esc(t('rec.ob.info'))}</h2><table>
    ${row(t('rec.fullName'), app.fullName)}${row(t('rec.position'), app.position)}${row(t('rec.department'), [app.department, app.factory].filter(Boolean).join(' · ') || '—')}
    ${row(t('rec.phone'), app.phone ?? '—')}${row('Email', app.email ?? '—')}${app.idLast4 ? row('CCCD', `•••• ${app.idLast4}`) : ''}</table>
    <h2>${esc(t('rec.ob.title'))}</h2><table>
    ${row(t('rec.ob.startDate'), dmy(ob.startDate))}${row(t('rec.ob.probationEnd'), dmy(ob.probationEnd))}${row(t('rec.ob.location'), ob.location ?? '—')}${ob.note ? row(t('rec.note'), ob.note) : ''}</table>
    ${offer ? `<h2>${esc(t('rec.ob.offer'))}</h2><table>${row(t('rec.ob.probationSalary'), money(offer.probationSalary))}${row(t('rec.ob.salary'), money(offer.salary))}${offer.baseSalary != null ? row(t('rec.ob.baseSalary'), money(offer.baseSalary)) : ''}${offer.totalOffer != null ? row(t('rec.ob.totalOffer'), money(offer.totalOffer)) : ''}
      ${row(t('rec.ob.allowances'), offer.allowances ?? '—')}${row(t('rec.ob.contract'), offer.contract ?? '—')}${offer.note ? row(t('rec.note'), offer.note) : ''}</table>
      <div class="conf">${esc(t('rec.ob.confidential'))}</div>` : ''}
    <div class="sign"><div>${esc(t('rec.ob.signEmployee'))}</div><div>${esc(t('rec.ob.signManager'))}</div><div>${esc(t('rec.ob.signHr'))}</div></div>
    <script>window.onload=function(){window.print()}</script></body></html>`
  const w = window.open('', '_blank', 'noopener=no,width=900,height=1000')
  if (!w) return false
  w.document.open(); w.document.write(html); w.document.close()
  return true
}

/** Nhãn theo dõi sau nhận việc: đến đúng hẹn / đến muộn / không đến, nghỉ sớm. */
export function ArrivalTags({ ob }: { ob: Onboarding }) {
  const { t } = useTranslation()
  if (!ob.arrival) return <span className="cell-muted">—</span>
  return (
    <Space size={4} wrap>
      {ob.arrival === 'no' ? <Tag color="red">{t('rec.tr.noShow')}</Tag>
        : ob.onTime ? <Tag color="green" icon={<CheckCircleOutlined />}>{t('rec.tr.onTime')}</Tag>
        : <Tag color="gold">{t('rec.tr.late', { d: dmy(ob.arrivedDate) })}</Tag>}
      {ob.leftDate && <Tag color={ob.leftEarly ? 'red' : 'default'} icon={ob.leftEarly ? <WarningOutlined /> : undefined}>{t('rec.tr.left', { d: dmy(ob.leftDate) })}</Tag>}
    </Space>
  )
}

/** HR ghi ứng viên có đến nhận việc không (đúng hẹn = có mặt đúng ngày hẹn), ngày nghỉ việc thực tế; nghỉ trong thử việc thì hệ thống báo HR. */
function TrackModal({ app, ob, onClose }: { app: RecruitApplication; ob: Onboarding; onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const [form] = Form.useForm<{ arrival: 'yes' | 'no' | 'none'; arrivedDate?: Dayjs; left?: boolean; leftDate?: Dayjs; leftNote?: string }>()
  const arrival = Form.useWatch('arrival', form)
  const left = Form.useWatch('left', form)
  useEffect(() => {
    form.setFieldsValue({ arrival: ob.arrival ?? 'none', arrivedDate: dayjs(ob.arrivedDate ?? ob.startDate), left: !!ob.leftDate, leftDate: ob.leftDate ? dayjs(ob.leftDate) : undefined, leftNote: ob.leftNote ?? undefined })
  }, [ob, form])
  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      const b: OnboardingTrack = v.arrival === 'yes'
        ? { arrival: 'yes', arrivedDate: ymd(v.arrivedDate) ?? null, leftDate: v.left ? ymd(v.leftDate) ?? null : null, leftNote: v.left ? v.leftNote?.trim() || null : null }
        : { arrival: v.arrival === 'no' ? 'no' : null }
      return recruit.trackOnboarding(app.id, b)
    },
    onSuccess: (r) => { msg.success(r.leftEarly ? t('rec.tr.warned') : t('usr.saved')); qc.invalidateQueries({ queryKey: ['recruit'] }); onClose() },
    onError: (e) => { if (!(e && typeof e === 'object' && 'errorFields' in e)) msg.error(err(e)) },
  })
  const notAfterToday = (d: Dayjs) => d.isAfter(dayjs(), 'day')
  return (
    <AppModal open onClose={onClose} size="sm" icon={<CheckCircleOutlined />} title={t('rec.tr.title')} subtitle={`${app.fullName} · ${t('rec.tr.planned', { d: dmy(ob.startDate) })}`}
      okLoading={save.isPending} onOk={() => save.mutate()}>
      <Form form={form} layout="vertical">
        <Form.Item name="arrival" label={t('rec.tr.came')}>
          <Radio.Group optionType="button" options={[{ value: 'yes', label: t('rec.tr.yes') }, { value: 'no', label: t('rec.tr.no') }, { value: 'none', label: t('rec.tr.unknown') }]} />
        </Form.Item>
        {arrival === 'yes' && (
          <>
            <Form.Item name="arrivedDate" label={t('rec.tr.arrivedDate')} extra={t('rec.tr.onTimeHint')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" disabledDate={notAfterToday} /></Form.Item>
            <Form.Item name="left" valuePropName="checked"><Checkbox>{t('rec.tr.hasLeft')}</Checkbox></Form.Item>
            {left && (
              <>
                <Form.Item name="leftDate" label={t('rec.tr.leftDate')} extra={t('rec.tr.leftHint')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" disabledDate={notAfterToday} /></Form.Item>
                <Form.Item name="leftNote" label={t('rec.tr.leftNote')} rules={[{ max: 500 }]}><Input.TextArea rows={2} maxLength={500} /></Form.Item>
              </>
            )}
          </>
        )}
      </Form>
    </AppModal>
  )
}

/** Khối "Nhận việc" trong hồ sơ đã chốt Đạt: lịch nhận việc, offer (người có quyền), gửi thư, in phiếu nhân viên mới. */
export function OnboardingBlock({ app, ccGroups }: { app: RecruitApplication; ccGroups: RecruitCcGroup[] }) {
  const { t } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const { user } = useAuth()
  const viewer = isOfferViewer(user)
  const q = useQuery({ queryKey: ['recruit', 'onboarding', app.id], queryFn: () => recruit.onboarding(app.id), retry: false })
  const ob = q.data ?? null
  const lookups = useQuery({ queryKey: ['recruit', 'lookups'], queryFn: recruit.lookups, staleTime: 5 * 60_000, retry: false })
  const tracking = !!lookups.data?.tracking
  const [tracking2, setTracking2] = useState(false)
  const [editing, setEditing] = useState(false)
  const [mailing, setMailing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [withOffer, setWithOffer] = useState(false)
  const [form] = Form.useForm<{ startDate: Dayjs; probationEnd?: Dayjs; location?: string; note?: string; offer?: RecruitOffer }>()
  const offerDraft = Form.useWatch('offer', form)
  const offerQ = useQuery({ queryKey: ['recruit', 'offer', app.id], queryFn: () => recruit.offer(app.id), enabled: viewer && !!ob?.hasOffer, retry: false, staleTime: 0, gcTime: 0 })
  useEffect(() => {
    if (!editing) return
    form.setFieldsValue({
      startDate: ob ? dayjs(ob.startDate) : undefined, probationEnd: ob?.probationEnd ? dayjs(ob.probationEnd) : undefined, location: ob?.location ?? undefined, note: ob?.note ?? undefined,
      offer: offerQ.data ?? undefined,
    })
  }, [editing, ob, offerQ.data, form])
  const refresh = () => qc.invalidateQueries({ queryKey: ['recruit'] })
  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      const b = { startDate: ymd(v.startDate)!, probationEnd: ymd(v.probationEnd), location: v.location?.trim() || undefined, note: v.note?.trim() || undefined }
      return viewer ? recruit.saveOnboardingWithOffer(app.id, { ...b, offer: v.offer && Object.values(v.offer).some((x) => x != null && x !== '') ? v.offer : undefined }) : recruit.saveOnboarding(app.id, b)
    },
    onSuccess: () => { msg.success(t('usr.saved')); setEditing(false); refresh() },
    onError: (e) => { if (!(e && typeof e === 'object' && 'errorFields' in e)) msg.error(err(e)) },
  })
  const [cc, setCc] = useState<string[]>([])
  const [toCandidate, setToCandidate] = useState(true)
  const [mailOffer, setMailOffer] = useState(true)
  const [message, setMessage] = useState('')
  const lang: MailLang = 'en'   // thư ứng viên dùng mẫu của HR (song ngữ Anh / Việt), không chọn ngôn ngữ nữa
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const canMailOffer = viewer && !!ob?.hasOffer
  const previewQ = useMutation({
    mutationFn: () => recruit.previewOnboarding(app.id, { message: message.trim() || undefined, lang }, canMailOffer && mailOffer),
    onSuccess: setPreview,
    onError: (e) => msg.error(err(e)),
  })
  const notify = useMutation({
    mutationFn: () => {
      const b = { message: message.trim() || undefined, cc, toCandidate, lang }
      return canMailOffer && toCandidate && mailOffer ? recruit.notifyOnboardingWithOffer(app.id, b) : recruit.notifyOnboarding(app.id, b)
    },
    onSuccess: () => { msg.success(t('rec.ob.mailed')); setMailing(false); setMessage(''); setCc([]); refresh() },
    onError: (e) => msg.error(err(e)),
  })
  const doPrint = () => {
    if (!ob) return
    if (!printSheet(t, app, ob, withOffer && viewer ? offerQ.data ?? null : null)) msg.error(t('rec.ob.popup'))
    setPrinting(false)
  }

  return (
    <div className="rec-round is-open">
      <div className="rec-round-head">
        <RocketOutlined /><b>{t('rec.ob.title')}</b>
        {ob && <span>{dmy(ob.startDate)}</span>}
        {ob?.location && <span className="cell-muted">· {ob.location}</span>}
        <span className="rec-round-tags">{ob?.hasOffer && <Tag icon={<LockOutlined />} color="purple">{t('rec.ob.hasOffer')}</Tag>}</span>
      </div>
      <div className="rec-panel-row">
        {ob ? <span>{t('rec.ob.probationEnd')}: <b>{dmy(ob.probationEnd)}</b>{ob.note && <div className="rec-panel-note">{ob.note}</div>}</span>
          : <span className="cell-muted">{q.isLoading ? '…' : t('rec.ob.none')}</span>}
      </div>
      {ob?.hasOffer && (viewer ? (
        <div className="rec-panel-row rec-offer">
          <span><LockOutlined /> <b>{t('rec.ob.offer')}</b></span>
          {offerQ.isLoading ? <span className="cell-muted"> …</span> : offerQ.isError || !offerQ.data ? <span className="cell-muted"> {t('usr.err.generic')}</span> : (
            <div className="rec-panel-note">
              {[[t('rec.ob.probationSalary'), money(offerQ.data.probationSalary)], [t('rec.ob.salary'), money(offerQ.data.salary)],
                ...(offerQ.data.baseSalary != null ? [[t('rec.ob.baseSalary'), money(offerQ.data.baseSalary)]] : []),
                ...(offerQ.data.totalOffer != null ? [[t('rec.ob.totalOffer'), money(offerQ.data.totalOffer)]] : []),
                [t('rec.ob.allowances'), offerQ.data.allowances || '—'], [t('rec.ob.contract'), offerQ.data.contract || '—'],
                ...(offerQ.data.note ? [[t('rec.note'), offerQ.data.note]] : [])].map(([k, v]) => <div key={k}>{k}: <b>{v}</b></div>)}
            </div>
          )}
        </div>
      ) : <div className="rec-panel-row cell-muted"><LockOutlined /> {t('rec.ob.offerHidden')}</div>)}
      {ob && tracking && <div className="rec-panel-row"><span>{t('rec.tr.title')}: <ArrivalTags ob={ob} /></span>{ob.leftNote && <div className="rec-panel-note">{ob.leftNote}</div>}</div>}
      <div className="rec-round-actions">
        <Button type="primary" icon={<RocketOutlined />} onClick={() => setEditing(true)}>{ob ? t('rec.ob.edit') : t('rec.ob.create')}</Button>
        {ob && <Button icon={<MailOutlined />} onClick={() => { setToCandidate(!!app.email); setMailOffer(true); setMailing(true) }}>{t('rec.ob.mail')}</Button>}
        {ob && <Button icon={<PrinterOutlined />} onClick={() => { setWithOffer(false); setPrinting(true) }}>{t('rec.ob.print')}</Button>}
        {ob && tracking && <Button icon={<CheckCircleOutlined />} onClick={() => setTracking2(true)}>{t('rec.tr.btn')}</Button>}
        {ob && app.level === 'staff' && <OjtFromApplication applicationId={app.id} startDate={ob.startDate} probationEnd={ob.probationEnd} />}
      </div>
      {ob && tracking2 && <TrackModal app={app} ob={ob} onClose={() => setTracking2(false)} />}

      <AppModal open={editing} onClose={() => setEditing(false)} size="md" icon={<RocketOutlined />} title={t('rec.ob.title')} subtitle={`${app.fullName} · ${app.position}`}
        okText={t('rec.ob.save')} okLoading={save.isPending} onOk={() => save.mutate()}>
        <Form form={form} layout="vertical" autoComplete="off">
          <Space style={{ display: 'flex' }} align="start" wrap>
            <Form.Item name="startDate" label={t('rec.ob.startDate')} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" /></Form.Item>
            <Form.Item name="probationEnd" label={t('rec.ob.probationEnd')} extra={t('rec.ob.probationHint')}><DatePicker format="DD/MM/YYYY" /></Form.Item>
          </Space>
          <Form.Item name="location" label={t('rec.ob.location')} rules={[{ max: 200 }]}><Input /></Form.Item>
          <Form.Item name="note" label={t('rec.note')} rules={[{ max: 1000 }]}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
          {viewer ? (
            <div className="rec-offer">
              <div className="rec-section"><LockOutlined /> {t('rec.ob.offer')}</div>
              <Space style={{ display: 'flex' }} align="start" wrap>
                <Form.Item name={['offer', 'probationSalary']} label={t('rec.ob.probationSalary')}><InputNumber min={0} max={10_000_000_000} step={100_000} style={{ width: 200 }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number((v ?? '').replace(/\./g, '')) as 0} /></Form.Item>
                <Form.Item name={['offer', 'salary']} label={t('rec.ob.salary')}><InputNumber min={0} max={10_000_000_000} step={100_000} style={{ width: 200 }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number((v ?? '').replace(/\./g, '')) as 0} /></Form.Item>
                <Form.Item name={['offer', 'baseSalary']} label={t('rec.ob.baseSalary')} extra={t('rec.ob.fallbackSalary')}><InputNumber min={0} max={10_000_000_000} step={100_000} style={{ width: 200 }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number((v ?? '').replace(/\./g, '')) as 0} /></Form.Item>
                <Form.Item name={['offer', 'totalOffer']} label={t('rec.ob.totalOffer')} extra={t('rec.ob.fallbackSalary')}><InputNumber min={0} max={10_000_000_000} step={100_000} style={{ width: 200 }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number((v ?? '').replace(/\./g, '')) as 0} /></Form.Item>
              </Space>
              {(offerKrw(offerDraft) != null || offerHourly(offerDraft) != null) && <div className="cell-muted" style={{ marginBottom: 12 }}>{t('rec.ob.calc', { krw: offerKrw(offerDraft)?.toLocaleString('vi-VN') ?? '—', hourly: offerHourly(offerDraft)?.toLocaleString('vi-VN') ?? '—' })}</div>}
              <Form.Item name={['offer', 'allowances']} label={t('rec.ob.allowances')} rules={[{ max: 500 }]}><Input.TextArea rows={2} maxLength={500} /></Form.Item>
              <Form.Item name={['offer', 'contract']} label={t('rec.ob.contract')} rules={[{ max: 100 }]}><Input /></Form.Item>
              <Form.Item name={['offer', 'note']} label={t('rec.ob.offerNote')} rules={[{ max: 1000 }]}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
              <div className="cell-muted">{t('rec.ob.offerHint')}</div>
            </div>
          ) : ob?.hasOffer ? <div className="cell-muted"><LockOutlined /> {t('rec.ob.offerHidden')}</div> : null}
        </Form>
      </AppModal>

      <AppModal open={mailing} onClose={() => setMailing(false)} size="md" icon={<MailOutlined />} title={t('rec.ob.mail')} subtitle={t('rec.ob.mailHint')}
        okText={t('rec.ob.send')} okDisabled={!toCandidate && cc.length === 0} okLoading={notify.isPending} onOk={() => notify.mutate()}
        extra={toCandidate && <Button icon={<EyeOutlined />} loading={previewQ.isPending} onClick={() => previewQ.mutate()}>{t('rec.ob.preview')}</Button>}>
        <Form layout="vertical">
          {lookups.data?.autoMail && <div className="cell-muted" style={{ marginBottom: 12 }}>{t('rec.mt.autoOb')}</div>}
          <Form.Item><Checkbox checked={toCandidate} disabled={!app.email} onChange={(e) => setToCandidate(e.target.checked)}>{t('rec.ob.toCandidate', { email: app.email ?? '—' })}</Checkbox>
            {canMailOffer && <div><Checkbox checked={mailOffer && toCandidate} disabled={!toCandidate} onChange={(e) => setMailOffer(e.target.checked)}><LockOutlined /> {t('rec.ob.mailOffer')}</Checkbox></div>}
          </Form.Item>
          <Form.Item label={t('rec.ob.ccLabel')} extra={t('rec.ob.ccHint')}>
            <Select mode="tags" value={cc} tokenSeparators={[',', ';', ' ']} placeholder={t('rec.ccPh')} notFoundContent={null}
              onChange={(v: string[]) => setCc([...new Set(v.map((x) => x.trim().toLowerCase()).filter(isEmail))].slice(0, 30))} />
          </Form.Item>
          {ccGroups.length > 0 && (
            <Space wrap style={{ marginBottom: 12 }}>
              <span className="cell-muted">{t('rec.ccGroups')}</span>
              {ccGroups.map((g) => <Button key={g.name} size="small" onClick={() => setCc([...new Set([...cc, ...g.emails])].slice(0, 30))}>{g.name} ({g.emails.length})</Button>)}
            </Space>
          )}
          <Form.Item label={t('rec.inviteMsg')}><Input.TextArea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>
      <AppModal open={!!preview} onClose={() => setPreview(null)} size="md" icon={<EyeOutlined />} title={t('rec.ob.previewTitle')} subtitle={preview?.subject}>
        {/* Thư dựng từ máy chủ (đã mã hoá ký tự đặc biệt); iframe sandbox không chạy script */}
        <iframe title="preview" sandbox="" srcDoc={preview?.html ?? ''} style={{ width: '100%', height: 480, border: '1px solid var(--c-border, #d0d5dd)', borderRadius: 8, background: '#fff' }} />
      </AppModal>

      <AppModal open={printing} onClose={() => setPrinting(false)} size="sm" icon={<PrinterOutlined />} title={t('rec.ob.print')} subtitle={t('rec.ob.printHint')}
        okText={t('rec.ob.print')} okLoading={withOffer && offerQ.isFetching} onOk={doPrint}>
        {viewer && ob?.hasOffer
          ? <Space><Switch checked={withOffer} onChange={setWithOffer} /><span>{t('rec.ob.withOffer')}</span></Space>
          : <span className="cell-muted">{t('rec.ob.noOfferPrint')}</span>}
      </AppModal>
    </div>
  )
}

/** Tab "Nhận việc": người nhận việc từ 30 ngày trước đến 60 ngày tới (theo ngày nhận việc). */
export function OnboardingPanel({ onOpen }: { onOpen: (id: number) => void }) {
  const { t } = useTranslation()
  const err = useErr()
  const from = dayjs().subtract(30, 'day').format('YYYY-MM-DD'), to = dayjs().add(60, 'day').format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['recruit', 'onboardings', from, to], queryFn: () => recruit.onboardings(from, to), retry: false })
  const today = dayjs().format('YYYY-MM-DD')
  const [text, setText] = useState('')
  const [dept, setDept] = useState<string | undefined>()
  const [arrival, setArrival] = useState<string | undefined>()
  const [level, setLevel] = useState<string | undefined>()
  const all = q.data ?? []
  const depts = [...new Set(all.map((r) => r.application.department).filter((d): d is string => !!d))].sort()
  const key = text.trim().toLowerCase()
  const rows = all.filter((r) =>
    (!key || [r.application.fullName, r.application.position, r.application.phone, r.application.email, r.onboarding.location].some((v) => (v ?? '').toLowerCase().includes(key)))
    && (!dept || r.application.department === dept)
    && (!level || r.application.level === level)
    && (!arrival || (arrival === 'none' ? !r.onboarding.arrival : r.onboarding.arrival === arrival)))
  return (
    <DataTable<{ onboarding: Onboarding; application: RecruitApplication }>
      rowKey={(r) => r.onboarding.applicationId} loading={q.isLoading} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
      locale={{ emptyText: q.isError ? err(q.error) : t('rec.ob.emptyList') }}
      toolbar={<Space wrap>
        <Input.Search allowClear style={{ width: 240 }} placeholder={t('rec.ob.fSearch')} value={text} onChange={(e) => setText(e.target.value)} />
        <Select allowClear showSearch style={{ width: 200 }} placeholder={t('rec.ob.fDept')} value={dept} onChange={setDept} options={depts.map((d) => ({ value: d, label: d }))} />
        <Select allowClear style={{ width: 130 }} placeholder={t('rec.ob.fLevel')} value={level} onChange={setLevel} options={[{ value: 'staff', label: 'Staff' }, { value: 'op', label: 'OP' }]} />
        <Select allowClear style={{ width: 170 }} placeholder={t('rec.ob.fArrival')} value={arrival} onChange={setArrival}
          options={[{ value: 'none', label: t('rec.ob.fNone') }, { value: 'yes', label: t('rec.ob.fYes') }, { value: 'no', label: t('rec.ob.fNo') }]} />
        <RecruitExportMenu summary={false} scope={{ from, to }} />
        <span className="cell-muted">{rows.length}/{all.length} · {t('rec.ob.listHint')}</span>
      </Space>}
      columns={[
        { title: t('rec.ob.startDate'), width: 130, render: (_: unknown, r) => <span>{dmy(r.onboarding.startDate)}{r.onboarding.startDate < today ? null : r.onboarding.startDate === today ? <Tag color="green" style={{ marginLeft: 6 }}>{t('rec.ob.today')}</Tag> : null}</span> },
        { title: t('rec.fullName'), render: (_: unknown, r) => <span><b>{r.application.fullName}</b><div className="cell-muted">{r.application.position}</div></span> },
        { title: t('rec.department'), render: (_: unknown, r) => [r.application.department, r.application.factory].filter(Boolean).join(' · ') || '—' },
        { title: t('rec.ob.location'), dataIndex: ['onboarding', 'location'], render: (v: string | null) => v ?? '—' },
        { title: t('rec.ob.probationEnd'), width: 130, render: (_: unknown, r) => dmy(r.onboarding.probationEnd) },
        { title: t('rec.tr.title'), width: 200, render: (_: unknown, r) => <ArrivalTags ob={r.onboarding} /> },
        { title: '', width: 90, render: (_: unknown, r) => <Button size="small" onClick={() => onOpen(r.application.id)}>{t('rec.open')}</Button> },
      ]}
    />
  )
}
