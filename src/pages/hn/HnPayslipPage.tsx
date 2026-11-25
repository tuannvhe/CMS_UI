import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Alert, Button, Empty, Result, Select, Skeleton, Space, Switch, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeInvisibleOutlined, EyeOutlined, FileDoneOutlined, PrinterOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { hnApi, hnErrorCode, hnErrorKey, type HnPayslip, type HnPayslipItem } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { periodToSlug } from '../../utils/hnFormat'
import { vnMoneyWords } from '../../utils/vnMoneyWords'
import logo from '../../assets/logoVinaEnesol.jpg'

/*
 * 2026-11-24 [Truong] - HN payslip laid out like the old CMS_HN "Phiếu lương tháng" (Payslip.tsx + utils/payslip.ts transformToPayslipData):
 * header with logo, employee box, contract tiles, A. Income table (probation 85% / official), B. Deductions table, net pay in words.
 * Amounts stay hidden until the switch is on; nothing is stored in localStorage / sessionStorage; react-query cache is short and not persisted.
 */

/** "10/2026" (từ bảng chấm công) hoặc "2026-10" → "2026-10" (dạng của API phiếu lương). */
const toApiPeriod = (p: string | null) => {
  const m = p ? /^(\d{1,2})\/(\d{4})$/.exec(p.trim()) : null
  return m ? `${m[2]}-${m[1].padStart(2, '0')}` : p || undefined
}
/** "2026-10" → "10/2026" */
const toLabel = (p: string) => { const m = /^(\d{4})-(\d{2})$/.exec(p); return m ? `${m[2]}/${m[1]}` : p }
/** "2026-10-01" → "2026/10/01" như phiếu cũ */
const ymd = (d?: string | null) => (d ? d.slice(0, 10).replace(/-/g, '/') : '')

const fmt = (n: number | null | undefined) => (n == null || n === 0 ? '-' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }))
const nz = (n: number | null | undefined) => n != null && n !== 0

interface IncomeRow { key: string; name: ReactNode; nameSpan?: number; percent?: string; hTv?: ReactNode; aTv?: ReactNode; h?: ReactNode; a?: ReactNode; head?: boolean; total?: boolean }
interface DedRow { key: string; name: string; percent?: string; amount?: ReactNode; head?: boolean; total?: boolean }

export default function HnPayslipPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [period, setPeriod] = useState<string | undefined>(toApiPeriod(params.get('period')))
  const [show, setShow] = useState(false)

  const periods = useQuery({ queryKey: ['hn', 'payslip', 'periods', user?.userId], queryFn: hnApi.payslipPeriods, retry: false, staleTime: 0, gcTime: 30_000 })
  const list = useMemo(() => periods.data?.periods ?? [], [periods.data])
  useEffect(() => { if (!period && list.length) setPeriod(list[0].period) }, [list, period])
  const slip = useQuery({
    queryKey: ['hn', 'payslip', 'slip', user?.userId, period], queryFn: () => hnApi.payslip(period),
    enabled: periods.isSuccess && (!!period || list.length === 0), retry: false, staleTime: 0, gcTime: 0,
  })
  useEffect(() => { setShow(false) }, [period])

  const errCode = slip.isError ? hnErrorCode(slip.error) : periods.isError ? hnErrorCode(periods.error) : ''
  const soft = errCode === 'payslip_not_found' || errCode === 'no_employee'
  const failed = periods.isError ? periods.error : slip.isError ? slip.error : null
  const loading = periods.isLoading || (slip.isLoading && !!period)
  const d = slip.data

  return (
    <div className="page wide payslip hn-payslip">
      <div className="pay-toolbar" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Space wrap>
          <Select style={{ width: 160 }} value={period} onChange={setPeriod} loading={periods.isLoading} disabled={!list.length} placeholder={t('hn.payslip.period')} aria-label={t('hn.payslip.period')}
            options={list.map((p) => ({ value: p.period, label: toLabel(p.period) }))} />
          <span><Switch checked={show} onChange={setShow} checkedChildren={<EyeOutlined />} unCheckedChildren={<EyeInvisibleOutlined />} /> {t(show ? 'hn.payslip.hide' : 'hn.payslip.show')}</span>
        </Space>
        <Space wrap>
          {period && <Button icon={<FileDoneOutlined />} onClick={() => navigate(`/hn/timework/${periodToSlug(toLabel(period))}`)}>{t('hn.payslip.viewTimework')}</Button>}
          <Button icon={<PrinterOutlined />} disabled={!d || !show} onClick={() => window.print()}>{t('hn.payslip.print')}</Button>
        </Space>
      </div>

      {loading ? <Skeleton active paragraph={{ rows: 12 }} />
        : failed && soft ? <Result status="info" title={t(errCode === 'payslip_not_found' ? 'hn.payslip.notFound' : 'hn.err.no_employee')} />
        : failed ? <Alert type="error" showIcon title={t(hnErrorKey(failed))} action={<Button size="small" onClick={() => { void periods.refetch(); void slip.refetch() }}>{t('hn.common.retry')}</Button>} />
        : periods.isSuccess && list.length === 0 ? <Empty description={t('hn.payslip.none')} />
        : d && <PayslipSheet d={d} show={show} />}
      <p className="pay-foot">{t('hn.payslip.foot')}</p>
    </div>
  )
}

