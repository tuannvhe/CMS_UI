import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Col, Form, Input, Progress, Row, Select, Spin, Tag } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, MailOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { INTERNAL_MAIL_KEYS, recruit, type RecruitApplication } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

/** Mẫu mặc định khi gửi hàng loạt: xác nhận thông tin ứng viên trước phỏng vấn. */
export const CONFIRM_KEY = 'candidate_confirm'
/** Mẫu không gửi hàng loạt được: thư mời PV cần lịch riêng từng người, offer có lương riêng. */
const NOT_BULK = ['invite_v1', 'invite_v1_online', 'invite_v2', 'job_offer']
/** Ô tự điền riêng từng ứng viên (không cho sửa chung). */
const PER_PERSON = ['name', 'position']
const PREVIEW_STYLE = { width: '100%', height: 'calc(100vh - 300px)', minHeight: 480, border: '1px solid var(--c-border, #d0d5dd)', borderRadius: 8, background: '#fff' } as const
const emailOk = (x?: string | null) => !!x && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.trim())

type Result = { state: 'ok' | 'fail'; error?: string }

/**
 * Gửi một mẫu mail cho nhiều CV đã chọn ở màn Quản lý CV. Mỗi ứng viên nhận một thư riêng (tên, vị trí theo hồ sơ);
 * các ô chung (vd hạn phản hồi) HR sửa một lần. Thư có Reply-To là email của HR đang gửi nên ứng viên trả lời thẳng về HR đó.
 * Gửi lần lượt từng thư (dùng lại API gửi 1 thư), hồ sơ không có email bị bỏ qua.
 */
