import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Empty, Result, Select, Skeleton, Space, Switch } from 'antd'
import { EyeInvisibleOutlined, EyeOutlined, WalletOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorCode, hnErrorKey, type HnPayslipItem } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { PageBanner } from '../../components/PageBanner'

/**
 * Phiếu lương của chính bạn (cơ sở Ninh Bình) theo kỳ. Giao diện dùng lại kiểu màn Phiếu lương của VINA (pay-head / pay-tile / pay-card).
 * Số tiền ẩn mặc định (làm mờ), bấm công tắc để hiện. Dữ liệu lương KHÔNG lưu vào localStorage/sessionStorage; react-query giữ cache ngắn, không persist.
 */
const nz = (v: number | null | undefined) => v != null && v !== 0
const visible = (it: HnPayslipItem) => nz(it.amount) || nz(it.amountProbation) || nz(it.hours) || nz(it.hoursProbation)

export default function HnPayslipPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [period, setPeriod] = useState<string>()
  const [show, setShow] = useState(false)
  const loc = i18n.language === 'vi' ? 'vi-VN' : i18n.language
  const num = (n: number) => n.toLocaleString(loc, { maximumFractionDigits: 2 })
  const money = (n: number | null | undefined) => (n == null ? '' : `${num(n)} ₫`)

  const periods = useQuery({ queryKey: ['hn', 'payslip', 'periods', user?.userId], queryFn: hnApi.payslipPeriods, retry: false, staleTime: 0, gcTime: 30_000 })
  const list = useMemo(() => periods.data?.periods ?? [], [periods.data])
  useEffect(() => { if (!period && list.length) setPeriod(list[0].period) }, [list, period])
  const slip = useQuery({
    queryKey: ['hn', 'payslip', 'slip', user?.userId, period], queryFn: () => hnApi.payslip(period),
    enabled: periods.isSuccess && (!!period || list.length === 0), retry: false, staleTime: 0, gcTime: 0,
  })
  useEffect(() => { setShow(false) }, [period])

  const d = slip.data
  const income = useMemo(() => (d?.income ?? []).filter(visible), [d])
  const deductions = useMemo(() => (d?.deductions ?? []).filter(visible), [d])
  const contract = useMemo(() => (d?.contract ?? []).filter(visible), [d])
  const hasProb = [...income, ...deductions].some((it) => nz(it.amountProbation) || nz(it.hoursProbation))
  const mask = (s: string) => <span className={show ? undefined : 'masked'}>{show ? s : '••••••'}</span>

  const rows = (items: HnPayslipItem[]) => (
    <dl>
      {items.map((it) => (
        <div className="pay-row" key={it.key}>
          <dt>
            {it.label}
            {nz(it.percent) && <span style={{ color: 'var(--c-muted)' }}> · {num(it.percent!)}%</span>}
            {nz(it.hours) && <span style={{ color: 'var(--c-muted)' }}> · {num(it.hours!)} {t('hn.payslip.hoursUnit')}</span>}
          </dt>
          <dd>
            {nz(it.amount) ? mask(money(it.amount)) : '–'}
            {hasProb && nz(it.amountProbation) && <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--c-muted)' }}>{t('hn.payslip.probation')}: {mask(money(it.amountProbation))}</div>}
          </dd>
        </div>
      ))}
    </dl>
  )

  const errCode = slip.isError ? hnErrorCode(slip.error) : periods.isError ? hnErrorCode(periods.error) : ''
  const soft = errCode === 'payslip_not_found' || errCode === 'no_employee'
  const failed = periods.isError ? periods.error : slip.isError ? slip.error : null
  const loading = periods.isLoading || (slip.isLoading && !!period)

  return (
    <div className="page wide payslip">
      <PageBanner avatar={<Avatar size={56} icon={<WalletOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('hn.nav.payslip')} subtitle={t('hn.nav.payslipDesc')} />
      <div className="pay-toolbar">
        <Space wrap>
          <Select style={{ width: 160 }} value={period} onChange={setPeriod} loading={periods.isLoading} disabled={!list.length} placeholder={t('hn.payslip.period')} aria-label={t('hn.payslip.period')}
            options={list.map((p) => ({ value: p.period, label: p.period }))} />
          <span><Switch checked={show} onChange={setShow} checkedChildren={<EyeOutlined />} unCheckedChildren={<EyeInvisibleOutlined />} /> {t(show ? 'hn.payslip.hide' : 'hn.payslip.show')}</span>
        </Space>
      </div>
      {loading ? <Skeleton active paragraph={{ rows: 10 }} />
        : failed && soft ? <Result status="info" title={t(errCode === 'payslip_not_found' ? 'hn.payslip.notFound' : 'hn.err.no_employee')} />
        : failed ? <Alert type="error" showIcon title={t(hnErrorKey(failed))} action={<Button size="small" onClick={() => { void periods.refetch(); void slip.refetch() }}>{t('hn.common.retry')}</Button>} />
        : periods.isSuccess && list.length === 0 ? <Empty description={t('hn.payslip.none')} />
        : d && (
          <>
            <section className="pay-head">
              <div>
                <div className="ph-name">{d.employeeName}</div>
                <div className="ph-sub">{[d.employeeId, d.department, d.position].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="ph-period"><span>{t('hn.payslip.period')}</span><b>{d.period}</b></div>
            </section>
            <div className="pay-tiles">
              <div className="pay-tile"><span>{t('hn.payslip.gross')}</span><b>{mask(money(d.grossIncome))}</b></div>
              <div className="pay-tile neg"><span>{t('hn.payslip.totalDed')}</span><b>{mask(money(d.totalDeductions))}</b></div>
              <div className="pay-tile net"><span>{t('hn.payslip.net')}</span><b>{mask(money(d.netSalary))}</b></div>
            </div>
            <div className="pay-cols">
              <div className="pay-col">
                {contract.length > 0 && <section className="pay-card"><h3>{t('hn.payslip.contract')}</h3>{rows(contract)}</section>}
                <section className="pay-card"><h3>{t('hn.payslip.income')}</h3>{income.length ? rows(income) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.payslip.noItems')} />}</section>
              </div>
              <div className="pay-col">
                <section className="pay-card"><h3>{t('hn.payslip.deductions')}</h3>{deductions.length ? rows(deductions) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hn.payslip.noItems')} />}</section>
              </div>
            </div>
            <p className="pay-foot">{t('hn.payslip.foot')}</p>
          </>
        )}
    </div>
  )
}
