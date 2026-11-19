import { useState } from 'react'
import { Button, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { kpi, type KpiTargetItem } from '../../api/kpi'
import { KPI_CSS } from './kpiUi'
import { STATUS_TEXT } from './kpiCalc'
import { KpiState, NameCell, PeriodSelect, SheetStatusTag, KpiHead } from './KpiParts'
import { fmtNum, isKpiAdmin, usePeriods } from './kpiShared'
import { foldFilter } from '../../utils/search'
import { trData } from '../../utils/dataText'

/** Mục tiêu và trọng số KPI đã giao cho từng phòng ban trong một kỳ (chỉ xem). HR (kpiAdmin) sửa ở màn Thiết lập KPI. */
export default function KpiTargetsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const admin = isKpiAdmin(user)
  const periods = usePeriods()
  const [periodPick, setPeriodPick] = useState<number | undefined>()
  const [unitId, setUnitId] = useState<number | undefined>()
  const periodId = periodPick ?? periods.data?.[0]?.id
  const units = useQuery({ queryKey: ['kpi-sheets', periodId, ''], queryFn: () => kpi.sheets({ periodId }), enabled: !!periodId })
  const unit = unitId ?? units.data?.[0]?.unitId
  const q = useQuery({ queryKey: ['kpi-targets', periodId, unit], queryFn: () => kpi.targets(periodId as number, unit as number), enabled: !!periodId && !!unit })
  const sumOk = q.data ? Math.abs(q.data.weightSum - 100) <= 0.01 : true

  const cols: ColumnsType<KpiTargetItem> = [
    { title: t('kpi.col.kpi'), key: 'n', render: (_, r) => <NameCell ind={r.indicator} /> },
    { title: t('kpi.col.unit'), key: 'u', width: 80, render: (_, r) => r.indicator.unit },
    { title: t('kpi.col.direction'), key: 'dir', width: 160, render: (_, r) => <Tag>{r.indicator.valueType === 'yesno' ? t('kpi.lib.vt.yesno') : r.indicator.lowerBetter ? t('kpi.lower') : t('kpi.higher')}</Tag> },
    { title: t('kpi.col.target'), key: 'tg', width: 130, align: 'right', render: (_, r) => (r.indicator.valueType === 'yesno' ? t('kpi.sheet.yes') : fmtNum(r.target, r.indicator.unit)) },
    { title: t('kpi.col.weight'), dataIndex: 'weight', width: 100, align: 'right', render: (v: number) => `${v}%` },
  ]

  return (
    <div className="page wide kpi-page">
      <style>{KPI_CSS}</style>
      <KpiHead page="kpiTargets" />
      <div className="kpi-bar">
        <label>{t('kpi.period.label')}</label>
        <PeriodSelect periods={periods.data} loading={periods.isLoading} value={periodId} onChange={(v) => { setPeriodPick(v); setUnitId(undefined) }} />
        <label>{t('kpi.col.dept')}</label>
        <Select style={{ width: 260 }} showSearch filterOption={foldFilter('label')} value={unit} onChange={setUnitId} loading={units.isLoading}
          placeholder={t('kpi.pickDept')} notFoundContent={t('kpi.noSheets')}
          options={(units.data ?? []).map((x) => ({ value: x.unitId, label: `${x.unitName}${x.site ? ` · ${x.site}` : ''}` }))} />
        {q.data && <span>{t('kpi.weightSum')}: <b style={{ color: sumOk ? STATUS_TEXT.ok : STATUS_TEXT.low }}>{q.data.weightSum}%</b></span>}
        {admin && <Button style={{ marginLeft: 'auto' }} icon={<SettingOutlined />} onClick={() => navigate('/kpi/setup?tab=assign')}>{t('kpi.setupLink')}</Button>}
      </div>
      <KpiState loading={periods.isLoading || units.isLoading || q.isLoading} error={periods.error ?? units.error ?? q.error} onRetry={() => { units.refetch(); q.refetch() }}
        empty={!periodId || !unit || !q.data?.sheet} emptyText={!periodId ? t('kpi.period.none') : !unit ? t('kpi.noSheets') : t('kpi.assign.notAssigned')}>
        {q.data?.sheet && (
          <div className="kpi-card">
            <h3>{trData(q.data.sheet.unitName)} · {q.data.sheet.periodCode}<small><SheetStatusTag status={q.data.sheet.status} /></small></h3>
            <Table<KpiTargetItem> size="small" rowKey={(r) => r.indicator.id} columns={cols} dataSource={[...q.data.items].sort((a, b) => a.sort - b.sort)} pagination={false} scroll={{ x: 760 }}
              locale={{ emptyText: t('kpi.sheet.noItems') }} />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-muted)' }}>{admin ? t('kpi.targetsAdminHint') : t('kpi.targetsHint')}</div>
          </div>
        )}
      </KpiState>
    </div>
  )
}
