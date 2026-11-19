import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Empty, Input, Popconfirm, Progress, Segmented, Select, Skeleton, Tag, Typography } from 'antd'
import { EnvironmentOutlined, SearchOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { adminUnits, type NewWardRow } from '../../api/adminUnits'
import { foldFilter } from '../../utils/search'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
const fmtTime = (s: string | null) => (s ? dayjs(s).format('DD/MM/YYYY HH:mm') : '')
/** Ô tìm có từ 2 dấu phẩy trở lên = một địa chỉ đầy đủ: đổi địa chỉ thay vì tìm tên xã. */
const looksLikeAddress = (s: string) => s.split(',').filter((x) => x.trim()).length >= 3

/** Một xã mới và các xã cũ gộp vào: xã cũ bên trái, chụm về tên xã mới bên phải. */
function MergeRow({ w, province, highlight }: { w: NewWardRow; province?: string; highlight?: string }) {
  const { t } = useTranslation()
  const f = highlight ? fold(highlight) : ''
  const unchanged = w.oldWards.length === 1 && !w.oldWards[0].partial && fold(w.oldWards[0].name).endsWith(fold(w.name))
  return (
    <div className="au-merge">
      <ul className="au-merge-from">
        {w.oldWards.length === 0 && <li className="au-old au-old-none">{t('au.noOld')}</li>}
        {w.oldWards.map((o) => (
          <li key={o.code} className={`au-old${o.partial ? ' au-old-partial' : ''}${f && fold(o.name).includes(f) ? ' au-old-hit' : ''}`}>
            <span className="au-old-name">{o.name}</span>
            <span className="au-old-where">{[o.district, o.province].filter(Boolean).join(', ')}</span>
            {o.partial && <span className="au-old-flag" title={t('au.partial')}>{t('au.partialShort')}</span>}
          </li>
        ))}
      </ul>
      <div className="au-merge-arrow" aria-hidden="true" />
      <div className="au-merge-to">
        <div className="au-new-name">{w.type} {w.name}</div>
        {province && <div className="au-new-prov">{province}</div>}
        {unchanged && <div className="au-new-prov">{t('au.unchanged')}</div>}
      </div>
    </div>
  )
}

/**
 * Đơn vị hành chính sau sáp nhập. Trái: 34 tỉnh / thành; phải: xã mới của tỉnh đang chọn, mỗi dòng là các xã cũ gộp vào một xã mới
 * (xã cũ bị chia tô vàng, lọc nhanh được). Ô tìm chung: tên xã cũ / mới trên cả nước, hoặc dán cả địa chỉ cũ để đổi.
 * Nút Đồng bộ tải lại bảng sáp nhập ở nền (~40 phút); xong là địa chỉ mới của mọi người đã lưu tự tính lại theo bảng mới.
 */
export default function AdminUnitsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [provFilter, setProvFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [onlySplit, setOnlySplit] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => { const h = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(h) }, [query])

  const info = useQuery({ queryKey: ['admin-units', 'info'], queryFn: adminUnits.info, refetchInterval: (q) => (q.state.data?.sync.running ? 5000 : false) })
  const stamp = `${info.data?.data.version}|${info.data?.data.syncedAt}`
  const provinces = useQuery({ queryKey: ['admin-units', 'provinces', stamp], queryFn: adminUnits.provinces, enabled: !!info.data })
  const current = selected ?? provinces.data?.[0]?.code ?? null
  const wards = useQuery({ queryKey: ['admin-units', 'wards', current, stamp], queryFn: () => adminUnits.wards(current!), enabled: !!current })
  const isAddress = looksLikeAddress(debounced)
  const search = useQuery({ queryKey: ['admin-units', 'search', debounced, stamp], queryFn: () => adminUnits.search(debounced), enabled: debounced.length >= 2 && !isAddress })
  const conv = useQuery({ queryKey: ['admin-units', 'convert', debounced, stamp], queryFn: () => adminUnits.convert(debounced), enabled: isAddress })

  const s = info.data?.sync
  const d = info.data?.data
  const running = !!s?.running
  const sync = useMutation({
    mutationFn: adminUnits.sync,
    onSuccess: () => { msg.success(t('au.syncStarted')); qc.invalidateQueries({ queryKey: ['admin-units', 'info'] }) },
    onError: () => msg.error(t('au.syncFailed')),
  })

  const pf = fold(provFilter)
  const provRows = useMemo(() => (provinces.data ?? []).filter((p) => !pf || fold(p.name).includes(pf) || p.mergedFrom.some((m) => fold(m).includes(pf))), [provinces.data, pf])
  const prov = provinces.data?.find((p) => p.code === current)
  const wardRows = (wards.data ?? []).filter((w) => !onlySplit || w.oldWards.some((o) => o.partial))
  const searching = debounced.length >= 2

  return (
    <div className="page wide au-page">
      <PageBanner avatar={<Avatar size={56} icon={<EnvironmentOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.adminUnits')} subtitle={t('nav.adminUnitsDesc')} />

      <section className="au-status" aria-live="polite">
        <div className="au-status-facts">
          <span><b>{d?.version ?? '-'}</b> {t('au.version').toLowerCase()}</span>
          <span>{d?.syncedAt ? t('au.syncedAtText', { at: fmtTime(d.syncedAt) }) : t('au.builtIn')}</span>
          {d && <span>{t('au.countsText', { p: d.newProvinces, w: d.newWards, o: d.oldWards })}</span>}
        </div>
        <Popconfirm title={t('au.syncAsk')} onConfirm={() => sync.mutate()} disabled={running}>
          <Button type="primary" icon={<SyncOutlined spin={running} />} loading={sync.isPending} disabled={running}>{running ? t('au.syncing') : t('au.sync')}</Button>
        </Popconfirm>
        {running && s && (
          <div className="au-status-progress">
            <Progress size="small" showInfo={false} status="active" percent={s.step === 'merge' && s.total ? Math.max(2, Math.round((s.done / s.total) * 100)) : s.step === 'save' ? 100 : 2} />
            <Typography.Text type="secondary">{t(`au.step.${s.step ?? 'start'}`, { done: s.done, total: s.total })} · {t('au.startedBy', { by: s.by, at: fmtTime(s.startedAt) })}</Typography.Text>
          </div>
        )}
        {!running && s?.error && <Alert className="au-status-note" type="error" showIcon message={t('au.syncError', { at: fmtTime(s.finishedAt) })} description={s.error} />}
        {!running && !s?.error && s?.result && <Alert className="au-status-note" type="success" showIcon closable message={t('au.syncDone', { at: fmtTime(s.finishedAt), result: s.result })} />}
      </section>

      {d && d.newProvinces === 0 && <Alert type="warning" showIcon message={t('au.empty')} />}

      <Input size="large" allowClear prefix={<SearchOutlined />} className="au-search" placeholder={t('au.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />

      {searching ? (
        <section className="au-panel">
          {isAddress ? (
            conv.data ? (
              <div className="au-convert">
                <Tag color={conv.data.status === 'exact' || conv.data.status === 'already_new' ? 'success' : conv.data.status === 'check' ? 'warning' : 'error'}>{t(`au.status.${conv.data.status}`)}</Tag>
                {conv.data.newAddress && <Typography.Text copyable className="au-convert-result">{conv.data.newAddress}</Typography.Text>}
                {conv.data.candidates.length > 0 && (
                  <ul className="au-convert-list">{conv.data.candidates.map((c) => <li key={c}><Typography.Text copyable>{c}</Typography.Text></li>)}</ul>
                )}
                {conv.data.status === 'not_found' && <Typography.Paragraph type="secondary">{t('au.notFoundHelp')}</Typography.Paragraph>}
              </div>
            ) : <Skeleton active paragraph={{ rows: 1 }} />
          ) : search.isLoading ? <Skeleton active /> : (search.data ?? []).length === 0 ? <Empty description={t('au.noResult')} /> : (
            <>
              <Typography.Text type="secondary">{t('au.resultCount', { n: search.data!.length })}</Typography.Text>
              {search.data!.map((h) => <MergeRow key={h.ward.code} w={h.ward} province={h.provinceName} highlight={debounced} />)}
            </>
          )}
        </section>
      ) : (
        <div className="au-browse">
          <aside className="au-provinces">
            <Input allowClear size="small" placeholder={t('au.filterProvince')} value={provFilter} onChange={(e) => setProvFilter(e.target.value)} />
            <Select className="au-provinces-select" showSearch filterOption={foldFilter('label')} value={current ?? undefined} onChange={setSelected}
              options={(provinces.data ?? []).map((p) => ({ value: p.code, label: `${p.type} ${p.name}` }))} />
            <ul className="au-province-list">
              {provRows.map((p) => (
                <li key={p.code}>
                  <button type="button" className={p.code === current ? 'is-active' : ''} onClick={() => { setSelected(p.code); setOnlySplit(false) }}>
                    <span className="au-province-name">{p.name}</span>
                    <span className="au-province-meta">{t('au.wardsN', { n: p.wardCount })}</span>
                    {p.splitWards > 0 && <span className="au-province-split" title={t('au.splitHint', { n: p.splitWards })}>{p.splitWards}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="au-panel">
            {prov && (
              <header className="au-panel-head">
                <div>
                  <h2>{prov.type} {prov.name}</h2>
                  <p>{prov.mergedFrom.length > 1 ? t('au.mergedFromText', { list: prov.mergedFrom.join(', ') }) : t('au.keptProvince')}</p>
                </div>
                <Segmented value={onlySplit ? 'split' : 'all'} onChange={(v) => setOnlySplit(v === 'split')}
                  options={[{ value: 'all', label: t('au.allWards', { n: prov.wardCount }) }, { value: 'split', label: t('au.splitWards', { n: prov.splitWards }), disabled: prov.splitWards === 0 }]} />
              </header>
            )}
            {wards.isLoading ? <Skeleton active /> : wardRows.length === 0 ? <Empty /> : wardRows.map((w) => <MergeRow key={w.code} w={w} />)}
          </section>
        </div>
      )}
      <Typography.Paragraph type="secondary" className="au-foot">{t('au.hint')}</Typography.Paragraph>
    </div>
  )
}
