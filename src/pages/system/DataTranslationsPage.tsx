import { useMemo, useRef, useState } from 'react'
import { Alert, Avatar, Button, Input, Popconfirm, Progress, Segmented, Select, Space, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, DeleteOutlined, RobotOutlined, SaveOutlined, SyncOutlined, TranslationOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { dataTranslations, type DataTranslation } from '../../api/dataTranslations'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { refreshDataDictionary } from '../../utils/dataText'

type Filter = 'all' | 'missing' | 'review' | 'ok'
type Draft = { en: string; ko: string }
const KEY = ['data-translations']
const CHUNK = 30   // máy chủ dịch tối đa 30 mục mỗi lượt

/**
 * Dịch dữ liệu: tên bộ phận / part / chức vụ / line lưu tiếng Việt trong CSDL → tiếng Anh, tiếng Hàn để hiển thị theo ngôn ngữ người dùng.
 * Quét chữ mới từ dữ liệu, AI trên máy chủ gợi ý (không gửi ra ngoài), HR sửa và duyệt. Dữ liệu gốc không đổi.
 */
export default function DataTranslationsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('missing')
  const [kind, setKind] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [ai, setAi] = useState<{ done: number; total: number } | null>(null)
  const stopAi = useRef(false)

  const q = useQuery({ queryKey: KEY, queryFn: dataTranslations.list, retry: false })
  const errText = (e: unknown) => { const { code } = adminError(e); return t(`dtr.err.${code}`, { defaultValue: t('dtr.err.generic') }) }
  const ready = !!q.data?.ready
  const items = useMemo(() => q.data?.items ?? [], [q.data])
  const missing = (r: DataTranslation) => !r.en?.trim() || !r.ko?.trim()

  const afterChange = () => { qc.invalidateQueries({ queryKey: KEY }); refreshDataDictionary() }

  const scan = useMutation({
    mutationFn: dataTranslations.scan,
    onSuccess: (r) => { msg.success(r.added ? t('dtr.scanAdded', { n: r.added }) : t('dtr.scanNone')); afterChange() },
    onError: (e) => msg.error(errText(e)),
  })
  const save = useMutation({
    mutationFn: (v: { r: DataTranslation; approve: boolean }) => {
      const d = drafts[v.r.id]
      return dataTranslations.save(v.r.id, { en: (d?.en ?? v.r.en ?? '').trim() || null, ko: (d?.ko ?? v.r.ko ?? '').trim() || null, approve: v.approve })
    },
    onSuccess: (_, v) => {
      setDrafts((s) => { const n = { ...s }; delete n[v.r.id]; return n })
      msg.success(v.approve ? t('dtr.approvedMsg', { src: v.r.source }) : t('dtr.savedMsg', { src: v.r.source }))
      afterChange()
    },
    onError: (e) => msg.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (r: DataTranslation) => dataTranslations.remove(r.id),
    onSuccess: () => afterChange(),
    onError: (e) => msg.error(errText(e)),
  })

  /** AI gợi ý từng lượt 30 mục cho các mục còn thiếu (đang lọc), đi một lượt qua danh sách, bấm Dừng để ngắt. */
  const runAi = async () => {
    const ids = shown.filter((r) => r.status !== 'ok' && missing(r)).map((r) => r.id)
    if (!ids.length) { msg.info(t('dtr.aiNothing')); return }
    stopAi.current = false
    setAi({ done: 0, total: ids.length })
    let filled = 0
    try {
      for (let at = 0; at < ids.length && !stopAi.current; at += CHUNK) {
        const r = await dataTranslations.suggest(ids.slice(at, at + CHUNK))
        filled += r.filled
        setAi({ done: Math.min(at + CHUNK, ids.length), total: ids.length })
        qc.invalidateQueries({ queryKey: KEY })
        if (r.failed) { msg.warning(t('dtr.aiFailed')); break }
      }
      msg.success(t('dtr.aiDone', { n: filled }))
    } catch (e) {
      msg.error(errText(e))
    } finally {
      setAi(null)
      afterChange()
    }
  }

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase()
    return items.filter((r) =>
      (filter === 'all' || (filter === 'missing' && missing(r)) || (filter === 'review' && r.status !== 'ok' && !missing(r)) || (filter === 'ok' && r.status === 'ok'))
      && (!kind || r.kind === kind)
      && (!s || [r.source, r.en, r.ko].some((v) => v?.toLowerCase().includes(s))))
  }, [items, filter, kind, search])

  const counts = useMemo(() => ({
    all: items.length,
    missing: items.filter(missing).length,
    review: items.filter((r) => r.status !== 'ok' && !missing(r)).length,
    ok: items.filter((r) => r.status === 'ok').length,
  }), [items])

  const val = (r: DataTranslation, f: keyof Draft) => drafts[r.id]?.[f] ?? r[f] ?? ''
  const dirty = (r: DataTranslation) => !!drafts[r.id] && (val(r, 'en') !== (r.en ?? '') || val(r, 'ko') !== (r.ko ?? ''))
  const edit = (r: DataTranslation, f: keyof Draft, v: string) =>
    setDrafts((s) => ({ ...s, [r.id]: { en: s[r.id]?.en ?? r.en ?? '', ko: s[r.id]?.ko ?? r.ko ?? '', [f]: v } }))
  const busy = (r: DataTranslation) => save.isPending && save.variables?.r.id === r.id

  const columns: ColumnsType<DataTranslation> = [
    {
      title: t('dtr.source'), dataIndex: 'source', width: 300,
      render: (v: string, r) => (
        <div style={{ display: 'grid', gap: 2 }}>
          <b style={{ overflowWrap: 'anywhere' }}>{v}</b>
          <span style={{ fontSize: 12, color: 'var(--c-muted, #667085)' }}>
            <Tag style={{ marginInlineEnd: 6 }}>{t(`dtr.kind.${r.kind}`, { defaultValue: r.kind })}</Tag>
            {r.employees > 0 && t('dtr.people', { n: r.employees })}
          </span>
        </div>
      ),
    },
    {
      title: 'English', key: 'en',
      render: (_: unknown, r) => <Input value={val(r, 'en')} maxLength={200} disabled={!ready} placeholder={t('dtr.empty')} onChange={(e) => edit(r, 'en', e.target.value)} />,
    },
    {
      title: '한국어', key: 'ko',
      render: (_: unknown, r) => <Input value={val(r, 'ko')} maxLength={200} disabled={!ready} placeholder={t('dtr.empty')} lang="ko" onChange={(e) => edit(r, 'ko', e.target.value)} />,
    },
    {
      title: t('dtr.status'), key: 'status', width: 130,
      render: (_: unknown, r) => (
        <Tooltip title={r.updatedBy ? t('dtr.changedBy', { by: r.updatedBy, at: r.updatedAt ? dayjs(r.updatedAt).format('HH:mm DD/MM/YYYY') : '' }) : undefined}>
          {r.status === 'ok' ? <Tag color="green">{t('dtr.statusOk')}</Tag> : missing(r) ? <Tag>{t('dtr.statusMissing')}</Tag> : <Tag color="gold">{t('dtr.statusAi')}</Tag>}
        </Tooltip>
      ),
    },
    {
      title: '', key: 'act', width: 190, align: 'right',
      render: (_: unknown, r) => (
        <Space size={4}>
          {dirty(r) && <Button size="small" icon={<SaveOutlined />} loading={busy(r)} onClick={() => save.mutate({ r, approve: r.status === 'ok' })}>{t('dtr.save')}</Button>}
          {(r.status !== 'ok' || dirty(r)) && (
            <Button size="small" type="primary" icon={<CheckOutlined />} loading={busy(r)} disabled={!val(r, 'en').trim() && !val(r, 'ko').trim()}
              onClick={() => save.mutate({ r, approve: true })}>{t('dtr.approve')}</Button>
          )}
          <Popconfirm title={t('dtr.deleteConfirm')} onConfirm={() => remove.mutate(r)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('dtr.delete')} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<TranslationOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.dataTranslations')} subtitle={t('nav.dataTranslationsDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('dtr.intro')} />
      {q.data && !ready && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('dtr.err.table_missing')} />}
      {q.data && ready && !q.data.aiEnabled && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('dtr.err.ai_disabled')} />}
      {ai && (
        <Alert type="info" style={{ marginBottom: 12 }} title={
          <Space style={{ width: '100%' }} wrap>
            <span>{t('dtr.aiRunning', { done: ai.done, total: ai.total })}</span>
            <Progress percent={Math.round((ai.done / ai.total) * 100)} size="small" style={{ width: 200, margin: 0 }} />
            <Button size="small" onClick={() => { stopAi.current = true }}>{t('dtr.aiStop')}</Button>
          </Space>
        } />
      )}
      <DataTable<DataTranslation>
        rowKey="id" loading={q.isLoading} columns={columns} dataSource={shown} columnFilters={false}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        locale={{ emptyText: q.isError ? errText(q.error) : undefined }}
        toolbar={
          <Space wrap>
            <Segmented<Filter> value={filter} onChange={setFilter} options={(['missing', 'review', 'ok', 'all'] as Filter[]).map((f) => ({ value: f, label: `${t(`dtr.filter.${f}`)} (${counts[f]})` }))} />
            <Select allowClear placeholder={t('dtr.kindAll')} value={kind} onChange={setKind} style={{ width: 160 }}
              options={['dept', 'part', 'position', 'line', 'unit', 'other'].map((k) => ({ value: k, label: t(`dtr.kind.${k}`) }))} />
            <Input.Search placeholder={t('dtr.search')} allowClear style={{ width: 220 }} onSearch={setSearch} onChange={(e) => setSearch(e.target.value)} />
            <Button icon={<SyncOutlined />} disabled={!ready} loading={scan.isPending} onClick={() => scan.mutate()}>{t('dtr.scan')}</Button>
            <Button type="primary" icon={<RobotOutlined />} disabled={!ready || !q.data?.aiEnabled || !!ai} loading={!!ai} onClick={runAi}>{t('dtr.aiSuggest')}</Button>
          </Space>
        }
      />
    </div>
  )
}
