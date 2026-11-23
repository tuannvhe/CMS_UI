import { Button, Popconfirm } from 'antd'
import { CloseCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { ApprovalStep } from '../api/requests'

/**
 * Người gửi hủy được đơn của chính mình khi chưa cấp nào duyệt, hoặc đã có cấp từ chối. Đã duyệt một phần mà chưa ai từ chối thì không hủy được.
 * (Máy chủ kiểm tra lại điều kiện này; ở đây chỉ để ẩn / hiện nút.)
 */
export function canCancelSteps(steps: ApprovalStep[], senderId: string, userId?: string): boolean {
  if (!userId || senderId.trim().toLowerCase() !== userId.trim().toLowerCase()) return false
  if (steps.some((s) => s.status === 'rejected')) return true
  return !steps.some((s) => s.status === 'approved')
}

/** Nút "Hủy đơn" có hỏi lại; đơn bị xóa khỏi danh sách đã gửi. */
export function CancelSubmittedButton({ onConfirm, loading }: { onConfirm: () => void; loading?: boolean }) {
  const { t } = useTranslation()
  return (
    <Popconfirm title={t('req.cancelRequestAsk')} description={t('req.cancelRequestHint')} okText={t('req.cancelRequest')} okButtonProps={{ danger: true }} onConfirm={onConfirm}>
      <Button size="small" danger icon={<CloseCircleOutlined />} loading={loading}>{t('req.cancelRequest')}</Button>
    </Popconfirm>
  )
}
