import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Input, Modal, Popconfirm, Select, Space, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DatabaseOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { dataRecovery, DATA_SNAPSHOT_TABLE_SQL, type RestoreSummary, type SnapshotSummary } from '../../api/dataRecovery'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

const OP_COLOR: Record<string, string> = { UPDATE: 'blue', DELETE: 'red', INSERT: 'green' }
const short = (v: string | null) => (v == null ? '∅' : v.length > 120 ? v.slice(0, 120) + '…' : v)

/** Quản lý và khôi phục dữ liệu toàn hệ thống mới: lịch sử thay đổi từng dòng dữ liệu (ảnh chụp trước khi sửa / xóa), so sánh với hiện tại và khôi phục. Chỉ quản trị hệ thống. */
export default function DataRecoveryPage() {
  const { t, i18n } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()])
  const [table, setTable] = useState<string>()
  const [actor, setActor] = useState('')
  const [text, setText] = useState('')
  const when = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'medium' })

  const status = useQuery({ queryKey: ['data', 'status'], queryFn: dataRecovery.status, retry: false })
  const list = useQuery({
    queryKey: ['data', 'snapshots', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), table, actor, text],
    queryFn: () => dataRecovery.search({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), table, actor, text, take: 500 }),
    enabled: status.data?.ready === true, retry: false,
  })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['data'] }) }

  const report = (r: RestoreSummary, retry: () => void) => {
    if (!r.applied) {
      Modal.confirm({
        title: t('dr.conflictTitle'), content: t('dr.conflictText', { n: r.conflict, f: r.failed }), okText: t('dr.force'), okButtonProps: { danger: true }, cancelText: t('dr.cancel'),
        onOk: r.failed > 0 ? undefined : retry,
        okCancel: true,
      })
    } else message.success(t('dr.done', { n: r.restored, s: r.same }))
    refresh()
  }
  const failure = (e: unknown) => {
    const title = (e as { response?: { data?: { title?: string } } }).response?.data?.title
    message.error(t(title === 'already_restored' ? 'dr.already' : 'dr.failed'))
    refresh()
  }
  const restore = useMutation({
    mutationFn: (v: { id: number; force: boolean }) => dataRecovery.restore(v.id, v.force),
    onSuccess: (r, v) => report(r, () => restore.mutate({ id: v.id, force: true })), onError: failure,
  })
  const restoreRequest = useMutation({
    mutationFn: (v: { reqId: string; force: boolean }) => dataRecovery.restoreRequest(v.reqId, v.force),
    onSuccess: (r, v) => report(r, () => restoreRequest.mutate({ reqId: v.reqId, force: true })), onError: failure,
  })

  const rows = list.data ?? []
  const perRequest = (reqId: string) => rows.filter((r) => r.reqId === reqId && !r.restoredAt).length

  const columns: ColumnsType<SnapshotSummary> = [
    { title: t('aud.at'), dataIndex: 'at', width: 170, render: when },
    { title: t('aud.actor'), dataIndex: 'actorId', width: 120 },
    { title: t('dr.table'), dataIndex: 'table', width: 230, render: (v: string, r) => <span><Tag color={OP_COLOR[r.op]}>{t(`dr.op.${r.op}`)}</Tag>{v.replace('dbo.', '')}</span> },
    { title: t('dr.key'), dataIndex: 'key', width: 150, ellipsis: true },
    { title: t('aud.action'), dataIndex: 'action', ellipsis: true },
    { title: t('aud.status'), width: 130, render: (_: unknown, r) => r.restoredAt ? <Tag>{t('dr.restored')}</Tag> : null },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<DatabaseOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.dataRecovery')} subtitle={t('nav.dataRecoveryDesc')} />
      {status.data && !status.data.ready ? <SqlNotReady title={t('dr.notReady')} sql={DATA_SNAPSHOT_TABLE_SQL} onRetry={() => status.refetch()} loading={status.isFetching} /> : (
        <>
          {status.data && !status.data.enabled && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('dr.disabled')} />}
          <StatTiles items={[
            { label: t('dr.tileTotal'), value: status.data?.total ?? 0, color: '#2F6FB0' },
            { label: t('dr.tileTables'), value: status.data?.tables.length ?? 0, color: '#2E9E4F' },
            { label: t('dr.tileRetention'), value: status.data?.retentionDays ?? 0, unit: t('dr.days'), color: '#D48806' },
            { label: t('dr.tileOldest'), value: status.data?.oldest ? dayjs(status.data.oldest).format('DD/MM/YYYY') : '—' },
          ]} />
          <Alert type="info" showIcon style={{ margin: '12px 0' }} title={t('dr.explain')} />
          <DataTable<SnapshotSummary>
            rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 25, showSizeChanger: false }}
            locale={{ emptyText: list.isError ? t('usr.err.generic') : t('dr.empty') }}
            expandable={{ expandedRowRender: (r) => <Detail row={r} requestRows={perRequest(r.reqId)} busy={restore.isPending || restoreRequest.isPending}
              onRestore={() => restore.mutate({ id: r.id, force: false })} onRestoreRequest={() => restoreRequest.mutate({ reqId: r.reqId, force: false })} /> }}
            toolbar={(
              <Space wrap>
                <DatePicker.RangePicker allowClear={false} value={range} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} />
                <Select allowClear showSearch style={{ width: 240 }} placeholder={t('dr.tablePh')} value={table} onChange={setTable}
                  options={(status.data?.tables ?? []).map((x) => ({ value: x.table, label: `${x.table.replace('dbo.', '')} (${x.count})` }))} />
                <Input allowClear style={{ width: 160 }} placeholder={t('aud.actorPh')} value={actor} onChange={(e) => setActor(e.target.value)} />
                <Input.Search allowClear style={{ width: 240 }} placeholder={t('dr.textPh')} onSearch={setText} />
                <Button icon={<ReloadOutlined />} onClick={refresh} loading={list.isFetching}>{t('org.recheck')}</Button>
              </Space>
            )}
          />
        </>
      )}
    </div>
  )
}

