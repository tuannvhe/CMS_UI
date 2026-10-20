import { useState } from 'react'
import { Avatar, Button, Descriptions, Drawer, Empty, Form, Input, Radio, Segmented, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SolutionOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cvUrl, recruit, type RecruitMine } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { CvViewer } from './RecruitCommon'

/** Người đánh giá CV (bộ phận): chỉ thấy hồ sơ HR đã gửi cho mình; xem CV rồi chọn mời phỏng vấn hoặc không phù hợp (kèm lý do). */
export default function RecruitMyPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [pending, setPending] = useState(true)
  const [openId, setOpenId] = useState<number | null>(null)
  const [form] = Form.useForm<{ decision: 'invite' | 'reject'; comment?: string }>()

  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const q = useQuery({ queryKey: ['recruit', 'mine', pending], queryFn: () => recruit.mine(pending), retry: false })
  const detail = useQuery({ queryKey: ['recruit', 'mineDetail', openId], queryFn: () => recruit.mineGet(openId!), enabled: openId !== null, retry: false })
  const decide = useMutation({
    mutationFn: (v: { decision: 'invite' | 'reject'; comment?: string }) => recruit.decide(openId!, v.decision, v.comment),
    onSuccess: () => { msg.success(t('rec.decided')); setOpenId(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(errText(e)),
  })

  const day = (v: string) => new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString(i18n.language)
  const mine = detail.data?.screenings[0]
  const app = detail.data?.application
  const open = !!mine && !mine.decision && !mine.revoked

  const columns: ColumnsType<RecruitMine> = [
    { title: t('rec.fullName'), render: (_: unknown, r) => <b>{r.application.fullName}</b> },
    { title: t('rec.position'), render: (_: unknown, r) => r.application.position },
    { title: t('rec.dueDate'), width: 120, render: (_: unknown, r) => day(r.screening.dueDate) },
    { title: t('rec.decision'), width: 150, render: (_: unknown, r) => r.screening.decision ? <Tag color={r.screening.decision === 'invite' ? 'green' : 'red'}>{t(`rec.dec.${r.screening.decision}`)}</Tag> : <Tag color={r.screening.overdue ? 'red' : 'blue'}>{r.screening.overdue ? t('rec.overdue') : t('rec.waiting')}</Tag> },
    { title: '', width: 110, render: (_: unknown, r) => <Button size="small" type={r.screening.decision ? 'default' : 'primary'} onClick={() => setOpenId(r.application.id)}>{t(r.screening.decision ? 'rec.open' : 'rec.review')}</Button> },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<SolutionOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.recruitMy')} subtitle={t('nav.recruitMyDesc')} />
      <DataTable<RecruitMine>
        rowKey={(r) => r.screening.id} loading={q.isLoading} columns={columns} dataSource={q.data ?? []} pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: q.isError ? t('usr.err.generic') : <Empty description={t('rec.emptyMine')} /> }}
        toolbar={<Segmented value={pending ? 'p' : 'a'} onChange={(v) => setPending(v === 'p')} options={[{ value: 'p', label: t('rec.fPending') }, { value: 'a', label: t('org.all') }]} />}
      />
      <Drawer open={openId !== null} onClose={() => setOpenId(null)} width="min(1100px, 100vw)" title={app ? `${app.fullName} · ${app.position}` : ''} destroyOnClose>
        {app && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label={t('rec.position')}>{app.position}</Descriptions.Item>
              <Descriptions.Item label={t('rec.department')}>{[app.department, app.factory].filter(Boolean).join(' · ') || '—'}</Descriptions.Item>
            </Descriptions>
            {detail.data?.file && open ? <CvViewer src={cvUrl(app.id, false)} hideTools height="62vh" /> : null}
            {open ? (
              <Form form={form} layout="vertical" initialValues={{ decision: 'invite' }} onFinish={(v) => decide.mutate(v)}>
                <Form.Item name="decision" label={t('rec.decision')} rules={[{ required: true }]}>
                  <Radio.Group size="large" optionType="button" buttonStyle="solid" options={[{ value: 'invite', label: t('rec.dec.invite') }, { value: 'reject', label: t('rec.dec.reject') }]} />
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(a, b) => a.decision !== b.decision}>
                  {() => <Form.Item name="comment" label={t('rec.comment')} rules={[{ max: 1000 }, ...(form.getFieldValue('decision') === 'reject' ? [{ required: true, min: 2, message: t('rec.reasonRequired') }] : [])]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>}
                </Form.Item>
                <Button type="primary" size="large" htmlType="submit" loading={decide.isPending}>{t('rec.submit')}</Button>
              </Form>
            ) : mine && <span className="cell-muted">{mine.revoked ? t('rec.revokedTag') : `${t('rec.dec.' + mine.decision)}${mine.comment ? ': ' + mine.comment : ''}`}</span>}
          </Space>
        )}
      </Drawer>
    </div>
  )
}
