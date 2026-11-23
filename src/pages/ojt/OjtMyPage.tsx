import { useEffect, useRef, useState } from 'react'
import { Button, Card, Empty, Skeleton } from 'antd'
import { CheckCircleFilled, CoffeeOutlined, EditOutlined, InfoCircleOutlined, LeftOutlined, ReadOutlined, RightOutlined, WarningFilled } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { ojt, type OjtDay, type OjtReview } from '../../api/ojt'
import { OjtAvatar, OjtStatusTag, dmy, useOjtAvatars } from './OjtCommon'
import { OjtNotebook } from './OjtNotebook'
import { MyReviews } from './OjtReviews'
import { MentorNote, OjtDayCard, ojtLocale } from './OjtDayCard'
import './ojt.css'
import './ojt-my.css'

const monday = (date: string) => { const d = dayjs(date); return d.subtract((d.day() + 6) % 7, 'day').format('YYYY-MM-DD') }

type Cell = { date: string; state: string; day?: OjtDay }

/**
 * Nhật ký OJT của nhân viên mới. Bố cục (từ trên xuống):
 *  1. Thẻ "Hôm nay": trạng thái hôm nay + nút Viết nhật ký hôm nay thật nổi, bên phải là tiến độ cả đợt.
 *  2. Dải "Viết bù": các ngày chưa viết, bấm là mở form viết luôn (không phải đi tìm tuần).
 *  3. Một thanh chọn tuần duy nhất, bên dưới là các ngày của tuần đó (thứ 2 → thứ 7).
 *  4. Cột phụ: mentor, nhận xét tuần, quy tắc (trên điện thoại nằm dưới cùng).
 */
