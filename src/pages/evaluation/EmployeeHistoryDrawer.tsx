import { Drawer, Empty, Skeleton, Tag, Tooltip } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { review, type EmployeeEvaluation } from '../../api/review'

const STAGE_COLOR: Record<EmployeeEvaluation['stage'], string> = { rating: 'gold', pending: 'purple', done: 'green' }

/** Hồ sơ đánh giá của một nhân viên qua các kỳ: kết quả, điểm từng vòng, F, G, tổng hợp 70/30 và gợi ý; có biểu đồ cột điểm theo kỳ. */
export function EmployeeHistoryDrawer({ employeeId, name, onClose }: { employeeId: string | null; name?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['evaluations', 'employee-history', employeeId], queryFn: () => review.employeeHistory(employeeId!), enabled: !!employeeId })
  const list = q.data ?? []
  // điểm để vẽ: ưu tiên tổng hợp 70/30 (OP có G), không thì điểm trung bình F; vẽ từ kỳ cũ đến mới
  const chart = list.filter((x) => (x.overall ?? x.average) != null).slice().reverse()
  return (
    <Drawer open={!!employeeId} onClose={onClose} width={680} title={<span><HistoryOutlined /> {t('emh.title')}{name ? ` · ${name}` : ''}{employeeId ? ` (${employeeId})` : ''}</span>}>
      {q.isLoading ? <Skeleton active /> : q.isError || list.length === 0 ? <Empty description={t('emh.empty')} /> : (
        <div style={{ display: 'grid', gap: 14 }}>
          {chart.length > 1 && (
            <div className="emh-chart" aria-label={t('emh.chart')}>
              {chart.map((x) => {
                const v = (x.overall ?? x.average)!
                return (
                  <Tooltip key={`${x.typeRate}|${x.dateRate}`} title={`${dayjs(x.dateRate).format('DD/MM/YYYY')} · ${x.typeRate}: ${v}`}>
                    <div className="emh-bar"><i style={{ height: `${Math.min(100, Math.max(4, v))}%` }} className={v >= 80 ? 'ok' : 'low'} /><span>{v}</span><small>{dayjs(x.dateRate).format('MM/YY')}</small></div>
                  </Tooltip>
                )
              })}
            </div>
          )}
          {list.map((x) => (
            <div key={`${x.typeRate}|${x.dateRate}`} className="emh-card">
              <div className="emh-head">
                <b>{x.typeRate}</b>
                <Tag color={STAGE_COLOR[x.stage]} variant="filled">{t(`emh.stage.${x.stage}`)}</Tag>
                <span className="cell-muted">{dayjs(x.dateRate).format('DD/MM/YYYY')}</span>
                {x.result && <Tag color={x.result === 'pass' ? 'success' : 'error'} variant="filled">{t(x.result === 'pass' ? 'rev.pass' : 'rev.fail')}</Tag>}
                {x.promote && <Tag color="gold" variant="filled">{t('rev.promote')}</Tag>}
              </div>
              <div className="emh-rounds">
                {x.rounds.length === 0 ? <span className="cell-muted">{t('emh.noScores')}</span> : x.rounds.map((r, i) => (
                  <Tooltip key={i} title={`${r.userName ?? ''}${r.status ? ` · ${r.status}` : ''}`}>
                    <span className="emh-round"><small>{t('line.roundN', { n: i + 1 })}</small><b>{r.mark ?? '—'}</b></span>
                  </Tooltip>
                ))}
                {x.average != null && <span className="emh-round sum"><small>F</small><b>{x.average}</b></span>}
                {x.culture != null && <span className="emh-round sum"><small>G</small><b>{x.culture}</b></span>}
                {x.overall != null && <span className="emh-round sum"><small>70/30</small><b>{x.overall}</b></span>}
                {x.suggest && <Tag variant="filled" color={x.suggest === 'pass' ? 'success' : 'error'}>{t('rev.suggest')}: {t(x.suggest === 'pass' ? 'rev.pass' : 'rev.fail')}</Tag>}
              </div>
              {x.remark && <div className="emh-remark">{x.remark}</div>}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}
