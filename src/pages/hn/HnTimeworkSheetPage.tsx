import { useMemo } from 'react'
import { Alert, Button, Result, Skeleton, Space } from 'antd'
import { ArrowLeftOutlined, FileDoneOutlined, LeftOutlined, PrinterOutlined, RightOutlined, WalletOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { hnApi, hnErrorKey } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { cell, fmtCell, periodToSlug, slugToPeriod } from '../../utils/hnFormat'
import { TimeworkSheet } from './HnTimeworkDetail'

/* 2026-11-24 [Truong] - HN timework: full page "Bảng chấm công tháng" for one period (/hn/timework/10-2026), replaces the detail drawer */

const PERIOD = 'KyLuong'

export default function HnTimeworkSheetPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const period = slugToPeriod(useParams<{ period: string }>().period)
  // Dùng chung dữ liệu (và bộ nhớ đệm) với bảng phiếu công: tối đa 24 kỳ gần nhất, mới nhất trước
  const q = useQuery({ queryKey: ['hn', 'timework', user?.userId], queryFn: () => hnApi.timework(), staleTime: 60_000, retry: false })

  const all = useMemo(() => q.data?.periods ?? [], [q.data])
  const periods = useMemo(() => [...new Set(all.map((r) => fmtCell(cell(r, PERIOD)).trim()).filter(Boolean))], [all])
  const row = all.find((r) => fmtCell(cell(r, PERIOD)).trim() === period)
  const i = periods.indexOf(period)
  const newer = i > 0 ? periods[i - 1] : undefined
  const older = i >= 0 && i < periods.length - 1 ? periods[i + 1] : undefined
  const go = (p: string) => navigate(`/hn/timework/${periodToSlug(p)}`)

  return (
    <div className="page wide hn-sheet">
      {/* Thanh thao tác: ẩn khi in (pay-toolbar đã có trong @media print) */}
      <div className="pay-toolbar" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hn/timework')}>{t('hn.timework.backToList')}</Button>
        <Space wrap>
          <Button icon={<LeftOutlined />} disabled={!older} onClick={() => older && go(older)}>{older ?? t('hn.timework.prev')}</Button>
          <Button disabled={!newer} onClick={() => newer && go(newer)}>{newer ?? t('hn.timework.next')} <RightOutlined /></Button>
          <Button icon={<PrinterOutlined />} disabled={!row} onClick={() => window.print()}>{t('hn.timework.print')}</Button>
          <Button type="primary" icon={<WalletOutlined />} onClick={() => navigate(`/hn/payslip?period=${encodeURIComponent(period)}`)}>{t('hn.timework.viewPayslip')}</Button>
        </Space>
      </div>

      <section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 16, padding: '28px 28px 32px', boxShadow: 'var(--shadow-sm)' }}>
        <header style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: 0.5, color: 'var(--c-primary)', textTransform: 'uppercase' }}>
            <FileDoneOutlined style={{ fontSize: 24, marginRight: 10 }} />{t('hn.timework.sheetTitle', { period })}
          </h1>
          <div style={{ color: 'var(--c-muted)', marginTop: 6 }}>{t('hn.timework.sheetSub')}</div>
        </header>

        {q.isLoading ? <Skeleton active paragraph={{ rows: 10 }} />
          : q.isError ? <Alert type="error" showIcon title={t(hnErrorKey(q.error))} action={<Button size="small" onClick={() => void q.refetch()}>{t('hn.common.retry')}</Button>} />
          : !row ? <Result status="info" title={t('hn.timework.emptyPeriod')} extra={<Button onClick={() => navigate('/hn/timework')}>{t('hn.timework.backToList')}</Button>} />
          : <TimeworkSheet row={row} />}
      </section>
    </div>
  )
}
