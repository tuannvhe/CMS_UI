import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Empty, Result, Select, Skeleton, Space, Switch } from 'antd'
import { EyeInvisibleOutlined, EyeOutlined, MessageOutlined, PrinterOutlined, WalletOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiError } from '../../api/healthLeave'
import { payslip } from '../../api/payslip'
import { PageBanner } from '../../components/PageBanner'
import { PayslipHow } from './PayslipHow'

/** Phiếu lương của chính bạn theo kỳ. Số tiền được ẩn mặc định (tránh người bên cạnh nhìn thấy), bấm để hiện; có thể in. */
export default function PayslipPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const periods = useQuery({ queryKey: ['payslip', 'periods'], queryFn: payslip.periods, retry: false })
  const [period, setPeriod] = useState<string>()
  const [show, setShow] = useState(false)

  const list = useMemo(() => periods.data ?? [], [periods.data])
  useEffect(() => { if (!period && list.length) setPeriod(list[0].period) }, [list, period])
  const slip = useQuery({ queryKey: ['payslip', 'mine', period], queryFn: () => payslip.mine(period!), enabled: !!period, retry: false, staleTime: 0, gcTime: 0 })

  const explain = useQuery({ queryKey: ['payslip', 'explain', period], queryFn: () => payslip.explain(period!), enabled: !!period && show, retry: false, staleTime: 0, gcTime: 0 })
  const money = (n: number | null, raw: string) => (n === null ? (raw || '—') : n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 0 }))

  const byKey = (k: string) => slip.data?.items.find((i) => i.key === k)
  const tiles = [
    { k: 'grossIncome', cls: '' },
    { k: 'totalDeduction', cls: 'neg' },
    { k: 'netPay', cls: 'net' },
  ].map((x) => ({ ...x, item: byKey(x.k) })).filter((x) => x.item)

  const none = periods.isSuccess && list.length === 0
  const notFound = slip.isError && apiError(slip.error).code === 'not_found'

  return (
    <div className="page wide payslip">
      <PageBanner avatar={<Avatar size={56} icon={<WalletOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.payslip')} subtitle={t('nav.payslipDesc')} />
      {none ? <Empty description={t('pay.none')} /> : (
        <>
          <div className="pay-toolbar">
            <Space wrap>
              <Select style={{ width: 160 }} value={period} onChange={setPeriod} loading={periods.isLoading} options={list.map((p) => ({ value: p.period, label: p.period }))} />
              <span><Switch checked={show} onChange={setShow} checkedChildren={<EyeOutlined />} unCheckedChildren={<EyeInvisibleOutlined />} /> {t(show ? 'pay.hide' : 'pay.show')}</span>
            </Space>
            <Space wrap>
              <Button icon={<MessageOutlined />} onClick={() => navigate('/qa?channel=salary')}>{t('pay.ask')}</Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={!slip.data || !show}>{t('pay.print')}</Button>
            </Space>
          </div>
          {slip.isLoading || periods.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : notFound ? <Result status="info" title={t('pay.notFound')} /> : slip.isError ? <Alert type="error" showIcon title={t('usr.err.generic')} /> : slip.data && (
            <>
              <section className="pay-head">
                <div>
                  <div className="ph-name">{slip.data.fullName}</div>
                  <div className="ph-sub">{slip.data.employeeId} · {slip.data.department}{slip.data.title ? ` · ${slip.data.title}` : ''}</div>
                </div>
                <div className="ph-period"><span>{t('cls.period')}</span><b>{slip.data.period}</b></div>
              </section>
              <div className="pay-tiles">
                {tiles.map(({ k, cls, item }) => (
                  <div key={k} className={`pay-tile ${cls}`}>
                    <span>{t(`pay.f.${k}`)}</span>
                    <b className={show ? '' : 'masked'}>{money(item!.amount, item!.raw)}</b>
                  </div>
                ))}
              </div>
              {show && (
                <section className="pay-card pay-how">
                  <h3>{t('pay.how.title')}</h3>
                  <p className="pay-how-note">{t('pay.how.note')}</p>
                  <PayslipHow lines={explain.data ?? []} loading={explain.isLoading} fmt={(n) => n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 2 })} />
                </section>
              )}
              <p className="pay-foot">{t('pay.foot')}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
