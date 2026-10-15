import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Input, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AuditOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { evaluations, type EvaluationItem } from '../../api/evaluations'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import dayjs from 'dayjs'
import { EvaluationDetailDrawer } from './EvaluationDetailDrawer'
import { fmtDate } from '../../utils/format'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import EvaluationDoneTab from './EvaluationDoneTab'

const day = (s: string | null) => (s ? fmtDate(dayjs(s)) : '')

/** Đánh giá hợp đồng – danh sách nhân viên đang chờ bạn đánh giá (thử việc, ký lại hợp đồng, vô thời hạn). */
export default function EvaluationPage() {
  const { t } = useTranslation()
  const tabs = [{ key: 'pending', label: t('eva.tabPending') }, { key: 'done', label: t('eva.tabDone') }]
  const [tab, setTab] = usePageTab(tabs)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<EvaluationItem | null>(null)
  const q = useQuery({ queryKey: ['evaluations', 'mine'], queryFn: evaluations.mine })
  // Mở từ thông báo: ?employeeId=...&date=yyyy-MM-dd → tự mở form chấm điểm của nhân viên đó.
  const [params, setParams] = useSearchParams()
  const wantEmp = params.get('employeeId')
  const wantDate = params.get('date')
  useEffect(() => {
    if (!wantEmp || !q.data) return
    const hit = q.data.find((r) => r.employeeId === wantEmp && (!wantDate || (r.dateRate ?? '').startsWith(wantDate)))
    if (hit) setSelected(hit)
    setParams((p) => { const n = new URLSearchParams(p); n.delete('employeeId'); n.delete('date'); return n }, { replace: true })
  }, [wantEmp, wantDate, q.data, setParams])

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (q.data ?? []).filter((r) => !f || `${r.employeeId} ${r.fullName} ${r.department}`.toLowerCase().includes(f))
  }, [q.data, filter])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const overdue = (q.data ?? []).filter((r) => r.dateRate && new Date(r.dateRate) < today).length
  const types = new Set((q.data ?? []).map((r) => r.typeRate)).size

  const columns: ColumnsType<EvaluationItem> = [
    { title: t('eva.employeeId'), dataIndex: 'employeeId', width: 120 },
    { title: t('eva.fullName'), dataIndex: 'fullName', width: 220 },
    { title: t('eva.position'), dataIndex: 'position', width: 110 },
    { title: t('eva.department'), dataIndex: 'department', width: 200 },
    { title: t('eva.startWork'), dataIndex: 'startWork', width: 120, render: day },
    { title: t('eva.typeRate'), dataIndex: 'typeRate', width: 260, render: (v: string) => <Tag color="green" variant="filled">{v}</Tag> },
    {
      title: t('eva.dateRate'), dataIndex: 'dateRate', width: 130,
      render: (v: string | null) => (v && new Date(v) < today ? <Tag color="red" variant="filled">{day(v)}</Tag> : day(v)),
    },
    { title: t('eva.round'), dataIndex: 'round', width: 90, align: 'center' },
    { title: '', width: 110, render: (_: unknown, r: EvaluationItem) => <Button size="small" onClick={() => setSelected(r)}>{t('eva.view')}</Button> },
  ]

  return (
    <>
      <PageTabs items={tabs} active={tab} onChange={setTab} />
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<AuditOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.evaluation')}
        subtitle={t('eva.subtitle')}
      />
      {tab === 'done' ? <EvaluationDoneTab /> : (<>
      <StatTiles items={[
        { label: t('eva.tilePending'), value: q.data?.length ?? 0, color: '#2E9E4F' },
        { label: t('eva.tileOverdue'), value: overdue, color: '#D92D20' },
        { label: t('eva.tileTypes'), value: types, color: '#D48806' },
      ]} />
      <Alert type="info" showIcon title={t('eva.note')} style={{ marginBottom: 16 }} />
      <DataTable<EvaluationItem>
        rowKey={(r) => `${r.id}-${r.round}`}
        loading={q.isLoading}
        columns={columns}
        dataSource={rows}
        toolbar={<Input.Search allowClear style={{ width: 280 }} placeholder={t('eva.search')} onChange={(e) => setFilter(e.target.value)} />}
        locale={{ emptyText: q.isError ? t('req.err.generic') : t('eva.empty') }}
      />
      <EvaluationDetailDrawer item={selected} onClose={() => setSelected(null)} />
      </>)}
    </div>
    </>
  )
}
