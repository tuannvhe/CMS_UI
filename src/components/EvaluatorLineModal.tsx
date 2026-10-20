import { useState } from 'react'
import { Alert, Button, Popconfirm, Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { lines, POSITION_CODES, type EvaluatorLineRow, type PositionCode } from '../api/lines'
import { AppModal } from './AppModal'
import { MiniTable } from './DataTable'
import { useToast } from '../hooks/useToast'
import { lineErrorText } from '../pages/lines/ApprovalLinePage'

const ROUND_COLOR = ['', 'green', 'blue', 'purple', 'orange', 'red']

/**
 * Line đánh giá của một phòng ban, sửa ngay trong hộp thoại (không phải sang màn Line đánh giá): thêm người đánh giá theo vòng,
 * đổi người, xóa. `name` là tên phòng ban; null = đóng.
 */
export function EvaluatorLineModal({ name, onClose, onChanged }: { name: string | null; onClose: () => void; onChanged?: () => void }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [position, setPosition] = useState<PositionCode>()
  const [editId, setEditId] = useState<number | null>(null)
  const [editUser, setEditUser] = useState<string>()

  const lookups = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, enabled: !!name })
  const list = useQuery({ queryKey: ['lines', 'evaluators', 'modal', name], queryFn: () => lines.evaluators({ department: name! }), enabled: !!name })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lines'] }); qc.invalidateQueries({ queryKey: ['org'] }); onChanged?.() }
  const people = (lookups.data?.people ?? []).map((p) => ({ value: p.value, label: `${p.label} · ${p.value}` }))

  const add = useMutation({
    mutationFn: () => lines.addEvaluator({ department: name!, userId: userId!, position: position! }),
    onSuccess: () => { message.success(t('line.added')); setUserId(undefined); setPosition(undefined); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const update = useMutation({
    mutationFn: () => lines.updateEvaluator(editId!, editUser!),
    onSuccess: () => { message.success(t('line.updated')); setEditId(null); setEditUser(undefined); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => lines.deleteEvaluator(id),
    onSuccess: () => { message.success(t('line.deleted')); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })

  const rows = [...(list.data ?? [])].sort((a, b) => a.round - b.round)
  const columns: ColumnsType<EvaluatorLineRow> = [
    { title: t('line.round'), width: 210, render: (_: unknown, r) => <Tag color={ROUND_COLOR[r.round] ?? 'default'} variant="filled">{t('line.roundN', { n: r.round })} · {t(`line.roundName.${r.round}`, { defaultValue: '' })}</Tag> },
    {
      title: t('line.person'),
      render: (_: unknown, r) => editId === r.id ? (
        <Space.Compact style={{ width: '100%' }}>
          <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={editUser} onChange={setEditUser} options={people} autoFocus />
          <Button type="primary" disabled={!editUser} loading={update.isPending} onClick={() => update.mutate()}>{t('req.saveChanges')}</Button>
          <Button onClick={() => { setEditId(null); setEditUser(undefined) }}>{t('req.cancel')}</Button>
        </Space.Compact>
      ) : <span><b>{r.fullName ?? '—'}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span>,
    },
    {
      title: '', width: 160,
      render: (_: unknown, r) => (
        <Space>
          <Button size="small" onClick={() => { setEditId(r.id); setEditUser(r.userId) }}>{t('req.edit')}</Button>
          <Popconfirm title={t('line.confirmDelete')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.id)}>
            <Button size="small" danger>{t('req.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <AppModal open={!!name} onClose={onClose} size="lg" icon={<TeamOutlined />} title={t('org.evaluatorLine')} subtitle={name ?? undefined} footer={null}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select style={{ width: 230 }} placeholder={t('line.round')} value={position} onChange={setPosition}
          options={POSITION_CODES.map((c, i) => ({ value: c, label: `${t('line.roundN', { n: i + 1 })} · ${t(`line.roundName.${i + 1}`)}` }))} />
        <Select showSearch optionFilterProp="label" style={{ width: 300 }} placeholder={t('line.person')} value={userId} onChange={setUserId} loading={lookups.isLoading} options={people} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!userId || !position} loading={add.isPending} onClick={() => add.mutate()}>{t('line.add')}</Button>
      </Space>
      {!list.isLoading && rows.length === 0 && <Alert type="info" showIcon title={t('org.noEvaluatorLine')} style={{ marginBottom: 12 }} />}
      <MiniTable<EvaluatorLineRow> rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} locale={{ emptyText: list.isError ? t('req.err.generic') : t('line.empty') }} />
    </AppModal>
  )
}
