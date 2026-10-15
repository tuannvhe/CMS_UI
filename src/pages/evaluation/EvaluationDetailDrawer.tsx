import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Collapse, Descriptions, Empty, Input, InputNumber, Popconfirm, Progress, Skeleton, Space, Steps, Tag, Typography } from 'antd'
import { MiniTable } from '../../components/DataTable'
import type { ColumnsType } from 'antd/es/table'
import { AuditOutlined, CheckCircleFilled, PrinterOutlined } from '@ant-design/icons'
import { AppModal } from '../../components/AppModal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { evaluations, type EvaluationDetail, type EvaluationItem, type ScoreRow } from '../../api/evaluations'
import { apiErrorCode } from '../../api/requests'
import { fmtDate } from '../../utils/format'
import { useToast } from '../../hooks/useToast'
import { printEvaluationSheet } from '../../utils/printEvaluation'

const day = (s: string | null) => (s ? fmtDate(dayjs(s)) : '')
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase()

/** Dòng tiêu đề / dòng tổng: hệ thống tự cộng, không nhập tay (giống form cũ). */
const GROUP_A = [22, 23, 24, 25, 26], GROUP_B = [29, 30, 31, 32, 33, 34, 35], GROUP_C = [38, 39, 40, 41, 42, 43]
const TOTAL_IDS = [27, 36, 44, 45]
const HEADER_IDS = [28, 37, ...TOTAL_IDS]

/** Ô nhận xét cần nhập ở từng vòng (khớp quy tắc của hệ thống cũ). */
const FIELDS: Record<number, string[]> = {
  1: ['strength', 'weakness', 'aboutWork', 'satisfiedWork', 'companyReview', 'aboutTrain', 'aboutLeader', 'nextPlan'],
  2: ['comment', 'offerLeader', 'statusOffWork', 'discipline', 'bonus'],
  3: ['comment', 'offerLeader', 'statusOffWork', 'discipline', 'bonus'],
  4: ['comment'],
}
const OP_FIELDS: Record<number, string[]> = { 1: ['comment'], 2: ['comment'], 3: ['comment'], 4: ['comment'] }
/** Tiêu chí công nhân (OP) nhập tay; các dòng còn lại (F, G, kết quả, văn hóa…) do hệ thống tự tính. */
const OP_INPUT_IDS = [4, 5, 6, 7, 8, 9, 11, 12, 13, 19]
const OFFER_KEYS = ['offerLeader', 'statusOffWork', 'discipline', 'bonus']
/** Cột nhận xét trong DB tương ứng với ô nhập của từng vòng (để không hiện lặp ở phần tham khảo). */
const FIELD_COLUMN: Record<string, string> = {
  strength: 'Strength', weakness: 'Weakness', aboutWork: 'AboutWork', satisfiedWork: 'SatisfiedWork', companyReview: 'CompanyReview', aboutTrain: 'AboutTrain',
  aboutLeader: 'AboutLeader', nextPlan: 'NextPaln', offerLeader: 'OfferLeader', statusOffWork: 'StatusOffWork', discipline: 'Discipline', bonus: 'Bonus',
}
const COMMENT_COLUMN: Record<number, string> = { 1: 'CommnentPartLeader', 2: 'CommentTeamLeader', 3: 'CommentGroupLeader', 4: 'CommentSectorLeader' }
const COMMENT_SOURCE: Record<number, string> = { 1: 'commentPart', 2: 'commentTeam', 3: 'commentGroup', 4: 'commentSector' }

type Section = { title: string | null; rows: ScoreRow[]; total: ScoreRow | null }

/** Chia bảng điểm thành các nhóm tiêu chí: dòng không có điểm tối đa là tiêu đề nhóm, dòng "Tổng" khép nhóm; dòng kết quả cuối (skipIds) hiện riêng. */
function buildSections(scores: ScoreRow[], totalIds: number[], skipIds: number[]): Section[] {
  const out: Section[] = []
  let cur: Section = { title: null, rows: [], total: null }
  const flush = () => { if (cur.rows.length || cur.total) out.push(cur); cur = { title: null, rows: [], total: null } }
  for (const r of scores) {
    if (skipIds.includes(r.titleId)) continue
    if (r.maxPoint == null) { flush(); cur.title = r.name } else if (totalIds.includes(r.titleId)) { cur.total = r; flush() } else cur.rows.push(r)
  }
  flush()
  return out
}