function Detail({ row, requestRows, busy, onRestore, onRestoreRequest }: { row: SnapshotSummary; requestRows: number; busy: boolean; onRestore: () => void; onRestoreRequest: () => void }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['data', 'detail', row.id], queryFn: () => dataRecovery.detail(row.id), retry: false })
  if (q.isLoading) return <Spin />
  if (!q.data) return <Alert type="error" showIcon title={t('dr.failed')} />
  const d = q.data
  const gone = d.current == null
  return (
    <div className="aud-detail">
      {d.newerExists && <Alert type="warning" showIcon style={{ marginBottom: 8 }} title={t('dr.newer')} />}
      {gone && row.op !== 'INSERT' && <Alert type="info" showIcon style={{ marginBottom: 8 }} title={t('dr.rowGone')} />}
      {d.diff.length === 0 ? <div style={{ opacity: 0.7 }}>{t('dr.noDiff')}</div> : (
        <Table size="small" pagination={false} rowKey="column" dataSource={d.diff}
          columns={[
            { title: t('dr.column'), dataIndex: 'column', width: 220 },
            { title: t('dr.current'), dataIndex: 'current', render: (v: string | null) => <code>{short(v)}</code> },
            { title: t('dr.snapshot'), dataIndex: 'snapshot', render: (v: string | null) => <code>{short(v)}</code> },
          ]} />
      )}
      {!row.restoredAt && (
        <Space style={{ marginTop: 10 }} wrap>
          <Popconfirm title={t('dr.confirmRow')} onConfirm={onRestore}><Button icon={<RollbackOutlined />} type="primary" loading={busy}>{t('dr.restoreRow')}</Button></Popconfirm>
          {requestRows > 1 && <Popconfirm title={t('dr.confirmRequest', { n: requestRows })} onConfirm={onRestoreRequest}><Button icon={<RollbackOutlined />} danger loading={busy}>{t('dr.restoreRequest', { n: requestRows })}</Button></Popconfirm>}
        </Space>
      )}
    </div>
  )
}
