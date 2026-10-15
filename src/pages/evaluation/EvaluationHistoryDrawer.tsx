import { Drawer, Empty, Skeleton, Timeline } from 'antd'
import { CheckCircleFilled, ClockCircleOutlined, EditOutlined, FlagFilled, PlusCircleFilled } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { review, type HistoryEvent, type ReviewKey } from '../../api/review'

const ICON: Record<HistoryEvent['kind'], { icon: React.ReactNode; color: string }> = {
  created: { icon: <PlusCircleFilled />, color: 'blue' },
  round_saved: { icon: <EditOutlined />, color: 'gray' },
  round_done: { icon: <CheckCircleFilled />, color: 'green' },
  hr_final: { icon: <FlagFilled />, color: 'purple' },
}

/** Lịch sử thao tác của một đơn đánh giá: tạo, người đánh giá lưu / xác nhận từng vòng, HR chốt. */
export function EvaluationHistoryDrawer({ target, title, onClose }: { target: ReviewKey | null; title?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['evaluations', 'history', target], queryFn: () => review.history(target!), enabled: !!target })
  const text = (e: HistoryEvent) => {
    const who = e.byName || e.by || t('hist.system')
    if (e.kind === 'created') return t('hist.created', { who, n: e.detail })
    if (e.kind === 'round_saved') return t('hist.roundSaved', { who, n: e.round })
    if (e.kind === 'round_done') return t('hist.roundDone', { who, n: e.round })
    const [res, ...rest] = (e.detail ?? '').split(': ')
    return t('hist.hrFinal', { who, result: res === 'pass' ? t('rev.pass') : res === 'fail' ? t('rev.fail') : '—' }) + (rest.length ? ` — ${rest.join(': ')}` : '')
  }
  return (
    <Drawer open={!!target} onClose={onClose} width={460} title={<span><ClockCircleOutlined /> {t('hist.title')}{title ? ` · ${title}` : ''}</span>}>
      {q.isLoading ? <Skeleton active /> : q.isError || !q.data?.length ? <Empty description={t('hist.empty')} /> : (
        <>
          <Timeline items={q.data.map((e) => ({ color: ICON[e.kind].color, dot: ICON[e.kind].icon, children: (
            <div><div>{text(e)}</div><small style={{ color: 'var(--c-muted)' }}>{dayjs(e.at).format('DD/MM/YYYY HH:mm')}</small></div>
          ) }))} />
          <small style={{ color: 'var(--c-muted)' }}>{t('hist.note')}</small>
        </>
      )}
    </Drawer>
  )
}