/** Xem chi tiết một kỳ đánh giá; nếu đã đến lượt bạn thì nhập điểm, nhận xét, lưu nháp hoặc xác nhận vòng. */
export function EvaluationDetailDrawer({ item, onClose, readOnly = false }: { item: EvaluationItem | null; onClose: () => void; readOnly?: boolean }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const dateRate = item?.dateRate?.slice(0, 10)
  const q = useQuery({
    queryKey: ['evaluations', 'detail', item?.employeeId, dateRate],
    queryFn: () => evaluations.detail(item!.employeeId, dateRate!),
    enabled: !!dateRate,
  })
  const d = q.data
  const round = d?.myRound ?? null
  const editing = !!d?.canEdit && round != null
  const isOp = d?.position === 'OP'
  const isInput = (r: ScoreRow) => (isOp ? OP_INPUT_IDS.includes(r.titleId) : !HEADER_IDS.includes(r.titleId))
  /** Ô đề xuất/chuyên cần/kỷ luật/khen thưởng: proc cũ chỉ ghi ở vòng 2 (nhân viên thường) hoặc vòng 3 (khi nhân viên là Group Leader). */
  const fieldsOf = (rd: number) => {
    const base = (isOp ? OP_FIELDS : FIELDS)[rd] ?? []
    if (isOp) return base
    const groupLeader = d?.position === 'Group Leader'
    return base.filter((k) => !OFFER_KEYS.includes(k) || (rd === 2 ? !groupLeader : rd === 3 ? groupLeader : true))
  }

  const [marks, setMarks] = useState<Record<number, number | null>>({})
  const [other, setOther] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!d || !editing || round == null) return
    const m: Record<number, number | null> = {}
    d.scores.forEach((r) => { if (isInput(r)) m[r.titleId] = r.scores[round - 1] })
    setMarks(m)
    const o: Record<string, string> = {}
    fieldsOf(round).forEach((k) => { o[k] = (k === 'comment' ? d.other[COMMENT_SOURCE[round]] : d.other[k]) ?? '' })
    setOther(o)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, editing, round])

  const sum = (ids: number[]) => (ids.every((i) => marks[i] != null) ? ids.reduce((n, i) => n + (marks[i] as number), 0) : null)
  const totals = useMemo(() => {
    const a = sum(GROUP_A), b = sum(GROUP_B), c = sum(GROUP_C)
    return { 27: a, 36: b, 44: c, 45: a != null && b != null && c != null ? a + b + c : null } as Record<number, number | null>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks])

  const errText = (e: unknown) => {
    const { code, detail } = apiErrorCode(e)
    if (code === 'invalid_input') return t(`eva.err.${detail}`, { defaultValue: t('req.err.invalid_input') })
    if (code === 'forbidden') return t('eva.err.forbidden')
    if (code === 'unsupported') return t('eva.err.unsupported')
    return t('req.err.generic')
  }

  const save = useMutation({
    mutationFn: (confirm: boolean) => evaluations.submit({
      employeeId: item!.employeeId, dateRate: dateRate!, confirm, other,
      marks: marks as Record<string, number | null>,
    }),
    onSuccess: (_r, confirm) => {
      message.success(confirm ? t('eva.confirmedOk') : t('eva.savedOk'))
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      if (confirm) onClose()
    },
    onError: (e) => message.error(errText(e)),
  })

  const inputIds = d ? d.scores.filter(isInput).map((r) => r.titleId) : []
  const filled = inputIds.filter((id) => marks[id] != null).length
  const complete = inputIds.length > 0 && filled === inputIds.length

  return (
    <AppModal open={!!item} onClose={onClose} size="xl" icon={<AuditOutlined />} title={t('eva.modalTitle')}
      subtitle={item ? `${item.employeeId} – ${item.fullName}` : undefined}
      footer={editing ? (
        <div className="eva-footer">
          <div className="eva-progress">
            <Progress percent={inputIds.length ? Math.round((filled / inputIds.length) * 100) : 0} size="small" status={complete ? 'success' : 'active'} style={{ minWidth: 150 }} />
            <span>{t('eva.filled', { n: filled, total: inputIds.length })}</span>
          </div>
          <Space>
            <Button onClick={onClose}>{t('req.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate(false)}>{t('eva.saveDraft')}</Button>
            <Popconfirm title={t('eva.confirmAsk')} okText={t('eva.confirm')} cancelText={t('req.cancel')} onConfirm={() => save.mutate(true)} disabled={!complete}>
              <Button type="primary" loading={save.isPending} disabled={!complete}>{t('eva.confirm')}</Button>
            </Popconfirm>
          </Space>
        </div>
      ) : null}
    >
      {q.isLoading && <Skeleton active />}
      {q.isError && <Alert type="error" showIcon title={t('req.err.generic')} />}
      {d && item && (
        <div style={{ display: 'grid', gap: 18 }}>
          <Hero d={d} t={t} />
          <div style={{ textAlign: 'right', marginTop: -8 }}><Button icon={<PrinterOutlined />} onClick={() => printEvaluationSheet(d, t)}>{t('print.button')}</Button></div>
          <RoundSteps d={d} round={round} t={t} />
          {!editing && !readOnly && (
            <Alert type="warning" showIcon title={
              item.round > 4 ? t('eva.why.round', { n: item.round }) : d.scores.length === 0 ? t('eva.why.noRows') : t('eva.why.notYet')
            } />
          )}
          {editing && round != null && <Alert type="success" showIcon title={t('eva.yourTurn', { n: round })} />}
          {editing && round != null && (
            <Reference d={d} own={fieldsOf(round).map((k) => (k === 'comment' ? COMMENT_COLUMN[round] : FIELD_COLUMN[k]))} t={t} />
          )}

          {d.scores.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('eva.noScores')} /> : editing && round != null ? (
            <ScoreEditor d={d} round={round} isOp={isOp} isInput={isInput} marks={marks} setMarks={setMarks} totals={totals} t={t} />
          ) : <ScoreTable d={d} t={t} />}

          {editing && round != null && (
            <section>
              <Typography.Title level={5} style={{ marginTop: 0 }}>{t('eva.yourComments')}</Typography.Title>
              <div style={{ display: 'grid', gap: 12 }}>
                {fieldsOf(round).map((k) => (
                  <label key={k} style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>{t(`eva.f.${k}`)}</span>
                    <Input.TextArea rows={2} maxLength={500} showCount value={other[k] ?? ''} onChange={(e) => setOther((p) => ({ ...p, [k]: e.target.value }))} />
                  </label>
                ))}
              </div>
            </section>
          )}

          {!editing && d.attendance.length > 0 && (
            <section>
              <Typography.Title level={5}>{t('eva.attendance')}</Typography.Title>
              <Descriptions size="small" bordered column={3}
                items={d.attendance.map((a) => ({ key: a.label, label: t(`eva.a.${a.label}`, { defaultValue: a.label }), children: a.value }))} />
            </section>
          )}
          {!editing && d.comments.length > 0 && (
            <section>
              <Typography.Title level={5}>{t('eva.comments')}</Typography.Title>
              <Descriptions size="small" bordered column={1}
                items={d.comments.map((c) => ({ key: c.label, label: t(`eva.c.${c.label}`, { defaultValue: c.label }), children: <span style={{ whiteSpace: 'pre-wrap' }}>{c.value}</span> }))} />
            </section>
          )}
        </div>
      )}
    </AppModal>
  )
}

