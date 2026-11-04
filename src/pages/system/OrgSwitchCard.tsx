import { Alert, Popconfirm, Space, Switch } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { orgSwitch } from '../../api/orgModel'
import { useToast } from '../../hooks/useToast'

const KEY = ['orgModel', 'switch']

/** Công tắc chung "Dùng cây và line ERP": tắt = đơn và đánh giá vẫn theo phòng ban + line cũ; bật = người duyệt lấy theo line mới. */
export function OrgSwitchCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const q = useQuery({ queryKey: KEY, queryFn: orgSwitch.get })
  const save = useMutation({
    mutationFn: orgSwitch.save,
    onSuccess: (d) => { msg.success(t(d.useErp ? 'om.job.swOnDone' : 'om.job.swOffDone')); qc.setQueryData(KEY, d) },
    onError: () => msg.error(t('om.err.generic')),
  })
  const d = q.data
  if (!d) return null
  return (
    <div style={{ padding: 18, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Space wrap>
          <Popconfirm title={t(d.useErp ? 'om.job.swOffConfirm' : 'om.job.swOnConfirm')} okText={t('om.job.swOk')} cancelText={t('om.cancel')} onConfirm={() => save.mutate(!d.useErp)}>
            <Switch checked={d.useErp} loading={save.isPending} />
          </Popconfirm>
          <b>{t('om.job.swTitle')}</b>
        </Space>
        <span className="cell-muted">{t('om.job.swNote')}</span>
        {d.useErp && <Alert type="warning" showIcon title={t('om.job.swOnNote')} />}
      </Space>
    </div>
  )
}
