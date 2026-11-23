import { useState } from 'react'
import { Alert, App, Button, Card, Checkbox, Dropdown, Space, TreeSelect } from 'antd'
import { FilterTable as Table } from '../../components/DataTable'
import type { ColumnsType } from 'antd/es/table'
import { DownOutlined, FileExcelOutlined, LockOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { EXPORT_COLS, recruit, recruitApplicantsExport, recruitHiresExport, recruitOnboardedExport, recruitSummary, recruitSummaryExport, type ExportScope, type RecruitSummaryRow } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { batchTreeData } from './RecruitBatchTree'
import { isOfferViewer, isSalaryViewer } from './RecruitCommon'

const dm = (v: string | null) => (v ? dayjs(v).format('DD/MM') : '')
const rate = (v: number | null, a: number, b: number) => (v == null ? '—' : `${v}% (${a}/${b})`)

/** Nhớ cột đã chọn lần xuất gần nhất (theo trình duyệt), chỉ giữ những cột còn tồn tại. */
const savedCols = (key: string, all: string[]) => {
  try {
    const v = JSON.parse(localStorage.getItem(`recruit.export.cols.${key}`) ?? 'null') as string[] | null
    const ok = v?.filter((c) => all.includes(c)) ?? []
    return ok.length > 0 ? ok : all
  } catch { return all }
}

/** Nút xuất Excel 7.1 / 7.2 / 7.3 theo cùng phạm vi (khoảng ngày, đợt, hoặc các hồ sơ đã chọn). Danh sách ứng viên và người nhận việc cho HR chọn cột, lần sau nhớ lựa chọn. Mục lương / offer chỉ hiện với người có quyền. */
export function RecruitExportMenu({ scope, summary = true, size }: { scope: ExportScope; summary?: boolean; size?: 'small' | 'middle' }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState<{ key: string; title: string; all: string[]; go: (cols: string[]) => Promise<void> } | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    try { await f() } catch (e) { const { detail, code } = adminError(e); message.error(t(`rec.err.${detail || code}`, { defaultValue: t('rdb.exportErr') })) } finally { setBusy(false) }
  }
  const choose = (key: string, title: string, all: string[], go: (cols: string[]) => Promise<void>) => { setPicked(savedCols(key, all)); setPicker({ key, title, all, go }) }
  const apps = EXPORT_COLS.applicants
  const onb = EXPORT_COLS.onboarded
  const items = [
    ...(summary ? [{ key: 'sum', label: t('rec.ex.summary'), onClick: () => run(() => recruitSummaryExport(scope)) }] : []),
    { key: 'apps', label: t('rec.ex.applicants'), onClick: () => choose('apps', t('rec.ex.applicants'), apps, (c) => recruitApplicantsExport(scope, false, c)) },
    ...(isSalaryViewer(user) ? [{ key: 'appsSal', icon: <LockOutlined />, label: t('rec.ex.applicantsSalary'), onClick: () => choose('appsSal', t('rec.ex.applicantsSalary'), [...apps, ...EXPORT_COLS.applicantsSalary], (c) => recruitApplicantsExport(scope, true, c)) }] : []),
    ...(!scope.ids?.length ? [{ key: 'onb', label: t('rec.ex.onboarded'), onClick: () => choose('onb', t('rec.ex.onboarded'), [...onb, ...EXPORT_COLS.onboardedDate], (c) => recruitOnboardedExport(scope, 'base', c)) }] : []),
    ...(isSalaryViewer(user) && !scope.ids?.length ? [{ key: 'onbSal', icon: <LockOutlined />, label: t('rec.ex.onboardedSalary'), onClick: () => choose('onbSal', t('rec.ex.onboardedSalary'), [...onb, ...EXPORT_COLS.onboardedSalary, ...EXPORT_COLS.onboardedDate], (c) => recruitOnboardedExport(scope, 'salary', c)) }] : []),
    ...(isOfferViewer(user) && !scope.ids?.length ? [{ key: 'onbOff', icon: <LockOutlined />, label: t('rec.ex.onboardedOffer'), onClick: () => choose('onbOff', t('rec.ex.onboardedOffer'), [...onb, ...EXPORT_COLS.onboardedOffer, ...EXPORT_COLS.onboardedDate], (c) => recruitOnboardedExport(scope, 'offer', c)) }] : []),
    ...(isOfferViewer(user) && !scope.ids?.length ? [{ key: 'hires', icon: <LockOutlined />, label: t('rec.ex.hires'), onClick: () => choose('hires', t('rec.ex.hires'), EXPORT_COLS.hires, (c) => recruitHiresExport(scope, c)) }] : []),
  ]
  return (
    <>
      <Dropdown trigger={['click']} menu={{ items }}>
        <Button size={size} icon={<FileExcelOutlined />} loading={busy}>{t('rec.ex.btn')} <DownOutlined /></Button>
      </Dropdown>
      <AppModal open={picker !== null} onClose={() => setPicker(null)} size="md" icon={<FileExcelOutlined />} title={picker?.title ?? ''} subtitle={t('rec.ex.pickHint', { defaultValue: 'Chọn các cột cần xuất. Lần sau hệ thống nhớ lựa chọn này.' })}
        okText={t('rec.ex.btn')} okDisabled={picked.length === 0} okLoading={busy}
        onOk={() => {
          if (!picker) return
          try { localStorage.setItem(`recruit.export.cols.${picker.key}`, JSON.stringify(picked)) } catch { /* không lưu được thì bỏ qua */ }
          const cols = picker.all.filter((c) => picked.includes(c))
          void run(() => picker.go(cols)).then(() => setPicker(null))
        }}>
        <Space style={{ marginBottom: 10 }}>
          <Button size="small" onClick={() => setPicked(picker?.all ?? [])}>{t('rec.ex.pickAll', { defaultValue: 'Chọn tất cả' })}</Button>
          <Button size="small" onClick={() => setPicked([])}>{t('rec.ex.pickNone', { defaultValue: 'Bỏ chọn hết' })}</Button>
          <span className="cell-muted">{picked.length}/{picker?.all.length ?? 0}</span>
        </Space>
        <Checkbox.Group value={picked} onChange={(v) => setPicked(v as string[])} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6 }}
          options={(picker?.all ?? []).map((c) => ({ value: c, label: c }))} />
      </AppModal>
    </>
  )
}

