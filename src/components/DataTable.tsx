import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Empty, Table, type TableProps } from 'antd'
import { useTranslation } from 'react-i18next'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import { withColumnFilters } from './ColumnFilter'
import { DATA_TEXT_FIELDS, trData, useDataDictVersion } from '../utils/dataText'

/** Gắn bộ lọc kiểu Excel cho mảng cột; bỏ qua khi tắt. Bảng phân trang phía máy chủ (pagination.total) vẫn được gắn nhưng chỉ lọc trong trang đang hiển thị (bộ lọc có ghi chú). */
function useAutoColumnFilters<T extends object>(columns: TableProps<T>['columns'], dataSource: TableProps<T>['dataSource'], pagination: TableProps<T>['pagination'], enabled: boolean) {
  const dataRef = useRef<readonly T[]>([])
  dataRef.current = dataSource ?? []
  const serverPaged = !!pagination && pagination.total !== undefined
  const dictVersion = useDataDictVersion()   // từ điển dịch dữ liệu tải xong thì tính lại cột để vẽ chữ đã dịch
  return useMemo(() => {
    const cols = columns ? withDataText<T>(columns) : columns
    return cols && enabled ? withColumnFilters<T>(cols, () => dataRef.current, serverPaged) : cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, enabled, serverPaged, dictVersion])
}

/** Cột bộ phận / chức vụ / part / line không có render riêng: hiển thị theo từ điển dịch dữ liệu (lọc / sắp xếp vẫn theo chữ gốc). */
function withDataText<T extends object>(columns: ColumnsType<T>): ColumnsType<T> {
  return columns.map((c) => {
    if ('children' in c && c.children) return { ...c, children: withDataText(c.children as ColumnsType<T>) } as typeof c
    const col = c as ColumnType<T>
    if (col.render || typeof col.dataIndex !== 'string' || !DATA_TEXT_FIELDS.has(col.dataIndex)) return c
    return { ...col, render: (v: unknown) => (typeof v === 'string' ? trData(v) : (v as ReactNode)) } as typeof c
  }) as ColumnsType<T>
}

type Props<T> = TableProps<T> & {
  /** Thanh công cụ phía trên bảng: tìm kiếm, bộ lọc, nút xuất Excel… */
  toolbar?: ReactNode
  /** Tự gắn bộ lọc kiểu Excel (Giá trị / Lọc theo văn bản) ở tiêu đề các cột chưa có bộ lọc riêng. Mặc định bật; tắt bằng false. Bảng phân trang phía máy chủ (pagination.total) không được gắn vì chỉ lọc được trang đang có. */
  columnFilters?: boolean
  /** Đổi giá trị này (vd. khi bấm "Xem" truy vấn mới) thì bỏ hết bộ lọc ở tiêu đề cột, để bộ lọc của lần trước không ẩn mất dữ liệu mới. */
  filterResetKey?: string
}

/**
 * Bảng dữ liệu chuẩn của hệ thống: khung bo góc có bóng nhẹ, thanh công cụ riêng, tiêu đề cột nổi bật, dòng xen kẽ màu,
 * dòng được tô khi rê chuột/chọn, chân bảng có tổng số dòng và phân trang. Mọi danh sách dùng component này để đồng bộ.
 * Kiểu hiển thị nằm ở khối ".data-table" trong index.css.
 */
export function DataTable<T extends object>({ toolbar, pagination, className, columnFilters = true, columns, filterResetKey, locale, onChange, ...rest }: Props<T>) {
  const { t } = useTranslation()
  const cols = useAutoColumnFilters<T>(columns, rest.dataSource, pagination, columnFilters)
  // Bộ lọc cột của antd giữ trạng thái riêng: dựng lại bảng (đổi key) là xoá hết.
  // Bộ lọc cột ẩn hết các dòng đang có thì báo rõ kèm nút bỏ lọc, thay vì chỉ hiện "Trống".
  const [gen, setGen] = useState(0)
  const [filtering, setFiltering] = useState(false)
  const [lastKey, setLastKey] = useState(filterResetKey)
  if (lastKey !== filterResetKey) { setLastKey(filterResetKey); setGen((g) => g + 1); setFiltering(false) }
  const clearFilters = () => { setGen((g) => g + 1); setFiltering(false) }
  const hiddenByFilter = filtering && (rest.dataSource?.length ?? 0) > 0
  return (
    <div className="data-table">
      {toolbar && <div className="dt-toolbar">{toolbar}</div>}
      <Table<T>
        size="middle"
        scroll={{ x: 'max-content' }}
        sticky
        key={gen}
        className={className}
        columns={cols}
        pagination={pagination === false ? false : {
          pageSize: 20, showSizeChanger: true, showTotal: (total) => t('common.records', { n: total }), ...pagination,
        }}
        {...rest}
        locale={hiddenByFilter
          ? { ...locale, emptyText: <Empty description={t('common.colFilter.hiddenAll')}><Button size="small" onClick={clearFilters}>{t('common.colFilter.clearAll')}</Button></Empty> }
          : locale}
        onChange={(p, filters, sorter, extra) => {
          setFiltering(Object.values(filters ?? {}).some((v) => Array.isArray(v) && v.length > 0))
          onChange?.(p, filters, sorter, extra)
        }}
      />
    </div>
  )
}

/** Bảng nhỏ gọn đặt trong modal/khối: cùng họ với DataTable nhưng không có khung ngoài và không phân trang. Cũng có bộ lọc cột (tắt bằng columnFilters={false}). */
export function MiniTable<T extends object>({ className, columnFilters = true, columns, ...rest }: TableProps<T> & { columnFilters?: boolean }) {
  const cols = useAutoColumnFilters<T>(columns, rest.dataSource, rest.pagination, columnFilters)
  return <Table<T> size="small" pagination={false} className={`mini-table${className ? ` ${className}` : ''}`} columns={cols} {...rest} />
}

function FilterTableImpl<T extends object>({ columnFilters = true, columns, ...rest }: TableProps<T> & { columnFilters?: boolean }) {
  const cols = useAutoColumnFilters<T>(columns, rest.dataSource, rest.pagination, columnFilters)
  return <Table<T> columns={cols} {...rest} />
}

/** Thay thế trực tiếp cho `Table` của antd (import { FilterTable as Table }) để có bộ lọc cột kiểu Excel mà không đổi kiểu dáng. */
export const FilterTable = Object.assign(FilterTableImpl, { Summary: Table.Summary, SELECTION_COLUMN: Table.SELECTION_COLUMN, EXPAND_COLUMN: Table.EXPAND_COLUMN })