export function MailBulkModal({ apps, onClose, onDone }: { apps: RecruitApplication[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const targets = useMemo(() => apps.filter((a) => emailOk(a.email)), [apps])
  const skipped = apps.length - targets.length
  const templates = useQuery({ queryKey: ['recruit', 'mail-templates'], queryFn: recruit.mailTemplates })
  const options = (templates.data ?? []).filter((x) => !INTERNAL_MAIL_KEYS.includes(x.key) && !NOT_BULK.includes(x.key))
  const [key, setKey] = useState(CONFIRM_KEY)
  useEffect(() => { if (options.length > 0 && !options.some((o) => o.key === key)) setKey(options[0].key) }, [options, key])
  const [values, setValues] = useState<Record<string, string>>({})
  const [debounced, setDebounced] = useState<Record<string, string>>({})
  useEffect(() => { const h = setTimeout(() => setDebounced(values), 400); return () => clearTimeout(h) }, [values])
  const [previewId, setPreviewId] = useState<number | undefined>(targets[0]?.id)
  const draft = useQuery({
    queryKey: ['recruit', 'mail-draft', previewId, key, debounced], queryFn: () => recruit.mailDraft(previewId!, { key, values: debounced }),
    enabled: previewId != null, retry: false, gcTime: 0, placeholderData: (prev) => prev,
  })
  const d = draft.data?.key === key ? draft.data : undefined
  const shared = (d?.fields ?? []).filter((f) => !PER_PERSON.includes(f))
  const missing = shared.filter((f) => !(values[f] ?? d?.values[f] ?? '').trim())
  const [results, setResults] = useState<Record<number, Result>>({})
  const [running, setRunning] = useState(false)
  const done = Object.keys(results).length
  const failed = Object.values(results).filter((r) => r.state === 'fail').length
  const finished = done > 0 && !running

  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const changeKey = (k: string) => { setKey(k); setValues({}); setDebounced({}); setResults({}) }

  const sendAll = async () => {
    if (!d) return
    // Ô chung: giá trị HR sửa, chưa sửa thì giá trị gợi ý của thư xem trước (vd hạn +3 ngày) để mọi thư cùng một hạn
    const common = Object.fromEntries(shared.map((f) => [f, (values[f] ?? d.values[f] ?? '').trim()]))
    setRunning(true)
    const res: Record<number, Result> = {}
    for (const a of targets) {
      if (results[a.id]?.state === 'ok') { res[a.id] = results[a.id]; continue }   // bấm gửi lại: bỏ qua thư đã gửi được
      try { await recruit.sendMail(a.id, { key, values: common }); res[a.id] = { state: 'ok' } }
      catch (e) { res[a.id] = { state: 'fail', error: errText(e) } }
      setResults({ ...res })
    }
    setRunning(false)
    targets.forEach((a) => qc.invalidateQueries({ queryKey: ['recruit', 'detail', a.id] }))
    const ok = Object.values(res).filter((r) => r.state === 'ok').length
    if (ok === targets.length) { msg.success(t('rec.mb.sentAll', { n: ok })); onDone(); onClose() }
    else msg.warning(t('rec.mb.someFailed', { ok, n: targets.length - ok }))
  }

  return (
    <AppModal open onClose={() => { if (finished) onDone(); onClose() }} size="screen" icon={<MailOutlined />} title={t('rec.mb.title', { n: targets.length })}
      subtitle={t('rec.mb.replyHint')}
      okText={failed > 0 ? t('rec.mb.retry', { n: failed }) : t('rec.mb.send', { n: targets.length })} okLoading={running}
      okDisabled={!d || targets.length === 0 || missing.length > 0 || (finished && failed === 0)} onOk={sendAll}
      extra={missing.length > 0 ? <Tag color="orange">{t('rec.mt.missing', { n: missing.length })}</Tag> : null}>
      <Row gutter={20}>
        <Col xs={24} lg={9}>
          <Form layout="vertical">
            <Form.Item label={t('rec.mt.template')}>
              <Select value={key} onChange={changeKey} loading={templates.isLoading} disabled={running} options={options.map((x) => ({ value: x.key, label: x.name }))} />
            </Form.Item>
            {skipped > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('rec.mb.noEmail', { n: skipped })} />}
            {draft.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={errText(draft.error)} />}
            {shared.length > 0 && <div style={{ fontWeight: 600, margin: '4px 0 8px' }}>{t('rec.mb.common')}</div>}
            {d && shared.map((f) => (
              <Form.Item key={f} label={f === 'deadline' && key === CONFIRM_KEY ? t('rec.mb.deadline') : t(`rec.mt.f.${f}`)} validateStatus={missing.includes(f) ? 'warning' : undefined} style={{ marginBottom: 10 }}>
                <Input value={values[f] ?? d.values[f] ?? ''} maxLength={500} disabled={running} onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))} />
              </Form.Item>
            ))}
            <div style={{ fontWeight: 600, margin: '8px 0' }}>{t('rec.mb.list', { n: targets.length })}</div>
            {done > 0 && <Progress percent={Math.round((done / Math.max(targets.length, 1)) * 100)} status={failed > 0 ? 'exception' : running ? 'active' : 'success'} size="small" style={{ marginBottom: 8 }} />}
            <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--c-border, #e5e7eb)', borderRadius: 8 }}>
              {targets.map((a) => {
                const r = results[a.id]
                return (
                  <div key={a.id} onClick={() => setPreviewId(a.id)}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--c-border, #f0f0f0)', background: a.id === previewId ? 'var(--c-primary-bg, #e8f3ee)' : undefined }}>
                    {r?.state === 'ok' ? <CheckCircleFilled style={{ color: '#2e7d32' }} /> : r?.state === 'fail' ? <CloseCircleFilled style={{ color: '#d32f2f' }} /> : <MailOutlined style={{ color: '#9ca3af' }} />}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{a.fullName} <span className="cell-muted" style={{ fontWeight: 400 }}>· {a.position}</span></div>
                      <div className="cell-muted" style={{ fontSize: 12 }}>{a.email}</div>
                      {r?.error && <div style={{ color: '#d32f2f', fontSize: 12 }}>{r.error}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Form>
        </Col>
        <Col xs={24} lg={15}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('rec.mb.preview', { name: targets.find((a) => a.id === previewId)?.fullName ?? '' })}</div>
          <Spin spinning={draft.isFetching}>
            <iframe title="mail-bulk-preview" sandbox="" srcDoc={d?.html ?? ''} style={PREVIEW_STYLE} />
          </Spin>
        </Col>
      </Row>
    </AppModal>
  )
}

/** Nút trên thanh hồ sơ đã chọn: gửi mẫu mail (mặc định Xác nhận thông tin ứng viên) cho các CV đã chọn. */
export function MailBulkButton({ apps, onDone }: { apps: RecruitApplication[]; onDone: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const n = apps.filter((a) => emailOk(a.email)).length
  return (
    <>
      <Button icon={<MailOutlined />} disabled={n === 0} title={n === 0 ? t('rec.rm.noEmail') : undefined} onClick={() => setOpen(true)}>{t('rec.mb.btn', { n })}</Button>
      {open && <MailBulkModal apps={apps} onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  )
}