/** Báo cáo tổng thể (7.1) trên Dashboard: 13 chỉ số theo bộ phận + vị trí, lọc theo đợt; xuất Excel cùng phạm vi. */
export function RecruitSummaryCard({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation()
  const [batch, setBatch] = useState<number | null>(null)
  const lookups = useQuery({ queryKey: ['recruit', 'lookups'], queryFn: recruit.lookups, staleTime: 5 * 60_000, retry: false })
  const batchesQ = useQuery({ queryKey: ['recruit', 'batches'], queryFn: recruit.batches, enabled: !!lookups.data?.batches, retry: false })
  const q = useQuery({ queryKey: ['recruit', 'summary', from, to, batch], queryFn: () => recruitSummary(from, to, batch), staleTime: 60_000, retry: false })
  const s = q.data
  const cols: ColumnsType<RecruitSummaryRow> = [
    { title: t('rec.department'), dataIndex: 'department', width: 160, fixed: 'left', render: (v: string | null, r) => (r === s?.total ? <b>{t('rec.sm.total')}</b> : v ?? '—') },
    { title: t('rec.position'), dataIndex: 'position', width: 180, render: (v: string, r) => (r === s?.total ? '' : v) },
    { title: t('rec.sm.applied'), dataIndex: 'applied', width: 90, align: 'right' },
    { title: t('rec.sm.invited'), dataIndex: 'invited', width: 80, align: 'right' },
    { title: t('rec.sm.attend1'), dataIndex: 'attend1', width: 80, align: 'right' },
    { title: t('rec.sm.pass1'), dataIndex: 'pass1', width: 80, align: 'right' },
    { title: t('rec.sm.attend2'), dataIndex: 'attend2', width: 80, align: 'right' },
    { title: t('rec.sm.pass2'), dataIndex: 'pass2', width: 80, align: 'right' },
    { title: t('rec.sm.hired'), dataIndex: 'hired', width: 90, align: 'right', render: (v: number) => <b>{v}</b> },
    { title: t('rec.sm.onboard'), width: 120, render: (_: unknown, r) => (r.onboardFrom ? (r.onboardFrom === r.onboardTo ? dm(r.onboardFrom) : `${dm(r.onboardFrom)} – ${dm(r.onboardTo)}`) : '—') },
    { title: t('rec.sm.onTime'), width: 120, render: (_: unknown, r) => rate(r.onTimeRate, r.onTime, r.tracked) },
    { title: t('rec.sm.leftEarly'), width: 130, render: (_: unknown, r) => rate(r.leftEarlyRate, r.leftEarly, r.arrived) },
  ]
  return (
    <Card size="small" title={t('rec.sm.title')} style={{ marginTop: 12 }}
      extra={(
        <Space wrap>
          {lookups.data?.batches && (
            <TreeSelect allowClear showSearch treeNodeFilterProp="title" style={{ width: 260 }} placeholder={t('rec.sm.allBatches')} value={batch ?? undefined}
              onChange={(v) => setBatch(v ?? null)} treeData={[...batchTreeData(batchesQ.data ?? [], t), { value: -1, title: t('rec.bt.none'), children: [] }]} treeDefaultExpandAll={false} />
          )}
          <RecruitExportMenu scope={{ from, to, batch }} />
        </Space>
      )}>
      {s && !s.tracking && <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('rec.sm.noTracking')} />}
      <Table<RecruitSummaryRow> size="small" rowKey={(r) => `${r.department ?? ''}|${r.position}`} columns={cols} loading={q.isLoading}
        dataSource={s ? [...s.rows, ...(s.rows.length > 1 ? [s.total] : [])] : []} pagination={{ pageSize: 30, hideOnSinglePage: true }} scroll={{ x: 1300 }}
        locale={{ emptyText: q.isError ? t('usr.err.generic') : t('rdb.empty') }} />
      <p className="cell-muted" style={{ marginTop: 8, marginBottom: 0 }}>{t('rec.sm.hint')}</p>
    </Card>
  )
}
