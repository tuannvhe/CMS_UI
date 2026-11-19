import { useEffect, useState } from 'react'
import { Alert, Button, DatePicker, Empty, Input, Radio, Tag } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { ojt, type OjtConclusion, type OjtDetail, type OjtReview, type OjtReviewBody } from '../../api/ojt'
import { dmy } from './OjtCommon'
import './ojt.css'

const CONCL_COLOR: Record<OjtConclusion, string> = { pass: 'green', extend: 'gold', fail: 'red' }

export function ConclusionTag({ value }: { value: OjtConclusion | null | undefined }) {
  const { t } = useTranslation()
  return value ? <Tag color={CONCL_COLOR[value]}>{t(`ojt.concl.${value}`)}</Tag> : null
}

type Scores = [number, number, number, number]

const POINTS = [1, 2, 3, 4, 5]

/** Thang điểm số 1–5 cho từng tiêu chí (1 = yếu, 5 = xuất sắc). Chỉ đọc thì hiện "điểm/5". */
function ScoreRows({ value, onChange, readOnly }: { value: Scores; onChange?: (v: Scores) => void; readOnly?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="ojt-scores">
      {value.map((v, i) => (
        <div key={i} className="ojt-score-row">
          <span>{t(`ojt.crit${i + 1}`)}</span>
          {readOnly
            ? <span className="ojt-bar-wrap"><i className="ojt-bar"><u style={{ width: `${v * 20}%` }} /></i><b className="ojt-score-num">{v > 0 ? `${v}/5` : '—'}</b></span>
            : <Radio.Group size="small" optionType="button" buttonStyle="solid" value={v || undefined} options={POINTS.map((n) => ({ value: n, label: n }))}
                onChange={(e) => onChange?.(value.map((x, j) => (j === i ? e.target.value : x)) as Scores)} />}
        </div>
      ))}
    </div>
  )
}

const scoresOf = (r?: OjtReview): Scores => [r?.s1 ?? 0, r?.s2 ?? 0, r?.s3 ?? 0, r?.s4 ?? 0]

/** Mutation dùng chung: báo lỗi bằng i18n, nếu chưa có bảng Tbl_Ojt_Review thì trả cờ để hiện SQL. */
function useReviewSave(planId: number, call: (b: OjtReviewBody) => Promise<unknown>, onDone?: () => void) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [needSql, setNeedSql] = useState(false)
  const m = useMutation({
    mutationFn: call,
    onSuccess: () => { toast.success(t('ojt.reviewSaved')); qc.invalidateQueries({ queryKey: ['ojt-detail', planId] }); qc.invalidateQueries({ queryKey: ['ojt-team'] }); qc.invalidateQueries({ queryKey: ['ojt-mine'] }); onDone?.() },
    onError: (e) => {
      const { detail, code } = adminError(e)
      if ((detail || code) === 'ojt_review_table') setNeedSql(true)
      toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') }))
    },
  })
  return { m, needSql }
}

export function SqlHint() {
  const { t } = useTranslation()
  return <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('ojt.err.ojt_review_table')} />
}

function WeekCard({ detail, monday, review }: { detail: OjtDetail; monday: string; review?: OjtReview }) {
  const { t } = useTranslation()
  const [sc, setSc] = useState<Scores>(scoresOf(review))
  const [text, setText] = useState(review?.comment ?? '')
  useEffect(() => { setSc(scoresOf(review)); setText(review?.comment ?? '') }, [review])
  const { m, needSql } = useReviewSave(detail.plan.id, (b) => ojt.reviewWeek(detail.plan.id, b))
  const sunday = dayjs(monday).add(6, 'day').format('YYYY-MM-DD')
  const edit = !!detail.canReview
  const weekLogs = detail.days.filter((d) => d.log && d.date >= monday && d.date <= sunday).sort((a, b) => a.date.localeCompare(b.date))
  return (
    <section className="ojt-page ojt-week">
      <div className="ojt-page-date">
        <b>{t('ojt.weekOf', { from: dmy(monday), to: dmy(sunday) })}</b>
        {review?.avg != null && <Tag color="blue" style={{ marginLeft: 8 }}>{t('ojt.avg')}: {review.avg.toFixed(1)}/5</Tag>}
        {!review && <Tag style={{ marginLeft: 8 }}>{t('ojt.noReview')}</Tag>}
      </div>
      {needSql && <SqlHint />}
      {edit && weekLogs.length > 0 && (
        <details className="ojt-week-logs" open={!review}>
          <summary>{t('ojt.weekDiary', { n: weekLogs.length })}</summary>
          {weekLogs.map((d) => (
            <div key={d.date} className="ojt-week-log">
              <b>{dmy(d.date)}{d.log?.vi && <Tag color="red" style={{ marginLeft: 6 }}>VI</Tag>}</b>
              <p>{d.log?.content}</p>
              {d.log?.difficulty && <p className="ojt-week-hard">{d.log.difficulty}</p>}
            </div>
          ))}
        </details>
      )}
      {(edit || review) && <ScoreRows value={sc} readOnly={!edit} onChange={setSc} />}
      {edit ? (
        <>
          <Input.TextArea rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ojt.reviewPh')} />
          <Button type="primary" style={{ marginTop: 8 }} loading={m.isPending} disabled={sc.some((x) => x < 1)} onClick={() => m.mutate({ weekStart: monday, s1: sc[0], s2: sc[1], s3: sc[2], s4: sc[3], comment: text })}>{t('ojt.reviewSave')}</Button>
        </>
      ) : review?.comment && <p className="ojt-ruled" style={{ whiteSpace: 'pre-wrap' }}>{review.comment}</p>}
      {review && <div className="ojt-by">{review.byName ?? review.by} · {dayjs(review.at).format('DD/MM/YYYY HH:mm')}</div>}
    </section>
  )
}

