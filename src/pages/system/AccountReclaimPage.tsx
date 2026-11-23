import { useState, type CSSProperties, type ReactNode } from 'react'
import { Alert, Avatar, Button, Card, DatePicker, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CloudServerOutlined, DesktopOutlined, FileExcelOutlined, ReloadOutlined, UserDeleteOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import {
  accountReclaim, reclaimError, type CmsReclaimRow, type ErpReclaimRow, type ReclaimPage, type ReclaimQuery, type ReclaimReason, type ReclaimSite, type ReclaimStatus, type Seasonal,
} from '../../api/accountReclaim'
import { PageBanner } from '../../components/PageBanner'
import { PageTabs, usePageTab } from '../../components/PageTabs'
import { FilterBar, FilterRow, PillFilter } from '../../components/FilterBar'
import { SearchBox } from '../../components/SearchBox'
import { useToast } from '../../hooks/useToast'

type Source = 'erp' | 'cms'
type AnyPage = ReclaimPage<ErpReclaimRow> | ReclaimPage<CmsReclaimRow>

/** Lỗi API đã tách mã (title của ProblemDetails) để hiện đúng thông báo: 409 erp_not_configured, 503 erp_unreachable, 400 invalid_input. */
class ReclaimFailure extends Error {
  constructor(readonly status: number, readonly code: string, readonly detail: string) { super(code || String(status)) }
}
const wrap = async <T,>(fn: () => Promise<T>): Promise<T> => {
  try { return await fn() } catch (e) { const r = await reclaimError(e); throw new ReclaimFailure(r.status, r.code, r.detail) }
}

/** Màu từng lý do: Tag (preset antd) và màu nhấn của thẻ tóm tắt. */
const REASON_STYLE: Record<ReclaimReason, { tag: string; tone: string }> = {
  erp_retired: { tag: 'red', tone: '#D92D20' },
  cms_quit: { tag: 'volcano', tone: '#E8590C' },
  cms_endwork_past: { tag: 'orange', tone: '#D48806' },
  no_employee: { tag: 'purple', tone: '#7A5AF8' },
  no_cms_match: { tag: 'default', tone: '#667085' },
  demo: { tag: 'blue', tone: '#2F6FB0' },
}
const REASONS: Record<Source, ReclaimReason[]> = {
  erp: ['erp_retired', 'cms_quit', 'cms_endwork_past', 'no_cms_match'],
  cms: ['erp_retired', 'cms_quit', 'cms_endwork_past', 'no_employee', 'demo'],
}

const day = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '')
const dash = (v: ReactNode) => (v === null || v === undefined || v === '' ? <span className="cell-muted">—</span> : v)

function ReasonTags({ reasons }: { reasons: ReclaimReason[] }) {
  const { t } = useTranslation()
  return <Space size={[4, 4]} wrap>{reasons.map((r) => <Tag key={r} color={REASON_STYLE[r]?.tag} variant="filled">{t(`acr.reason.${r}`, { defaultValue: r })}</Tag>)}</Space>
}

