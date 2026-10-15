import { Button, Card, Empty, Tag, Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { review } from '../../api/review'

/**
 * Tổng quan tiến độ cho HR: số nhân viên đến hạn chưa tạo đơn, đang đánh giá (trong đó trễ hạn), chờ chốt, đã hoàn tất 90 ngày,
 * và các bộ phận trễ nhiều nhất. Bấm vào ô để đi tới màn xử lý tương ứng.
 */
export function EvaluationOverview() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: ['evaluations', 'review-dashboard'], queryFn: review.dashboard, staleTime: 60_000 })
  const d = q.data
  const tiles = d ? [
    { key: 'unreg', label: t('ovw.unregistered'), value: d.unregistered, color: '#2F6FB0', warn: d.unregistered > 0, go: '/evaluation/register?auto=1' },
    { key: 'long', label: t('ovw.longOverdue'), value: d.longOverdue, color: '#D92D20', warn: d.longOverdue > 0, go: '/evaluation/register?overdue=1' },
    { key: 'rating', label: t('ovw.rating'), value: d.rating, sub: d.ratingLate > 0 ? t('ovw.late', { n: d.ratingLate }) : undefined, color: '#D48806', warn: d.ratingLate > 0, go: '/evaluation/audit' },
    { key: 'pending', label: t('ovw.pending'), value: d.pending, color: '#6D5BD0', go: undefined },
    { key: 'done', label: t('ovw.doneRecent'), value: d.doneRecent, color: '#2E9E4F', go: '/evaluation/hr?tab=done' },
  ] : []

  return (
    <Card size="small" className="ovw-card" loading={q.isLoading} style={{ marginBottom: 16 }} title={t('ovw.title')}>
      {q.isError && <Empty description={t('req.err.generic')} />}
      {d && (
        <>
          <div className="ovw-tiles">
            {tiles.map((x) => (
              <button key={x.key} type="button" className={`ovw-tile${x.go ? ' link' : ''}`} style={{ borderLeftColor: x.color }} onClick={() => x.go && navigate(x.go)} disabled={!x.go}>
                <span className="ovw-label">{x.label}</span>
                <b className="ovw-value">{x.value}</b>
                {x.sub && <Tag color="error" variant="filled" style={{ marginInlineEnd: 0 }}>{x.sub}</Tag>}
              </button>
            ))}
          </div>
          {d.departments.some((x) => x.late > 0 || x.pending > 0) && (
            <div className="ovw-depts">
              <div className="ovw-depts-title">{t('ovw.byDept')}</div>
              {d.departments.filter((x) => x.late > 0 || x.pending > 0).slice(0, 8).map((x) => (
                <div className="ovw-dept" key={x.department}>
                  <span className="ovw-dept-name" title={x.department}>{x.department}</span>
                  <Tooltip title={t('ovw.deptRating')}><Tag variant="filled">{x.rating}</Tag></Tooltip>
                  {x.late > 0 && <Tooltip title={t('ovw.deptLate')}><Tag color="error" variant="filled">{x.late}</Tag></Tooltip>}
                  {x.pending > 0 && <Tooltip title={t('ovw.deptPending')}><Tag color="purple" variant="filled">{x.pending}</Tag></Tooltip>}
                </div>
              ))}
              <Button type="link" size="small" onClick={() => navigate('/evaluation/audit')}>{t('ovw.openAudit')}</Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
