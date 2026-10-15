import { Tag } from 'antd'
import { useTranslation } from 'react-i18next'

export type Status = 'approved' | 'pending' | 'rejected' | 'draft' | 'warning'

const COLORS: Record<Status, string> = {
  approved: 'success',
  pending: 'processing',
  rejected: 'error',
  draft: 'default',
  warning: 'warning',
}

/** Nhãn trạng thái thống nhất cho mọi bảng (duyệt đơn, đánh giá, OT…). */
export function StatusTag({ status }: { status: Status }) {
  const { t } = useTranslation()
  return <Tag color={COLORS[status]} variant="filled">{t(`status.${status}`)}</Tag>
}