/** Thẻ tóm tắt theo `summary` (đếm trước khi lọc lý do): bấm một thẻ để lọc theo lý do đó, bấm lại / bấm "Tổng" để bỏ lọc. */
function SummaryTiles({ source, summary, reason, onPick }: { source: Source; summary?: Record<string, number>; reason: ReclaimReason | ''; onPick: (r: ReclaimReason | '') => void }) {
  const { t } = useTranslation()
  const tiles: { key: ReclaimReason | ''; label: string; tone: string }[] = [
    { key: '', label: t('acr.summary.total'), tone: '#475467' },
    ...REASONS[source].map((r) => ({ key: r, label: t(`acr.reason.${r}`), tone: REASON_STYLE[r].tone })),
  ]
  return (
    <div className="stat-grid">
      {tiles.map((x) => {
        const on = reason === x.key
        const style: CSSProperties = { ['--tile' as string]: x.tone, textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%', outline: on ? `2px solid ${x.tone}` : undefined, outlineOffset: on ? -2 : undefined } as CSSProperties
        return (
          <button key={x.key || 'total'} type="button" className="stat-tile" aria-pressed={on} style={style} onClick={() => onPick(on || x.key === '' ? '' : x.key)}>
            <div className="st-label" title={x.label}>{x.label}</div>
            <div><span className="st-value">{summary ? (summary[x.key || 'total'] ?? 0) : '—'}</span></div>
          </button>
        )
      })}
    </div>
  )
}

/** Một tab (ERP hoặc CMS): bộ lọc, thẻ tóm tắt, bảng phân trang phía server, xuất Excel. */
function ReclaimTab({ source, status }: { source: Source; status?: ReclaimStatus }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [site, setSite] = useState<ReclaimSite | ''>('')
  const [reason, setReason] = useState<ReclaimReason | ''>('')
  const [quitFrom, setQuitFrom] = useState<Dayjs | null>(null)
  const [search, setSearch] = useState('')
  const [seasonal, setSeasonal] = useState<Seasonal>('include')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [exporting, setExporting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const qc = useQueryClient()

  const erpOff = source === 'erp' && status?.erpConfigured === false
  const params: ReclaimQuery = { q: search, site, reason, quitFrom: quitFrom ? quitFrom.format('YYYY-MM-DD') : undefined, seasonal: source === 'cms' ? seasonal : undefined }
  const list = useQuery<AnyPage, ReclaimFailure>({
    queryKey: ['accountReclaim', source, params, page, pageSize],
    queryFn: () => wrap<AnyPage>(() => (source === 'erp' ? accountReclaim.erp({ ...params, page, pageSize }) : accountReclaim.cms({ ...params, page, pageSize }))),
    enabled: !erpOff,
    retry: false,
    placeholderData: (p) => p,
  })
  const err = list.error
  const notConfigured = erpOff || (source === 'erp' && err?.code === 'erp_not_configured')
  const unreachable = source === 'erp' && err?.code === 'erp_unreachable'
  const data = list.isError ? undefined : list.data
  const reset = () => setPage(1)

  /** Làm mới: gọi request hiện tại kèm refresh=true (máy chủ bỏ đệm, xoá đệm cả hai tab) rồi invalidate query của cả hai tab. */
  const doRefresh = async () => {
    setRefreshing(true)
    try { await (source === 'erp' ? accountReclaim.erp({ ...params, page, pageSize, refresh: true }) : accountReclaim.cms({ ...params, page, pageSize, refresh: true })) }
    catch { /* lỗi hiện qua lần tải lại của query bên dưới */ }
    finally {
      await Promise.all([qc.invalidateQueries({ queryKey: ['accountReclaim', 'erp'] }), qc.invalidateQueries({ queryKey: ['accountReclaim', 'cms'] })])
      setRefreshing(false)
    }
  }

  const doExport = async () => {
    setExporting(true)
    try { await accountReclaim.exportExcel(source, params) }
    catch (e) {
      const { code, detail } = await reclaimError(e)
      toast.error(code === 'invalid_input' && detail === 'too_many' ? t('acr.err.tooMany')
        : code === 'erp_not_configured' ? t('acr.erpNotConfigured')
          : code === 'erp_unreachable' ? t('acr.erpUnreachable') : t('acr.err.export'))
    }
    finally { setExporting(false) }
  }

  const daysCell = (n: number | null) => (n == null ? dash(null) : n < 0 ? <span className="cell-muted">{t('acr.daysAhead', { n: -n })}</span> : t('acr.days', { n }))
  const siteCell = (v: string) => (v ? <Tag variant="filled" color={v === 'BN' ? 'geekblue' : 'cyan'}>{v}</Tag> : dash(null))

  const erpColumns: ColumnsType<ErpReclaimRow> = [
    { title: t('acr.col.userId'), dataIndex: 'userId', width: 150, fixed: 'left', render: (_: unknown, r) => <div><b>{r.userId}</b>{r.userName && <div className="cell-muted">{r.userName}</div>}</div> },
    { title: t('acr.col.empId'), dataIndex: 'empId', width: 100, render: (v: string | null) => dash(v) },
    { title: t('acr.col.name'), width: 200, render: (_: unknown, r) => <div>{dash(r.empName ?? r.cmsName)}{r.erpDept && <div className="cell-muted">{r.erpDept}</div>}</div> },
    { title: t('acr.col.erpRetire'), dataIndex: 'erpRetireDate', width: 110, render: (v: string | null) => dash(day(v)) },
    { title: t('acr.col.cmsEmpId'), width: 130, render: (_: unknown, r) => (
      <div>{dash(r.cmsEmployeeId)}<div><Tag variant="outlined" color={r.match === 'manual' ? 'blue' : r.match === 'auto' ? 'green' : 'default'}>{t(`acr.match.${r.match}`, { defaultValue: r.match })}</Tag></div></div>
    ) },
    { title: t('acr.col.cmsStatus'), width: 160, render: (_: unknown, r) => <div>{dash(r.cmsStatusWorking)}{r.cmsDepartment && <div className="cell-muted">{r.cmsDepartment}</div>}</div> },
    { title: t('acr.col.cmsEndWork'), dataIndex: 'cmsEndWork', width: 110, render: (v: string | null) => dash(day(v)) },
    { title: t('acr.col.site'), dataIndex: 'site', width: 80, render: siteCell },
    { title: t('acr.col.quitDate'), dataIndex: 'quitDate', width: 110, render: (v: string | null) => dash(day(v)) },
    { title: t('acr.col.daysSinceQuit'), dataIndex: 'daysSinceQuit', width: 120, align: 'right', render: daysCell },
    { title: t('acr.col.reasons'), dataIndex: 'reasons', render: (v: ReclaimReason[]) => <ReasonTags reasons={v} /> },
  ]
  // erpRetireDate ở tab CMS backend luôn trả null nên không hiện cột này
  const cmsColumns: ColumnsType<CmsReclaimRow> = [
    { title: t('acr.col.userId'), dataIndex: 'userId', width: 130, fixed: 'left', render: (v: string) => <b>{v}</b> },
    { title: t('acr.col.employeeId'), dataIndex: 'employeeId', width: 150, render: (_: unknown, r) => (
      <Space size={4} wrap>{dash(r.employeeId)}{r.seasonal && <Tag color="gold" variant="filled">{t('acr.tag.seasonal')}</Tag>}{r.demo && <Tag color="blue" variant="filled">{t('acr.tag.demo')}</Tag>}</Space>
    ) },
    { title: t('acr.col.name'), dataIndex: 'fullName', width: 200, render: (v: string) => dash(v) },
    { title: t('acr.col.department'), dataIndex: 'department', width: 180, render: (v: string | null) => dash(v) },
    { title: t('acr.col.group'), dataIndex: 'groupName', width: 150, render: (v: string | null) => dash(v) },
    { title: t('acr.col.site'), dataIndex: 'site', width: 80, render: siteCell },
    { title: t('acr.col.cmsStatus'), dataIndex: 'statusWorking', width: 110, render: (v: string | null) => dash(v) },
    { title: t('acr.col.cmsEndWork'), dataIndex: 'endWork', width: 110, render: (v: string | null) => dash(day(v)) },
    { title: t('acr.col.reasons'), dataIndex: 'reasons', render: (v: ReclaimReason[]) => <ReasonTags reasons={v} /> },
  ]

  const pagination = { current: page, pageSize, total: data?.total ?? 0, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200, 500],
    onChange: (p: number, s: number) => { setPage(s !== pageSize ? 1 : p); setPageSize(s) } }
  const summary = data?.summary

  return (
    <>
      {source === 'erp' && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('acr.readOnlyErp')} />}
      {source === 'cms' && data && !data.erpChecked && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('acr.erpUnchecked')} />}
      {notConfigured ? <Alert type="warning" showIcon title={t('acr.erpNotConfigured')} /> : (
        <>
          <Card size="small" style={{ marginBottom: 12 }}>
            <FilterBar>
              <FilterRow label={t('acr.filter.site')}>
                <PillFilter<ReclaimSite | ''> value={site} onChange={(k) => { setSite(k); reset() }} options={[
                  { key: '', label: t('acr.filter.siteAll'), tone: '#475467' },
                  { key: 'BN', label: 'BN', count: summary?.BN, tone: '#2F6FB0' },
                  { key: 'HY', label: 'HY', count: summary?.HY, tone: '#0E9384' },
                ]} />
              </FilterRow>
              {source === 'cms' && (
                <FilterRow label={t('acr.filter.seasonal')}>
                  <PillFilter<Seasonal> value={seasonal} onChange={(k) => { setSeasonal(k); reset() }} options={[
                    { key: 'include', label: t('acr.seasonal.include'), tone: '#475467' },
                    { key: 'exclude', label: t('acr.seasonal.exclude'), tone: '#2E9E4F' },
                    { key: 'only', label: t('acr.seasonal.only'), count: summary?.seasonal, tone: '#D48806' },
                  ]} />
                </FilterRow>
              )}
              <FilterRow kind="find">
                <DatePicker format="DD/MM/YYYY" placeholder={t('acr.filter.quitFrom')} value={quitFrom} onChange={(v) => { setQuitFrom(v); reset() }} />
                <SearchBox allowClear style={{ width: 300 }} placeholder={t('acr.filter.search')} onSearch={(v) => { setSearch(v); reset() }} />
                <Button icon={<ReloadOutlined />} onClick={doRefresh} loading={refreshing} disabled={list.isFetching && !refreshing}>{t('acr.refresh')}</Button>
                <Button icon={<FileExcelOutlined />} onClick={doExport} loading={exporting} disabled={!data?.total}>{t('acr.export')}</Button>
              </FilterRow>
            </FilterBar>
          </Card>
          <SummaryTiles source={source} summary={summary} reason={reason} onPick={(r) => { setReason(r); reset() }} />
          {unreachable && <Alert type="error" showIcon title={t('acr.erpUnreachable')} />}
          {err && !unreachable && (
            <Alert type="error" showIcon style={{ marginBottom: 12 }}
              title={err.code === 'invalid_input' ? t('acr.err.invalid', { d: err.detail }) : t('acr.err.load')}
              action={<Button size="small" onClick={() => list.refetch()}>{t('acr.refresh')}</Button>} />
          )}
          {!unreachable && (
            <Card size="small"
              title={data ? t('acr.found', { count: data.total }) : source === 'erp' ? t('acr.tabErp') : t('acr.tabCms')}
              extra={data && <span className="cell-muted">{t('acr.generatedAt', { at: dayjs(data.generatedAt).format('DD/MM/YYYY HH:mm') })}</span>}>
              {source === 'erp' ? (
                <Table<ErpReclaimRow> size="small" rowKey="userSeq" loading={list.isFetching} columns={erpColumns} scroll={{ x: 1500 }}
                  dataSource={(data?.rows ?? []) as ErpReclaimRow[]} pagination={pagination} />
              ) : (
                <Table<CmsReclaimRow> size="small" rowKey="id" loading={list.isFetching} columns={cmsColumns} scroll={{ x: 1300 }}
                  dataSource={(data?.rows ?? []) as CmsReclaimRow[]} pagination={pagination} />
              )}
            </Card>
          )}
        </>
      )}
    </>
  )
}

