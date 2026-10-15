import type { ReactNode } from 'react'
import { Table, type TableProps } from 'antd'
import { useTranslation } from 'react-i18next'

type Props<T> = TableProps<T> & {
  /** Thanh công cụ phía trên bảng: tìm kiếm, bộ lọc, nút xuất Excel… */
  toolbar?: ReactNode
}

/**
 * Bảng dữ liệu chuẩn của hệ thống: khung bo góc có bóng nhẹ, thanh công cụ riêng, tiêu đề cột nổi bật, dòng xen kẽ màu,
 * dòng được tô khi rê chuột/chọn, chân bảng có tổng số dòng và phân trang. Mọi danh sách dùng component này để đồng bộ.
 * Kiểu hiển thị nằm ở khối ".data-table" trong index.css.
 */
export function DataTable<T extends object>({ toolbar, pagination, className, ...rest }: Props<T>) {
  const { t } = useTranslation()
  return (
    <div className="data-table">
      {toolbar && <div className="dt-toolbar">{toolbar}</div>}
      <Table<T>
        size="middle"
        scroll={{ x: 'max-content' }}
        sticky
        className={className}
        pagination={pagination === false ? false : {
          pageSize: 20, showSizeChanger: true, showTotal: (total) => t('common.records', { n: total }), ...pagination,
        }}
        {...rest}
      />
    </div>
  )
}

/** Bảng nhỏ gọn đặt trong modal/khối: cùng họ với DataTable nhưng không có khung ngoài và không phân trang. */
export function MiniTable<T extends object>({ className, ...rest }: TableProps<T>) {
  return <Table<T> size="small" pagination={false} className={`mini-table${className ? ` ${className}` : ''}`} {...rest} />
}