function PayslipSheet({ d, show }: { d: HnPayslip; show: boolean }) {
  const { t, i18n } = useTranslation()
  const L = (k: string) => t(`hn.payslip.l.${k}`)
  const line = (group: HnPayslipItem[], key: string) => group.find((x) => x.key === key)
  const c = (key: string) => line(d.contract, key)
  const inc = (key: string) => line(d.income, key)
  const ded = (key: string) => line(d.deductions, key)
  // Số tiền: che khi chưa bật "Hiện số tiền"; giờ công không che
  const money = (n: number | null | undefined): ReactNode => (!nz(n) ? '-' : show ? fmt(n) : <span className="masked">••••••</span>)
  const hours = (n: number | null | undefined) => fmt(n)

  // ---- Thông tin hợp đồng (2 cột như phiếu cũ; "Ngày công tiêu chuẩn" phiếu cũ ghi cố định 26)
  const contractLeft: [string, ReactNode][] = [
    [L('base_salary'), money(c('base_salary')?.amount)], [L('probation_salary'), money(c('probation_salary')?.amount)],
    [L('position_allowance'), money(c('position_allowance')?.amount)], [L('attendance_allowance'), money(c('attendance_allowance')?.amount)],
    [t('hn.payslip.stdDays'), '26'], [L('seniority_allowance'), money(c('seniority_allowance')?.amount)], [L('leave_balance'), money(c('leave_balance')?.amount)],
  ]
  const contractRight: [string, ReactNode][] = [
    [L('travel_allowance'), money(c('travel_allowance')?.amount)], [L('housing_allowance'), money(c('housing_allowance')?.amount)],
    [L('sport_training_allowance'), money(c('sport_training_allowance')?.amount)], [L('language_allowance'), money(c('language_allowance')?.amount)],
    [L('fire_protection_allowance'), money(c('fire_protection_allowance')?.amount)], [L('other_allowance'), money(c('other_allowance')?.amount)],
    [L('total_contract'), money(c('total_contract')?.amount)],
  ]

  // ---- A. Thu nhập
  const salaryRow = (key: string, name: ReactNode, pct: number | string, nameSpan?: number): IncomeRow => {
    const it = inc(key)
    return { key, name, nameSpan, percent: `${pct}%`, hTv: hours(it?.hoursProbation), aTv: money(it?.amountProbation), h: hours(it?.hours), a: money(it?.amount) }
  }
  const OT = ['150', '200', '210', '230', '270', '300', '390']
  const sev = inc('severance')
  const incomeRows: IncomeRow[] = [
    salaryRow('basic_day', L('basic_day'), 100), salaryRow('basic_night', L('basic_night'), 130), salaryRow('leave', L('leave'), 100),
    salaryRow('pn_payment', L('pn_payment'), 100), salaryRow('paid_leave_50', L('paid_leave_50'), 50), salaryRow('paid_leave_70', L('paid_leave_70'), 70),
    salaryRow('compensatory_leave', L('compensatory_leave'), 100),
    ...OT.map((p, i) => salaryRow(`ot_${p}`, L('ot'), p, i === 0 ? OT.length : 0)),
    { key: 'a2', name: t('hn.payslip.a2'), head: true, percent: '-', hTv: '-', aTv: '-', h: t('hn.payslip.a2Unit'), a: '-' },
    ...(['other_bonus', 'meal_support', 'bonus_kpi'] as const).map((k): IncomeRow => {
      const it = inc(k)
      return { key: k, name: L(k), percent: '-', hTv: hours(it?.hoursProbation), aTv: money(it?.amountProbation), h: hours(it?.hours), a: money(it?.amount) }
    }),
    ...(nz(sev?.amount) || nz(sev?.amountProbation) ? [{ key: 'severance', name: L('severance'), percent: '-', hTv: hours(sev?.hoursProbation), aTv: money(sev?.amountProbation), h: hours(sev?.hours), a: money(sev?.amount) }] : []),
    { key: 'tet_bonus', name: L('tet_bonus'), percent: '-', hTv: '-', aTv: '-', h: '-', a: '-' },
    { key: 'gross', name: t('hn.payslip.grossRow'), total: true, percent: '', hTv: '', aTv: '', h: '', a: money(d.grossIncome) },
  ]
  const nameCell = (r: IncomeRow) => ({ rowSpan: r.nameSpan ?? 1 })
  const incomeCols: ColumnsType<IncomeRow> = [
    { title: t('hn.payslip.a1'), dataIndex: 'name', key: 'name', width: 190, onCell: nameCell, render: (v: ReactNode, r) => <span className={r.total ? 'hp-total' : 'hp-name'}>{v}</span> },
    { title: '%', dataIndex: 'percent', key: 'pct', width: 70, align: 'center' },
    {
      title: t('hn.payslip.prob85'), children: [
        { title: t('hn.payslip.hoursCol'), dataIndex: 'hTv', key: 'hTv', width: 80, align: 'center' },
        { title: t('hn.payslip.amountCol'), dataIndex: 'aTv', key: 'aTv', width: 130, align: 'right' },
      ],
    },
    {
      title: t('hn.payslip.official'), children: [
        { title: t('hn.payslip.hoursCol'), dataIndex: 'h', key: 'h', width: 80, align: 'center' },
        { title: t('hn.payslip.amountCol'), dataIndex: 'a', key: 'a', width: 130, align: 'right', render: (v: ReactNode, r) => (r.total ? <b>{v}</b> : v) },
      ],
    },
  ]

  // ---- B. Khấu trừ
  const pct = (n: number | null | undefined) => (n == null ? '-' : `${n.toFixed(1)}%`)
  const dRow = (key: string, opts: Partial<DedRow> = {}): DedRow => ({ key, name: L(key), percent: pct(ded(key)?.percent), amount: money(ded(key)?.amount), ...opts })
  const dedRows: DedRow[] = [
    dRow('insurance', { head: true }), dRow('insurance_base'), dRow('social_insurance'), dRow('health_insurance'), dRow('unemployment_insurance'),
    dRow('union_fee', { head: true }), dRow('personal_income_tax', { head: true }),
    dRow('taxable_income'), dRow('family_allowance'), dRow('advance_deduction'), dRow('personal_allowance'), dRow('provisional_tax'),
    { key: 'other_head', name: L('other_head'), head: true, percent: '-', amount: '-' },
    dRow('other_deductions'), dRow('hi_arrears'), dRow('natural_disaster_fund'),
    { key: 'total_deductions', name: L('total_deductions'), total: true, percent: '-', amount: money(d.totalDeductions) },
  ]
  const dedCols: ColumnsType<DedRow> = [
    { title: t('hn.payslip.bHead').toUpperCase(), dataIndex: 'name', key: 'name', render: (v: string, r) => <span className={r.head ? 'hp-name' : r.total ? 'hp-total' : undefined}>{v}</span> },
    { title: '', dataIndex: 'percent', key: 'pct', width: 90, align: 'center' },
    { title: t('hn.payslip.amountCol'), dataIndex: 'amount', key: 'amount', width: 160, align: 'right', render: (v: ReactNode, r) => (r.total ? <b>{v}</b> : v) },
  ]

  return (
    <section className="hp-sheet">
      <header className="hp-header">
        <img src={logo} alt="VINA ENESOL" className="hp-logo" />
        <div style={{ textAlign: 'right' }}>
          <h1>{t('hn.payslip.title', { period: toLabel(d.period) })}</h1>
          {(d.fromDate || d.toDate) && <div className="hp-range">{t('hn.payslip.range', { from: ymd(d.fromDate), to: ymd(d.toDate) })}</div>}
        </div>
      </header>

      <div className="hp-info">
        {[[t('hn.payslip.empId'), d.employeeId], [t('hn.payslip.position'), d.position], [t('hn.payslip.fullName'), d.employeeName], [t('hn.payslip.from'), ymd(d.fromDate)],
          [t('hn.payslip.dept'), d.department], [t('hn.payslip.to'), ymd(d.toDate)]].map(([l, v]) => (
          <div key={l as string}><b>{l}:</b> <span>{v || '-'}</span></div>
        ))}
      </div>

      <h2 className="hp-title">📝 {t('hn.payslip.contractTitle')}</h2>
      <div className="hp-contract">
        {[contractLeft, contractRight].map((col, i) => (
          <div key={i} className="hp-contract-col">
            {col.map(([l, v]) => <div key={l} className="hp-tile"><span>{l}:</span><b>{v}</b></div>)}
          </div>
        ))}
      </div>

      <div className="hp-tables">
        <div>
          <h2 className="hp-title">💰 {t('hn.payslip.incomeTitle')}</h2>
          <Table<IncomeRow> className="hp-table" size="small" bordered pagination={false} rowKey="key" scroll={{ x: 680 }}
            columns={incomeCols} dataSource={incomeRows} rowClassName={(r) => (r.total ? 'hp-row-total' : '')} />
        </div>
        <div>
          <h2 className="hp-title">💸 {t('hn.payslip.deductTitle')}</h2>
          <Table<DedRow> className="hp-table" size="small" bordered pagination={false} rowKey="key" scroll={{ x: 420 }}
            columns={dedCols} dataSource={dedRows} rowClassName={(r) => (r.total ? 'hp-row-total' : '')} />
        </div>
      </div>

      <div className="hp-net">
        <div className="hp-net-title">💵 {t('hn.payslip.netTitle').toUpperCase()}</div>
        <div className="hp-net-amount">{show ? `${fmt(d.netSalary)} ₫` : <span className="masked">•••••••• ₫</span>}</div>
        {show && i18n.language === 'vi' && nz(d.netSalary) && <div className="hp-net-words">({t('hn.payslip.inWords', { text: vnMoneyWords(d.netSalary) })})</div>}
      </div>
    </section>
  )
}
