import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Segmented, Select, Space, Switch, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, RiseOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { key, review, toKey, type ReportRow } from '../../api/review'
import { DataTable } from '../../components/DataTable'
import { StatTiles } from '../../components/StatTiles'
import { deptColumn, personColumn } from '../../components/cells'
import { useToast } from '../../hooks/useToast'
import { EmployeeHistoryDrawer } from './EmployeeHistoryDrawer'

/**
 * Báo cáo kết quả đánh giá theo kỳ, nằm trong tab "Đã hoàn tất" của màn HR: điểm từng vòng, điểm trung bình (F), điểm G và điểm tổng hợp 70% F + 30% G (OP),
 * đề xuất theo điểm, kết quả cuối của HR và đề xuất thăng tiến. Xuất Excel.
 */
export function EvaluationReportView() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [date, setDate] = useState<string>()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'all' | 'promote'>('all')
  const [exporting, setExporting] = useState(false)
  const [profile, setProfile] = useState<ReportRow | null>(null)

  const dates = useQuery({ queryKey: ['evaluations', 'report-dates'], queryFn: review.reportDates, staleTime: 5 * 60_000 })
  useEffect(() => {
    // Mặc định kỳ gần nhất (không ở tương lai) đã có đơn HR chốt; không có thì kỳ gần nhất không ở tương lai; không có nữa thì kỳ đầu danh sách.
    if (!date && dates.data?.length) {
      const today = dayjs().format('YYYY-MM-DD')
      const past = dates.data.filter((p) => p.date.slice(0, 10) <= today)
      setDate((past.find((p) => p.done > 0) ?? past[0] ?? dates.data[0]).date.slice(0, 10))
    }
  }, [date, dates.data])
  const q = useQuery({ queryKey: ['evaluations', 'report', date], queryFn: () => review.report(date!), enabled: !!date, staleTime: 0 })

  const promote = useMutation({
    mutationFn: (v: { r: ReportRow; on: boolean }) => review.promote(toKey(v.r), v.on),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['evaluations', 'report'] }); message.success(t(v.on ? 'rev.promoteOn' : 'rev.promoteOff', { name: v.r.fullName })) },
    onError: () => message.error(t('req.err.generic')),
  })

  const all = q.data ?? []
  const rows = useMemo(() => {
    const f = search.trim().toLowerCase()
    return all.filter((r) => (view === 'all' || !!r.promote) && (!f || `${r.employeeId} ${r.fullName} ${r.department}`.toLowerCase().includes(f)))
  }, [all, search, view])
  const roundCount = Math.max(1, ...all.map((r) => r.rounds.length))
  const promoted = all.filter((r) => !!r.promote).length
  const passed = all.filter((r) => r.hqResult === 'Y' || r.hqResult === 'Pass').length

  const columns: ColumnsType<ReportRow> = [
    personColumn<ReportRow>(t('att.name'), 240),
    deptColumn<ReportRow>(t('att.dept'), 190),
    { title: t('eva.typeRate'), dataIndex: 'typeRate', width: 250, render: (v: string) => <Tag color="green" variant="filled">{v}</Tag> },
    ...Array.from({ length: roundCount }, (_, i) => ({
      title: t('line.roundN', { n: i + 1 }), width: 150, align: 'center' as const,
      render: (_: unknown, r: ReportRow) => {
        const x = r.rounds[i]
        if (!x) return <span className="cell-muted">—</span>
        return (
          <Tooltip title={`${x.userName ?? ''}${x.status ? ` · ${x.status}` : ''}`}>
            <span className="rep-score" data-done={x.status === 'Completed' ? '1' : '0'}>
              <b>{x.mark ?? '—'}</b><small>{x.userName}</small>
            </span>
          </Tooltip>
        )
      },
    })),
    { title: t('rev.average'), dataIndex: 'average', width: 100, align: 'center', render: (v: number | null) => (v == null ? '—' : <b>{v}</b>) },
    {
      title: t('rev.gScore'), dataIndex: 'culture', width: 90, align: 'center',
      render: (v: number | null, r: ReportRow) => (r.position?.toUpperCase() !== 'OP' ? <span className="cell-muted">—</span> : v == null ? <Tag color="warning" variant="filled">{t('rev.gNone')}</Tag> : <b>{v}</b>),
    },
    {
      title: t('rev.overall'), dataIndex: 'overall', width: 150, align: 'center',
      render: (v: number | null, r: ReportRow) => (v == null ? <span className="cell-muted">—</span>
        : <Tooltip title={t('rev.overallTip', { f: r.average, g: r.culture })}><b>{v}</b></Tooltip>),
    },
    {
      title: t('rev.suggest'), dataIndex: 'suggest', width: 130,
      render: (v: string | null, r: ReportRow) => (v ? <Tooltip title={r.suggestReason}><Tag variant="filled" color={v === 'pass' ? 'success' : 'error'}>{v === 'pass' ? t('rev.pass') : t('rev.fail')}</Tag></Tooltip> : <span className="cell-muted">—</span>),
    },
    {
      title: t('rev.finalResult'), dataIndex: 'hqResult', width: 150,
      render: (v: string | null, r: ReportRow) => (v
        ? <Tooltip title={r.hqRemark}><Tag variant="filled" color={v === 'Y' || v === 'Pass' ? 'success' : 'error'}>{v === 'Y' || v === 'Pass' ? t('rev.pass') : t('rev.fail')}</Tag></Tooltip>
        : <span className="cell-muted">—</span>),
    },
    {
      title: '', width: 90, render: (_: unknown, r: ReportRow) => <Button size="small" onClick={() => setProfile(r)}>{t('emh.button')}</Button>,
    },
    {
      title: t('rev.promote'), width: 120, align: 'center',
      render: (_: unknown, r: ReportRow) => <Switch size="small" checked={!!r.promote} loading={promote.isPending && promote.variables && key(toKey(promote.variables.r)) === key(toKey(r))}
        onChange={(on) => promote.mutate({ r, on })} />,
    },
  ]

  const exportXlsx = async () => {
    if (!date) return
    setExporting(true)
    try {
      const blob = await review.exportReport(date)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `evaluation-report-${date}.xlsx`; a.click()
      URL.revokeObjectURL(url)
      message.success(t('rev.exported'))
    } catch { message.error(t('req.err.generic')) } finally { setExporting(false) }
  }

  return (
    <div className="page wide" style={{ paddingTop: 0 }}>
      <StatTiles items={[
        { label: t('rev.tileTotal'), value: all.length, color: '#2E9E4F' },
        { label: t('rev.tilePassed'), value: passed, color: '#2F6FB0' },
        { label: t('rev.tilePromoted'), value: promoted, color: '#D48806' },
      ]} />
      <DataTable<ReportRow>
        rowKey={(r) => key(toKey(r))} loading={q.isFetching} columns={columns} dataSource={rows}
        locale={{ emptyText: q.isError ? t('req.err.generic') : t('rev.empty') }}
        toolbar={(
          <Space wrap>
            <Select showSearch style={{ width: 170 }} placeholder={t('rev.pickDate')} loading={dates.isLoading} value={date} onChange={setDate}
              options={(dates.data ?? []).map((p) => ({ value: p.date.slice(0, 10), label: `${dayjs(p.date).format('DD/MM/YYYY')} · ${p.done}/${p.total}` }))} />
            <Segmented value={view} onChange={(v) => setView(v as 'all' | 'promote')}
              options={[{ value: 'all', label: t('rev.viewAll') }, { value: 'promote', label: <span><RiseOutlined /> {t('rev.viewPromote')}</span> }]} />
            <Input.Search allowClear style={{ width: 240 }} placeholder={t('eva.search')} onChange={(e) => setSearch(e.target.value)} />
            <Button icon={<DownloadOutlined />} loading={exporting} disabled={!date || all.length === 0} onClick={exportXlsx}>{t('rev.export')}</Button>
          </Space>
        )}
      />
      <EmployeeHistoryDrawer employeeId={profile?.employeeId ?? null} name={profile?.fullName} onClose={() => setProfile(null)} />
    </div>
  )
}