type Tfn = (k: string, o?: Record<string, unknown>) => string

/** Thông tin tham khảo khi đang chấm (giống form cũ): chuyên cần, khen thưởng/kỷ luật và nhận xét của các vòng khác (chỉ đọc). */
function Reference({ d, own, t }: { d: EvaluationDetail; own: string[]; t: Tfn }) {
  const others = d.comments.filter((c) => !own.includes(c.label))
  if (d.attendance.length === 0 && others.length === 0) return null
  return (
    <Collapse size="small" defaultActiveKey={['ref']} items={[{
      key: 'ref', label: <b>{t('eva.reference')}</b>,
      children: (
        <div style={{ display: 'grid', gap: 12 }}>
          {d.attendance.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {d.attendance.map((a) => <Tag key={a.label} variant="filled" color={a.label === 'Discipline' && a.value !== '0' ? 'error' : a.label === 'Reward' && a.value !== '0' ? 'success' : 'default'}>
                {t(`eva.a.${a.label}`, { defaultValue: a.label })}: <b>{a.value}</b></Tag>)}
            </div>
          )}
          {others.length > 0 && (
            <Descriptions size="small" bordered column={1}
              items={others.map((c) => ({ key: c.label, label: t(`eva.c.${c.label}`, { defaultValue: c.label }), children: <span style={{ whiteSpace: 'pre-wrap' }}>{c.value}</span> }))} />
          )}
        </div>
      ),
    }]} />
  )
}