/** Thứ 2 của từng tuần OJT, mới nhất trước (không vượt quá hôm nay). */
function mondays(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const last = dayjs().isBefore(dayjs(endDate)) ? dayjs() : dayjs(endDate)
  let m = dayjs(startDate).startOf('day'); m = m.subtract((m.day() + 6) % 7, 'day')
  while (!m.isAfter(last)) { out.push(m.format('YYYY-MM-DD')); m = m.add(7, 'day') }
  return out.reverse()
}

export function WeeksPanel({ detail }: { detail: OjtDetail }) {
  const { t } = useTranslation()
  const weeks = mondays(detail.plan.startDate, detail.plan.endDate)
  const byWeek = new Map((detail.reviews ?? []).filter((r) => r.kind === 'week').map((r) => [r.periodStart, r]))
  if (weeks.length === 0) return <Empty description={t('ojt.noDays')} />
  return <>{weeks.map((w) => <WeekCard key={w} detail={detail} monday={w} review={byWeek.get(w)} />)}</>
}

function ConclusionRadio({ value, onChange }: { value?: OjtConclusion; onChange: (v: OjtConclusion) => void }) {
  const { t } = useTranslation()
  return (
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} optionType="button" buttonStyle="solid"
      options={(['pass', 'extend', 'fail'] as const).map((k) => ({ value: k, label: t(`ojt.concl.${k}`) }))} />
  )
}

