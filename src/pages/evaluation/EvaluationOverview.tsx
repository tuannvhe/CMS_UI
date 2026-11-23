import { Button, Empty, Skeleton, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { review } from '../../api/review'
import { DASH_CSS, DashCard, HBar, OR } from '../../components/DashKit'

/**
 * Tổng quan tiến độ cho HR (cùng kiểu dashboard): số nhân viên đến hạn chưa tạo đơn, đang đánh giá (trong đó trễ hạn), chờ chốt, đã hoàn tất 90 ngày,
 * và các bộ phận trễ nhiều nhất. Bấm vào thẻ để đi tới màn xử lý tương ứng.
 */
export function EvaluationOverview() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: ['evaluations', 'review-dashboard'], queryFn: review.dashboard, staleTime: 60_000 })
  const d = q.data
  const tiles = d ? [
    { key: 'unreg', label: t('ovw.unregistered'), value: d.unregistered, warn: d.unregistered > 0, go: '/evaluation/register?auto=1' },
    { key: 'long', label: t('ovw.longOverdue'), value: d.longOverdue, warn: d.longOverdue > 0, go: '/evaluation/register?overdue=1' },
    { key: 'rating', label: t('ovw.rating'), value: d.rating, sub: d.ratingLate > 0 ? t('ovw.late', { n: d.ratingLate }) : undefined, warn: d.ratingLate > 0, go: '/evaluation/audit' },
    { key: 'pending', label: t('ovw.pending'), value: d.pending, go: undefined },
    { key: 'done', label: t('ovw.doneRecent'), value: d.doneRecent, go: '/evaluation/hr?tab=done' },
  ] : []
  const depts = d?.departments.filter((x) => x.late > 0 || x.pending > 0).slice(0, 8) ?? []
  const maxDept = Math.max(1, ...depts.map((x) => x.rating + x.pending))

  return (
    <div className="rdb ovw-dash" style={{ marginBottom: 16 }}>
      <style>{DASH_CSS + OVW_CSS}</style>
      <div className="rdb-head"><h1>{t('ovw.title')}</h1></div>
      {q.isLoading && <Skeleton active />}
      {q.isError && <Empty description={t('req.err.generic')} />}
      {d && (
        <>
          <div className="rdb-kpis" style={{ marginBottom: depts.length ? 12 : 0 }}>
            {tiles.map((x) => (
              <button key={x.key} type="button" className={`rdb-kpi ovw-k${x.go ? ' link' : ''}`} onClick={() => x.go && navigate(x.go)} disabled={!x.go}>
                <div className="rdb-kpi-l" style={x.warn ? { borderBottomColor: OR.down } : undefined}>{x.label}</div>
                <div className="rdb-kpi-v" style={x.warn && x.value ? { color: OR.down } : undefined}>{x.value}</div>
                <div className="rdb-kpi-p">{x.sub ? <Tag color="error" variant="filled" style={{ marginInlineEnd: 0 }}>{x.sub}</Tag> : <span>&nbsp;</span>}</div>
              </button>
            ))}
          </div>
          {depts.length > 0 && (
            <DashCard title={t('ovw.byDept')} extra={<><span className="dot" style={{ background: OR.down }} />{t('ovw.deptLate')} <Button type="link" size="small" onClick={() => navigate('/evaluation/audit')}>{t('ovw.openAudit')}</Button></>}>
              {depts.map((x) => (
                <HBar key={x.department} label={x.department} value={x.late} max={maxDept} total={x.rating} color={OR.down}
                  note={`${t('ovw.deptRating')} ${x.rating} · ${t('ovw.deptPending')} ${x.pending}`} />
              ))}
            </DashCard>
          )}
        </>
      )}
    </div>
  )
}

const OVW_CSS = `
.ovw-dash .rdb-head h1 { font-size: 18px; }
.ovw-k { border: 0; text-align: left; font: inherit; color: inherit; cursor: default; }
.ovw-k.link { cursor: pointer; transition: box-shadow .15s, transform .15s; }
.ovw-k.link:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.ovw-dash .rdb-hbar { grid-template-columns: minmax(110px, 30%) 1fr minmax(150px, auto); }
`
