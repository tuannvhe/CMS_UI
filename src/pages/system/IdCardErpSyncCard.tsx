import { Button, Popconfirm, Space, Switch } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { adminError } from '../../api/userAdmin'
import { idCardErpSync } from '../../api/orgModel'
import { useToast } from '../../hooks/useToast'

const KEY = ['orgModel', 'idCardErpSync']

/** Job tự đồng bộ CCCD lên ERP (người đã có trong ERP, khớp theo mã NV): một công tắc bật / tắt (mặc định tắt) và nút chạy ngay. Lịch tự chạy 02:00. */
export function IdCardErpSyncCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const q = useQuery({ queryKey: KEY, queryFn: idCardErpSync.status })
  const errText = (e: unknown) => {
    const c = adminError(e).code
    return c === 'job_busy' ? t('om.job.busy') : c === 'erp_write_not_configured' ? t('idcSync.notConfigured') : c === 'user_seq_missing' ? t('idcSync.userSeq') : t('om.err.generic')
  }
  const save = useMutation({
    mutationFn: idCardErpSync.save,
    onSuccess: (d) => { msg.success(t('om.saved')); qc.setQueryData(KEY, d) },
    onError: (e) => msg.error(errText(e)),
  })
  const run = useMutation({
    mutationFn: idCardErpSync.run,
    onSuccess: (r) => { msg.success(t('idcSync.ran', { c: r.checked, u: r.updated, s: r.same, n: r.notInErp, k: r.skipped, f: r.failed })); qc.invalidateQueries({ queryKey: KEY }) },
    onError: (e) => msg.error(errText(e)),
  })
  const d = q.data
  if (!d) return null
  const s = d.settings
  return (
    <div style={{ padding: 18, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Switch checked={s.enabled} loading={save.isPending} disabled={!d.configured} onChange={(v) => save.mutate(v)} />
          <b>{t('idcSync.title')}</b>
        </Space>
        <span className="cell-muted">{d.configured ? t('idcSync.note', { db: d.target ?? '—' }) : t('idcSync.notConfigured')}</span>
        <Space wrap size={16}>
          <Popconfirm title={t('idcSync.confirm', { db: d.target ?? '—' })} okText={t('idcSync.run')} cancelText={t('om.cancel')} onConfirm={() => run.mutate()} disabled={!s.enabled}>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={run.isPending} disabled={!s.enabled}>{t('idcSync.run')}</Button>
          </Popconfirm>
          <span className="cell-muted">{s.enabled ? t('idcSync.last', { at: s.lastRun ? s.lastRun.replace('T', ' ').slice(0, 16) : '—', u: s.lastUpdated, s: s.lastSame, n: s.lastNotInErp, k: s.lastSkipped, f: s.lastFailed }) : t('idcSync.off')}</span>
        </Space>
      </Space>
    </div>
  )
}
