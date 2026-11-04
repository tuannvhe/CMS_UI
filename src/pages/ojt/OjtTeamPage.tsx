import { useState } from 'react'
import { BookOutlined } from '@ant-design/icons'
import './ojt.css'
import { Alert, Button, Card, Empty, Input, Modal, Segmented, Skeleton, Table, Tag, Typography } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageBanner } from '../../components/PageBanner'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { ojt, type OjtDay, type OjtPlan } from '../../api/ojt'
import { OjtStatusTag, PersonSelect, dmy } from './OjtCommon'

function NoteBox({ planId, day }: { planId: number; day: OjtDay }) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [text, setText] = useState(day.log?.mentorNote ?? '')
  const save = useMutation({
    mutationFn: () => ojt.note(planId, day.date, text),
    onSuccess: () => { toast.success(t('ojt.noteSaved')); qc.invalidateQueries({ queryKey: ['ojt-detail', planId] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  return (
    <div style={{ marginTop: 8 }}>
      <Input.TextArea rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ojt.notePh')} />
      <Button size="small" style={{ marginTop: 6 }} loading={save.isPending} disabled={text === (day.log?.mentorNote ?? '')} onClick={() => save.mutate()}>{t('ojt.noteSave')}</Button>
    </div>
  )
}

function PlanDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['ojt-detail', id], queryFn: () => ojt.detail(id) })
  const [mentor, setMentor] = useState<string>()
  const assign = useMutation({
    mutationFn: () => ojt.setMentor(id, mentor!),
    onSuccess: () => { toast.success(t('ojt.assigned')); setMentor(undefined); qc.invalidateQueries({ queryKey: ['ojt-detail', id] }); qc.invalidateQueries({ queryKey: ['ojt-team'] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  const d = q.data
  const canAssign = !!d && (d.isApprover || !!user?.isAdmin) && d.plan.status !== 'done' && d.plan.status !== 'cancelled'
  const canNote = !!d && (d.isMentor || d.isApprover || !!user?.isAdmin)
  return (
    <Modal open onCancel={onClose} footer={null} width="min(960px, 94vw)" centered destroyOnHidden className="ojt-nb-modal" title={null}>
      <div className="ojt-nb">
        <header className="ojt-nb-head">
          <div className="ojt-nb-date"><b>{d ? d.plan.written : '…'}</b><span>/ {d ? d.due : '…'}</span></div>
          <div className="ojt-nb-meta">
            <h2><BookOutlined /> {d ? `${d.plan.employeeName ?? ''} (${d.plan.employeeId})` : ''}</h2>
            <p>{d ? `${d.plan.department ?? '—'} · ${dmy(d.plan.startDate)} → ${dmy(d.plan.endDate)}` : ''}</p>
            {d && <div className="ojt-nb-chips">
              <span>{t('ojt.mentor')}: {d.plan.mentorId ? `${d.plan.mentorName ?? ''} (${d.plan.mentorId})` : t('ojt.noMentor')}</span>
              <span>{t('ojt.written')}: {d.plan.written}/{d.due}</span>
            </div>}
          </div>
        </header>
        <div className="ojt-nb-body">
          {q.isLoading && <Skeleton active />}
          {d && (
            <>
              {canAssign && (
                <section className="ojt-page ojt-assign">
                  <b className="ojt-sec-title">{t('ojt.assign')}</b>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <PersonSelect value={mentor} onChange={setMentor} placeholder={t('ojt.pickMentor')} />
                    <Button type="primary" disabled={!mentor} loading={assign.isPending} onClick={() => assign.mutate()}>{t('ojt.assignBtn')}</Button>
                  </div>
                </section>
              )}
              {d.days.length === 0 && <Empty description={t('ojt.noDays')} />}
              {d.days.map((day) => (
                <section key={day.date} className="ojt-page">
                  <div className="ojt-page-date"><b>{dmy(day.date)}</b> </div>
                  {day.log ? (
                    <>
                      <Typography.Paragraph className="ojt-ruled" style={{ whiteSpace: 'pre-wrap' }}>{day.log.content}</Typography.Paragraph>
                      {day.log.difficulty && <Typography.Paragraph type="secondary" className="ojt-ruled" style={{ whiteSpace: 'pre-wrap' }}><b>{t('ojt.difficulty')}:</b> {day.log.difficulty}</Typography.Paragraph>}
                      {canNote ? <NoteBox planId={d.plan.id} day={day} /> : day.log.mentorNote && <Alert type="success" message={day.log.mentorNote} />}
                    </>
                  ) : day.onLeave ? <Tag color="gold">{t('ojt.onLeave')}</Tag> : <Tag color="red">{t('ojt.missing')}</Tag>}
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Mentor / người duyệt bộ phận (và HR) xem nhân viên mới được phân: nhật ký theo từng ngày, phân mentor, nhận xét. */
export default function OjtTeamPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<string>('all')
  const [open, setOpen] = useState<number | null>(null)
  const q = useQuery({ queryKey: ['ojt-team', status], queryFn: () => ojt.team(status === 'all' ? undefined : status) })
  return (
    <div className="page wide">
      <PageBanner avatar={<TeamOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.ojtTeam')} subtitle={t('nav.ojtTeamDesc')} />
      <Card>
        <Segmented style={{ marginBottom: 12 }} value={status} onChange={(v) => setStatus(String(v))}
          options={[{ value: 'all', label: t('ojt.all') }, { value: 'pending', label: t('ojt.status.pending') }, { value: 'active', label: t('ojt.status.active') }, { value: 'done', label: t('ojt.status.done') }]} />
        <Table<OjtPlan> rowKey="id" size="middle" loading={q.isLoading} dataSource={q.data ?? []} scroll={{ x: 760 }} locale={{ emptyText: <Empty description={t('ojt.teamEmpty')} /> }}
          onRow={(r) => ({ onClick: () => setOpen(r.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: t('ojt.employee'), render: (_: unknown, r) => <span><b>{r.employeeName}</b> <Typography.Text type="secondary">{r.employeeId}</Typography.Text></span> },
            { title: t('ojt.department'), dataIndex: 'department' },
            { title: t('ojt.mentor'), render: (_: unknown, r) => (r.mentorId ? `${r.mentorName ?? ''} (${r.mentorId})` : <Tag color="orange">{t('ojt.noMentor')}</Tag>) },
            { title: t('ojt.period'), render: (_: unknown, r) => `${dmy(r.startDate)} → ${dmy(r.endDate)}` },
            { title: t('ojt.written'), dataIndex: 'written', align: 'right' as const },
            { title: t('ojt.statusLabel'), render: (_: unknown, r) => <OjtStatusTag status={r.status} /> },
          ]} />
      </Card>
      {open !== null && <PlanDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
