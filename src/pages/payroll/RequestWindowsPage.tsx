import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LockOutlined, ScheduleOutlined, UnlockOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { requestWindows, type WindowState } from '../../api/requestWindows'
import type { WindowKind, WindowMode } from '../../api/requests'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

const KINDS: WindowKind[] = ['finger', 'overtime', 'leave']
const fmt = (v: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '')

interface Row { period: string; cells: Record<WindowKind, WindowState | undefined> }

/** Khóa / mở đăng ký đơn: HR bật / tắt cho nhân viên tự đăng ký theo kỳ công và loại đơn. Quản trị luôn gửi được (đơn bổ sung). */
export default function RequestWindowsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [year, setYear] = useState(dayjs().year())

  const q = useQuery({ queryKey: ['request-windows', year], queryFn: () => requestWindows.list(year), retry: false })
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rqw.err.${code}`, { detail, defaultValue: t('rqw.err.generic') }) }
  // mode open / locked = HR khóa / mở tay (thắng lịch tự động); auto = trả về theo lịch tự động.
  const save = useMutation({
    mutationFn: (v: { period: string; kinds: WindowKind[]; mode: WindowMode }) => requestWindows.save({ period: v.period, kinds: v.kinds, mode: v.mode }),
    onSuccess: (_, v) => {
      msg.success(t(v.mode === 'open' ? 'rqw.openedMsg' : v.mode === 'locked' ? 'rqw.lockedMsg' : 'rqw.autoMsg', { period: v.period }))
      qc.invalidateQueries({ queryKey: ['request-windows'] }); qc.invalidateQueries({ queryKey: ['req', 'self-service'] })
    },
    onError: (e) => msg.error(errText(e)),
  })
  const busy = (period: string, k?: WindowKind) => save.isPending && save.variables?.period === period && (!k || save.variables.kinds.includes(k))
  const busyAll = (period: string, mode: WindowMode) => busy(period) && save.variables?.kinds.length === 3 && save.variables.mode === mode

  const items = q.data?.items ?? []
  const ready = !!q.data?.ready
  const autoLock = !!q.data?.autoLock
  const untilDay = q.data?.untilDay ?? 0
  const reopenDay = q.data?.reopenDay ?? 0
  const autoText = !q.data ? null : !autoLock ? t('rqw.autoOff')
    : reopenDay > 0 ? t('rqw.autoOn', { close: untilDay, closeAt: untilDay + 1, reopen: reopenDay, reopenAt: reopenDay + 1, from: q.data.fromPeriod || '-' })
      : t('rqw.autoOnNoReopen', { close: untilDay, closeAt: untilDay + 1, from: q.data.fromPeriod || '-' })
  const current = dayjs().format('MM/YYYY')
  const rows: Row[] = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')}/${year}`).map((period) => ({
    period, cells: Object.fromEntries(KINDS.map((k) => [k, items.find((x) => x.period === period && x.kind === k)])) as Row['cells'],
  }))

  const cell = (period: string, k: WindowKind, w: WindowState | undefined) => {
    if (!w) return null
    const allow = !w.closed
    const manual = w.custom && w.mode !== 'auto'
    const schedule = w.mode === 'auto' && w.deadline
      ? (w.reopenAt ? t('rqw.scheduleTip', { close: fmt(w.deadline), reopen: fmt(w.reopenAt) }) : t('rqw.scheduleTipNoReopen', { close: fmt(w.deadline) }))
      : undefined
    const tip = [schedule, w.custom ? t('rqw.changedBy', { by: w.updatedBy ?? '', at: fmt(w.updatedAt) }) : undefined].filter(Boolean).join(' · ')
    return (
      <Tooltip title={tip || undefined}>
        <Space size={8} wrap>
          <Switch checked={allow} disabled={!ready} loading={busy(period, k)} checkedChildren={<UnlockOutlined />} unCheckedChildren={<LockOutlined />}
            onChange={(v) => save.mutate({ period, kinds: [k], mode: v ? 'open' : 'locked' })} />
          <span style={allow ? undefined : { color: '#D92D20' }}>{t(allow ? 'rqw.allow' : 'rqw.block')}</span>
          {manual
            ? <Tag color="orange" style={{ cursor: ready ? 'pointer' : undefined }} onClick={() => ready && save.mutate({ period, kinds: [k], mode: 'auto' })}>{t('rqw.manualTag')} · {t('rqw.backToAuto')}</Tag>
            : autoLock && w.deadline ? <Tag icon={<ScheduleOutlined />}>{t('rqw.autoTag')}</Tag> : null}
        </Space>
      </Tooltip>
    )
  }

  const columns: ColumnsType<Row> = [
    {
      title: t('rqw.period'), dataIndex: 'period', width: 120,
      render: (v: string) => <b>{v}{v === current ? <Tag style={{ marginLeft: 6 }}>{t('rqw.current')}</Tag> : null}</b>,
    },
    ...KINDS.map((k) => ({ title: t(`rqw.kind.${k}`), key: k, render: (_: unknown, r: Row) => cell(r.period, k, r.cells[k]) })),
    {
      title: '', key: 'act', width: 330,
      render: (_: unknown, r: Row) => (
        <Space size={4}>
          <Popconfirm title={t('rqw.lockAllAsk', { period: r.period })} onConfirm={() => save.mutate({ period: r.period, kinds: KINDS, mode: 'locked' })} disabled={!ready}>
            <Button size="small" danger icon={<LockOutlined />} disabled={!ready} loading={busyAll(r.period, 'locked')}>{t('rqw.lockAll')}</Button>
          </Popconfirm>
          <Button size="small" icon={<UnlockOutlined />} disabled={!ready} loading={busyAll(r.period, 'open')}
            onClick={() => save.mutate({ period: r.period, kinds: KINDS, mode: 'open' })}>{t('rqw.openAll')}</Button>
          {autoLock && KINDS.some((k) => r.cells[k]?.custom && r.cells[k]?.mode !== 'auto') && (
            <Button size="small" icon={<ScheduleOutlined />} disabled={!ready} loading={busyAll(r.period, 'auto')}
              onClick={() => save.mutate({ period: r.period, kinds: KINDS, mode: 'auto' })}>{t('rqw.autoAll')}</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<LockOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.requestWindows')} subtitle={t('nav.requestWindowsDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('rqw.intro')} />
      {autoText && <Alert type={autoLock ? 'success' : 'warning'} showIcon icon={<ScheduleOutlined />} style={{ marginBottom: 12 }} title={autoText} />}
      {q.data && !ready && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('rqw.err.table_missing')} />}
      <DataTable<Row>
        rowKey="period" loading={q.isLoading} columns={columns} dataSource={rows} pagination={false} columnFilters={false}
        rowClassName={(r) => (r.period === current ? 'row-focus' : '')}
        locale={{ emptyText: q.isError ? errText(q.error) : undefined }}
        toolbar={<Space><Typography.Text>{t('rqw.year')}</Typography.Text><DatePicker picker="year" allowClear={false} value={dayjs(`${year}-01-01`)} onChange={(d) => d && setYear(d.year())} /></Space>}
      />
    </div>
  )
}
