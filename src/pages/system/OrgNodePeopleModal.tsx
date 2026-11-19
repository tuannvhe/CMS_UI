import { useState } from 'react'
import { Modal, Segmented, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { orgModel, type OrgEmployee, type OrgNode } from '../../api/orgModel'
import { DataTable } from '../../components/DataTable'
import { SearchBox } from '../../components/SearchBox'
import { EmployeePhoto } from '../../components/EmployeePhoto'

const PAGE_SIZE = 20

/** Bảng người thuộc một Dept / Team / Part (dùng trong tab và trong modal). */
export function OrgNodePeopleTable({ node, active = true }: { node: OrgNode | null; active?: boolean }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useQuery({
    queryKey: ['orgModel', 'nodePeople', node?.nodeId, status, search, page],
    queryFn: () => orgModel.employees({
      search, status, page, pageSize: PAGE_SIZE,
      deptId: node?.kind === 'DEPT' ? node.nodeId : undefined, teamId: node?.kind === 'TEAM' ? node.nodeId : undefined, partId: node?.kind === 'PART' ? node.nodeId : undefined,
    }),
    enabled: !!node && active, placeholderData: (p) => p,
  })
  const columns: ColumnsType<OrgEmployee> = [
    { title: t('idc.col.photo'), dataIndex: 'photoUrl', width: 100, render: (v: string | null | undefined, r) => <EmployeePhoto employeeId={r.employeeId} src={v} name={r.fullName} /> },
    { title: t('om.code'), dataIndex: 'employeeId', width: 100, render: (v: string) => <b>{v}</b> },
    { title: t('om.fullName'), dataIndex: 'fullName', width: 180 },
    { title: t('idc.col.phone'), dataIndex: 'phone', width: 130, render: (v: string | null | undefined) => (v ? <a href={`tel:${v}`} style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{v}</a> : <span className="cell-muted">—</span>) },
    { title: t('idc.col.phone'), dataIndex: 'phone', width: 130, render: (v: string | null | undefined) => (v ? <a href={`tel:${v}`} style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{v}</a> : <span className="cell-muted">—</span>) },
    { title: t('om.team'), dataIndex: 'team', width: 160, render: (v: string | null) => v ?? <span className="cell-muted">—</span> },
    { title: t('om.part'), dataIndex: 'part', width: 130, render: (v: string | null) => v ?? <span className="cell-muted">—</span> },
    { title: t('om.position'), dataIndex: 'position', width: 110, render: (v: string, r) => <span>{v || '—'}{r.isOp && v.toUpperCase() !== 'OP' && <Tag style={{ marginLeft: 6 }} color="blue" variant="filled">OP</Tag>}</span> },
    { title: t('om.status'), dataIndex: 'isActive', width: 100, render: (v: boolean) => <Tag color={v ? 'success' : 'default'} variant="filled">{t(v ? 'om.working' : 'om.left')}</Tag> },
  ]
  return (
    <DataTable<OrgEmployee> rowKey="employeeId" size="small" sticky={false} loading={q.isLoading || q.isFetching} columns={columns} dataSource={q.data?.rows ?? []}
      toolbar={(
        <Space wrap>
          <SearchBox allowClear style={{ width: 240 }} placeholder={t('om.search')} onSearch={(v) => { setSearch(v); setPage(1) }} />
          <Segmented value={status} onChange={(v) => { setStatus(String(v)); setPage(1) }} options={[{ value: 'active', label: t('om.working') }, { value: 'left', label: t('om.left') }, { value: 'all', label: t('om.all') }]} />
        </Space>
      )}
      pagination={{ current: page, pageSize: PAGE_SIZE, total: q.data?.total ?? 0, showSizeChanger: false, onChange: setPage }} />
  )
}

/** Danh sách người đang thuộc một Dept / Team / Part (bảng tổ chức mới), dạng modal. */
export function OrgNodePeopleModal({ node, path, onClose }: { node: OrgNode | null; path: string; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal open={!!node} width={880} footer={null} onCancel={onClose} destroyOnHidden title={node ? <span>{t('om.peopleTitle', { name: node.name })}<div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{path}</div></span> : ''}>
      <OrgNodePeopleTable node={node} />
    </Modal>
  )
}