export function FinalPanel({ detail }: { detail: OjtDetail }) {
  const { t } = useTranslation()
  const proposal = detail.reviews?.find((r) => r.kind === 'proposal')
  const final = detail.reviews?.find((r) => r.kind === 'final')
  const [psc, setPsc] = useState<Scores>(scoresOf(proposal))
  const [pc, setPc] = useState<OjtConclusion | undefined>(proposal?.conclusion ?? undefined)
  const [ptext, setPtext] = useState(proposal?.comment ?? '')
  const [fc, setFc] = useState<OjtConclusion | undefined>(final?.conclusion ?? undefined)
  const [ftext, setFtext] = useState(final?.comment ?? '')
  const [ext, setExt] = useState<dayjs.Dayjs | null>(null)
  useEffect(() => { setPsc(scoresOf(proposal)); setPc(proposal?.conclusion ?? undefined); setPtext(proposal?.comment ?? '') }, [proposal])
  useEffect(() => { setFc(final?.conclusion ?? undefined); setFtext(final?.comment ?? '') }, [final])
  const id = detail.plan.id
  const prop = useReviewSave(id, (b) => ojt.propose(id, b))
  const fin = useReviewSave(id, (b) => ojt.conclude(id, b))
  const end = dayjs(detail.plan.endDate)
  return (
    <>
      {(prop.needSql || fin.needSql) && <SqlHint />}
      {final && (
        <Alert style={{ marginBottom: 12 }} type={final.conclusion === 'pass' ? 'success' : final.conclusion === 'fail' ? 'error' : 'warning'} showIcon
          message={<span>{t('ojt.finalTitle')}: <ConclusionTag value={final.conclusion} /> {final.conclusion === 'extend' && final.periodEnd && <>→ {dmy(final.periodEnd)}</>}</span>}
          description={<><span style={{ whiteSpace: 'pre-wrap' }}>{final.comment}</span><div className="ojt-by">{final.byName ?? final.by} · {dayjs(final.at).format('DD/MM/YYYY HH:mm')}</div></>} />
      )}
      {(detail.canReview || proposal) && (
        <section className="ojt-page ojt-assign">
          <b className="ojt-sec-title">{t('ojt.proposalTitle')} {proposal && <ConclusionTag value={proposal.conclusion} />}</b>
          <ScoreRows value={psc} readOnly={!detail.canReview} onChange={setPsc} />
          {detail.canReview ? (
            <>
              <ConclusionRadio value={pc} onChange={setPc} />
              <Input.TextArea style={{ marginTop: 8 }} rows={3} maxLength={2000} value={ptext} onChange={(e) => setPtext(e.target.value)} placeholder={t('ojt.proposalPh')} />
              <Button type="primary" style={{ marginTop: 8 }} loading={prop.m.isPending} disabled={!pc || !ptext.trim() || psc.some((x) => x < 1)}
                onClick={() => prop.m.mutate({ s1: psc[0], s2: psc[1], s3: psc[2], s4: psc[3], conclusion: pc, comment: ptext })}>{t('ojt.proposeBtn')}</Button>
            </>
          ) : <p className="ojt-ruled" style={{ whiteSpace: 'pre-wrap' }}>{proposal?.comment}</p>}
          {proposal && <div className="ojt-by">{proposal.byName ?? proposal.by} · {dayjs(proposal.at).format('DD/MM/YYYY HH:mm')}</div>}
        </section>
      )}
      {detail.canConclude && (
        <section className="ojt-page ojt-assign">
          <b className="ojt-sec-title">{t('ojt.finalForm')}</b>
          <ConclusionRadio value={fc} onChange={setFc} />
          {fc === 'extend' && (
            <div style={{ marginTop: 8 }}>
              <DatePicker format="DD/MM/YYYY" placeholder={t('ojt.extendTo')} value={ext} onChange={setExt} style={{ width: 220 }}
                disabledDate={(d) => !d.isAfter(end) || d.diff(end, 'day') > 60} />
              <span className="ojt-by" style={{ marginLeft: 8 }}>{t('ojt.extendHint')}</span>
            </div>
          )}
          <Input.TextArea style={{ marginTop: 8 }} rows={3} maxLength={2000} value={ftext} onChange={(e) => setFtext(e.target.value)} placeholder={t('ojt.finalPh')} />
          <Button type="primary" style={{ marginTop: 8 }} loading={fin.m.isPending} disabled={!fc || !ftext.trim() || (fc === 'extend' && !ext)}
            onClick={() => fin.m.mutate({ conclusion: fc, comment: ftext, extendTo: fc === 'extend' ? ext?.format('YYYY-MM-DD') : undefined })}>{t('ojt.finalBtn')}</Button>
        </section>
      )}
      {!detail.canReview && !detail.canConclude && !proposal && !final && <Empty description={t('ojt.noFinal')} />}
    </>
  )
}

/** Nhân viên mới xem nhận xét tuần và kết luận của mentor / leader (không thấy đề xuất của mentor). */
export function MyReviews({ reviews }: { reviews: OjtReview[] }) {
  const { t } = useTranslation()
  const weeks = reviews.filter((r) => r.kind === 'week').sort((a, b) => b.periodStart.localeCompare(a.periodStart))
  const final = reviews.find((r) => r.kind === 'final')
  if (weeks.length === 0 && !final) return null
  return (
    <section className="ojt-side-card ojt-myreviews">
      <div className="ojt-side-title">{t('ojt.myReviews')}</div>
      {final && <Alert style={{ marginBottom: 10 }} showIcon type={final.conclusion === 'pass' ? 'success' : final.conclusion === 'fail' ? 'error' : 'warning'}
        message={<span>{t('ojt.finalTitle')}: <ConclusionTag value={final.conclusion} /></span>} description={<span style={{ whiteSpace: 'pre-wrap' }}>{final.comment}</span>} />}
      <div className="ojt-myreview-grid">
        {weeks.map((r) => (
          <div key={r.id} className="ojt-myreview">
            <b>{t('ojt.weekOf', { from: dmy(r.periodStart), to: dmy(r.periodEnd) })}</b>
            <Tag color="blue" style={{ marginLeft: 8 }}>{r.avg?.toFixed(1)}/5</Tag>
            <ScoreRows value={scoresOf(r)} readOnly />
            {r.comment && <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{r.comment}</p>}
            <div className="ojt-by">{r.byName ?? r.by}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
