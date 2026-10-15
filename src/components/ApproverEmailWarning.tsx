import { Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Approver } from '../api/requests'

/** Ô chọn: thêm dấu cảnh báo cho người duyệt chưa có email (đơn sẽ không hiện ở hệ thống cũ). */
export const approverOption = (a: Approver) => ({ value: a.userId, label: a.email ? a.name : `${a.name} ⚠` })

/** Tên những người duyệt đã chọn nhưng chưa có email trong line phê duyệt / tài khoản. */
export function noEmailNames(list: Approver[] | undefined, selected: (string | undefined)[]): string[] {
  return Array.from(new Set(selected.filter(Boolean) as string[]))
    .map((id) => list?.find((a) => a.userId === id))
    .filter((a): a is Approver => !!a && !a.email)
    .map((a) => a.name)
}

/**
 * Đơn mới lưu email người duyệt như hệ thống cũ nên hệ thống cũ cũng thấy và duyệt được đơn.
 * Người duyệt chưa có email thì đơn chỉ hiện ở hệ thống mới (vẫn duyệt được tại đây).
 */
export function ApproverEmailWarning({ names }: { names: string[] }) {
  const { t } = useTranslation()
  if (names.length === 0) return null
  return <Alert type="warning" showIcon title={t('req.noEmailWarn', { names: names.join(', '), count: names.length })} style={{ fontSize: 12 }} />
}
