import { useState } from 'react'
import { Alert, Checkbox, Skeleton, Space } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { AppModal } from '../../components/AppModal'
import { evaluations, type EvaluationSet } from '../../api/evaluations'
import { apiErrorCode } from '../../api/requests'
import { useToast } from '../../hooks/useToast'

const key = (s: EvaluationSet) => `${s.employeeId}|${s.dateRate.slice(0, 10)}|${s.typeRate}`

/**
 * Xóa một đơn đánh giá đã tạo (dùng ở màn Đăng ký đánh giá và Rà soát line). Mở chi tiết để biết đơn đã có vòng xác nhận / điểm / nhận xét / HR chốt chưa:
 * nếu có thì bắt buộc tick xác nhận mất dữ liệu (gửi force = true). Chỉ đơn trùng kỳ với đơn loại khác là bị chặn hẳn.
 */
export function EvaluationDeleteModal({ target, onClose }: { target: EvaluationSet | null; onClose: () => void }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [understood, setUnderstood] = useState(false)

  const detail = useQuery({
    queryKey: ['evaluations', 'audit-del', target ? key(target) : ''], enabled: !!target, gcTime: 0,
    queryFn: () => evaluations.auditSet(target!.employeeId, target!.dateRate.slice(0, 10), target!.typeRate),
  })
  const confirmed = detail.data?.rounds.filter((r) => r.confirmed).length ?? 0
  const flags = detail.data?.flags
  const marks = Math.max(flags?.marks ?? 0, detail.data?.rounds.reduce((n, r) => n + (r.markCount ?? 0), 0) ?? 0)
  const blocked = flags?.sharedDate ? 'eva.auditDeleteShared' : null
  const needForce = confirmed > 0 || marks > 0 || !!flags?.comments || !!flags?.finalized
  const close = () => { setUnderstood(false); onClose() }

  const remove = useMutation({
    mutationFn: () => evaluations.deleteSet(target!.employeeId, target!.dateRate.slice(0, 10), target!.typeRate, needForce),
    onSuccess: () => { message.success(t('eva.auditDeleted')); close(); qc.invalidateQueries({ queryKey: ['evaluations'] }) },
    onError: (e) => {
      const { code, detail: d } = apiErrorCode(e)
      if (d === 'needs_force') qc.invalidateQueries({ queryKey: ['evaluations', 'audit-del'] })
      message.error(code === 'not_found' ? t('req.err.not_found') : d === 'shared_date' ? t('eva.auditDeleteShared') : d === 'needs_force' ? t('eva.auditDeleteChanged') : t('req.err.generic'))
    },
  })

  return (
    <AppModal open={!!target} onClose={close} size="sm" danger icon={<DeleteOutlined />} title={t('eva.auditDeleteTitle')}
      subtitle={target ? `${target.employeeId} – ${target.fullName}` : undefined}
      onOk={() => remove.mutate()} okText={t('eva.auditDeleteDo')} okLoading={remove.isPending} okDisabled={detail.isLoading || !!blocked || (needForce && !understood)}>
      {detail.isLoading ? <Skeleton active /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <div>{target?.typeRate} · {t('eva.dateRate')}: {target ? dayjs(target.dateRate).format('DD/MM/YYYY') : ''}</div>
          {blocked ? <Alert type="error" showIcon title={t(blocked)} /> : <>
            <Alert type={needForce ? 'error' : 'warning'} showIcon title={t(needForce ? 'eva.auditDeleteDanger' : 'eva.auditDeleteInfo', { rounds: detail.data?.rounds.length ?? 0, confirmed, marks })} />
            {flags?.finalized && <Alert type="error" showIcon title={t('eva.auditDeleteFinalized')} />}
            {needForce && <Checkbox checked={understood} onChange={(e) => setUnderstood(e.target.checked)}>{t('eva.auditDeleteAck')}</Checkbox>}
          </>}
        </Space>
      )}
    </AppModal>
  )
}
