import { useState } from 'react'
import { Alert, Button, Card, Empty, Progress, Skeleton, Tag, Typography } from 'antd'
import { EditOutlined, InfoCircleOutlined, ReadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { ojt, type OjtDay } from '../../api/ojt'
import { OjtStatusTag, dmy } from './OjtCommon'
import { OjtNotebook } from './OjtNotebook'
import './ojt.css'

/** Nhật ký OJT của nhân viên mới: viết mỗi ngày làm việc đến hết thử việc, xem nhận xét của mentor. */
export default function OjtMyPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['ojt-mine'], queryFn: ojt.mine })
  const [editing, setEditing] = useState<OjtDay | null>(null)
  const save = useMutation({
    mutationFn: (v: { content: string; difficulty: string }) => ojt.saveLog(editing!.date, v),
    onSuccess: () => { toast.success(t('ojt.saved')); setEditing(null); qc.invalidateQueries({ queryKey: ['ojt-mine'] }) },
    onError: (e) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) },
  })
  const open = (d: OjtDay) => setEditing(d)

  const d = q.data
  const today = dayjs().format('YYYY-MM-DD')
  const todayDay = d?.days.find((x) => x.date === today)
  const missing = d?.days.filter((x) => !x.log && !x.onLeave && x.date !== today).length ?? 0
  return (
    <div className="page wide">
      <PageBanner avatar={<ReadOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.ojtMy')} subtitle={t('nav.ojtMyDesc')} />
      {q.isLoading ? <Skeleton active /> : !d ? (
        <Card><Empty description={t('ojt.noPlan')} /></Card>
      ) : (
        <>
          <section className="ojt-hero">
            <Progress type="circle" size={112} strokeWidth={9} percent={d.due ? Math.round((d.plan.written / d.due) * 100) : 0} strokeColor="#fff" trailColor="rgba(255,255,255,.25)"
              format={(p) => <span className="ojt-hero-pct">{p}%<small>{d.plan.written}/{d.due}</small></span>} />
            <div className="ojt-hero-main">
              <h2>{t('ojt.progress', { done: d.plan.written, due: d.due })}</h2>
              <div className="ojt-nb-chips">
                <span>{dmy(d.plan.startDate)} → {dmy(d.plan.endDate)}</span>
                <span>{t('ojt.mentor')}: {d.plan.mentorId ? `${d.plan.mentorName ?? ''}` : t('ojt.noMentor')}</span>
                <span><OjtStatusTag status={d.plan.status} /></span>
                {missing > 0 && <span className="ojt-chip-warn">{t('ojt.missing')}: {missing}</span>}
              </div>
              <p className="ojt-hero-rule"><InfoCircleOutlined /> {t('ojt.rule', { days: 3 })}</p>
            </div>
            {todayDay?.canWrite && !todayDay.log && (
              <Button size="large" className="ojt-hero-cta" icon={<EditOutlined />} onClick={() => open(todayDay)}>{t('ojt.write')} · {t('ojt.today')}</Button>
            )}
          </section>
          {d.days.length === 0 && <Card><Empty description={t('ojt.noDays')} /></Card>}
          <div className="ojt-days">
            {d.days.map((day) => {
              const dd = dayjs(day.date)
              const state = day.log ? 'done' : day.onLeave ? 'leave' : day.date === today ? 'today' : 'miss'
              return (
                <div key={day.date} className={`ojt-day ojt-day-${state}`}>
                  <div className="ojt-day-tile"><b>{dd.format('DD')}</b><span>{dd.format('MM/YYYY')}</span><em>{dd.format('ddd')}</em></div>
                  <section className="ojt-page">
                    <div className="ojt-page-date">
                      <b>{dd.format('dddd, DD/MM/YYYY')}</b> {day.date === today && <Tag color="blue">{t('ojt.today')}</Tag>}
                      {day.canWrite && <Button size="small" type={day.log ? 'default' : 'primary'} icon={<EditOutlined />} onClick={() => open(day)} style={{ float: 'right' }}>{day.log ? t('ojt.edit') : t('ojt.write')}</Button>}
                    </div>
                    {day.log ? (
                      <>
                        <Typography.Paragraph className="ojt-ruled" style={{ whiteSpace: 'pre-wrap' }}>{day.log.content}</Typography.Paragraph>
                        {day.log.difficulty && <Typography.Paragraph type="secondary" className="ojt-ruled" style={{ whiteSpace: 'pre-wrap' }}><b>{t('ojt.difficulty')}:</b> {day.log.difficulty}</Typography.Paragraph>}
                        {day.log.mentorNote && <Alert type="success" showIcon message={t('ojt.mentorNote')} description={<span style={{ whiteSpace: 'pre-wrap' }}>{day.log.mentorNote}</span>} />}
                      </>
                    ) : day.onLeave ? <Tag color="gold">{t('ojt.onLeave')}</Tag> : <Tag color={day.date === today ? 'blue' : 'red'}>{t('ojt.missing')}</Tag>}
                  </section>
                </div>
              )
            })}
          </div>
        </>
      )}
      <OjtNotebook open={!!editing} date={editing?.date ?? today} dayNo={editing ? (d?.days.length ?? 1) - (d?.days.findIndex((x) => x.date === editing.date) ?? 0) : 1} dayTotal={d?.days.length ?? 1}
        mentorName={d?.plan.mentorName} initial={{ content: editing?.log?.content ?? '', difficulty: editing?.log?.difficulty ?? '' }} saving={save.isPending}
        onClose={() => setEditing(null)} onSave={(v) => save.mutate(v)} />
    </div>
  )
}
