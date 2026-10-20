import { useState } from 'react'
import { Alert, Button, Popconfirm, Select, Space, Switch, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckSquareOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { lines, type ApproverLineRow } from '../api/lines'
import { AppModal } from './AppModal'
import { MiniTable } from './DataTable'
import { useToast } from '../hooks/useToast'
import { lineErrorText } from '../pages/lines/ApprovalLinePage'

const levelColor = (lv: number) => (['', 'green', 'blue', 'purple', 'orange', 'red'][lv] ?? 'default')

/**
 * Line duyệt của một bộ phận hoặc một phòng ban, sửa ngay trong hộp thoại (không phải sang màn Line phê duyệt):
 * thêm người duyệt theo cấp, bật / tắt, xóa. Mỗi thay đổi có hiệu lực ngay ở các form đăng ký đơn.
 * `name` là tên bộ phận hoặc phòng ban; null = đóng.
 */
export function ApproverLineModal({ name, kind, onClose, onChanged }: { name: string | null; kind: 'department' | 'unit'; onClose: () => void; onChanged?: () => void }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [level, setLevel] = useState<string>()

  const lookups = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, enabled: !!name })
  const list = useQuery({ queryKey: ['lines', 'approvers', 'modal', name], queryFn: () => lines.approvers({ department: name! }), enabled: !!name })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lines', 'approvers'] }); qc.invalidateQueries({ queryKey: ['req', 'approvers'] }); onChanged?.() }

  const add = useMutation({
    mutationFn: () => lines.addApprover({ department: name!, userId: userId!, level: level! }),
    onSuccess: () => { message.success(t('line.added')); setUserId(undefined); setLevel(undefined); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const toggle = useMutation({ mutationFn: (id: number) => lines.toggleApprover(id), onSuccess: refresh, onError: (e) => message.error(lineErrorText(e, t)) })
  const remove = useMutation({
    mutationFn: (id: number) => lines.deleteApprover(id),
    onSuccess: () => { message.success(t('line.deleted')); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })

  const rows = list.data ?? []
  const columns: ColumnsType<ApproverLineRow> = [
    { title: t('line.person'), render: (_: unknown, r) => <span><b>{r.fullName}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span> },
    { title: 'Email', width: 210, ellipsis: true, render: (_: unknown, r) => (r.email ? <span>{r.email}</span> : <Tag color="warning" variant="filled">{t('line.noEmail')}</Tag>) },
    { title: t('line.level'), width: 150, render: (_: unknown, r) => <Tag color={levelColor(r.level)} variant="filled">{r.levelName || r.level}</Tag> },
    {
      title: t('line.active'), width: 90, align: 'center',
      render: (_: unknown, r) => (
        <Popconfirm title={r.active ? t('line.confirmDeactivate') : t('line.confirmActivate')} onConfirm={() => toggle.mutate(r.id)}>
          <Switch size="small" checked={r.active} loading={toggle.isPending && toggle.variables === r.id} />
        </Popconfirm>
      ),
    },
    {
      title: '', width: 80,
      render: (_: unknown, r) => (
        <Popconfirm title={t('line.confirmDelete')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.id)}>
          <Button size="small" danger>{t('req.delete')}</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <AppModal open={!!name} onClose={onClose} size="lg" icon={<CheckSquareOutlined />} title={t('org.approverLine')} subtitle={name ?? undefined} footer={null}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select showSearch optionFilterProp="label" style={{ width: 300 }} placeholder={t('line.person')} value={userId} onChange={setUserId} loading={lookups.isLoading}
          options={(lookups.data?.people ?? []).map((p) => ({ value: p.value, label: `${p.label} · ${p.value}` }))} />
        <Select style={{ width: 200 }} placeholder={t('line.level')} value={level} onChange={setLevel} options={(lookups.data?.levels ?? []).map((l) => ({ value: l.value, label: l.label }))} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!userId || !level} loading={add.isPending} onClick={() => add.mutate()}>{t('line.add')}</Button>
      </Space>
      {kind === 'unit' && rows.length === 0 && !list.isLoading && <Alert type="info" showIcon title={t('org.usesDepartmentLine')} style={{ marginBottom: 12 }} />}
      <MiniTable<ApproverLineRow> rowKey="id" loading={list.isLoading} columns={columns} dataSource={rows} locale={{ emptyText: list.isError ? t('req.err.generic') : t('line.empty') }} />
    </AppModal>
  )
}
