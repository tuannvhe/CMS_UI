import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Card, Col, Form, Input, Row, Space, Switch, Tag, Typography } from 'antd'
import { GiftOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { adminError } from '../../api/userAdmin'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

interface Msg { enabled: boolean; company: string; title: string; body: string }
interface Res { message: Msg; defaults: Msg }

const birthdayApi = {
  get: () => api.get<Res>('/admin/birthday-message').then((r) => r.data),
  save: (m: Msg) => api.put<Res>('/admin/birthday-message', m).then((r) => r.data),
}

const SAMPLE = 'NGUYỄN VĂN A'
const fill = (s: string, company: string, name: string) => s.split('{company}').join(company).split('{name}').join(name)

/** Soạn tin chúc mừng sinh nhật gửi lúc 07:00 cho người có sinh nhật hôm đó. Dùng {name} (họ tên) và {company} (tên công ty). */
export default function BirthdayMessagePage() {
  const { t } = useTranslation()
  const msg = useToast()
  const q = useQuery({ queryKey: ['birthday-message'], queryFn: birthdayApi.get })
  const [m, setM] = useState<Msg | null>(null)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (q.data && !dirty) setM(q.data.message) }, [q.data, dirty])
  const set = (patch: Partial<Msg>) => { setM((x) => (x ? { ...x, ...patch } : x)); setDirty(true) }

  const save = useMutation({
    mutationFn: () => birthdayApi.save(m!),
    onSuccess: (r) => { msg.success(t('bdm.saved')); setM(r.message); setDirty(false); q.refetch() },
    onError: (e) => { const { code, detail } = adminError(e); msg.error(code === 'cannot_write' ? t('occm.err.cannot_write') : t(`bdm.err.${detail}`, { defaultValue: t('usr.err.generic') })) },
  })

  if (!m) return <div className="page"><Card loading /></div>
  const def = q.data?.defaults
  const title = fill(m.title, m.company, SAMPLE)
  const body = fill(m.body, m.company, SAMPLE)

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<GiftOutlined />} />} title={t('nav.birthdayMessage')} subtitle={t('nav.birthdayMessageDesc')}
        extra={<Space wrap>
          <Button icon={<ReloadOutlined />} disabled={!def} onClick={() => { if (def) { setM({ ...def, enabled: m.enabled }); setDirty(true) } }}>{t('bdm.reset')}</Button>
          <Button type="primary" icon={<SaveOutlined />} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>{t('req.saveChanges')}</Button>
        </Space>} />
      {dirty && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('bdm.dirty')} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <Card>
            <Form layout="vertical">
              <Form.Item><Space><Switch checked={m.enabled} onChange={(v) => set({ enabled: v })} /> {t('bdm.enabled')}</Space></Form.Item>
              <Form.Item label={t('bdm.company')}><Input value={m.company} maxLength={80} onChange={(e) => set({ company: e.target.value })} /></Form.Item>
              <Form.Item label={t('bdm.title')} required><Input value={m.title} maxLength={150} onChange={(e) => set({ title: e.target.value })} /></Form.Item>
              <Form.Item label={t('bdm.body')} required extra={<span>{t('bdm.vars')} <Tag>{'{name}'}</Tag> <Tag>{'{company}'}</Tag></span>}>
                <Input.TextArea rows={14} value={m.body} maxLength={4000} showCount onChange={(e) => set({ body: e.target.value })} />
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={11}>
          <Card title={t('bdm.preview')}>
            <div className="notif-row" data-kind="birthday" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="notif-ico" style={{ background: '#D6336C' }}><span aria-hidden>🎂</span></span>
              <span className="notif-txt">
                <b>{title}</b>
                <span style={{ whiteSpace: 'pre-line', display: 'block', WebkitLineClamp: 'unset' }}>{body}</span>
              </span>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>{t('bdm.previewNote', { name: SAMPLE })}</Typography.Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