export default function OjtMyPage() {
  const { t, i18n } = useTranslation()
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
  const loc = ojtLocale(i18n.language)

  const d = q.data
  const today = dayjs().format('YYYY-MM-DD')
  const todayDay = d?.days.find((x) => x.date === today)
  const stateOf = (x: OjtDay) => (x.log ? 'done' : x.onLeave ? 'leave' : x.date === today ? 'today' : 'miss')
  const missDays = (d?.days ?? []).filter((x) => stateOf(x) === 'miss').sort((a, b) => a.date.localeCompare(b.date))
  const left = d ? dayjs(d.plan.endDate).diff(dayjs(today), 'day') : 0
  const pct = d?.due ? Math.min(100, Math.round((d.plan.written / d.due) * 100)) : 0
  const leaders = d?.leaders ?? []
  const mentors = d?.mentors?.length ? d.mentors : d?.plan.mentorId ? [{ id: d.plan.mentorId, name: d.plan.mentorName ?? d.plan.mentorId }] : []
  const photos = useOjtAvatars([...mentors.map((m) => m.id), ...leaders.map((l) => l.id)])
  const weekReview = (k: string): OjtReview | undefined => d?.reviews?.find((r) => r.kind === 'week' && r.periodStart === k)

  // Các tuần của cả đợt OJT (kể cả tuần chưa tới), mỗi tuần thứ 2 → thứ 7
  const thisWeek = monday(today)
  const allWeeks: { key: string; cells: Cell[] }[] = []
  if (d) {
    const byDate = new Map(d.days.map((x) => [x.date, x]))
    for (let m = dayjs(monday(d.plan.startDate)); !m.isAfter(dayjs(d.plan.endDate)); m = m.add(7, 'day')) {
      const cells = [0, 1, 2, 3, 4, 5].map((n) => {
        const date = m.add(n, 'day').format('YYYY-MM-DD')
        const day = byDate.get(date)
        return { date, day, state: day ? stateOf(day) : date > today && date >= d.plan.startDate && date <= d.plan.endDate ? 'future' : 'off' }
      }).filter((c) => c.state !== 'off')
      allWeeks.push({ key: m.format('YYYY-MM-DD'), cells })
    }
  }
  const info = (w: { key: string; cells: Cell[] }) => {
    const done = w.cells.filter((c) => c.state === 'done').length
    const total = w.cells.filter((c) => c.state !== 'future').length
    const miss = w.cells.filter((c) => c.state === 'miss').length
    const st = total === 0 ? 'future' : miss > 0 ? 'bad' : w.key === thisWeek ? 'now' : done === total ? 'ok' : 'part'
    return { done, total, miss, st, rv: weekReview(w.key) }
  }
  const [sel, setSel] = useState<string | null>(null)
  const defaultWeek = allWeeks.find((w) => w.key === thisWeek)?.key ?? allWeeks.filter((w) => info(w).total > 0).pop()?.key ?? allWeeks[0]?.key ?? ''
  const cur = sel && allWeeks.some((w) => w.key === sel) ? sel : defaultWeek
  const curIdx = allWeeks.findIndex((w) => w.key === cur)
  const curWeek = allWeeks[curIdx]
  const curInfo = curWeek ? info(curWeek) : null
  const weekDays = curWeek ? curWeek.cells.filter((c) => c.day).map((c) => c.day!) : []
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => { barRef.current?.querySelector('.sel')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }, [cur, d?.plan.id])
  const step = (n: number) => { const w = allWeeks[curIdx + n]; if (w) setSel(w.key) }
  // Ngày chưa viết: còn hạn thì mở form luôn, quá hạn thì nhảy tới thẻ ngày đó để xem
  const goMiss = (day: OjtDay) => {
    if (day.canWrite) { open(day); return }
    setSel(monday(day.date))
    setTimeout(() => document.getElementById(`ojt-day-${day.date}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }
  const fmt = (date: string, f: string) => dayjs(date).locale(loc).format(f)

  return (
    <div className="page wide ojt-root om">
      <PageBanner avatar={<ReadOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.ojtMy')} subtitle={t('nav.ojtMyDesc')} />
      {q.isLoading ? <Skeleton active /> : !d ? (
        <Card><Empty description={t('ojt.noPlan')} /></Card>
      ) : (
        <>
          <section className="om-hero">
            <div className={`om-today om-today-${todayDay ? stateOf(todayDay) : 'off'}`}>
              <div className="om-cal" aria-hidden>
                <small>{fmt(today, 'ddd')}</small>
                <b>{fmt(today, 'DD')}</b>
                <span>{fmt(today, 'MM/YYYY')}</span>
              </div>
              <div className="om-today-main">
                <span className="om-eyebrow">{t('ojt.today')}</span>
                {!todayDay ? (
                  <h2><CoffeeOutlined /> {t('ojt.todayOff')}</h2>
                ) : todayDay.log ? (
                  <h2 className="ok"><CheckCircleFilled /> {t('ojt.todayDone')}</h2>
                ) : todayDay.onLeave ? (
                  <h2><CoffeeOutlined /> {t('ojt.todayLeave')}</h2>
                ) : (
                  <h2>{t('ojt.todayTodo')}</h2>
                )}
                {todayDay?.canWrite && !todayDay.onLeave && (
                  todayDay.log
                    ? <Button size="large" icon={<EditOutlined />} onClick={() => open(todayDay)}>{t('ojt.edit')}</Button>
                    : <Button size="large" type="primary" className="om-cta" icon={<EditOutlined />} onClick={() => open(todayDay)}>{t('ojt.writeToday')}</Button>
                )}
              </div>
            </div>
            <div className="om-progress">
              <div className="om-progress-head">
                <b>{t('ojt.progress', { done: d.plan.written, due: d.due })}</b>
                <OjtStatusTag status={d.plan.status} />
              </div>
              <div className="om-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
              <div className="om-stats">
                <div><b>{d.plan.written}<small>/{d.due}</small></b><span>{t('ojt.statWritten')}</span></div>
                <div className={missDays.length > 0 ? 'bad' : ''}><b>{missDays.length}</b><span>{t('ojt.statMissing')}</span></div>
                <div><b>{Math.max(0, left)}</b><span>{t('ojt.statLeft')}</span></div>
              </div>
              <p className="om-period">{dmy(d.plan.startDate)} → {dmy(d.plan.endDate)}{left < 0 ? ` · ${t('ojt.daysEnded')}` : ''}</p>
            </div>
          </section>

          {missDays.length > 0 && (
            <section className="om-miss" role="alert">
              <div className="om-miss-text"><WarningFilled /> {t('ojt.missWarn', { n: missDays.length })}</div>
              <div className="om-miss-days">
                {missDays.map((x) => (
                  <button key={x.date} type="button" className={`om-miss-day${x.canWrite ? '' : ' late'}`} onClick={() => goMiss(x)} title={x.canWrite ? t('ojt.catchUp') : t('ojt.tooLate')}>
                    <small>{fmt(x.date, 'ddd')}</small><b>{fmt(x.date, 'DD/MM')}</b>
                    <em>{x.canWrite ? <><EditOutlined /> {t('ojt.catchUp')}</> : t('ojt.tooLate')}</em>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="om-cols">
            <main className="om-main">
              {d.days.length === 0 && <Card><Empty description={t('ojt.noDays')} /></Card>}
              {allWeeks.length > 0 && (
                <section className="om-weeks">
                  <div className="om-weeks-head">
                    <button type="button" className="om-nav" aria-label="prev" disabled={curIdx <= 0} onClick={() => step(-1)}><LeftOutlined /></button>
                    <div className="om-weeks-title">
                      <h3>{t('ojt.weekN', { n: curIdx + 1 })}</h3>
                      {curWeek && <span>{dmy(curWeek.key)} – {dmy(dayjs(curWeek.key).add(5, 'day').format('YYYY-MM-DD'))}</span>}
                    </div>
                    <div className="om-weeks-badges">
                      {curInfo && curInfo.total > 0 && <b>{curInfo.done}/{curInfo.total}</b>}
                      {curInfo?.rv?.avg != null && <em>{curInfo.rv.avg.toFixed(1)}/5</em>}
                    </div>
                    <button type="button" className="om-nav" aria-label="next" disabled={curIdx >= allWeeks.length - 1} onClick={() => step(1)}><RightOutlined /></button>
                  </div>
                  <div className="om-wkbar" ref={barRef}>
                    {allWeeks.map((w, wi) => {
                      const f = info(w)
                      return (
                        <button key={w.key} type="button" className={`om-pill st-${f.st}${w.key === cur ? ' sel' : ''}`} onClick={() => setSel(w.key)}
                          title={`${t('ojt.weekN', { n: wi + 1 })}: ${dmy(w.key)} – ${dmy(dayjs(w.key).add(5, 'day').format('YYYY-MM-DD'))}`}>
                          <b>{wi + 1}</b><i>{f.st === 'future' ? '·' : `${f.done}/${f.total}`}</i>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}
              {weekDays.length > 0 ? (
                <div className="ojt-days om-days">
                  {[...weekDays].sort((a, b) => a.date.localeCompare(b.date)).map((day) => (
                    <OjtDayCard key={day.date} day={day} today={today} onEdit={() => open(day)} footer={day.log?.mentorNote ? <MentorNote note={day.log.mentorNote} /> : undefined} />
                  ))}
                </div>
              ) : allWeeks.length > 0 && <Card><Empty description={t('ojt.weekUpcoming')} /></Card>}
            </main>
            <aside className="om-aside">
              <div className="ojt-side-card">
                <div className="ojt-side-title">{t('ojt.mentorTitle')}</div>
                {mentors.length > 0 ? (
                  <div className="ojt-persons">{mentors.map((m) => (
                    <div key={m.id} className="ojt-person"><OjtAvatar name={m.name} src={photos[m.id]} size={44} /><div><b>{m.name}</b><span>{m.id}</span></div></div>
                  ))}</div>
                ) : <p className="ojt-muted">{t('ojt.waitingMentor')}</p>}
                {leaders.length > 0 && (
                  <>
                    <div className="ojt-side-title ojt-side-title-2">{t('ojt.leadersLabel')}</div>
                    <div className="ojt-people">{leaders.map((l) => <span key={l.id} className="ojt-person-chip" title={l.id}><OjtAvatar name={l.name} src={photos[l.id]} size={22} />{l.name}</span>)}</div>
                  </>
                )}
              </div>
              <MyReviews reviews={d.reviews ?? []} />
              <div className="ojt-side-card ojt-rule"><InfoCircleOutlined /> {t('ojt.rule', { days: 3 })}</div>
            </aside>
          </div>
        </>
      )}
      <OjtNotebook open={!!editing} date={editing?.date ?? today} dayNo={editing ? (d?.days.length ?? 1) - (d?.days.findIndex((x) => x.date === editing.date) ?? 0) : 1} dayTotal={d?.days.length ?? 1}
        mentorName={d?.plan.mentorName} initial={{ content: editing?.log?.content ?? '', difficulty: editing?.log?.difficulty ?? '' }} saving={save.isPending}
        onClose={() => setEditing(null)} onSave={(v) => save.mutate(v)} />
    </div>
  )
}
