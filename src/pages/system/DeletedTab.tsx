import { useState } from 'react'
import { Alert, Button, DatePicker, Modal, Popconfirm, Select, Space, Spin, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, RollbackOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { DELETED_MODULES, dataRecovery, type DeletedItem, type RestoreSummary } from '../../api/dataRecovery'
import { DataTable, FilterTable as Table } from '../../components/DataTable'
import { SearchBox } from '../../components/SearchBox'
import { useToast } from '../../hooks/useToast'
import { foldFilter } from '../../utils/search'

const PAGE_SIZE = 20
const short = (v: string | null) => (v == null ? '∅' : v.length > 120 ? v.slice(0, 120) + '…' : v)

/** Tab "Đã xóa" (thùng rác): mỗi dòng là một lần xóa còn khôi phục được; quá hạn giữ thì hệ thống tự dọn hẳn. */
export function DeletedTab({ retentionDays }: { retentionDays: number }) {
  const { t, i18n } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(Math.max(retentionDays, 1), 'day'), dayjs()])
  const [module, setModule] = useState<string>()
  const [text, setText] = useState('')
  const [page, setPage] = useState(1)
  const when = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })

  const list = useQuery({
    queryKey: ['data', 'deleted', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), module, text, page],
    queryFn: () => dataRecovery.deleted({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), module, text, page, pageSize: PAGE_SIZE }),
    retry: false,
  })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['data'] }) }

  const restore = useMutation({
    mutationFn: (v: { reqId: string; force: boolean }) => dataRecovery.restoreRequest(v.reqId, v.force),
    onSuccess: (r: RestoreSummary, v) => {
      if (!r.applied) {
        Modal.confirm({
          title: t('dr.conflictTitle'), content: t('dr.del.conflict', { n: r.conflict, f: r.failed }), okText: t('dr.force'), okButtonProps: { danger: true }, cancelText: t('dr.cancel'),
          onOk: r.failed > 0 ? undefined : () => restore.mutate({ reqId: v.reqId, force: true }),
        })
      } else message.success(t('dr.del.done', { n: r.restored }))
      refresh()
    },
    onError: (e: unknown) => {
      const title = (e as { response?: { data?: { title?: string } } }).response?.data?.title
      message.error(t(title === 'not_found' ? 'dr.already' : 'dr.failed'))
      refresh()
    },
  })

  const daysLeft = (purgeAt: string) => Math.max(0, dayjs(purgeAt).startOf('day').diff(dayjs().startOf('day'), 'day'))
  const columns: ColumnsType<DeletedItem> = [
    { title: t('dr.del.at'), dataIndex: 'at', width: 140, render: when },
    { title: t('dr.del.module'), dataIndex: 'module', width: 170, render: (v: string) => <Tag color="red">{t(`dr.mod.${v}`, { defaultValue: v })}</Tag> },
    { title: t('dr.del.content'), dataIndex: 'title', render: (v: string, r) => v || <span style={{ opacity: 0.6 }}>{r.tables.map((x) => x.table.replace('dbo.', '')).join(', ')}</span> },
    { title: t('dr.del.by'), dataIndex: 'actorId', width: 120 },
    {
      title: t('dr.del.left'), dataIndex: 'purgeAt', width: 120,
      render: (v: string) => { const n = daysLeft(v); return <Tag color={n <= 7 ? 'orange' : 'default'}>{t('dr.del.days', { n })}</Tag> },
    },
    {
      title: '', width: 130, render: (_: unknown, r) => (
        <Popconfirm title={t('dr.del.confirm', { title: r.title || r.module })} onConfirm={() => restore.mutate({ reqId: r.reqId, force: false })}>
          <Button size="small" type="primary" icon={<RollbackOutlined />} loading={restore.isPending && restore.variables?.reqId === r.reqId}>{t('dr.del.restore')}</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('dr.del.explain', { n: retentionDays })} />
      <DataTable<DeletedItem>
        rowKey="reqId" loading={list.isLoading} columns={columns} dataSource={list.data?.items ?? []}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, showSizeChanger: false, onChange: setPage }}
        locale={{ emptyText: list.isError ? t('usr.err.generic') : t('dr.del.empty') }}
        expandable={{ expandedRowRender: (r) => <Rows item={r} /> }}
        toolbar={(
          <Space wrap>
            <DatePicker.RangePicker allowClear={false} value={range} onChange={(v) => { if (v && v[0] && v[1]) { setRange([v[0], v[1]]); setPage(1) } }} />
            <Select allowClear showSearch filterOption={foldFilter()} style={{ width: 200 }} placeholder={t('dr.del.modulePh')} value={module}
              onChange={(v) => { setModule(v); setPage(1) }} options={DELETED_MODULES.map((m) => ({ value: m, label: t(`dr.mod.${m}`) }))} />
            <SearchBox allowClear style={{ width: 260 }} placeholder={t('dr.del.textPh')} onSearch={(v) => { setText(v); setPage(1) }} />
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={list.isFetching}>{t('org.recheck')}</Button>
          </Space>
        )}
      />
    </>
  )
}

/** Nội dung dòng chính bị xóa (các cột trong ảnh chụp) và các bảng đi kèm của lần xóa. */
function Rows({ item }: { item: DeletedItem }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['data', 'detail', item.primaryId], queryFn: () => dataRecovery.detail(item.primaryId), enabled: item.primaryId > 0, retry: false })
  return (
    <div className="aud-detail">
      <div style={{ marginBottom: 8 }}>
        {item.tables.map((x) => <Tag key={x.table}>{x.table.replace('dbo.', '')} × {x.count}</Tag>)}
        <span style={{ opacity: 0.7 }}>{item.action}</span>
      </div>
      {q.isLoading ? <Spin /> : !q.data ? <Alert type="error" showIcon title={t('dr.failed')} /> : (
        <Table size="small" pagination={false} rowKey="column" dataSource={q.data.diff}
          columns={[
            { title: t('dr.column'), dataIndex: 'column', width: 220 },
            { title: t('dr.del.value'), dataIndex: 'snapshot', render: (v: string | null) => <code>{short(v)}</code> },
          ]} />
      )}
    </div>
  )
}
