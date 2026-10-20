import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Input, Popconfirm, Popover, Skeleton, Tag, Typography } from 'antd'
import { MailOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import axios from 'axios'
import { mailTemplates, MAIL_TEMPLATE_SQL, type MailLayoutDraft, type MailTemplateDraft, type MailTemplateInfo } from '../../api/mailTemplates'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useToast } from '../../hooks/useToast'

const LAYOUT = '_layout'
const GROUP_ORDER = ['approval', 'eval', 'complaint', 'hungyen', 'payslip', 'qa', 'closing', 'feed']
const EMPTY: MailTemplateDraft = { subject: '', heading: '', intro: '', buttonText: '', footer: '' }

/**
 * Mẫu email (quản trị): xem và chỉnh giao diện của từng loại email, kèm khung chung (tên hiển thị, màu, chữ trên nút, chân thư).
 * Chỗ trống để trống thì dùng mặc định. Bên phải là bản xem trước THẬT (do máy chủ vẽ, dữ liệu mẫu) cập nhật khi đang gõ; có nút gửi thử.
 */
export default function MailTemplatesPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['mail-templates'], queryFn: mailTemplates.get })
  const [sel, setSel] = useState<string>(LAYOUT)
  const [draft, setDraft] = useState<MailTemplateDraft>(EMPTY)
  const [layout, setLayout] = useState<MailLayoutDraft>({ brand: '', color: '', buttonText: '', footer: '' })
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [to, setTo] = useState('')
  const seeded = useRef<string | null>(null)

  const data = q.data
  const isLayout = sel === LAYOUT
  const info: MailTemplateInfo | undefined = data?.templates.find((x) => x.key === sel)

  // Nạp bản đã lưu vào ô nhập khi chọn mục khác hoặc vừa lưu xong
  useEffect(() => {
    if (!data) return
    const stamp = `${sel}|${data.layout.brand}|${data.layout.color}|${data.layout.custom}|${info?.custom?.updatedAt ?? ''}`
    if (seeded.current === stamp) return
    seeded.current = stamp
    setLayout({ brand: data.layout.custom ? data.layout.brand : '', color: data.layout.custom ? data.layout.color : '', buttonText: data.layout.custom ? data.layout.buttonText : '', footer: data.layout.custom ? data.layout.footer : '' })
    const c = info?.custom
    setDraft({ subject: c?.subject ?? '', heading: c?.heading ?? '', intro: c?.intro ?? '', buttonText: c?.buttonText ?? '', footer: c?.footer ?? '' })
  }, [data, sel, info])

  // Xem trước: máy chủ vẽ lại 0,5 giây sau lần gõ cuối
  useEffect(() => {
    if (!data) return
    let live = true
    const h = setTimeout(() => {
      mailTemplates.preview(isLayout ? null : sel, isLayout ? null : draft, layout).then((r) => { if (live) setPreview(r) }).catch(() => { if (live) setPreview(null) })
    }, 500)
    return () => { live = false; clearTimeout(h) }
  }, [data, sel, isLayout, draft, layout])

  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    if (d?.title === 'not_ready') return t('mt.notReadyShort')
    if (d?.title === 'invalid_input') return t('mt.invalid', { field: d?.detail ?? '' })
    return t('req.err.generic')
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['mail-templates'] })
  const save = useMutation({
    mutationFn: () => (isLayout ? mailTemplates.saveLayout(layout) : mailTemplates.save(sel, draft)),
    onSuccess: () => { message.success(t('line.updated')); refresh() }, onError: (e) => message.error(errText(e)),
  })
  const reset = useMutation({
    mutationFn: () => (isLayout ? mailTemplates.resetLayout() : mailTemplates.reset(sel)),
    onSuccess: () => { message.success(t('mt.resetDone')); seeded.current = null; refresh() }, onError: (e) => message.error(errText(e)),
  })
  const test = useMutation({
    mutationFn: () => mailTemplates.test(isLayout ? null : sel, to.trim(), isLayout ? null : draft, layout),
    onSuccess: (r) => (r.ok ? message.success(t('mt.testSent', { to })) : message.error(t('mt.testFailed'))), onError: (e) => message.error(errText(e)),
  })

  const groups = useMemo(() => {
    const map = new Map<string, MailTemplateInfo[]>()
    for (const x of data?.templates ?? []) map.set(x.group, [...(map.get(x.group) ?? []), x])
    return [...map.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
  }, [data])

  const setD = (k: keyof MailTemplateDraft, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const setL = (k: keyof MailLayoutDraft, v: string) => setLayout((l) => ({ ...l, [k]: v }))
  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="mt-field"><label>{label}</label>{node}{hint && <span className="mt-hint">{hint}</span>}</div>
  )
  const dflt = data?.defaults

  return (
    <div className="page wide">
      <PageBanner avatar={<MailOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.mailTemplates')} subtitle={t('nav.mailTemplatesDesc')} />
      {q.isError && <Alert type="error" showIcon title={t('req.err.generic')} style={{ marginBottom: 16 }} />}
      {data && !data.ready && <div style={{ marginBottom: 16 }}><SqlNotReady title={t('mt.notReady')} sql={MAIL_TEMPLATE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /></div>}
      {q.isLoading || !data || !dflt ? <Skeleton active paragraph={{ rows: 10 }} /> : (
        <div className="mt-layout">
          <aside className="mt-list">
            <button type="button" className={`mt-item${isLayout ? ' on' : ''}`} onClick={() => setSel(LAYOUT)}>
              <b>{t('mt.layoutItem')}</b>{data.layout.custom && <Tag color="success" variant="filled">{t('mt.customized')}</Tag>}
            </button>
            {groups.map(([group, rows]) => (
              <div key={group}>
                <div className="mt-group">{t(`ns.group.${group}`, { defaultValue: group })}</div>
                {rows.map((x) => (
                  <button key={x.key} type="button" className={`mt-item${sel === x.key ? ' on' : ''}`} onClick={() => setSel(x.key)}>
                    <span>{t(`ns.case.${x.key.replace('.', '_')}`, { defaultValue: x.key })}</span>
                    {x.custom && <Tag color="success" variant="filled">{t('mt.customized')}</Tag>}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          <section className="mt-edit">
            <Card size="small" title={<b>{isLayout ? t('mt.layoutItem') : t(`ns.case.${sel.replace('.', '_')}`, { defaultValue: sel })}</b>}
              extra={!isLayout && info?.custom?.updatedBy ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('ns.updated', { by: info.custom.updatedBy, at: info.custom.updatedAt ? dayjs(info.custom.updatedAt).format('DD/MM/YYYY HH:mm') : '' })}</Typography.Text> : undefined}>
              <p className="mt-help">{isLayout ? t('mt.layoutHelp') : t('mt.caseHelp')}</p>
              {isLayout ? (
                <>
                  {field(t('mt.brand'), <Input value={layout.brand} maxLength={60} placeholder={dflt.brand} onChange={(e) => setL('brand', e.target.value)} />)}
                  {field(t('mt.color'), (
                    <div className="mt-color">
                      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(layout.color) ? layout.color : dflt.color} onChange={(e) => setL('color', e.target.value)} aria-label={t('mt.color')} />
                      <Input value={layout.color} maxLength={7} placeholder={dflt.color} onChange={(e) => setL('color', e.target.value)} style={{ width: 130 }} />
                    </div>
                  ), t('mt.colorHint'))}
                  {field(t('mt.button'), <Input value={layout.buttonText} maxLength={60} placeholder={dflt.buttonText} onChange={(e) => setL('buttonText', e.target.value)} />, t('mt.buttonHint'))}
                  {field(t('mt.footer'), <Input.TextArea value={layout.footer} maxLength={500} autoSize={{ minRows: 3, maxRows: 6 }} placeholder={dflt.footer} onChange={(e) => setL('footer', e.target.value)} />, t('mt.footerHint'))}
                </>
              ) : (
                <>
                  <div className="mt-chips"><span>{t('mt.placeholders')}</span>{dflt.placeholders.map((p) => <Tag key={p}>{p}</Tag>)}</div>
                  {field(t('mt.subject'), <Input value={draft.subject} maxLength={200} placeholder={dflt.subject} onChange={(e) => setD('subject', e.target.value)} />, t('mt.subjectHint'))}
                  {field(t('mt.heading'), <Input value={draft.heading} maxLength={200} placeholder={dflt.heading} onChange={(e) => setD('heading', e.target.value)} />)}
                  {field(t('mt.intro'), <Input.TextArea value={draft.intro} maxLength={1000} autoSize={{ minRows: 3, maxRows: 8 }} placeholder={t('mt.introPh')} onChange={(e) => setD('intro', e.target.value)} />, t('mt.introHint'))}
                  {field(t('mt.button'), <Input value={draft.buttonText} maxLength={60} placeholder={data.layout.buttonText} onChange={(e) => setD('buttonText', e.target.value)} />)}
                  {field(t('mt.footer'), <Input.TextArea value={draft.footer} maxLength={500} autoSize={{ minRows: 2, maxRows: 5 }} placeholder={data.layout.footer} onChange={(e) => setD('footer', e.target.value)} />)}
                </>
              )}
              <div className="mt-actions">
                <Button type="primary" loading={save.isPending} disabled={!data.ready} onClick={() => save.mutate()}>{t('req.saveChanges')}</Button>
                <Popconfirm title={t('mt.resetAsk')} okText={t('mt.reset')} cancelText={t('req.cancel')} onConfirm={() => reset.mutate()} disabled={!data.ready || (isLayout ? !data.layout.custom : !info?.custom)}>
                  <Button icon={<UndoOutlined />} disabled={!data.ready || (isLayout ? !data.layout.custom : !info?.custom)}>{t('mt.reset')}</Button>
                </Popconfirm>
                <Popover trigger="click" placement="topLeft" title={t('mt.testTitle')} content={(
                  <div style={{ width: 300 }}>
                    <Input value={to} placeholder="ten@congty.com" onChange={(e) => setTo(e.target.value)} onPressEnter={() => to.includes('@') && test.mutate()} />
                    <Button type="primary" block style={{ marginTop: 8 }} icon={<SendOutlined />} loading={test.isPending} disabled={!to.includes('@')} onClick={() => test.mutate()}>{t('mt.testSend')}</Button>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>{t('mt.testNote')}</Typography.Text>
                  </div>
                )}>
                  <Button icon={<SendOutlined />}>{t('mt.test')}</Button>
                </Popover>
              </div>
            </Card>
          </section>

          <section className="mt-preview">
            <div className="mt-preview-head">
              <b>{t('mt.preview')}</b>
              {preview && <span title={preview.subject}>{t('mt.subjectLabel')}: {preview.subject}</span>}
            </div>
            {preview ? <iframe title={t('mt.preview')} sandbox="" srcDoc={preview.html} /> : <Skeleton active paragraph={{ rows: 10 }} />}
          </section>
        </div>
      )}
    </div>
  )
}
