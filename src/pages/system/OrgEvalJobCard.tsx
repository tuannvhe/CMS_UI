import { Button, Popconfirm, Space, Switch, Tag } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { adminError } from '../../api/userAdmin'
import { orgEvalJob } from '../../api/orgModel'
import { useToast } from '../../hooks/useToast'

const KEY = ['orgModel', 'evalJob']

/** Job tạo đơn đánh giá theo line mới: chỉ một công tắc bật / tắt (mặc định tắt) và nút tạo ngay. Lịch tự chạy 02:00 sau job tạo tài khoản. */
export function OrgEvalJobCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const q = useQuery({ queryKey: KEY, queryFn: orgEvalJob.status })
  const errText = (e: unknown) => (adminError(e).code === 'job_busy' ? t('om.job.busy') : t('om.err.generic'))
  const save = useMutation({
    mutationFn: orgEvalJob.save,
    onSuccess: (d) => { msg.success(t('om.saved')); qc.setQueryData(KEY, d) },
    onError: (e) => msg.error(errText(e)),
  })
  const run = useMutation({
    mutationFn: orgEvalJob.run,
    onSuccess: (r) => { msg.success(t('om.job.evRan', { c: r.candidates, n: r.created, h: r.held })); qc.invalidateQueries({ queryKey: KEY }) },
    onError: (e) => msg.error(errText(e)),
  })
  const d = q.data
  if (!d) return null
  const s = d.settings
  const held = Object.entries(s.lastHeldByReason ?? {}).sort((a, b) => b[1] - a[1])
  return (
    <div style={{ padding: 18, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Switch checked={s.enabled} loading={save.isPending} disabled={!d.ready} onChange={(v) => save.mutate(v)} />
          <b>{t('om.job.evTitle')}</b>
        </Space>
        <span className="cell-muted">{d.ready ? t('om.job.evNote') : t('om.job.evNotReady')}</span>
        <Space wrap size={16}>
          <Popconfirm title={t('om.job.evConfirm')} okText={t('om.job.evRun')} cancelText={t('om.cancel')} onConfirm={() => run.mutate()} disabled={!s.enabled}>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={run.isPending} disabled={!s.enabled}>{t('om.job.evRun')}</Button>
          </Popconfirm>
          <span className="cell-muted">{s.enabled ? t('om.job.evLast', { at: s.lastRun ? s.lastRun.replace('T', ' ').slice(0, 16) : '—', c: s.lastCreated, h: s.lastHeld }) : t('om.job.evOff')}</span>
        </Space>
        {held.length > 0 && (
          <Space wrap size={[4, 6]}>
            <span className="cell-muted">{t('om.job.evHeld')}</span>
            {held.map(([k, n]) => <Tag key={k}>{t(`om.job.evReason.${k}`, { defaultValue: k })}: {n}</Tag>)}
          </Space>
        )}
      </Space>
    </div>
  )
}