/** Khối đầu: ảnh chữ cái, họ tên, mã, chức vụ, bộ phận, loại đánh giá, hạn. */
function Hero({ d, t }: { d: EvaluationDetail; t: Tfn }) {
  return (
    <div className="eva-hero">
      <div className="eva-avatar">{initials(d.fullName) || '?'}</div>
      <div style={{ minWidth: 0 }}>
        <div className="eva-hero-name">{d.fullName}</div>
        <div className="eva-hero-meta">
          <span className="chip">{d.employeeId}</span>
          <span className="chip">{d.position}</span>
          <span className="chip">{d.department}</span>
          <span className="chip">{t('eva.startWork')}: {day(d.startWork)}</span>
        </div>
      </div>
      <div className="eva-hero-side">
        <div>{d.typeRate}</div>
        <div className="due">{t('eva.dateRate')}: <b>{day(d.dateRate)}</b></div>
      </div>
    </div>
  )
}

/** Các vòng đánh giá dạng bước: đã xác nhận / vòng của bạn / đang chờ. */
function RoundSteps({ d, round, t }: { d: EvaluationDetail; round: number | null; t: Tfn }) {
  const firstWaiting = d.rounds.find((r) => !r.confirmed)?.no
  return (
    <Steps size="small" current={Math.max(0, d.rounds.findIndex((r) => r.no === firstWaiting))} className="eva-steps"
      items={d.rounds.map((r) => ({
        title: <span>{t('eva.round')} {r.no}{r.no === round ? <Tag color="green" style={{ marginLeft: 6 }}>{t('eva.you')}</Tag> : null}</span>,
        content: r.evaluatorName || r.evaluatorId,
        status: r.confirmed ? 'finish' : r.no === firstWaiting ? 'process' : 'wait',
      }))}
    />
  )
}

/** Bảng điểm chỉ đọc (khi chưa đến lượt hoặc đã xác nhận). */
function ScoreTable({ d, t }: { d: EvaluationDetail; t: Tfn }) {
  const columns: ColumnsType<ScoreRow> = [
    { title: t('eva.criteria'), dataIndex: 'name', render: (v: string, r) => (r.maxPoint == null ? <b>{v}</b> : v) },
    { title: t('eva.maxPoint'), dataIndex: 'maxPoint', width: 80, align: 'center', render: (v: number | null) => v ?? '' },
    ...[0, 1, 2, 3, 4].map((i) => ({
      title: `${t('eva.round')} ${i + 1}`, width: 90, align: 'center' as const,
      render: (_: unknown, r: ScoreRow) => (r.scores[i] == null ? '' : r.scores[i]),
    })),
  ]
  return (
    <section>
      <Typography.Title level={5} style={{ marginTop: 0 }}>{t('eva.scores')}</Typography.Title>
      <MiniTable<ScoreRow> rowKey="titleId" columns={columns} dataSource={d.scores}
        rowClassName={(r) => (HEADER_IDS.includes(r.titleId) || r.maxPoint == null ? 'eva-group-row' : '')} />
    </section>
  )
}

