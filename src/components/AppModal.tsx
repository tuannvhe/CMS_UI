import type { ReactNode } from 'react'
import { Button, Modal } from 'antd'
import { useTranslation } from 'react-i18next'

const WIDTH = { sm: 520, md: 720, lg: 880, xl: 1040 } as const

export interface AppModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Dòng phụ dưới tiêu đề (ví dụ mã – tên nhân viên) */
  subtitle?: ReactNode
  icon?: ReactNode
  /** Cỡ chuẩn: sm 520 · md 720 · lg 880 · xl 1040 */
  size?: keyof typeof WIDTH
  /** Có onOk → chân modal chuẩn: [extra ở bên trái] … [Hủy] [OK]. Không có onOk → không có chân (modal chỉ để xem). */
  onOk?: () => void
  okText?: ReactNode
  cancelText?: ReactNode
  okDisabled?: boolean
  okLoading?: boolean
  /** Nút OK màu đỏ (hành động nguy hiểm) */
  danger?: boolean
  /** Nội dung bên trái chân modal (ví dụ nút "Dùng mặc định") */
  extra?: ReactNode
  /** Chân tùy biến hoàn toàn (ghi đè chân chuẩn); null = không chân */
  footer?: ReactNode | null
  children: ReactNode
}

/**
 * Modal chuẩn của hệ thống: cùng bo góc, tiêu đề có biểu tượng + dòng phụ, vùng nội dung cuộn trong, chân cố định.
 * Mọi popup (sửa đơn nháp, từ chối, line, đánh giá…) dùng component này để hình thức và hành vi đồng nhất.
 * Modal có biểu mẫu (có onOk) không đóng khi bấm ra ngoài để tránh mất dữ liệu đang nhập.
 */
export function AppModal({
  open, onClose, title, subtitle, icon, size = 'md', onOk, okText, cancelText, okDisabled, okLoading, danger, extra, footer, children,
}: AppModalProps) {
  const { t } = useTranslation()
  const standardFooter = onOk ? (
    <>
      <div className="am-extra">{extra}</div>
      <div className="am-actions">
        <Button onClick={onClose}>{cancelText ?? t('req.cancel')}</Button>
        <Button type="primary" danger={danger} disabled={okDisabled} loading={okLoading} onClick={onOk}>{okText ?? t('req.saveChanges')}</Button>
      </div>
    </>
  ) : null
  const content = footer === undefined ? standardFooter : footer

  return (
    <Modal
      open={open} onCancel={onClose} className="app-modal" width={WIDTH[size]} centered destroyOnHidden maskClosable={!onOk}
      title={(
        <div className="am-title">
          {icon && <span className="am-icon">{icon}</span>}
          <div style={{ minWidth: 0 }}>
            <div className="am-t">{title}</div>
            {subtitle && <div className="am-sub">{subtitle}</div>}
          </div>
        </div>
      )}
      footer={content ? <div className="am-footer">{content}</div> : null}
    >
      <div className="am-body">{children}</div>
    </Modal>
  )
}
