import { useState } from 'react'
import { Button, Card, Empty, Popconfirm, Select, Space, Switch, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { adminError } from '../../api/userAdmin'
import { orgLines, orgModel, type OrgLine, type OrgNode } from '../../api/orgModel'
import { MiniTable } from '../../components/DataTable'
import { useToast } from '../../hooks/useToast'
import { trData } from '../../utils/dataText'

type Kind = 'APPROVAL' | 'EVALUATION'
const LEVELS = [1, 2, 3, 4, 5]

function PersonSelect({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useQuery({ queryKey: ['orgModel', 'pickPerson', search], queryFn: () => orgModel.employees({ search, status: 'active', page: 1, pageSize: 20 }), enabled: search.trim().length >= 1, staleTime: 30000 })
  const options = (q.data?.rows ?? []).map((e) => ({ value: e.employeeId, label: `${e.employeeId} — ${e.fullName}${e.position ? ` (${e.position})` : ''}${e.team ? ` · ${e.team}` : ''}` }))
  return <Select showSearch allowClear filterOption={false} style={{ width: 340 }} placeholder={t('om.pickPerson')} value={value} loading={q.isFetching} options={options} onSearch={setSearch} onChange={(v) => onChange(v)}
    notFoundContent={search.trim() ? undefined : t('om.typeToSearch')} />
}

export function LineCard({ kind, node, lines, nodeName }: { kind: Kind; node: OrgNode; lines: OrgLine[]; nodeName: (id: number) => string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [level, setLevel] = useState(1)
  const [emp, setEmp] = useState<string | undefined>()
  const refresh = () => { qc.invalidateQueries({ queryKey: ['orgModel', 'lines'] }); qc.invalidateQueries({ queryKey: ['orgModel', 'lineCounts'] }) }
  const errText = (e: unknown) => { const a = adminError(e); return t(`om.err.${a.detail || 'generic'}`, { defaultValue: t('om.err.generic') }) }
  const add = useMutation({ mutationFn: () => orgLines.add(node.nodeId, { kind, level, employeeId: emp! }), onSuccess: () => { msg.success(t('om.saved')); setEmp(undefined); refresh() }, onError: (e) => msg.error(errText(e)) })
  const toggle = useMutation({ mutationFn: (l: OrgLine) => orgLines.setActive(l.lineId, !l.isActive), onSuccess: refresh, onError: (e) => msg.error(errText(e)) })
  const del = useMutation({ mutationFn: (l: OrgLine) => orgLines.remove(l.lineId), onSuccess: () => { msg.success(t('om.saved')); refresh() }, onError: (e) => msg.error(errText(e)) })
  const rows = lines.filter((l) => l.kind === kind)
  const columns: ColumnsType<OrgLine> = [
    { title: t(kind === 'APPROVAL' ? 'om.level' : 'om.round'), dataIndex: 'level', width: 80, render: (v: number) => <b>{v}</b> },
    { title: t('om.person'), render: (_: unknown, l) => (
      <span>{l.employeeId} — {l.fullName ?? '?'}{l.position ? <span className="cell-muted"> ({trData(l.position)})</span> : null}{!l.personActive && <Tag style={{ marginLeft: 6 }} color="error" variant="filled">{t('om.left')}</Tag>}</span>
    ) },
    { title: t('om.appliesTo'), width: 190, render: (_: unknown, l) => (l.nodeId === node.nodeId ? <Tag color="blue" variant="filled">{t('om.thisNode')}</Tag> : <Tag variant="filled">{t('om.inherited', { name: nodeName(l.nodeId) })}</Tag>) },
    { title: t('om.on'), width: 80, render: (_: unknown, l) => (l.nodeId === node.nodeId ? <Switch size="small" checked={l.isActive} onChange={() => toggle.mutate(l)} /> : <Tag variant="filled">{l.isActive ? t('om.on') : t('om.off')}</Tag>) },
    { title: '', width: 70, render: (_: unknown, l) => l.nodeId === node.nodeId && (
      <Popconfirm title={t('om.delConfirm')} onConfirm={() => del.mutate(l)}><Button type="link" size="small" danger>{t('om.delete')}</Button></Popconfirm>
    ) },
  ]
  return (
    <Card size="small" style={{ marginBottom: 16 }} title={t(kind === 'APPROVAL' ? 'om.approvalLine' : 'om.evaluationLine')}>
      {rows.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('om.lineEmpty')} /> : <MiniTable<OrgLine> rowKey="lineId" columns={columns} dataSource={rows} />}
      <Space wrap style={{ marginTop: 12 }}>
        <Select style={{ width: 130 }} value={level} onChange={setLevel} options={LEVELS.map((n) => ({ value: n, label: t(kind === 'APPROVAL' ? 'om.levelN' : 'om.roundN', { n }) }))} />
        <PersonSelect value={emp} onChange={setEmp} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!emp || !node.isActive} loading={add.isPending} onClick={() => add.mutate()}>{t('om.addLine')}</Button>
      </Space>
    </Card>
  )
}

