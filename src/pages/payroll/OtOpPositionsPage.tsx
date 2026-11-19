import { useState } from 'react'
import { Alert, Avatar, Button, Input, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { otOpPositions, type OtOpEmployee, type OtOpPosition } from '../../api/otOpPositions'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

/** Vị trí tính tăng ca như OP: HR bật / tắt từng chức vụ (Tbl_Employees.POSITTION). Thủ tục chấm công tự cộng giờ tăng ca máy ngày thường cho các chức vụ đang bật. */
export default function OtOpPositionsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [extra, setExtra] = useState('')
  const [empId, setEmpId] = useState('')

  const q = useQuery({ queryKey: ['ot-op-positions'], queryFn: otOpPositions.list, retry: false })
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`oop.err.${code}`, { detail, defaultValue: t('oop.err.generic') }) }
  const save = useMutation({
    mutationFn: (v: { position: string; active: boolean }) => otOpPositions.save(v),
    onSuccess: (data, v) => { qc.setQueryData(['ot-op-positions'], data); msg.success(t(v.active ? 'oop.onMsg' : 'oop.offMsg', { pos: v.position })); setExtra('') },
    onError: (e) => msg.error(errText(e)),
  })
  const saveEmp = useMutation({
    mutationFn: (v: { employeeId: string; active: boolean }) => otOpPositions.saveEmployee(v),
    onSuccess: (data, v) => { qc.setQueryData(['ot-op-positions'], data); msg.success(t(v.active ? 'oop.empOnMsg' : 'oop.empOffMsg', { id: v.employeeId })); setEmpId('') },
    onError: (e) => msg.error(errText(e)),
  })
  const ready = !!q.data?.ready
  const empReady = !!q.data?.employeesReady
  const fmtAt = (v: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '')
  const isOp = (p: string) => p.trim().toUpperCase() === 'OP'

  const columns: ColumnsType<OtOpPosition> = [
    { title: t('oop.position'), dataIndex: 'position', render: (v: string) => <b>{v}</b> },
    { title: t('oop.employees'), dataIndex: 'employees', width: 130, align: 'right' },
    {
      title: t('oop.asOp'), key: 'active', width: 220,
      render: (_: unknown, r) => (
        <Tooltip title={r.updatedBy ? t('oop.changedBy', { by: r.updatedBy, at: r.updatedAt ? dayjs(r.updatedAt).format('HH:mm DD/MM/YYYY') : '' }) : undefined}>
          <Space size={8}>
            <Switch checked={r.active} disabled={!ready || isOp(r.position)} loading={save.isPending && save.variables?.position === r.position}
              onChange={(v) => save.mutate({ position: r.position, active: v })} />
            {r.active ? <Tag color="green">{t('oop.on')}</Tag> : <span style={{ color: '#667085' }}>{t('oop.off')}</span>}
          </Space>
        </Tooltip>
      ),
    },
    { title: t('oop.note'), dataIndex: 'note', render: (v: string | null) => v ?? '' },
  ]

  const empColumns: ColumnsType<OtOpEmployee> = [
    { title: t('oop.empId'), dataIndex: 'employeeId', width: 120, render: (v: string) => <b>{v}</b> },
    { title: t('oop.empName'), dataIndex: 'fullName', render: (v: string | null) => v ?? '' },
    { title: t('oop.position'), dataIndex: 'position', width: 160, render: (v: string | null) => v ?? '' },
    { title: t('oop.dept'), dataIndex: 'department', render: (v: string | null) => v ?? '' },
    {
      title: t('oop.asOp'), key: 'active', width: 200,
      render: (_: unknown, r) => (
        <Tooltip title={r.updatedBy ? t('oop.changedBy', { by: r.updatedBy, at: fmtAt(r.updatedAt) }) : undefined}>
          <Space size={8}>
            <Switch checked={r.active} disabled={!empReady} loading={saveEmp.isPending && saveEmp.variables?.employeeId === r.employeeId}
              onChange={(v) => saveEmp.mutate({ employeeId: r.employeeId, active: v })} />
            {r.active ? <Tag color="green">{t('oop.on')}</Tag> : <span style={{ color: '#667085' }}>{t('oop.off')}</span>}
          </Space>
        </Tooltip>
      ),
    },
    { title: t('oop.note'), dataIndex: 'note', render: (v: string | null) => v ?? '' },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<ThunderboltOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.otOpPositions')} subtitle={t('nav.otOpPositionsDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('oop.intro')} />
      {q.data && !ready && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('oop.err.table_missing')} />}
      <DataTable<OtOpPosition>
        rowKey="position" loading={q.isLoading} columns={columns} dataSource={q.data?.items ?? []} pagination={false}
        locale={{ emptyText: q.isError ? errText(q.error) : undefined }}
        toolbar={
          <Space.Compact>
            <Input placeholder={t('oop.addPlaceholder')} value={extra} maxLength={100} onChange={(e) => setExtra(e.target.value)} disabled={!ready} style={{ width: 260 }}
              onPressEnter={() => extra.trim() && save.mutate({ position: extra.trim(), active: true })} />
            <Button icon={<PlusOutlined />} disabled={!ready || !extra.trim()} loading={save.isPending && save.variables?.position === extra.trim()}
              onClick={() => save.mutate({ position: extra.trim(), active: true })}>{t('oop.add')}</Button>
          </Space.Compact>
        }
      />
      <Typography.Title level={5} style={{ marginTop: 24 }}>{t('oop.empTitle')}</Typography.Title>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('oop.empIntro')} />
      {q.data && !empReady && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('oop.err.table_missing')} />}
      <DataTable<OtOpEmployee>
        rowKey="employeeId" loading={q.isLoading} columns={empColumns} dataSource={q.data?.employees ?? []} pagination={false}
        toolbar={
          <Space.Compact>
            <Input placeholder={t('oop.empPlaceholder')} value={empId} maxLength={30} onChange={(e) => setEmpId(e.target.value)} disabled={!empReady} style={{ width: 220 }}
              onPressEnter={() => empId.trim() && saveEmp.mutate({ employeeId: empId.trim(), active: true })} />
            <Button icon={<PlusOutlined />} disabled={!empReady || !empId.trim()} loading={saveEmp.isPending && saveEmp.variables?.employeeId === empId.trim()}
              onClick={() => saveEmp.mutate({ employeeId: empId.trim(), active: true })}>{t('oop.empAdd')}</Button>
          </Space.Compact>
        }
      />
    </div>
  )
}