/** Nhập điểm theo nhóm tiêu chí: mỗi tiêu chí một dòng, ô điểm lớn, viền vàng khi chưa nhập, xanh khi đã nhập; điểm các vòng trước hiện nhỏ bên cạnh. */
function ScoreEditor({ d, round, isOp, isInput, marks, setMarks, totals, t }: {
  d: EvaluationDetail; round: number; isOp: boolean; isInput: (r: ScoreRow) => boolean
  marks: Record<number, number | null>; setMarks: (f: (p: Record<number, number | null>) => Record<number, number | null>) => void
  totals: Record<number, number | null>; t: Tfn
}) {
  const sections = buildSections(d.scores, isOp ? [14, 20] : [27, 36, 44], isOp ? [21] : [45])
  const result = d.scores.find((r) => r.titleId === (isOp ? 21 : 45))
  // OP chưa có điểm G của nhóm hỗ trợ quản lý thì proc cũ tính phần G = 0 (ví dụ 67,78): không hiện con số gây hiểu nhầm đó
  const noG = isOp && (d.scores.find((r) => r.titleId === 20)?.scores ?? []).every((v) => v == null)
  const letter = (i: number) => String.fromCharCode(65 + i)
  const others = (r: ScoreRow) => r.scores.map((v, i) => (v != null && i + 1 !== round ? `${t('eva.roundShort')}${i + 1}: ${v}` : null)).filter(Boolean).join(' · ')

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <Typography.Title level={5} style={{ margin: 0 }}>{t('eva.scores')} · {t('eva.round')} {round}</Typography.Title>
      {sections.map((s, si) => {
        const live = !isOp && s.total ? totals[s.total.titleId] : null
        const shown = isOp ? s.total?.scores[round - 1] : live
        return (
          <div key={si} className="eva-section">
            <div className="eva-section-head">
              <span>{s.title ?? `${t('eva.group')} ${letter(si)}`}</span>
              {s.total && (
                <span className="eva-subtotal">{s.total.name.replace(/^Total/i, t('eva.total'))}: <b>{shown ?? '—'}</b>{s.total.maxPoint ? ` / ${s.total.maxPoint}` : ''}</span>
              )}
            </div>
            {s.rows.map((r) => {
              const editable = isInput(r)
              const v = marks[r.titleId]
              const cls = !editable ? 'auto' : v == null ? 'empty' : 'done'
              return (
                <div key={r.titleId} className={`eva-row ${cls}`}>
                  <div>
                    <div className="eva-name">{r.name}</div>
                    {others(r) && <div className="eva-others">{others(r)}</div>}
                  </div>
                  {editable ? (
                    <div className="eva-score">
                      <InputNumber size="large" min={0} max={r.maxPoint ?? undefined} step={0.5} precision={2} placeholder="0"
                        value={v ?? null} status={v == null ? 'warning' : undefined} controls={false}
                        onChange={(val) => setMarks((p) => ({ ...p, [r.titleId]: val }))} />
                      <span className="max">/ {r.maxPoint ?? ''}</span>
                      <span className="tick">{v != null && <CheckCircleFilled />}</span>
                    </div>
                  ) : (
                    <div className="eva-score auto-val">
                      <b>{r.scores[round - 1] ?? '—'}</b><span className="max">/ {r.maxPoint ?? ''}</span><span className="auto-tag">{t('eva.auto')}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
      {result && (
        <div className="eva-grand">{result.name.replace(/^K[eế]t qu[aả]\/.*?(?=\()/i, '').trim() || t('eva.grandTotal')}: {noG
          ? <><b>—</b> <Tag color="warning" variant="filled">{t('rev.gNone')}</Tag></>
          : <><b>{(isOp ? result.scores[round - 1] : totals[45]) ?? '—'}</b>{result.maxPoint ? ` / ${result.maxPoint}` : ''}</>}</div>
      )}
    </section>
  )
}
