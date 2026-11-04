import { useState } from 'react'
import { Button, Popconfirm, Space, Switch, Table, Tag } from 'antd'
import { EyeOutlined, PlayCircleOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { adminError } from '../../api/userAdmin'
import { orgDeptAlign, type OrgAlignPreview } from '../../api/orgModel'
import { useToast } from '../../hooks/useToast'

const KEY = ['orgModel', 'deptAlign']

/** Job đồng bộ tên Dept từ cây ERP vào cột cũ Tbl_Employees.DEPARTMENTNAME: công tắc (mặc định tắt), xem trước, áp dụng, hoàn tác. */
export function OrgDeptAlignCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [pv, setPv] = useState<OrgAlignPreview | null>(null)
  const q = useQuery({ queryKey: KEY, queryFn: orgDeptAlign.status })
  const errText = (e: unknown) => (adminError(e).code === 'job_busy' ? t('om.job.busy') : t('om.err.generic'))
  const save = useMutation({
    mutationFn: orgDeptAlign.save,
    onSuccess: (d) => { msg.success(t('om.saved')); qc.setQueryData(KEY, d) },
    onError: (e) => msg.error(errText(e)),
  })
  const preview = useMutation({ mutationFn: orgDeptAlign.preview, onSuccess: setPv, onError: (e) => msg.error(errText(e)) })
  const apply = useMutation({
    mutationFn: orgDeptAlign.apply,
    onSuccess: (r) => { msg.success(t('om.job.alApplied', { n: r.changed })); setPv(null); qc.invalidateQueries({ queryKey: KEY }) },
    onError: (e) => msg.error(errText(e)),
  })
  const undo = useMutation({
    mutationFn: orgDeptAlign.undo,
    onSuccess: (r) => { msg.success(t('om.job.alUndone', { n: r.restored })); setPv(null); qc.invalidateQueries({ queryKey: KEY }) },
    onError: (e) => msg.error(errText(e)),
  })
  const d = q.data
  if (!d) return null
  const s = d.settings
  return (
    <div style={{ padding: 18, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Switch checked={s.enabled} loading={save.isPending} disabled={!d.ready} onChange={(v) => save.mutate(v)} />
          <b>{t('om.job.alTitle')}</b>
        </Space>
        <span className="cell-muted">{d.ready ? t('om.job.alNote') : t('om.job.evNotReady')}</span>
        <Space wrap size={12}>
          <Button icon={<EyeOutlined />} loading={preview.isPending} disabled={!d.ready} onClick={() => preview.mutate()}>{t('om.job.alPreview')}</Button>
          <Popconfirm title={t('om.job.alConfirm')} okText={t('om.job.alApply')} cancelText={t('om.cancel')} onConfirm={() => apply.mutate()}>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={apply.isPending} disabled={!d.ready || !pv || pv.differ === 0}>{t('om.job.alApply')}</Button>
          </Popconfirm>
          <Popconfirm title={t('om.job.alUndoConfirm')} okText={t('om.job.alUndo')} cancelText={t('om.cancel')} onConfirm={() => undo.mutate()} disabled={!s.lastBatch}>
            <Button icon={<UndoOutlined />} loading={undo.isPending} disabled={!s.lastBatch}>{t('om.job.alUndo')}</Button>
          </Popconfirm>
        </Space>
        <span className="cell-muted">{t('om.job.alLast', { at: s.lastRun ? s.lastRun.replace('T', ' ').slice(0, 16) : '—', c: s.lastChanged })}</span>
        {pv && (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <span>{t('om.job.alResult', { c: pv.compared, d: pv.differ })}</span>
            {pv.mappings.length > 0 && (
              <Space wrap size={[4, 6]}>
                {pv.mappings.map((m) => <Tag key={m.oldDept + '>' + m.newDept}>{m.oldDept || '—'} → {m.newDept}: {m.count}</Tag>)}
              </Space>
            )}
            <Table size="small" pagination={false} rowKey="employeeId" dataSource={pv.sample} scroll={{ x: 'max-content' }}
              columns={[
                { title: t('om.job.alId'), dataIndex: 'employeeId' },
                { title: t('om.job.alName'), dataIndex: 'fullName' },
                { title: t('om.job.alOld'), dataIndex: 'oldDept' },
                { title: t('om.job.alNew'), dataIndex: 'newDept' },
              ]} />
          </Space>
        )}
      </Space>
    </div>
  )
}
