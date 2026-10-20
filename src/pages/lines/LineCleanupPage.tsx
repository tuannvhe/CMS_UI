import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Avatar, Button, Popconfirm, Segmented, Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ClearOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { lineCleanup, type CleanupBucket, type CleanupGroup, type UncoveredUnit } from '../../api/lineCleanup'
import { org } from '../../api/org'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { lineErrorText } from './ApprovalLinePage'
import { useToast } from '../../hooks/useToast'

const BUCKET_COLOR: Record<CleanupBucket, string> = { live: 'green', department: 'orange', emptied: 'default', never: 'red' }
type Tab = CleanupBucket | 'uncovered' | 'restore'

/** Đọc CSV sao lưu (UTF-8, dấu ngoặc kép, dòng đầu là tiêu đề Department,Bucket,Round,UserId,...). */
function parseBackup(text: string): { department: string; round: number; userId: string }[] | null {
  const rows: string[][] = []
  let cur: string[] = [], cell = '', q = false
  const src = text.replace(/^\ufeff/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '\n') { cur.push(cell.replace(/\r$/, '')); rows.push(cur); cur = []; cell = '' }
    else cell += c
  }
  if (cell || cur.length) { cur.push(cell.replace(/\r$/, '')); rows.push(cur) }
  if (rows.length < 2 || rows[0][0] !== 'Department' || rows[0][2] !== 'Round' || rows[0][3] !== 'UserId') return null
  return rows.slice(1).filter((r) => r.length >= 4 && r[0].trim()).map((r) => ({ department: r[0].trim(), round: Number(r[2]), userId: r[3].trim() }))
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

