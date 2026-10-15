import { useState } from 'react'
import { Avatar, Button, DatePicker, Input, Space, Switch, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AuditOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { audit, AUDIT_TABLE_SQL, type AuditRow } from '../../api/audit'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { StatTiles } from '../../components/StatTiles'

const pretty = (s: string | null) => { if (!s) return ''; try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s } }

/** Nhật ký thao tác của các màn quản trị: ai làm gì, lúc nào, tham số gì và kết quả. Chỉ quản trị hệ thống xem. */
export default function AuditPage() {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()])
  const [actor, setActor] = useState('')
  const [text, setText] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const q = useQuery({
    queryKey: ['audit', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), actor, text, failedOnly],
    queryFn: () => audit.search({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), actor, text, failedOnly, take: 500 }),
    retry: false,
  })
  const rows = q.data?.items ?? []
  const when = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'medium' })

  const columns: ColumnsType<AuditRow> = [
    { title: t('aud.at'), dataIndex: 'at', width: 170, render: when },
    { title: t('aud.actor'), width: 200, render: (_: unknown, r) => <span><b>{r.actorName || r.actorId}</b> <span className="cell-muted">· {r.actorId}</span></span> },
    { title: t('aud.entity'), dataIndex: 'entity', width: 160, render: (v: string, r) => <span className="org-chip">{v}{r.entityKey ? ` #${r.entityKey}` : ''}</span> },
    { title: t('aud.action'), dataIndex: 'action', ellipsis: true },
    { title: t('aud.status'), dataIndex: 'status', width: 90, render: (v: number) => <Tag color={v >= 400 ? 'red' : 'green'} variant="filled">{v}</Tag> },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<AuditOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.audit')} subtitle={t('nav.auditDesc')} />
      {q.data && !q.data.ready ? <SqlNotReady title={t('aud.notReady')} sql={AUDIT_TABLE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
        <>
          <StatTiles items={[
            { label: t('aud.tileAll'), value: rows.length },
            { label: t('aud.tileFailed'), value: rows.filter((r) => r.status >= 400).length, color: rows.some((r) => r.status >= 400) ? '#D92D20' : undefined },
            { label: t('aud.tileActors'), value: new Set(rows.map((r) => r.actorId)).size },
          ]} />
          <DataTable<AuditRow>
            rowKey="id" loading={q.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 25, showSizeChanger: false }}
            locale={{ emptyText: q.isError ? t('usr.err.generic') : t('aud.empty') }}
            expandable={{ expandedRowRender: (r) => (
              <div className="aud-detail">
                {r.note && <div><b>{t('aud.note')}:</b> {r.note}</div>}
                {r.ip && <div><b>IP:</b> {r.ip}</div>}
                {r.detail && <><b>{t('aud.detail')}</b><pre>{pretty(r.detail)}</pre></>}
                {r.before && <><b>{t('aud.before')}</b><pre>{pretty(r.before)}</pre></>}
                {r.after && <><b>{t('aud.after')}</b><pre>{pretty(r.after)}</pre></>}
              </div>
            ) }}
            toolbar={(
              <Space wrap>
                <DatePicker.RangePicker allowClear={false} value={range} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} />
                <Input allowClear style={{ width: 180 }} placeholder={t('aud.actorPh')} value={actor} onChange={(e) => setActor(e.target.value)} />
                <Input.Search allowClear style={{ width: 260 }} placeholder={t('aud.textPh')} onSearch={setText} />
                <span><Switch checked={failedOnly} onChange={setFailedOnly} /> {t('aud.failedOnly')}</span>
                <Button icon={<ReloadOutlined />} onClick={() => q.refetch()} loading={q.isFetching}>{t('org.recheck')}</Button>
              </Space>
            )}
          />
        </>
      )}
    </div>
  )
}
