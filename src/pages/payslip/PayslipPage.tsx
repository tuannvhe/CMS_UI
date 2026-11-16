import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Empty, Result, Select, Skeleton, Space, Switch } from 'antd'
import { EyeInvisibleOutlined, EyeOutlined, KeyOutlined, LockOutlined, MessageOutlined, PrinterOutlined, WalletOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiError } from '../../api/healthLeave'
import { payslip, payslipPin } from '../../api/payslip'
import { PageBanner } from '../../components/PageBanner'
import { PayslipHow } from './PayslipHow'
import { PayslipPinChange, PayslipPinGate } from './PayslipPin'
import { trData } from '../../utils/dataText'

/**
 * Phiếu lương của chính bạn theo kỳ. Phải nhập mã PIN 4 số mới mở được (lần đầu đặt mã); mở xong tự khoá lại sau 10 phút hoặc khi tải lại trang.
 * Số tiền được ẩn mặc định (tránh người bên cạnh nhìn thấy), bấm để hiện; có thể in.
 */
export default function PayslipPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [unlocked, setUnlocked] = useState(payslipPin.unlocked)
  const [changing, setChanging] = useState(false)
  const lock = () => {
    payslipPin.lock(); setUnlocked(false)
    for (const k of ['mine', 'provisional', 'explain']) qc.removeQueries({ queryKey: ['payslip', k] })
  }
  // Vé mở khoá hết hạn thì khoá lại màn hình (không để số tiền nằm trên màn hình bỏ quên)
  useEffect(() => {
    if (!unlocked) return
    const id = window.setInterval(() => { if (!payslipPin.unlocked()) lock() }, 15_000)
    return () => window.clearInterval(id)
  })
  const periods = useQuery({ queryKey: ['payslip', 'periods'], queryFn: payslip.periods, retry: false })
  const prov = useQuery({ queryKey: ['payslip', 'provisional'], queryFn: payslip.provisional, enabled: unlocked, retry: false, staleTime: 60_000 })
  const [period, setPeriod] = useState<string>()
  const [picked, setPicked] = useState(false)
  const [show, setShow] = useState(false)

  const provList = useMemo(() => prov.data ?? [], [prov.data])
  const isProv = !!period && provList.some((p) => p.period === period)
  const provItem = provList.find((p) => p.period === period)
  // Kỳ chưa có phiếu lương HR nhập nhưng có thể tạm tính (tháng hiện tại / tháng trước) được xếp lên đầu danh sách kỳ
  const list = useMemo(() => [...provList.map((p) => ({ period: p.period, rows: 0, lastImported: null as string | null })), ...(periods.data ?? [])], [periods.data, provList])
  // Chưa tự chọn kỳ nào thì mở kỳ mới nhất; khi phiếu tạm tính tải xong (chậm hơn vì phải tổng hợp công) thì chuyển sang kỳ tạm tính
  useEffect(() => { if (!picked && list.length) setPeriod(list[0].period) }, [list, picked])
  const real = useQuery({ queryKey: ['payslip', 'mine', period], queryFn: () => payslip.mine(period!), enabled: unlocked && !!period && !isProv, retry: false, staleTime: 0, gcTime: 0 })
  const slip = isProv ? { data: provItem?.slip ?? undefined, isLoading: false, isError: false, error: null as unknown } : real

  const explain = useQuery({ queryKey: ['payslip', 'explain', period], queryFn: () => payslip.explain(period!), enabled: unlocked && !!period && show && !(isProv && !provItem?.slip), retry: false, staleTime: 0, gcTime: 0 })
  const money = (n: number | null, raw: string) => (n === null ? (raw || '—') : n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 0 }))

  const byKey = (k: string) => slip.data?.items.find((i) => i.key === k)
  const tiles = [
    { k: 'grossIncome', cls: '' },
    { k: 'totalDeduction', cls: 'neg' },
    { k: 'netPay', cls: 'net' },
  ].map((x) => ({ ...x, item: byKey(x.k) })).filter((x) => x.item)

  // Máy chủ báo cần mã (vé hết hạn / mã vừa bị đặt lại / đổi ở máy khác) → về màn nhập mã
  const pinNeeded = [prov.error, real.error, explain.error].some((e) => e && apiError(e).code === 'pin_required')
  useEffect(() => { if (pinNeeded && unlocked) lock() })
  const none = periods.isSuccess && prov.isFetched && list.length === 0
  const notFound = slip.isError && apiError(slip.error).code === 'not_found'
  const provMissing = isProv && !provItem?.slip

  return (
    <div className="page wide payslip">
      <PageBanner avatar={<Avatar size={56} icon={<WalletOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.payslip')} subtitle={t('nav.payslipDesc')} />
      {!unlocked ? <PayslipPinGate onUnlocked={() => setUnlocked(true)} /> : none ? <Empty description={t('pay.none')} /> : (
        <>
          <div className="pay-toolbar">
            <Space wrap>
              <Select style={{ width: 160 }} value={period} onChange={(v) => { setPicked(true); setPeriod(v) }} loading={periods.isLoading || prov.isLoading} options={list.map((p) => ({ value: p.period, label: provList.some((x) => x.period === p.period) ? `${p.period} · ${t('pay.provTag')}` : p.period }))} />
              {prov.isLoading && <span style={{ color: 'var(--c-muted)' }}>{t('pay.provLoading')}</span>}
              <span><Switch checked={show} onChange={setShow} checkedChildren={<EyeOutlined />} unCheckedChildren={<EyeInvisibleOutlined />} /> {t(show ? 'pay.hide' : 'pay.show')}</span>
            </Space>
            <Space wrap>
              <Button icon={<MessageOutlined />} onClick={() => navigate('/qa?channel=salary')}>{t('pay.ask')}</Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={!slip.data || !show || isProv}>{t('pay.print')}</Button>
              <Button icon={<KeyOutlined />} onClick={() => setChanging(true)}>{t('pay.pin.change')}</Button>
              <Button icon={<LockOutlined />} onClick={lock}>{t('pay.pin.lock')}</Button>
            </Space>
          </div>
          {slip.isLoading || periods.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : provMissing ? <Result status="info" title={t('pay.provMissing')} subTitle={t(`pay.provReason.${provItem?.reason ?? 'calc_error'}`)} /> : notFound ? <Result status="info" title={t('pay.notFound')} /> : slip.isError ? <Alert type="error" showIcon title={t('usr.err.generic')} /> : slip.data && (
            <>
              {isProv && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('pay.provNote')} />}
              <section className="pay-head">
                <div>
                  <div className="ph-name">{slip.data.fullName}</div>
                  <div className="ph-sub">{slip.data.employeeId} · {trData(slip.data.department)}{slip.data.title ? ` · ${slip.data.title}` : ''}</div>
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
      <PayslipPinChange open={changing} onClose={() => setChanging(false)} />
    </div>
  )
}
