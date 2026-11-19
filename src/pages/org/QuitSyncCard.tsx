import { useState } from 'react'
import { Alert, Button, Card, Input, Popconfirm, Space, Tag } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import { SyncOutlined, UserDeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dataHealth, type QuitPerson } from '../../api/dataHealth'
import { useToast } from '../../hooks/useToast'
import { foldText } from '../../utils/search'
import { useDebouncedValue } from '../../hooks/useDebounce'

/**
 * Đồng bộ nghỉ việc: người hồ sơ ghi đã nghỉ mà cờ nhân viên còn bật, tài khoản còn mở hoặc còn trong line duyệt.
 * Xem trước danh sách, bấm "Đồng bộ ngay" để sửa cờ, khoá tài khoản, tắt line duyệt (có ảnh chụp để khôi phục, báo nhân sự).
 * Lượt tự động hằng ngày làm việc tương tự nếu số người không vượt ngưỡng.
 */
export function QuitSyncCard({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const dSearch = useDebouncedValue(search)   // gõ xong mới lọc, không lọc lại sau mỗi phím
  const q = useQuery({ queryKey: ['quit-sync'], queryFn: dataHealth.quitPreview, retry: false, staleTime: 0 })
  const run = useMutation({
    mutationFn: dataHealth.quitRun,
    onSuccess: (r) => {
      if (r.applied) msg.success(t('dh.quit.done', { n: r.people, locked: r.accountsLocked, lines: r.linesOff }))
      else msg.info(t('dh.quit.nothing'))
      qc.invalidateQueries({ queryKey: ['quit-sync'] }); onDone?.()
    },
    onError: () => msg.error(t('usr.err.generic')),
  })
  const items = q.data?.items ?? []
  const s = foldText(dSearch.trim())
  const shown = s ? items.filter((p) => foldText(`${p.name} ${p.employeeId} ${p.department ?? ''}`).includes(s)) : items
  const yes = (on: boolean, label: string) => (on ? <Tag color="error" variant="filled">{label}</Tag> : <span className="cell-muted">—</span>)

  return (
    <Card size="small" style={{ marginTop: 12 }} loading={q.isLoading}
      title={<Space><UserDeleteOutlined />{t('dh.quit.title')}{items.length > 0 && <Tag color="error" variant="filled">{items.length}</Tag>}</Space>}
      extra={(
        <Popconfirm title={t('dh.quit.ask', { n: items.length })} description={t('dh.quit.askDesc')} okText={t('dh.quit.run')} okButtonProps={{ danger: true }}
          cancelText={t('req.cancel')} disabled={items.length === 0} onConfirm={() => run.mutate()}>
          <Button type="primary" danger icon={<SyncOutlined />} disabled={items.length === 0} loading={run.isPending}>{t('dh.quit.run')}</Button>
        </Popconfirm>
      )}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title={q.data?.enabled ? t('dh.quit.auto', { at: q.data.runAt, max: q.data.maxAuto }) : t('dh.quit.autoOff')} />
      {items.length === 0 ? <span className="cell-muted">{t('dh.allGood')}</span> : (
        <>
          <Input.Search allowClear placeholder={t('dh.quit.search')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 280, marginBottom: 8 }} />
          <Table<QuitPerson> size="small" rowKey="employeeId" dataSource={shown} pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }} scroll={{ x: 'max-content' }}
            columns={[
              { title: t('dh.quit.person'), render: (_: unknown, p) => <span><b>{p.name}</b> <span className="cell-muted">· {p.employeeId}</span></span> },
              { title: t('dh.quit.dept'), dataIndex: 'department', render: (v: string | null) => v ?? '' },
              { title: t('dh.quit.status'), dataIndex: 'statusWorking', render: (v: string | null) => v || '—' },
              { title: t('dh.quit.flag'), align: 'center', render: (_: unknown, p) => yes(p.flagOn && p.statusWorking === 'Quit', t('dh.quit.fix')) },
              { title: t('dh.quit.account'), align: 'center', render: (_: unknown, p) => yes(p.accountOn, t('dh.quit.open')) },
              { title: t('dh.quit.lines'), align: 'center', render: (_: unknown, p) => (p.approverLines > 0 ? <Tag color="error" variant="filled">{p.approverLines}</Tag> : <span className="cell-muted">—</span>) },
            ]} />
        </>
      )}
    </Card>
  )
}
