import { useState } from 'react'
import { PERSON_PAY_SYNC } from '../../config/features'
import { Avatar, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WalletOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { payslip, type PayslipPeriodPreview, type PayslipPreview, type PayslipSample } from '../../api/payslip'
import { ImportWizard, IssueList, StatTiles } from '../../components/ImportWizard'
import { PageBanner } from '../../components/PageBanner'
import { PersonPaySuggest } from '../../components/PersonPaySuggest'

/** Nhập phiếu lương từ Excel (thay trang nhập lương của hệ thống cũ): xem trước kèm TỔNG thực nhận từng kỳ để đối chiếu với bảng lương gốc rồi mới ghi. */
export default function PayslipImportPage() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [suggestPeriod, setSuggestPeriod] = useState<string | null>(null)
  const periods = useQuery({ queryKey: ['payslip', 'admin-periods'], queryFn: payslip.adminPeriods, retry: false })
  const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 0 }))
  const day = (v: string | null) => (v ? new Date(v).toLocaleDateString(i18n.language) : '—')

  const periodCols: ColumnsType<PayslipPeriodPreview> = [
    { title: t('cls.period'), dataIndex: 'period', width: 110 },
    { title: t('pay.imp.rows'), dataIndex: 'rows', width: 90, align: 'right' },
    { title: t('pay.imp.new'), dataIndex: 'new', width: 90, align: 'right' },
    { title: t('pay.imp.updated'), dataIndex: 'updated', width: 110, align: 'right' },
    { title: t('pay.imp.total'), dataIndex: 'totalNetPay', align: 'right', render: (v: number) => <b>{fmt(v)}</b> },
  ]
  const sampleCols: ColumnsType<PayslipSample> = [
    { title: '#', dataIndex: 'excelRow', width: 70 },
    { title: t('org.colEmp'), dataIndex: 'employeeId', width: 120 },
    { title: t('org.colName'), dataIndex: 'fullName' },
    { title: t('org.department'), dataIndex: 'department' },
    { title: t('pay.f.netPay'), dataIndex: 'netPay', align: 'right', render: (v: number | null) => fmt(v) },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<WalletOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.payslipImport')} subtitle={t('nav.payslipImportDesc')} />
      <ImportWizard<PayslipPreview, { inserted: number; updated: number; periods: string[] }>
        noteTitle={t('pay.imp.noteTitle')} note={t('pay.imp.note')} dropText={t('pay.imp.drop')}
        preview={payslip.preview} commit={payslip.commit} template={payslip.template}
        confirmLabel={(p) => t('pay.imp.confirm', { n: p.totalRows })} doneTitle={t('pay.imp.doneTitle')}
        doneText={(r) => t('pay.imp.doneText', { inserted: r.inserted, updated: r.updated, periods: r.periods.join(', ') })}
        onDone={(r) => { qc.invalidateQueries({ queryKey: ['payslip'] }); setSuggestPeriod(r.periods[0] ?? null) }}
        renderPreview={(p) => (
          <>
            <StatTiles items={[
              { label: t('pay.imp.rows'), value: p.totalRows },
              { label: t('pay.imp.unknown'), value: p.unknownEmployees, color: p.unknownEmployees ? '#D48806' : '#2E9E4F' },
              { label: t('pay.imp.errors'), value: p.errors.length, color: p.errors.length ? '#D92D20' : '#2E9E4F' },
            ]} />
            <IssueList title={t('pay.imp.errors')} type="error" items={p.errors} issueKey="pay.issue" />
            <IssueList title={t('pay.imp.warnings')} type="warning" items={p.warnings} issueKey="pay.issue" />
            <Typography.Paragraph type="secondary">{t('pay.imp.checkTotals')}</Typography.Paragraph>
            <Table<PayslipPeriodPreview> rowKey="period" size="small" pagination={false} columns={periodCols} dataSource={p.periods} style={{ marginBottom: 12 }} />
            <Table<PayslipSample> rowKey="excelRow" size="small" pagination={false} columns={sampleCols} dataSource={p.sample} />
          </>
        )}
      />
      {PERSON_PAY_SYNC && <PersonPaySuggest period={suggestPeriod} />}
      <Typography.Title level={5} style={{ marginTop: 24 }}>{t('pay.imp.existing')}</Typography.Title>
      <Table rowKey="period" size="small" loading={periods.isLoading} pagination={{ pageSize: 8, showSizeChanger: false }} dataSource={periods.data ?? []}
        columns={[{ title: t('cls.period'), dataIndex: 'period' }, { title: t('pay.imp.rows'), dataIndex: 'rows', align: 'right' }, { title: t('pay.imp.last'), dataIndex: 'lastImported', render: day }]} />
    </div>
  )
}