/** Thu hồi tài khoản người đã nghỉ việc: tài khoản ERP (chỉ đọc) và CMS còn mở, chỉ xem + xuất Excel. Trang quản trị cấp được (khoá accountReclaim). */
export default function AccountReclaimPage() {
  const { t } = useTranslation()
  const tabs = [
    { key: 'erp', label: t('acr.tabErp'), icon: <CloudServerOutlined /> },
    { key: 'cms', label: t('acr.tabCms'), icon: <DesktopOutlined /> },
  ]
  const [tab, setTab] = usePageTab(tabs)
  const status = useQuery({ queryKey: ['accountReclaim', 'status'], queryFn: accountReclaim.status, staleTime: 300_000, retry: false })
  const qs = status.data?.quitSync

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<UserDeleteOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.accountReclaim')} subtitle={t('nav.accountReclaimDesc')} />
      <PageTabs items={tabs} active={tab} onChange={setTab} />
      {status.isError && <Alert type="error" showIcon style={{ margin: '12px 0' }} title={t('acr.err.load')}
        action={<Button size="small" onClick={() => status.refetch()}>{t('acr.refresh')}</Button>} />}
      {qs && (
        <div className="cell-muted" style={{ margin: '12px 0' }}>
          {qs.enabled ? t('acr.quitSyncNote', { runAt: qs.runAt, max: qs.maxAuto }) : t('acr.quitSyncOff')}
        </div>
      )}
      {status.isLoading && <Card size="small" loading style={{ marginTop: 12 }} />}
      {/* /status lỗi vẫn cho xem: tab ERP khi đó dựa vào mã lỗi 409 / 503 của chính /erp */}
      {!status.isLoading && (tab === 'erp' ? <ReclaimTab key="erp" source="erp" status={status.data} /> : <ReclaimTab key="cms" source="cms" status={status.data} />)}
    </div>
  )
}