/** Dọn line đánh giá: hệ thống cũ chỉ dùng dòng line có tên trùng PHÒNG BAN của nhân viên đang làm; các dòng còn lại được phân loại để sao lưu và xóa. */
export default function LineCleanupPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('department')
  const [copyFrom, setCopyFrom] = useState<Record<string, string | undefined>>({})

  const report = useQuery({ queryKey: ['lines', 'cleanup'], queryFn: lineCleanup.report, retry: false })
  const data = report.data
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lines'] }); qc.invalidateQueries({ queryKey: ['org'] }) }

  const remove = useMutation({
    mutationFn: (ids: number[]) => lineCleanup.remove(ids),
    onSuccess: (r) => { message.success(t('lc.deleted', { n: r.done, s: r.skipped })); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const copy = useMutation({
    mutationFn: (v: { from: string; to: string }) => lineCleanup.copy(v.from, v.to),
    onSuccess: (r) => { message.success(t('lc.copied', { n: r.done, s: r.skipped })); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const [restoreRows, setRestoreRows] = useState<{ department: string; round: number; userId: string }[]>([])
  const restore = useMutation({
    mutationFn: (rows: { department: string; round: number; userId: string }[]) => lineCleanup.restore(rows),
    onSuccess: (r) => { message.success(t('lc.restored', { n: r.done, d: r.duplicate, i: r.invalid })); setRestoreRows([]); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })
  const onFile = async (f?: File) => {
    if (!f) return
    const rows = parseBackup(await f.text())
    if (!rows || rows.length === 0) { message.error(t('lc.badFile')); setRestoreRows([]); return }
    setRestoreRows(rows)
  }
  const register = useMutation({
    mutationFn: (v: { name: string; department: string }) => org.assignUnit(v),
    onSuccess: (r) => { message.success(t('line.addedToOrg', { n: r.employees })); refresh() },
    onError: (e) => message.error(lineErrorText(e, t)),
  })

  const groups = useMemo(() => data?.groups ?? [], [data])
  const count = (b: CleanupBucket) => groups.filter((g) => g.bucket === b).length
  const shown = useMemo(() => (tab === 'uncovered' ? [] : groups.filter((g) => g.bucket === tab)), [groups, tab])
  const idsOf = (list: CleanupGroup[]) => list.flatMap((g) => g.lines.map((l) => l.id))

  const backup = (list: CleanupGroup[]) => {
    const rows = [['Department', 'Bucket', 'Round', 'UserId', 'FullName', 'PersonActive'], ...list.flatMap((g) => g.lines.map((l) => [g.name, g.bucket, l.round, l.userId, l.fullName ?? '', l.personActive ?? '']))]
    const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `evaluator-lines-${tab}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    const href = a.href
    setTimeout(() => URL.revokeObjectURL(href), 60000)
  }

  const cols: ColumnsType<CleanupGroup> = [
    { title: t('lc.name'), dataIndex: 'name', render: (v: string, g) => <Space direction="vertical" size={0}><b>{v || t('lc.blank')}</b><Tag color={BUCKET_COLOR[g.bucket]}>{t(`lc.bucket.${g.bucket}`)}</Tag></Space> },
    { title: t('lc.lines'), dataIndex: 'lines', width: 90, align: 'center', render: (l: CleanupGroup['lines']) => l.length },
    { title: t('lc.employees'), dataIndex: 'activeEmployees', width: 110, align: 'center' },
    {
      title: t('lc.people'),
      render: (_: unknown, g) => g.lines.map((l) => <Tag key={l.id} color={l.personActive === false ? 'red' : undefined}>{`V${l.round} · ${l.fullName ?? l.userId}`}</Tag>),
    },
    {
      title: t('lc.action'), width: 280,
      render: (_: unknown, g) => g.bucket === 'live'
        ? (g.registered ? <Tag color="green">{t('lc.registered')}</Tag>
          : g.suggestedDepartment && data?.orgReady
            ? <Button size="small" icon={<PlusOutlined />} loading={register.isPending} onClick={() => register.mutate({ name: g.name, department: g.suggestedDepartment! })}>{t('lc.register', { d: g.suggestedDepartment })}</Button>
            : <Link to="/org">{t('lc.openOrg')}</Link>)
        : <Space direction="vertical" size={2}>
          {g.suggestedUnit && <span style={{ fontSize: 12 }}>{t('lc.nearest')}: <b>{g.suggestedUnit}</b></span>}
          <Popconfirm title={t('lc.confirmDelete', { n: g.lines.length })} onConfirm={() => remove.mutate(g.lines.map((l) => l.id))}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('lc.delete')}</Button>
          </Popconfirm>
        </Space>,
    },
  ]

  const uncoveredCols: ColumnsType<UncoveredUnit> = [
    { title: t('lc.name'), dataIndex: 'part', render: (v: string, u) => <Space direction="vertical" size={0}><b>{v}</b><span style={{ fontSize: 12 }}>{u.department}</span></Space> },
    { title: t('lc.employees'), dataIndex: 'employees', width: 110, align: 'center' },
    { title: t('lc.registeredCol'), dataIndex: 'registered', width: 120, align: 'center', render: (v: boolean) => v ? <Tag color="green">✓</Tag> : <Tag color="orange">✗</Tag> },
    {
      title: t('lc.copyFrom'), width: 420,
      render: (_: unknown, u) => u.sources.length === 0 ? <span style={{ opacity: 0.6 }}>{t('lc.noSource')}</span> : (
        <Space wrap>
          <Select size="small" style={{ minWidth: 220 }} placeholder={t('lc.pickSource')} value={copyFrom[u.part]} onChange={(v) => setCopyFrom({ ...copyFrom, [u.part]: v })}
            options={u.sources.map((s) => ({ value: s.part, label: `${s.part} (${s.lines})` }))} />
          <Button size="small" icon={<CopyOutlined />} disabled={!copyFrom[u.part] || !u.registered} loading={copy.isPending}
            onClick={() => copy.mutate({ from: copyFrom[u.part]!, to: u.part })}>{t('lc.copy')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<ClearOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('lc.title')} subtitle={t('lc.subtitle')}
      />
      <Alert type="info" showIcon title={t('lc.explain')} style={{ marginBottom: 12 }} />
      {report.isError && <Alert type="error" showIcon title={t('lc.loadFailed')} style={{ marginBottom: 12 }} />}
      <StatTiles items={[
        { label: t('lc.bucket.live'), value: count('live'), color: '#2E9E4F' },
        { label: t('lc.bucket.department'), value: count('department'), color: '#D48806' },
        { label: t('lc.bucket.emptied'), value: count('emptied'), color: '#8c8c8c' },
        { label: t('lc.bucket.never'), value: count('never'), color: '#cf1322' },
        { label: t('lc.uncovered'), value: data?.uncovered.length ?? 0, color: '#2F6FB0' },
      ]} />
      <div style={{ margin: '12px 0' }}>
        <Segmented value={tab} onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'department', label: `${t('lc.bucket.department')} (${count('department')})` },
            { value: 'emptied', label: `${t('lc.bucket.emptied')} (${count('emptied')})` },
            { value: 'never', label: `${t('lc.bucket.never')} (${count('never')})` },
            { value: 'live', label: `${t('lc.bucket.live')} (${count('live')})` },
            { value: 'restore', label: t('lc.restore') },
            { value: 'uncovered', label: `${t('lc.uncovered')} (${data?.uncovered.length ?? 0})` },
          ]} />
      </div>

      {tab === 'restore' ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="info" showIcon title={t('lc.restoreHint')} />
          <input type="file" accept=".csv,text/csv" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} aria-label={t('lc.pickFile')} />
          {restoreRows.length > 0 && (
            <>
              <b>{t('lc.restoreRows', { n: restoreRows.length })}</b>
              <DataTable<{ department: string; round: number; userId: string }> rowKey={(r) => `${r.department}|${r.round}|${r.userId}`} size="small" dataSource={restoreRows} pagination={{ pageSize: 10 }}
                columns={[{ title: t('lc.name'), dataIndex: 'department' }, { title: t('lc.lines'), dataIndex: 'round', width: 90 }, { title: t('lc.people'), dataIndex: 'userId' }]} />
              <Popconfirm title={t('lc.restoreGo', { n: restoreRows.length })} onConfirm={() => restore.mutate(restoreRows)}>
                <Button type="primary" loading={restore.isPending}>{t('lc.restoreGo', { n: restoreRows.length })}</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ) : tab === 'uncovered' ? (
        <>
          <DataTable<UncoveredUnit> rowKey="part" loading={report.isLoading} columns={uncoveredCols} dataSource={data?.uncovered ?? []} pagination={{ pageSize: 20 }} />
          {(data?.blankPart.length ?? 0) > 0 && (
            <Alert style={{ marginTop: 12 }} type="warning" showIcon title={t('lc.blankPart')}
              description={data!.blankPart.map((b) => `${b.department || '—'}: ${b.employees}`).join(' · ')} />
          )}
        </>
      ) : (
        <>
          <Space style={{ marginBottom: 8 }} wrap>
            <Button icon={<DownloadOutlined />} disabled={shown.length === 0} onClick={() => backup(shown)}>{t('lc.backup')}</Button>
            {tab !== 'live' && (
              <Popconfirm title={t('lc.confirmDeleteAll', { n: idsOf(shown).length })} disabled={idsOf(shown).length === 0} onConfirm={() => remove.mutate(idsOf(shown))}>
                <Button danger icon={<DeleteOutlined />} disabled={idsOf(shown).length === 0} loading={remove.isPending}>{t('lc.deleteTab', { n: idsOf(shown).length })}</Button>
              </Popconfirm>
            )}
            {tab === 'live' && <span style={{ opacity: 0.6 }}>{t('lc.liveHint')}</span>}
          </Space>
          <DataTable<CleanupGroup> rowKey="name" loading={report.isLoading} columns={cols} dataSource={shown} pagination={{ pageSize: 20 }} />
        </>
      )}
    </div>
  )
}
