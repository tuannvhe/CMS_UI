import { useMemo, useState } from 'react'
import { Alert, Button, Descriptions, Drawer, Empty, Result, Select, Skeleton } from 'antd'
import { FileDoneOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorKey, type HnRow } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { cell, fmtCell, isEmptyCell, visibleColumns } from '../../utils/hnFormat'

const PERIOD = 'KyLuong'

/** Chốt công theo kỳ: tối đa 24 kỳ gần nhất (mới nhất trước). Cột lấy từ khoá JSON của nguồn, ẩn cột rỗng; "Chi tiết" mở danh sách khoá - giá trị của một kỳ. */
export default function HnTimeworkPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [period, setPeriod] = useState<string>()
  const [detail, setDetail] = useState<HnRow | null>(null)
  const q = useQuery({ queryKey: ['hn', 'timework', user?.userId], queryFn: () => hnApi.timework(), staleTime: 60_000, retry: false })

  const all = useMemo(() => q.data?.periods ?? [], [q.data])
  const periods = useMemo(() => [...new Set(all.map((r) => fmtCell(cell(r, PERIOD))).filter(Boolean))], [all])
  const rows = useMemo(() => (period ? all.filter((r) => fmtCell(cell(r, PERIOD)) === period) : all), [all, period])
  const label = (k: string) => (k.includes('.') ? k : t(`hn.col.${k.toLowerCase()}`, { defaultValue: k }))

  const columns = useMemo<ColumnsType<HnRow>>(() => [
    ...visibleColumns(rows, [PERIOD], ['MaNV']).map((k) => ({
      title: label(k), dataIndex: k, key: k, ellipsis: true,
      ...(k.toLowerCase() === PERIOD.toLowerCase() ? { fixed: 'left' as const } : {}),
      render: (v: unknown) => fmtCell(v),
    })),
    { title: t('hn.timework.detail'), key: '__detail', fixed: 'right', width: 100, render: (_: unknown, r: HnRow) => <Button size="small" type="link" onClick={() => setDetail(r)}>{t('hn.timework.detail')}</Button> },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [rows, t])

  const detailItems = detail ? Object.keys(detail).filter((k) => !isEmptyCell(detail[k])).map((k) => ({ key: k, label: label(k), children: fmtCell(detail[k]) })) : []

  return (
    <div className="page wide">
      <PageBanner avatar={<FileDoneOutlined style={{ fontSize: 30 }} />} title={t('hn.nav.timework')} subtitle={t('hn.nav.timeworkDesc')} chips={q.data ? [t('hn.timework.count', { n: all.length })] : undefined} />
      {q.isLoading ? <Skeleton active paragraph={{ rows: 8 }} />
        : q.isError ? <Alert type="error" showIcon title={t(hnErrorKey(q.error))} action={<Button size="small" onClick={() => void q.refetch()}>{t('hn.common.retry')}</Button>} />
        : all.length === 0 ? <Result status="info" title={t('hn.timework.empty')} />
        : (
          <DataTable<HnRow>
            rowKey={(_, i) => String(i)}
            columnFilters={false}
            columns={columns}
            dataSource={rows}
            pagination={false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.timework.emptyPeriod')} /> }}
            toolbar={(
              <Select allowClear style={{ width: 200 }} placeholder={t('hn.timework.period')} value={period} onChange={setPeriod}
                options={periods.map((p) => ({ value: p, label: p }))} aria-label={t('hn.timework.period')} />
            )}
          />
        )}
      <Drawer open={!!detail} onClose={() => setDetail(null)} size={520} title={t('hn.timework.detailTitle', { period: detail ? fmtCell(cell(detail, PERIOD)) : '' })}>
        <Descriptions bordered size="small" column={1} items={detailItems} />
      </Drawer>
    </div>
  )
}
