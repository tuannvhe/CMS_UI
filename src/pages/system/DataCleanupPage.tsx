import { invalidateOrgData } from '../../api/cache'
import { useState } from 'react'
import { Alert, Button, Popconfirm, Select, Space, Tabs, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dataCleanup, type CleanupKind, type NonStandardValue } from '../../api/dataCleanup'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { AddDepartmentModal } from '../../components/OrgModals'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

function Table({ kind, rows, standard }: { kind: CleanupKind; rows: NonStandardValue[]; standard: string[] }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [target, setTarget] = useState<Record<string, string | undefined>>({})
  const [adding, setAdding] = useState<string | null>(null)
  const apply = useMutation({
    mutationFn: (v: { from: string; to: string }) => dataCleanup.apply(kind, v.from, v.to),
    onSuccess: (r) => { msg.success(t('cln.done', { n: r.employees })); invalidateOrgData(qc) },
    onError: (e) => msg.error(t(`cln.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })),
  })
  const options = standard.map((s) => ({ value: s, label: s }))
  const columns: ColumnsType<NonStandardValue> = [
    { title: t(kind === 'department' ? 'cln.colDept' : 'cln.colPart'), dataIndex: 'value', width: 340, render: (v: string) => (v ? <b>{v}</b> : <span className="cell-muted">{t('cln.blank')}</span>) },
    { title: t('cln.total'), dataIndex: 'total', width: 90, align: 'right' },
    { title: t('cln.active'), dataIndex: 'active', width: 100, align: 'right', render: (v: number) => (v > 0 ? <b>{v}</b> : <span className="cell-muted">0</span>) },
    {
      title: t('cln.mergeTo'), width: 460,
      render: (_: unknown, r) => (
        <Space wrap>
          <Select showSearch allowClear optionFilterProp="label" style={{ width: 280 }} placeholder={t('cln.pick')} value={target[r.value]} onChange={(v) => setTarget((m) => ({ ...m, [r.value]: v }))} options={options} />
          {r.suggestion && !target[r.value] && <Button size="small" onClick={() => setTarget((m) => ({ ...m, [r.value]: r.suggestion! }))}>{t('cln.useSuggestion', { name: r.suggestion })}</Button>}
        </Space>
      ),
    },
    {
      title: '', width: 260,
      render: (_: unknown, r) => r.value === '' ? <span className="cell-muted">{t('cln.blankHint')}</span> : (
        <Space size={6}>
        <Popconfirm title={t('cln.confirm', { n: r.total, from: r.value || t('cln.blank'), to: target[r.value] ?? '' })} okText={t('cln.apply')} cancelText={t('req.cancel')} disabled={!target[r.value]}
          onConfirm={() => apply.mutate({ from: r.value, to: target[r.value]! })}>
          <Button type="primary" size="small" disabled={!target[r.value]} loading={apply.isPending && apply.variables?.from === r.value}>{t('cln.apply')}</Button>
        </Popconfirm>
        {kind === 'department' && <Button size="small" onClick={() => setAdding(r.value)}>{t('cln.addAsStandard')}</Button>}
        </Space>
      ),
    },
  ]
  return (
    <>
      <DataTable<NonStandardValue> rowKey="value" size="small" sticky={false} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: t('cln.clean') }} />
      <AddDepartmentModal open={adding !== null} initial={adding ?? undefined} onClose={() => setAdding(null)}
        onAdded={() => { setAdding(null); invalidateOrgData(qc) }} />
    </>
  )
}

/**
 * Dọn phòng ban / bộ phận rác trong hồ sơ nhân viên (do nhập Excel ở hệ thống cũ tự tạo tên): gộp từng giá trị ngoài danh mục về một tên chuẩn.
 * Phòng ban chuẩn = danh mục phòng ban; bộ phận chuẩn = đơn vị đã có line đánh giá.
 */
export function CleanupPanel() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['cleanup'], queryFn: dataCleanup.scan })
  const d = q.data
  return (
    <div>
      <StatTiles items={[
        { label: t('cln.tileDeps'), value: d?.departments.length ?? 0, color: d?.departments.length ? '#D48806' : '#2E9E4F' },
        { label: t('cln.tileDepsEmp'), value: d?.departments.reduce((s, x) => s + x.active, 0) ?? 0, color: '#D92D20' },
        { label: t('cln.tileParts'), value: d?.parts.length ?? 0, color: d?.parts.length ? '#D48806' : '#2E9E4F' },
        { label: t('cln.tilePartsEmp'), value: d?.parts.reduce((s, x) => s + x.active, 0) ?? 0, color: '#D92D20' },
      ]} />
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('cln.note')} />
      {q.isError ? <Alert type="error" showIcon title={t('usr.err.generic')} /> : (
        <Tabs items={[
          { key: 'dep', label: `${t('cln.tabDept')} (${d?.departments.length ?? 0})`, children: <Table kind="department" rows={d?.departments ?? []} standard={d?.standardDepartments ?? []} /> },
          {
            key: 'part', label: `${t('cln.tabPart')} (${d?.parts.length ?? 0})`,
            children: (
              <>
                <Typography.Paragraph type="secondary">{t('cln.partNote')}</Typography.Paragraph>
                <Table kind="part" rows={d?.parts ?? []} standard={d?.standardParts ?? []} />
              </>
            ),
          },
        ]} />
      )}
    </div>
  )
}

