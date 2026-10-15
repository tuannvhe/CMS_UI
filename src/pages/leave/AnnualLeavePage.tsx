import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Card, Empty, Progress, Skeleton, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CarryOutOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { leaveApi, type LeaveDetail } from '../../api/healthLeave'
import { AppModal } from '../../components/AppModal'
import { MiniTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'

const dayText = (d: number) => `${Math.round(d * 100) / 100}`

/** Phép năm của chính người dùng (tính theo ngày): phép được hưởng đến hết tháng này, đã nghỉ theo từng tháng, còn lại; bấm vào tháng để xem các đơn nghỉ. */
export default function AnnualLeavePage() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['leave', 'mine'], queryFn: leaveApi.mine, retry: false })
  const rows = useMemo(() => q.data ?? [], [q.data])
  const [id, setId] = useState<number>()   // năm đang xem
  useEffect(() => { if (id === undefined && rows.length) setId(rows[0].year) }, [rows, id])
  const rec = rows.find((r) => r.year === id) ?? rows[0]
  const [month, setMonth] = useState<number | null>(null)
  const detail = useQuery({ queryKey: ['leave', 'month', rec?.year, month], queryFn: () => leaveApi.month(rec!.year, month!), enabled: month !== null && !!rec, retry: false })

  const columns: ColumnsType<LeaveDetail> = [
    { title: t('al.from'), dataIndex: 'fromDate', width: 110, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '') },
    { title: t('al.to'), dataIndex: 'toDate', width: 110, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '') },
    { title: t('al.timeIn'), dataIndex: 'timeIn', width: 80 },
    { title: t('al.timeOut'), dataIndex: 'timeOut', width: 80 },
    { title: t('al.daysCol'), dataIndex: 'days', width: 80, align: 'right' },
    { title: t('al.type'), dataIndex: 'leaveType', ellipsis: true },
  ]

  const pct = rec && rec.entitledDays > 0 ? Math.min(100, Math.round((rec.usedDays / rec.entitledDays) * 100)) : 0
  const tile = (label: string, value: number, color: string, unit: string) => (
    <div className="stat-tile" style={{ ['--tile' as string]: color }}>
      <div className="st-label">{label}</div>
      <div className="st-value">{dayText(value)}<span className="st-unit">{unit}</span></div>
    </div>
  )

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CarryOutOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.annualLeave')} subtitle={t('nav.annualLeaveDesc')} chips={rec ? [`${t('al.year')} ${rec.year}`] : []} />
      {q.isLoading ? <Skeleton active /> : q.isError ? <Alert type="error" showIcon title={t('cls.err.generic')} /> : !rec ? (
        <Card><Empty description={t('al.none')} /></Card>
      ) : (
        <>
          <div className="cl-person">
            <div className="cl-who" style={{ flex: 1, minWidth: 260 }}>
              <div style={{ flex: 1 }}>
                <div className="cl-name">{rec.fullName}</div>
                <div className="cl-meta">{[rec.code, rec.department, rec.position].filter(Boolean).join(' · ')}</div>
                <Progress percent={pct} size="small" status={rec.remainingDays < 0 ? 'exception' : 'active'} style={{ marginTop: 6, marginBottom: 0 }} />
              </div>
            </div>
            {rows.length > 1 && (
              <div className="cl-periods" role="tablist" aria-label={t('al.year')}>
                {rows.map((r) => <button key={r.year} type="button" role="tab" aria-selected={r.year === rec.year} className={`cl-pill${r.year === rec.year ? ' on' : ''}`} onClick={() => setId(r.year)}>{r.year}</button>)}
              </div>
            )}
          </div>

          {rec.flags.filter((f) => ['over_used', 'missing_start_date', 'duplicate', 'unusual_hours', 'no_leave_start'].includes(f)).map((f) => (
            <Alert key={f} type="warning" showIcon style={{ marginBottom: 8 }} title={t(`al.flag.${f}`)} />
          ))}

          <div className="stat-grid">
            {tile(t('al.entitled'), rec.entitledDays, '#0F6B3E', t('al.daysUnit'))}
            {tile(t('al.used'), rec.usedDays, '#D48806', t('al.daysUnit'))}
            {tile(t('al.remaining'), rec.remainingDays, rec.remainingDays < 0 ? '#D92D20' : '#2E9E4F', t('al.daysUnit'))}
            {tile(t('al.serviceYears'), Math.floor(rec.serviceMonths / 12), '#2F6FB0', t('al.yearsUnit'))}
          </div>

          <section className="cl-section">
            <header style={{ ['--dot' as string]: '#0F6B3E' }}><span className="cl-dot" />{t('al.calcTitle')}</header>
            <div className="cl-grid">
              <div className="cl-row"><span className="cl-label">{t('al.accrualMonths')}</span><span className="cl-val">{rec.accrualMonths}</span></div>
              <div className="cl-row"><span className="cl-label">{t('al.seniorityDays')}</span><span className="cl-val">{rec.seniorityDays}</span></div>
              <div className="cl-row"><span className="cl-label">{t('al.startCalc')}</span><span className="cl-val">{rec.dateStart ? dayjs(rec.dateStart).format('DD/MM/YYYY') : '-'}</span></div>
              <div className="cl-row"><span className="cl-label">{t('al.asOf')}</span><span className="cl-val">{dayjs(rec.asOf).format('DD/MM/YYYY')}</span></div>
              <div className="cl-row"><span className="cl-label">{t('al.usedSource')}</span><span className="cl-val">{t(`al.source.${rec.usedSource}`)}</span></div>
              <div className="cl-row strong"><span className="cl-label">{t('al.formula')}</span><span className="cl-val">{rec.accrualMonths} + {rec.seniorityDays} − {dayText(rec.usedDays)} = {dayText(rec.remainingDays)}</span></div>
            </div>
          </section>

          <section className="cl-section">
            <header style={{ ['--dot' as string]: '#D48806' }}><span className="cl-dot" />{t('al.byMonth')}<small>{t('al.clickMonth')}</small></header>
            <div className="al-months">
              {rec.monthDays.map((d, i) => (
                <Tooltip key={i} title={rec.usedSource === 'hr' && rec.months[i] ? `${rec.months[i]} ${t('al.hoursUnit')}` : undefined}>
                  <button type="button" className={`al-month${d > 0 ? ' used' : ''}`} onClick={() => setMonth(i + 1)}>
                    <span className="al-m-name">{t('al.month', { n: i + 1 })}</span>
                    <span className="al-m-val">{d > 0 ? dayText(d) : '-'}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          </section>
          <Typography.Text className="cl-foot">{t('al.rules')}</Typography.Text>
          {rec.flags.includes('resigned') && <div style={{ marginTop: 6 }}><Tag color="default">{t('al.flag.resigned')}</Tag></div>}
        </>
      )}

      <AppModal open={month !== null} onClose={() => setMonth(null)} size="md" icon={<CarryOutOutlined />} title={t('al.detailTitle', { n: month ?? '' })} subtitle={t('al.detailSub')}>
        <MiniTable<LeaveDetail> rowKey="id" size="small" pagination={false} loading={detail.isFetching} columns={columns} dataSource={detail.data ?? []}
          locale={{ emptyText: detail.isError ? t('cls.err.generic') : t('al.detailEmpty') }} />
      </AppModal>
    </div>
  )
}
