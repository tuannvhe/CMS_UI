import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, Empty, Input, Popconfirm, Segmented, Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { gate, type GateRow, type GateState } from '../../api/security'
import { apiErrorCode } from '../../api/requests'
import { personColumn, deptColumn } from '../../components/cells'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

type Filter = 'all' | GateState
const STATE_COLOR: Record<GateState, string> = { waiting_out: 'processing', out: 'warning', back: 'success' }
const hm = (v: string | null) => (v ? dayjs(v).format('HH:mm') : '')

/**
 * Bảo vệ xác nhận người ra / vào cổng: các đơn ra ngoài ĐÃ DUYỆT của hôm nay.
 * Xác nhận giờ ra thực tế khi người đó ra cổng, và giờ quay lại thực tế với đơn có đăng ký quay lại (cùng cột với màn bảo vệ của hệ thống cũ).
 */
export default function SecurityGatePage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [factory, setFactory] = useState<string>()
  const [text, setText] = useState('')

  const q = useQuery({
    queryKey: ['gate', 'go-out'], queryFn: () => gate.list(),
    refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 0, retry: false,
  })
  const all = q.data?.rows ?? []
  const factories = useMemo(() => Array.from(new Set(all.map((r) => r.factory).filter((f): f is string => !!f))).sort(), [all])
  const rows = useMemo(() => {
    const f = text.trim().toLowerCase()
    return all.filter((r) => (filter === 'all' || r.state === filter) && (!factory || r.factory === factory)
      && (!f || `${r.employeeId} ${r.fullName} ${r.department ?? ''}`.toLowerCase().includes(f)))
  }, [all, filter, factory, text])
  const count = (s: GateState) => all.filter((r) => r.state === s).length

  const errText = (e: unknown) => {
    const { code } = apiErrorCode(e)
    return ['already_done', 'not_left_yet', 'no_return_expected', 'not_found'].includes(code) ? t(`sec.err.${code}`) : t('sec.err.generic')
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['gate'] })
  const confirmOut = useMutation({
    mutationFn: (r: GateRow) => gate.confirmOut(r.id),
    onSuccess: () => { msg.success(t('sec.doneOut')); refresh() },
    onError: (e) => { msg.error(errText(e)); refresh() },
  })
  const confirmBack = useMutation({
    mutationFn: (r: GateRow) => gate.confirmBack(r.id),
    onSuccess: () => { msg.success(t('sec.doneBack')); refresh() },
    onError: (e) => { msg.error(errText(e)); refresh() },
  })

  const columns: ColumnsType<GateRow> = [
    personColumn<GateRow>(t('att.name'), 230),
    deptColumn<GateRow>(t('att.dept'), 180),
    { title: t('sec.factory'), dataIndex: 'factory', width: 100, render: (v: string | null) => v || <span className="cell-muted">—</span> },
    { title: t('sh.timeOut'), dataIndex: 'timeOut', width: 90, align: 'center', render: (v: string) => <b style={{ fontSize: 16 }}>{v}</b> },
    { title: t('sh.purpose'), dataIndex: 'purpose', width: 130, render: (v: GateRow['purpose']) => <Tag variant="filled" color={v === 'company' ? 'blue' : 'default'}>{t(v === 'company' ? 'sh.purposeCompany' : 'sh.purposePersonal')}</Tag> },
    { title: t('sec.plannedBack'), dataIndex: 'comeBackTime', width: 110, align: 'center', render: (v: string | null) => v ?? <span className="cell-muted">{t('sh.comeBackNo')}</span> },
    { title: t('req.reason'), dataIndex: 'reason', width: 220, ellipsis: { showTitle: true } },
    { title: t('sh.approver'), dataIndex: 'approverName', width: 170, ellipsis: true },
    {
      title: t('sec.state'), dataIndex: 'state', width: 150,
      render: (s: GateState, r) => (
        <div style={{ lineHeight: 1.3 }}>
          <Tag color={STATE_COLOR[s]} variant="filled" style={{ margin: 0 }}>{t(`sec.state_${s}`)}</Tag>
          {r.confirmedAt && <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('sec.confirmedOut')} {hm(r.confirmedAt)}{r.confirmedBy ? ` · ${r.confirmedBy}` : ''}</div>}
          {r.actualComeBackAt && <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('sec.actualBack')} {hm(r.actualComeBackAt)}</div>}
        </div>
      ),
    },
    {
      title: '', key: 'act', width: 190, fixed: 'right',
      render: (_: unknown, r) => {
        if (r.state === 'waiting_out')
          return (
            <Popconfirm title={t('sec.askOut', { name: r.fullName })} okText={t('sec.confirmOut')} cancelText={t('req.cancel')} onConfirm={() => confirmOut.mutate(r)}>
              <Button type="primary" loading={confirmOut.isPending && confirmOut.variables?.id === r.id}>{t('sec.confirmOut')}</Button>
            </Popconfirm>
          )
        if (r.state === 'out' && r.comeBackTime)
          return (
            <Popconfirm title={t('sec.askBack', { name: r.fullName })} okText={t('sec.confirmBack')} cancelText={t('req.cancel')} onConfirm={() => confirmBack.mutate(r)}>
              <Button loading={confirmBack.isPending && confirmBack.variables?.id === r.id}>{t('sec.confirmBack')}</Button>
            </Popconfirm>
          )
        return <span className="cell-muted">—</span>
      },
    },
  ]

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<SafetyCertificateOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.securityGate')} subtitle={t('nav.securityGateDesc')}
        chips={q.data ? [dayjs(q.data.date).format('DD/MM/YYYY')] : []}
      />
      <Alert type="info" showIcon title={t('sec.info')} style={{ marginBottom: 16 }} />
      <StatTiles items={[
        { label: t('sec.tileTotal'), value: all.length, color: 'var(--c-primary)' },
        { label: t('sec.state_waiting_out'), value: count('waiting_out'), color: '#2F6FB0' },
        { label: t('sec.state_out'), value: count('out'), color: '#D48806' },
        { label: t('sec.state_back'), value: count('back'), color: '#2E9E4F' },
      ]} />
      <div className="list-table">
        <DataTable<GateRow>
          rowKey="id" size="middle" sticky={false} scroll={{ x: 1500 }}
          loading={q.isFetching} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
          rowClassName={(r) => `row-st-${r.state === 'waiting_out' ? 'waiting' : r.state === 'out' ? 'rejected' : 'approved'}`}
          locale={{ emptyText: q.isError ? t('sec.err.generic') : <Empty description={t('sec.empty')} /> }}
          toolbar={
            <Space wrap>
              <Segmented<Filter> value={filter} onChange={setFilter}
                options={[
                  { value: 'all', label: `${t('att.typeAll')} (${all.length})` },
                  { value: 'waiting_out', label: `${t('sec.state_waiting_out')} (${count('waiting_out')})` },
                  { value: 'out', label: `${t('sec.state_out')} (${count('out')})` },
                  { value: 'back', label: `${t('sec.state_back')} (${count('back')})` },
                ]} />
              {factories.length > 1 && (
                <Select allowClear value={factory} onChange={setFactory} style={{ width: 160 }} placeholder={t('sec.allFactories')} options={factories.map((f) => ({ value: f, label: f }))} />
              )}
              <Input.Search allowClear style={{ width: 240 }} placeholder={t('sec.search')} value={text} onChange={(e) => setText(e.target.value)} />
              <Button icon={<ReloadOutlined />} loading={q.isFetching} onClick={refresh}>{t('apr.reload')}</Button>
            </Space>
          }
        />
      </div>
    </div>
  )
}
