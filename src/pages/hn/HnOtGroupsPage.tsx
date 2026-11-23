import { useMemo, useState } from 'react'
import { Alert, Button, Drawer, Empty, Segmented, Skeleton, Tag } from 'antd'
import { CheckSquareOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorKey, type HnOtGroup } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { DataTable } from '../../components/DataTable'
import { HnRequestTable } from '../../components/HnRequestTable'
import { PageBanner } from '../../components/PageBanner'
import { fmtCell } from '../../utils/hnFormat'

/** Duyệt tăng ca (chỉ đọc): danh sách nhóm đơn (chờ tôi duyệt / tất cả); "Xem nhóm" mở ngăn bên với các đơn trong nhóm (cùng bảng đơn dùng chung). */
export default function HnOtGroupsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [state, setState] = useState<'pending' | 'all'>('pending')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [open, setOpen] = useState<HnOtGroup | null>(null)
  const q = useQuery({ queryKey: ['hn', 'otGroups', user?.userId, state, page, pageSize], queryFn: () => hnApi.otGroups({ state, page, pageSize }), staleTime: 30_000, retry: false, placeholderData: keepPreviousData })
  const g = useQuery({ queryKey: ['hn', 'otGroup', user?.userId, open?.groupId], queryFn: () => hnApi.otGroup(open!.groupId), enabled: !!open, staleTime: 30_000, retry: false })

  const columns = useMemo<ColumnsType<HnOtGroup>>(() => [
    { title: t('hn.requests.col.date'), dataIndex: 'date', key: 'date', width: 140, render: (v: string) => fmtCell(v) },
    { title: t('hn.requests.col.department'), dataIndex: 'department', key: 'department', ellipsis: true },
    { title: t('hn.requests.col.reason'), dataIndex: 'reason', key: 'reason', ellipsis: true, render: (v: string | null) => fmtCell(v) },
    { title: t('hn.requests.col.count'), dataIndex: 'count', key: 'count', width: 100, align: 'right' },
    { title: t('hn.requests.col.status'), key: 'mine', width: 120, render: (_, r) => (r.pendingForMe ? <Tag color="gold" variant="solid">{t('hn.requests.mine')}</Tag> : null) },
    { title: t('hn.requests.col.action'), key: 'act', width: 120, fixed: 'right', render: (_, r) => <Button size="small" type="link" onClick={() => setOpen(r)}>{t('hn.requests.groupOpen')}</Button> },
  ], [t])

  return (
    <div className="page wide">
      <PageBanner avatar={<CheckSquareOutlined style={{ fontSize: 30 }} />} title={t('hn.nav.otApprove')} subtitle={t('hn.nav.otApproveDesc')} chips={q.data ? [t('hn.requests.groupCount', { n: q.data.total })] : undefined} />
      {q.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={t(hnErrorKey(q.error))} action={<Button size="small" onClick={() => void q.refetch()}>{t('hn.common.retry')}</Button>} />}
      {q.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <DataTable<HnOtGroup>
          rowKey="groupId"
          columnFilters={false}
          columns={columns}
          dataSource={q.data?.items ?? []}
          loading={q.isFetching}
          pagination={{ current: page, pageSize, total: q.data?.total ?? 0, onChange: (p, s) => { setPage(s !== pageSize ? 1 : p); setPageSize(s) } }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.requests.emptyApprovals')} /> }}
          toolbar={(
            <Segmented aria-label={t('hn.requests.state')} value={state} onChange={(v) => { setState(v as 'pending' | 'all'); setPage(1) }}
              options={[{ value: 'pending', label: t('hn.requests.statePending') }, { value: 'all', label: t('hn.requests.stateAll') }]} />
          )}
        />
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} size={960} title={t('hn.requests.groupTitle', { date: open ? fmtCell(open.date) : '' })}>
        {g.isLoading ? <Skeleton active paragraph={{ rows: 6 }} />
          : g.isError ? <Alert type="error" showIcon title={t(hnErrorKey(g.error))} action={<Button size="small" onClick={() => void g.refetch()}>{t('hn.common.retry')}</Button>} />
          : (
            <HnRequestTable items={g.data?.items ?? []} total={g.data?.items.length ?? 0} page={1} pageSize={g.data?.items.length || 20} onPage={() => undefined} emptyText={t('hn.requests.groupEmpty')} />
          )}
      </Drawer>
    </div>
  )
}
