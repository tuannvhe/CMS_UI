import { useState } from 'react'
import { Avatar, Button, Card, Col, Empty, Form, Input, Radio, Row, Segmented, Space, Tag } from 'antd'
import { AuditOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { cvUrl, recruit, type AllInterview, type MyInterview } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { CvViewer } from './RecruitCommon'

/**
 * Người phỏng vấn (máy tính / tablet): lịch của mình, xem CV ngay trong lúc phỏng vấn và nhập đánh giá. Nút lớn, bố cục xếp dọc trên màn hẹp.
 * Mỗi người chỉ thấy phần đánh giá của chính mình, không thấy ý kiến người khác.
 */
export default function RecruitInterviewsPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canAll = !!user?.isAdmin || !!user?.grantedPages?.includes('recruitManage')
  const [all, setAll] = useState(false)
  const [viewing, setViewing] = useState<AllInterview | null>(null)
  const [pending, setPending] = useState(true)
  const [active, setActive] = useState<MyInterview | null>(null)
  const [form] = Form.useForm<{ result: 'pass' | 'fail'; strengths?: string; weaknesses?: string; comment?: string }>()
  const result = Form.useWatch('result', form)

  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const q = useQuery({ queryKey: ['recruit', 'myInterviews', pending], queryFn: () => recruit.myInterviews(pending), retry: false, refetchInterval: 60_000 })
  const qa = useQuery({ queryKey: ['recruit', 'allInterviews', pending], queryFn: () => recruit.allInterviews(pending), retry: false, enabled: all, refetchInterval: 60_000 })
  const submit = useMutation({
    mutationFn: (v: { result: 'pass' | 'fail'; strengths?: string; weaknesses?: string; comment?: string }) => recruit.evaluate(active!.interview.id, v),
    onSuccess: () => { msg.success(t('rec.evaluated')); setActive(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(errText(e)),
  })

  const time = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const canEvaluate = (m: MyInterview) => m.interview.status === 'planned' && !m.mine.result && m.application.status === 'scheduled'
  const items = q.data ?? []

  if (viewing) {
    const a = viewing.application
    return (
      <div className="page wide">
        <Space style={{ marginBottom: 12 }} wrap>
          <Button size="large" onClick={() => setViewing(null)}>← {t('rec.back')}</Button>
          <b style={{ fontSize: 18 }}>{a.fullName}</b><span className="cell-muted">{a.position} · {time(viewing.interview.startAt)}{viewing.interview.location ? ` · ${viewing.interview.location}` : ''}</span>
        </Space>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>{a.hasFile ? <CvViewer src={cvUrl(a.id, false)} height="78vh" /> : <Empty description={t('rec.noCv')} />}</Col>
          <Col xs={24} xl={10}>
            <Card title={t('rec.panel')}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {viewing.interview.panel.map((p) => (
                  <div key={p.id}><b>{p.interviewerName ?? p.interviewerId}</b> {p.result ? <Tag color={p.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${p.result}`)}</Tag> : <Tag>{t('rec.waiting')}</Tag>}
                    {p.strengths && <div>+ {p.strengths}</div>}{p.weaknesses && <div>− {p.weaknesses}</div>}{p.comment && <div>{p.comment}</div>}</div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    )
  }

  if (active) {
    const a = active.application
    return (
      <div className="page wide">
        <Space style={{ marginBottom: 12 }} wrap>
          <Button size="large" onClick={() => { setActive(null); form.resetFields() }}>← {t('rec.back')}</Button>
          <b style={{ fontSize: 18 }}>{a.fullName}</b><span className="cell-muted">{a.position} · {time(active.interview.startAt)}{active.interview.location ? ` · ${active.interview.location}` : ''}</span>
        </Space>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>{canEvaluate(active) || active.application.status === 'evaluated' ? <CvViewer src={cvUrl(a.id, false)} hideTools height="78vh" /> : <Empty description={t('rec.noCv')} />}</Col>
          <Col xs={24} xl={10}>
            <Card title={t('rec.myEvaluation')}>
              {canEvaluate(active) ? (
                <Form form={form} layout="vertical" onFinish={(v) => submit.mutate(v)}>
                  <Form.Item name="result" label={t('rec.result')} rules={[{ required: true, message: t('rec.err.result') }]}>
                    <Radio.Group size="large" optionType="button" buttonStyle="solid" options={[{ value: 'pass', label: t('rec.res.pass') }, { value: 'fail', label: t('rec.res.fail') }]} />
                  </Form.Item>
                  <Form.Item name="strengths" label={t('rec.strengths')} rules={[{ max: 1000 }]}><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
                  <Form.Item name="weaknesses" label={t('rec.weaknesses')} rules={[{ max: 1000 }]}><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
                  <Form.Item name="comment" label={t('rec.comment')} rules={[{ max: 1000 }, ...(result === 'fail' ? [{ required: true, min: 2, message: t('rec.reasonRequired') }] : [])]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>
                  <Button type="primary" size="large" htmlType="submit" loading={submit.isPending} block>{t('rec.submit')}</Button>
                </Form>
              ) : active.mine.result ? (
                <Space direction="vertical">
                  <Tag color={active.mine.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${active.mine.result}`)}</Tag>
                  {active.mine.strengths && <div><b>{t('rec.strengths')}:</b> {active.mine.strengths}</div>}
                  {active.mine.weaknesses && <div><b>{t('rec.weaknesses')}:</b> {active.mine.weaknesses}</div>}
                  {active.mine.comment && <div><b>{t('rec.comment')}:</b> {active.mine.comment}</div>}
                </Space>
              ) : <span className="cell-muted">{t('rec.ivClosed')}</span>}
            </Card>
          </Col>
        </Row>
      </div>
    )
  }

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<AuditOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.recruitInterviews')} subtitle={t('nav.recruitInterviewsDesc')} />
      <Space wrap style={{ marginBottom: 16 }}>
        {canAll && <Segmented value={all ? 'all' : 'mine'} onChange={(v) => setAll(v === 'all')} options={[{ value: 'mine', label: t('rec.viewMine') }, { value: 'all', label: t('rec.viewAll') }]} />}
        <Segmented value={pending ? 'p' : 'a'} onChange={(v) => setPending(v === 'p')} options={[{ value: 'p', label: t('rec.fPending') }, { value: 'a', label: t('org.all') }]} />
      </Space>
      {all ? ((qa.data ?? []).length === 0 ? <Empty description={qa.isError ? t('usr.err.generic') : t('rec.emptyInterviews')} /> : (
        <Row gutter={[16, 16]}>
          {(qa.data ?? []).map((m) => (
            <Col xs={24} md={12} xl={8} key={m.interview.id}>
              <Card hoverable onClick={() => setViewing(m)} title={time(m.interview.startAt)} extra={<Tag>{t(`rec.iv.${m.interview.status}`)}</Tag>}>
                <b style={{ fontSize: 16 }}>{m.application.fullName}</b>
                <div className="cell-muted">{m.application.position}{m.application.department ? ` · ${m.application.department}` : ''}</div>
                <div className="cell-muted">{t('rec.round')} {m.interview.round}{m.interview.location ? ` · ${m.interview.location}` : ''}</div>
                <Space size={4} wrap style={{ marginTop: 8 }}>{m.interview.panel.map((p) => <Tag key={p.id} color={p.result === 'pass' ? 'green' : p.result === 'fail' ? 'red' : undefined}>{p.interviewerName ?? p.interviewerId}</Tag>)}</Space>
              </Card>
            </Col>
          ))}
        </Row>
      )) : items.length === 0 ? <Empty description={q.isError ? t('usr.err.generic') : t('rec.emptyInterviews')} /> : (
        <Row gutter={[16, 16]}>
          {items.map((m) => (
            <Col xs={24} md={12} xl={8} key={m.interview.id}>
              <Card hoverable onClick={() => setActive(m)} title={<span>{time(m.interview.startAt)}</span>} extra={m.mine.result ? <Tag color={m.mine.result === 'pass' ? 'green' : 'red'}>{t(`rec.res.${m.mine.result}`)}</Tag> : m.interview.status === 'planned' ? <Tag color="blue">{t('rec.waiting')}</Tag> : <Tag>{t(`rec.iv.${m.interview.status}`)}</Tag>}>
                <b style={{ fontSize: 16 }}>{m.application.fullName}</b>
                <div className="cell-muted">{m.application.position}{m.application.department ? ` · ${m.application.department}` : ''}</div>
                <div className="cell-muted">{t('rec.round')} {m.interview.round}{m.interview.location ? ` · ${m.interview.location}` : ''}</div>
                <Button type={canEvaluate(m) ? 'primary' : 'default'} size="large" block style={{ marginTop: 12 }}>{t(canEvaluate(m) ? 'rec.openAndEvaluate' : 'rec.open')}</Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
