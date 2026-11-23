import { Alert, Button, Popconfirm, Select, Space, Switch, Typography } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { erpLink } from '../../api/erpLink'
import { adminError, userAdmin } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { useToast } from '../../hooks/useToast'
import { OrgEvalJobCard } from './OrgEvalJobCard'
import { OrgDeptAlignCard } from './OrgDeptAlignCard'
import { IdCardErpSyncCard } from './IdCardErpSyncCard'
import { OrgSwitchCard } from './OrgSwitchCard'

/** Job nền đồng bộ nhân sự ERP + tạo tài khoản: bật / tắt từng việc, bảng chức danh → nhóm quyền, chạy ngay. Lịch tự chạy 02:00 hằng ngày. */
export function OrgJobsPanel() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const q = useQuery({ queryKey: ['erp', 'job'], queryFn: erpLink.orgAccountJob })
  const groups = useQuery({ queryKey: ['erp', 'job', 'groups'], queryFn: userAdmin.groups })
  const errText = (e: unknown) => { const a = adminError(e); return a.code === 'job_busy' ? t('om.job.busy') : t('om.err.generic') }
  const save = useMutation({
    mutationFn: erpLink.saveOrgAccountJob,
    onSuccess: (d) => { msg.success(t('om.saved')); qc.setQueryData(['erp', 'job'], d) },
    onError: (e) => msg.error(errText(e)),
  })
  const run = useMutation({
    mutationFn: erpLink.runOrgAccountJob,
    onSuccess: (r) => { msg.success(t('om.job.ran', { e: r.erpNew, r: r.erpResigned, a: r.employeesAdded, c: r.accountsCreated, f: r.failed })); qc.invalidateQueries({ queryKey: ['erp'] }); qc.invalidateQueries({ queryKey: ['orgModel'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const d = q.data
  if (!d) return null
  const s = d.settings
  const posMap = s.positionGroups ?? {}
  const update = (patch: Partial<{ enabled: boolean; groupId: string | null; syncEmployees: boolean; positionGroups: Record<string, string>; hrGroupId: string | null }>) => save.mutate({ ...s, positionGroups: posMap, ...patch })
  const groupOptions = (groups.data ?? []).filter((g) => g.active).map((g) => ({ value: g.groupId, label: g.nameVi || g.name }))
  const setPos = (pos: string, g: string | undefined) => { const m = { ...posMap }; if (g) m[pos] = g; else delete m[pos]; update({ positionGroups: m }) }
  const anyOn = s.syncEmployees || s.enabled
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <OrgSwitchCard />
      <Alert type="info" showIcon title={t('om.job.note')} />
      <div className="ot-card" style={{ padding: 18, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space><Switch checked={s.syncEmployees} loading={save.isPending} onChange={(v) => update({ syncEmployees: v })} /> <b>{t('om.job.sync')}</b></Space>
          <Space wrap>
            <Switch checked={s.enabled} loading={save.isPending} disabled={!s.groupId} onChange={(v) => update({ enabled: v })} /> <b>{t('om.job.account')}</b>
            <Select style={{ width: 260 }} placeholder={t('om.job.group')} value={s.groupId ?? undefined} loading={groups.isLoading} options={groupOptions} onChange={(v) => update({ groupId: v })} />
          </Space>
          <div>
            <Typography.Text strong>{t('om.job.posTitle')}</Typography.Text>
            <DataTable<{ position: string; employees: number }> rowKey="position" size="small" sticky={false} dataSource={d.positions} pagination={false} style={{ marginTop: 8, maxWidth: 600 }} columns={[
              { title: t('om.position'), dataIndex: 'position', width: 200 },
              { title: t('om.job.count'), dataIndex: 'employees', width: 90 },
              { title: t('om.job.group'), key: 'g', render: (_: unknown, r: { position: string }) => <Select allowClear style={{ width: 240 }} placeholder={t('om.job.posDefault')} value={posMap[r.position]} options={groupOptions} onChange={(v) => setPos(r.position, v)} /> },
            ]} />
          </div>
          <div>
            <Typography.Text strong>{t('om.job.hsTitle')}</Typography.Text>
            <div className="cell-muted" style={{ margin: '4px 0 8px' }}>{t('om.job.hsNote')}</div>
            <Select allowClear style={{ width: 260 }} placeholder={t('om.job.hsGroup')} value={s.hrGroupId ?? undefined} loading={groups.isLoading} options={groupOptions} onChange={(v) => update({ hrGroupId: v ?? null })} />
          </div>
        </Space>
      </div>
      <Space wrap size={16}>
        <Popconfirm title={t('om.job.runConfirm')} okText={t('om.job.run')} cancelText={t('om.cancel')} onConfirm={() => run.mutate()} disabled={!anyOn}>
          <Button type="primary" size="large" icon={<PlayCircleOutlined />} loading={run.isPending} disabled={!anyOn}>{t('om.job.run')}</Button>
        </Popconfirm>
        <span className="cell-muted">{anyOn ? t('om.job.pending', { n: d.pending }) : t('om.job.allOff')}</span>
        <span className="cell-muted">{t('om.job.last', { at: d.lastRun ? d.lastRun.replace('T', ' ').slice(0, 16) : '—', c: d.lastCreated, f: d.lastFailed })}</span>
      </Space>
      <OrgEvalJobCard />
      <OrgDeptAlignCard />
      <IdCardErpSyncCard />
    </Space>
  )
}
