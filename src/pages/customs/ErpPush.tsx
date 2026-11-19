import { useState } from 'react'
import { Alert, Button, Switch, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, CloudUploadOutlined, ExclamationCircleOutlined, ExperimentOutlined, SyncOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { customsErp, customsError, type CustomsSyncStatus, type ErpPushDeclaration, type ErpPushInput, type ErpPushResult, type ErpSavedItem } from '../../api/customs'
import { useAuth } from '../../auth/AuthContext'
import { AppModal } from '../../components/AppModal'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

type Target = Omit<ErpPushInput, 'dryRun'>

/** Người được chạy thử / đẩy tờ khai sang ERP: quản trị hoặc được cấp riêng trang "customsErpPush". */
function useCanPushErp() {
  const { user } = useAuth()
  return !!(user?.isAdmin || user?.grantedPages?.includes('customsErpPush'))
}

const num = (v: number | null | undefined, lang: string, digits = 2) => (v == null ? '' : v.toLocaleString(lang, { maximumFractionDigits: digits }))

/** Mô tả ngắn đối tượng đẩy: "Tờ khai xuất 3091…" hoặc "Tờ khai nhập 01/11 – 17/11/2026". */
function useTargetLabel(target: Target | null) {
  const { t } = useTranslation()
  if (!target) return ''
  const kind = t(target.kind === 'import' ? 'cus.erp.kindImport' : 'cus.erp.kindExport')
  return target.soToKhai ? `${kind} ${target.soToKhai}` : `${kind} ${dayjs(target.from).format('DD/MM')} – ${dayjs(target.to).format('DD/MM/YYYY')}`
}

function StatusTag({ status }: { status: string | null }) {
  const { t } = useTranslation()
  const s = status ?? ''
  if (s.startsWith('OK - COMMITTED')) return <Tag color="success" variant="filled">{t('cus.erp.committed')}</Tag>
  if (s.startsWith('OK')) return <Tag color="processing" variant="filled">{t('cus.erp.rolledBack')}</Tag>
  if (s === 'SKIPPED') return <Tag color="warning" variant="filled">{t('cus.erp.review')}</Tag>
  return <Tag color="error" variant="filled">{t('cus.erp.failed')}</Tag>
}

/**
 * Kết quả chạy thử / đẩy: ô tổng hợp, bảng mỗi tờ khai một dòng (mở rộng xem dòng hàng đã ghép mã ERP).
 * Sau khi chạy thử có tờ khai OK và cấu hình cho phép ghi thật: chân modal có nút "Đẩy thật" để đi tiếp mà không phải bấm lại từ đầu.
 */
function ResultModal({ result, target, allowCommit, onClose, onCommit, subtitle }: { result: ErpPushResult | null; target: Target | null; allowCommit: boolean; onClose: () => void; onCommit: () => void; subtitle?: string }) {
  const { t, i18n } = useTranslation()
  const label = useTargetLabel(target)
  const n = (v: number | null | undefined, d?: number) => num(v, i18n.language, d)
  const columns: ColumnsType<ErpPushDeclaration> = [
    { title: t('cus.number'), dataIndex: 'soToKhai', width: 140, render: (v: string | null) => <b>{v ?? '—'}</b> },
    { title: t('cus.erp.status'), dataIndex: 'status', width: 130, render: (v: string | null) => <StatusTag status={v} /> },
    { title: 'Permit No', dataIndex: 'permitNo', width: 130, render: (v: string | null) => v ?? <span className="cell-muted">—</span> },
    { title: t('cus.erp.lines'), dataIndex: 'lines', width: 64, align: 'right' },
    { title: t('cus.erp.foreign'), dataIndex: 'totalForeign', width: 110, align: 'right', render: (v: number | null) => n(v) },
    { title: 'VND', dataIndex: 'totalVnd', width: 140, align: 'right', render: (v: number | null) => n(v, 0) },
    { title: t('cus.erp.exRate'), dataIndex: 'exRate', width: 90, align: 'right', render: (v: number | null) => n(v) },
    { title: t('cus.erp.messages'), render: (_: unknown, r) => (r.messages.length
      ? <ul className="cus-msgs">{r.messages.map((m, i) => <li key={i} className={r.status?.startsWith('OK') ? 'note' : 'err'}>{m}</li>)}</ul>
      : <span className="cell-muted">—</span>) },
  ]
  const pct = (v: number | null) => (v == null ? <span className="cell-muted">—</span> : `${n(v, 4)}%`)
  const code = (v: string | null) => v || <span className="cell-muted">—</span>
  /** Dòng hàng đã lưu ở ERP: cột chính + ĐVT 2 + nhóm "Mã biểu thuế" (Dummy 1, 2, 3, 6) + nhóm "Thuế suất" (Dummy 7, 8, 9, 10). */
  const itemCols: ColumnsType<ErpSavedItem> = [
    { title: '#', dataIndex: 'permitSerl', width: 44, fixed: 'left' },
    { title: t('cus.erp.ecusItem'), dataIndex: 'dummy5', width: 120, render: code },
    { title: t('cus.erp.erpItem'), width: 260, render: (_: unknown, r) => <div><b>{r.itemNo}</b> {r.itemName}{r.remark && <div className="cell-muted">{r.remark}</div>}</div> },
    { title: t('cus.qty'), dataIndex: 'qty', width: 90, align: 'right', render: (v: number | null) => n(v, 6) },
    { title: t('cus.unitPrice'), dataIndex: 'price', width: 90, align: 'right', render: (v: number | null) => n(v, 6) },
    { title: t('cus.erp.foreign'), dataIndex: 'curAmt', width: 110, align: 'right', render: (v: number | null) => n(v) },
    { title: 'VND', dataIndex: 'domAmt', width: 130, align: 'right', render: (v: number | null) => n(v, 0) },
    { title: t('cus.erp.unit2'), width: 110, align: 'right', render: (_: unknown, r) => (r.qty2 ? `${n(r.qty2, 6)} ${r.dummy4 ?? ''}` : code(r.dummy4)) },
    { title: t('cus.erp.taxCodes'), children: [
      { title: t('cus.erp.excise'), dataIndex: 'dummy1', width: 76, render: code },
      { title: t('cus.erp.env'), dataIndex: 'dummy2', width: 76, render: code },
      { title: 'VAT', dataIndex: 'dummy3', width: 76, render: code },
      { title: t('cus.erp.import'), dataIndex: 'dummy6', width: 76, render: code },
    ] },
    { title: t('cus.erp.taxRates'), children: [
      { title: t('cus.erp.excise'), dataIndex: 'dummy7', width: 80, align: 'right', render: pct },
      { title: t('cus.erp.env'), dataIndex: 'dummy8', width: 80, align: 'right', render: pct },
      { title: 'VAT', dataIndex: 'dummy9', width: 80, align: 'right', render: pct },
      { title: t('cus.erp.import'), dataIndex: 'dummy10', width: 80, align: 'right', render: pct },
    ] },
  ]
  const canCommit = !!result?.dryRun && result.ok > 0 && allowCommit
  return (
    <AppModal open={!!result} onClose={onClose} size="xl"
      icon={result?.dryRun ? <ExperimentOutlined /> : <CloudUploadOutlined />}
      title={result?.dryRun ? t('cus.erp.resultDry') : t('cus.erp.resultCommit')}
      subtitle={subtitle ?? label}
      footer={result && (
        <>
          <div className="am-extra">{canCommit && result.error > 0 && <span className="cell-muted">{t('cus.erp.commitOnlyOk', { ok: result.ok, error: result.error })}</span>}</div>
          <div className="am-actions">
            <Button onClick={onClose}>{t('cus.erp.close')}</Button>
            {canCommit && <Button type="primary" danger icon={<CloudUploadOutlined />} onClick={onCommit}>{t('cus.erp.commitNow')}</Button>}
          </div>
        </>
      )}>
      {result && (
        <>
          <StatTiles items={[
            { label: t('cus.erp.database'), value: result.database ?? '—' },
            { label: t('cus.erp.total'), value: result.total, color: '#2F6FB0' },
            { label: result.dryRun ? t('cus.erp.okDry') : t('cus.erp.okCommit'), value: result.ok, color: '#2E9E4F' },
            { label: t('cus.erp.failed'), value: result.error, color: result.error ? '#D92D20' : undefined },
          ]} />
          <Alert type={result.dryRun ? 'info' : 'success'} showIcon style={{ margin: '12px 0' }} title={result.dryRun ? t('cus.erp.dryNote') : t('cus.erp.commitNote')} />
          <Table<ErpPushDeclaration> size="small" rowKey={(r) => `${r.idx}|${r.soToKhai}`} columns={columns} dataSource={result.results} scroll={{ x: 1000 }}
            pagination={result.results.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
            expandable={{ rowExpandable: (r) => r.items.length > 0, expandedRowRender: (r) => <Table<ErpSavedItem> size="small" rowKey={(i) => String(i.permitSerl)} columns={itemCols} dataSource={r.items} pagination={false} scroll={{ x: 1500 }} bordered /> }} />
        </>
      )}
    </AppModal>
  )
}

/** Xác nhận ghi thật: nói rõ ghi vào DB nào, đối tượng nào, không tự xoá được; nhắc chạy thử trước nếu chưa chạy. */
function ConfirmModal({ open, target, database, tested, loading, onClose, onOk }: { open: boolean; target: Target | null; database: string | null; tested: boolean; loading: boolean; onClose: () => void; onOk: () => void }) {
  const { t } = useTranslation()
  const label = useTargetLabel(target)
  return (
    <AppModal open={open} onClose={onClose} size="sm" icon={<ExclamationCircleOutlined />} title={t('cus.erp.confirmTitle')} subtitle={label}
      onOk={onOk} okText={t('cus.erp.commit')} okLoading={loading} danger cancelText={t('cus.erp.cancel')}>
      <div className="rec-info">
        <div><label>{t('cus.erp.database')}</label><span><b>{database ?? '—'}</b></span></div>
        <div><label>{t('cus.erp.target')}</label><span>{label}</span></div>
      </div>
      <Alert type="warning" showIcon style={{ marginTop: 14 }} title={t('cus.erp.confirmText', { db: database ?? '' })} />
      {tested
        ? <div className="cus-tested"><CheckCircleOutlined /> {t('cus.erp.testedOk')}</div>
        : <div className="cus-tested warn"><ExclamationCircleOutlined /> {t('cus.erp.notTested')}</div>}
    </AppModal>
  )
}

/**
 * Hai nút "Chạy thử sang ERP" (lưu rồi rollback, không đổi dữ liệu) và "Đẩy sang ERP" (ghi thật, có modal xác nhận; chỉ hiện khi cấu hình cho phép).
 * target: một tờ khai (soToKhai) hoặc một khoảng ngày của một chiều nhập / xuất. disabledReason: lý do không bấm được (hiện ở tooltip).
 * onCommitted: gọi sau khi đẩy thật xong (không gọi khi chạy thử).
 */
export function ErpPushButtons({ target, disabledReason, size, onCommitted }: { target: Target | null; disabledReason?: string | null; size?: 'small' | 'middle'; onCommitted?: (r: ErpPushResult) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const can = useCanPushErp()
  const health = useQuery({ queryKey: ['customs-erp', 'health'], queryFn: customsErp.health, enabled: can, staleTime: 60_000, retry: false })
  const [result, setResult] = useState<ErpPushResult | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [testedKey, setTestedKey] = useState<string | null>(null)
  const key = target ? JSON.stringify(target) : ''
  const run = useMutation({
    mutationFn: (dryRun: boolean) => customsErp.push({ ...target!, dryRun }),
    onSuccess: (r) => {
      setConfirm(false)
      setResult(r)
      if (r.dryRun && r.ok > 0) setTestedKey(key)
      if (!r.dryRun) toast[r.error ? 'warning' : 'success'](t('cus.erp.doneToast', { ok: r.ok, total: r.total }))
      if (!r.dryRun) onCommitted?.(r)   // ghi thật xong: nơi gọi (vd. màn Đối soát) tải lại số liệu
    },
    onError: async (e) => {
      const { code, detail } = await customsError(e)
      toast.error(code === 'erp_db_mismatch' && detail ? { title: t('cus.erp.err.erp_db_mismatch'), description: detail }
        : code === 'too_many' ? t('cus.erp.err.too_many', { count: Number(detail) || 0 })
        : { title: t(`cus.erp.err.${code}`, { defaultValue: t('cus.erp.err.generic') }), description: code === 'invalid_input' ? detail : undefined })
    },
  })
  if (!can) return null
  const h = health.data
  const reason = disabledReason ?? (!target ? t('cus.erp.noTarget') : !h ? null : !h.configured ? t('cus.erp.notConfigured') : !h.reachable ? t('cus.erp.err.erp_unavailable')
    : !h.ecusConfigured ? t('cus.notConfigured') : h.status && h.status !== 'ok' ? t('cus.erp.dbMismatch', { db: h.database, expected: h.expectedDatabase }) : null)
  const disabled = !!reason || health.isLoading
  return (
    <>
      <Tooltip title={reason ?? (h?.database ? t('cus.erp.dryHint', { db: h.database }) : undefined)}>
        <Button size={size} icon={<ExperimentOutlined />} disabled={disabled} loading={run.isPending && run.variables === true} onClick={() => run.mutate(true)}>{t('cus.erp.dryRun')}</Button>
      </Tooltip>
      {h?.allowCommit && (
        <Tooltip title={reason ?? undefined}>
          <Button size={size} type="primary" danger icon={<CloudUploadOutlined />} disabled={disabled} onClick={() => setConfirm(true)}>{t('cus.erp.commit')}</Button>
        </Tooltip>
      )}
      <ResultModal result={result} target={target} allowCommit={!!h?.allowCommit} onClose={() => setResult(null)} onCommit={() => { setResult(null); setConfirm(true) }} />
      <ConfirmModal open={confirm} target={target} database={h?.database ?? null} tested={testedKey === key} loading={run.isPending && run.variables === false}
        onClose={() => setConfirm(false)} onOk={() => run.mutate(false)} />
    </>
  )
}


/** Giờ do máy chủ trả là giờ Việt Nam trên đồng hồ: bỏ "Z" (nếu có) để trình duyệt không đổi múi giờ lần nữa. */
const when = (iso: string | null | undefined, lang: string) => (iso ? new Date(iso.replace(/Z$/, '')).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' }) : '')

/**
 * Thanh "Đồng bộ tự động lên ERP": lịch chạy (CustomsSync), kết quả lần chạy gần nhất (tạo mới / lỗi / cần xem lại / đã có sẵn / chờ lượt sau),
 * xem danh sách tờ khai đã xử lý và nút "Chạy ngay" (chạy nền, cùng cách làm như job lúc 01:00). CHỈ quản trị thấy (API cũng chặn người khác).
 */
export function ErpSyncPanel() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()
  const can = !!user?.isAdmin   // chỉ quản trị thấy và dùng thanh đồng bộ tự động
  const [view, setView] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [confirmOn, setConfirmOn] = useState(false)
  const status = useQuery({
    queryKey: ['customs-erp', 'sync'], queryFn: customsErp.syncStatus, enabled: can, retry: false,
    refetchInterval: (q) => (q.state.data?.running ? 3000 : 60_000),
  })
  const health = useQuery({ queryKey: ['customs-erp', 'health'], queryFn: customsErp.health, enabled: can, staleTime: 60_000, retry: false })
  const run = useMutation({
    mutationFn: customsErp.syncRun,
    onSuccess: () => { setConfirm(false); toast.success(t('cus.erp.sync.started')); void status.refetch() },
    onError: async (e) => {
      setConfirm(false)
      const { code, detail } = await customsError(e)
      toast.error(code === 'sync_running' ? t('cus.erp.sync.alreadyRunning') : { title: t(`cus.erp.err.${code}`, { defaultValue: t('cus.erp.err.generic') }), description: code === 'invalid_input' ? detail : undefined })
    },
  })
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => customsErp.syncSetEnabled(enabled),
    onSuccess: (r) => { setConfirmOn(false); toast.success(t(r.enabled ? 'cus.erp.sync.enabledToast' : 'cus.erp.sync.disabledToast')); void status.refetch() },
    onError: async (e) => {
      setConfirmOn(false)
      const { code, detail } = await customsError(e)
      toast.error({ title: t(`cus.erp.err.${code}`, { defaultValue: t('cus.erp.err.generic') }), description: code === 'invalid_input' ? detail : undefined })
    },
  })
  if (!can || !status.data) return null
  const s: CustomsSyncStatus = status.data
  const last = s.last
  const kinds = s.kinds.map((k) => t(k.toUpperCase() === 'N' ? 'cus.erp.sync.kindN' : 'cus.erp.sync.kindX')).join(' + ')
  const sum = (f: (k: CustomsSyncStatus['last'] extends infer L ? (L extends { kinds: (infer K)[] } ? K : never) : never) => number) => (last ? last.kinds.reduce((a, k) => a + f(k), 0) : 0)
  const resultForModal: ErpPushResult | null = view && last ? {
    dryRun: false, database: last.database, total: last.items.length, ok: last.created, error: last.failed + last.needsReview, results: last.items,
  } : null
  const chip = (label: string, value: number, color: string) => <Tag key={label} color={value ? color : 'default'} variant="filled">{label}: <b>{value}</b></Tag>
  return (
    <div className="cus-sync">
      <div className="cs-head">
        <span className="cs-icon"><SyncOutlined spin={s.running} /></span>
        <div className="cs-main">
          <div className="cs-title">
            {t('cus.erp.sync.title')}
            <Tooltip title={s.switchBy ? t('cus.erp.sync.switchedBy', { by: s.switchBy, at: when(s.switchAt, i18n.language) }) : t('cus.erp.sync.byConfig')}>
              <span className="cs-switch"><Switch size="small" checked={s.enabled} loading={toggle.isPending} onChange={(v) => (v ? setConfirmOn(true) : toggle.mutate(false))} /><span className={s.enabled ? 'cs-on' : 'cs-off'}>{s.enabled ? t('cus.erp.sync.on') : t('cus.erp.sync.off')}</span></span>
            </Tooltip>
            {s.running && <Tag color="processing" variant="filled">{t('cus.erp.sync.running')}</Tag>}
          </div>
          <div className="cs-sub">{t('cus.erp.sync.schedule', { time: s.runAt, from: dayjs(s.fromDate).format('DD/MM/YYYY'), kinds })}{s.nextRun && ` · ${t('cus.erp.sync.next')}: ${when(s.nextRun, i18n.language)}`}</div>
        </div>
        <div className="cs-actions">
          <Button size="small" disabled={!last?.items.length} onClick={() => setView(true)}>{t('cus.erp.sync.view')}</Button>
          <Tooltip title={!s.allowCommit ? t('cus.erp.sync.needCommit') : undefined}>
            <Button size="small" type="primary" icon={<SyncOutlined />} disabled={!s.allowCommit || s.running} loading={run.isPending} onClick={() => setConfirm(true)}>{t('cus.erp.sync.runNow')}</Button>
          </Tooltip>
        </div>
      </div>
      <div className="cs-last">
        {!last ? <span className="cell-muted">{t('cus.erp.sync.never')}</span> : last.skippedReason ? (
          <Alert type="warning" showIcon style={{ padding: '4px 10px' }} title={`${when(last.startedAt, i18n.language)}: ${t(`cus.erp.sync.skip.${last.skippedReason}`, { defaultValue: last.skippedReason, db: last.database ?? '' })}`} />
        ) : (
          <>
            <span className="cs-when">{t('cus.erp.sync.last')} {when(last.startedAt, i18n.language)} · {t(last.manual ? 'cus.erp.sync.manual' : 'cus.erp.sync.auto')}</span>
            {chip(t('cus.erp.sync.created'), last.created, 'success')}
            {chip(t('cus.erp.sync.failed'), last.failed, 'error')}
            {chip(t('cus.erp.review'), last.needsReview, 'warning')}
            {chip(t('cus.erp.sync.already'), sum((k) => k.alreadyInErp), 'default')}
            {chip(t('cus.erp.sync.pending'), sum((k) => k.pending), 'processing')}
          </>
        )}
      </div>
      <ResultModal result={resultForModal} target={null} allowCommit={false} onClose={() => setView(false)} onCommit={() => undefined}
        subtitle={last ? `${t(last.manual ? 'cus.erp.sync.manual' : 'cus.erp.sync.auto')} · ${when(last.startedAt, i18n.language)}` : undefined} />
      <AppModal open={confirmOn} onClose={() => setConfirmOn(false)} size="sm" icon={<SyncOutlined />} title={t('cus.erp.sync.enableTitle')}
        subtitle={t('cus.erp.sync.schedule', { time: s.runAt, from: dayjs(s.fromDate).format('DD/MM/YYYY'), kinds })}
        onOk={() => toggle.mutate(true)} okText={t('cus.erp.sync.on')} okLoading={toggle.isPending} cancelText={t('cus.erp.cancel')}>
        <Alert type="warning" showIcon title={t('cus.erp.sync.enableText', { db: health.data?.database ?? '', max: s.maxPerRun })} />
        {!s.allowTemp && <div className="cus-tested warn"><ExclamationCircleOutlined /> {t('cus.erp.sync.noTemp')}</div>}
      </AppModal>
      <AppModal open={confirm} onClose={() => setConfirm(false)} size="sm" icon={<ExclamationCircleOutlined />} title={t('cus.erp.sync.confirmTitle')}
        subtitle={t('cus.erp.sync.schedule', { time: s.runAt, from: dayjs(s.fromDate).format('DD/MM/YYYY'), kinds })}
        onOk={() => run.mutate()} okText={t('cus.erp.sync.runNow')} okLoading={run.isPending} danger cancelText={t('cus.erp.cancel')}>
        <Alert type="warning" showIcon title={t('cus.erp.sync.confirmText', { db: health.data?.database ?? '', max: s.maxPerRun })} />
        {!s.allowTemp && <div className="cus-tested warn"><ExclamationCircleOutlined /> {t('cus.erp.sync.noTemp')}</div>}
      </AppModal>
    </div>
  )
}
