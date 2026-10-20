import { useState } from 'react'
import { DatePicker, Space } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { recruitReport, RECRUIT_STATUSES } from '../../api/recruit'
import { StatTiles } from '../../components/StatTiles'

/** Báo cáo tuyển dụng theo ngày tạo hồ sơ: phễu trạng thái, sàng lọc CV, phỏng vấn, kết quả cuối. Chỉ HR / quản trị. */
export function RecruitReport() {
  const { t } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(90, 'day'), dayjs()])
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['recruit-report', from, to], queryFn: () => recruitReport(from, to) })
  const r = q.data
  const num = (v: number | null | undefined, unit = '') => (v == null ? '—' : `${Math.round(v * 10) / 10}${unit}`)
  const total = r ? Object.values(r.byStatus).reduce((a, b) => a + b, 0) : 0
  const bar = (label: string, v: number, max: number) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 150 }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--surface-2, #f0f0f0)', borderRadius: 4, height: 14 }}>
        <div style={{ width: `${max ? (v / max) * 100 : 0}%`, background: '#2F6FB0', height: '100%', borderRadius: 4 }} />
      </div>
      <b style={{ width: 40, textAlign: 'right' }}>{v}</b>
    </div>
  )

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker allowClear={false} value={range} format="DD/MM/YYYY" onChange={(v) => v?.[0] && v[1] && setRange([v[0], v[1]])} />
      </Space>
      {r && r.ready !== false && (
        <>
          <StatTiles items={[
            { label: t('rec.rp.total'), value: total },
            { label: t('rec.rp.finalPass'), value: r.finalPass, color: '#2E9E4F' },
            { label: t('rec.rp.finalFail'), value: r.finalFail, color: '#CF1322' },
            { label: t('rec.rp.avgDays'), value: num(r.avgDaysToFinal, ' ' + t('rec.rp.days')) },
          ]} />
          <StatTiles items={[
            { label: t('rec.rp.scrSent'), value: r.screeningsSent },
            { label: t('rec.rp.scrInvite'), value: r.screeningsInvite, color: '#2E9E4F' },
            { label: t('rec.rp.scrReject'), value: r.screeningsReject },
            { label: t('rec.rp.scrOverdue'), value: r.screeningsOverdue, color: r.screeningsOverdue ? '#CF1322' : undefined },
            { label: t('rec.rp.avgScr'), value: num(r.avgScreeningHours, ' h') },
          ]} />
          <StatTiles items={[
            { label: t('rec.rp.ivPlanned'), value: r.interviewsPlanned },
            { label: t('rec.rp.ivDone'), value: r.interviewsDone, color: '#2E9E4F' },
            { label: t('rec.rp.ivNoShow'), value: r.interviewsNoShow },
            { label: t('rec.rp.ivCancelled'), value: r.interviewsCancelled },
            { label: t('rec.rp.evPass'), value: r.evaluationsPass, color: '#2E9E4F' },
            { label: t('rec.rp.evFail'), value: r.evaluationsFail },
          ]} />
          <h4>{t('rec.rp.byStatus')}</h4>
          {RECRUIT_STATUSES.map((s) => bar(t(`rec.st.${s}`), r.byStatus[s] ?? 0, total))}
          <h4>{t('rec.rp.byLevel')}</h4>
          {Object.entries(r.byLevel).map(([k, v]) => bar(t(`rec.lv.${k}`, { defaultValue: k }), v, total))}
          <h4>{t('rec.rp.byDept')}</h4>
          {r.byDepartment.map((d) => bar(d.key, d.value, r.byDepartment[0]?.value ?? 0))}
        </>
      )}
    </div>
  )
}
