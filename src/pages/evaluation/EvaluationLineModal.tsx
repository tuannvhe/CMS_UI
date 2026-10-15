import { useEffect, useState } from 'react'
import { Alert, Button, DatePicker, Select, Skeleton, Space, Tag, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { MiniTable } from '../../components/DataTable'
import { AppModal } from '../../components/AppModal'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, PlusOutlined, TeamOutlined, UndoOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { evaluations, type AuditRound, type LineRound } from '../../api/evaluations'
import { lines } from '../../api/lines'

const ROUND_COLOR = ['', 'green', 'blue', 'purple', 'orange', 'red']

/** Nhân viên cần xem/chỉnh line (ứng viên đăng ký hoặc đơn đã tạo). */
export interface LineSubject { employeeId: string; fullName: string; position: string; department: string; typeRate: string; dateRate: string }

type Row = LineRound & { locked?: boolean; marks?: number | null; inactive?: boolean }

/**
 * Xem và chỉnh line người đánh giá của RIÊNG một nhân viên (công nhân OP hoặc nhân viên văn phòng).
 * - Chế độ đăng ký (không có `fixed`): mặc định là line của bộ phận, có nút "Dùng line mặc định".
 * - Chế độ sửa đơn đã tạo (có `fixed`): các vòng đã xác nhận bị khóa; đổi người ở vòng đã có điểm nháp thì điểm đi theo vòng.
 * Nhân viên văn phòng luôn có vòng 1 là tự đánh giá (khóa).
 */
export function EvaluationLineModal({ subject, current, currentDate, fixed, bulkCount, onSave, onClose, saving }: {
  subject: LineSubject | null; current?: LineRound[]; currentDate?: string; fixed?: AuditRound[]; bulkCount?: number
  /** newDate = ngày đánh giá mới (YYYY-MM-DD) nếu HR đã đổi so với ngày hiện tại/đề xuất, ngược lại null. */
  onSave: (line: LineRound[] | null, newDate: string | null) => void; onClose: () => void; saving?: boolean
}) {
  const { t } = useTranslation()
  const proposedDate = subject?.dateRate.slice(0, 10)
  const isOp = subject?.position === 'OP'
  const def = useQuery({
    queryKey: ['evaluations', 'line', subject?.employeeId, proposedDate], queryFn: () => evaluations.defaultLine(subject!.employeeId, proposedDate!), enabled: !!subject && !fixed, gcTime: 0,
  })
  const lookups = useQuery({ queryKey: ['lines', 'lookups'], queryFn: lines.lookups, staleTime: 30_000, refetchOnMount: 'always', enabled: !!subject })
  const [rows, setRows] = useState<Row[]>([])
  const [date, setDateValue] = useState<Dayjs | null>(null)
  const originalDate = subject?.dateRate.slice(0, 10)

  useEffect(() => {
    if (!subject) return
    setDateValue(dayjs(currentDate ?? subject.dateRate))
    if (fixed) setRows(fixed.map((r) => ({ round: r.round, userId: r.userId, fullName: r.fullName, locked: r.confirmed, marks: r.markCount, inactive: r.active === false })))
    else setRows(current ?? def.data ?? [])
  }, [subject, current, currentDate, def.data, fixed])

  const people = (lookups.data?.people ?? []).map((p) => ({ value: p.value, label: `${p.label} · ${p.value}` }))
  // Tên hiển thị cho người đã có trong line nhưng không nằm trong danh sách chọn
  const known = new Map<string, string>([...(def.data ?? []), ...(fixed ?? [])].map((r) => [r.userId, r.fullName ?? r.userId]))
  const optionsFor = (uid: string) => (uid && !people.some((p) => p.value === uid) ? [...people, { value: uid, label: `${known.get(uid) ?? uid} · ${uid}` }] : people)

  const isSelf = (r: Row) => r.userId === subject?.employeeId
  // Nhân viên văn phòng: vòng tự đánh giá bắt buộc (khóa). Công nhân: tùy chọn, có thể thêm/xóa
  const selfLocked = (r: Row) => isSelf(r) && !isOp
  const dupUsers = new Set(rows.map((r) => r.userId).filter((u, i, a) => u && a.indexOf(u) !== i))
  const valid = rows.length > 0 && rows.every((r) => r.userId) && dupUsers.size === 0
  const setRow = (i: number, patch: Partial<Row>) => setRows((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const hasSelf = rows.some(isSelf)

  // Cảnh báo khi đổi/xóa vòng đang có điểm nháp (fix mode): điểm đi theo vòng cho người mới / mất nếu xóa vòng
  const original = new Map((fixed ?? []).map((r) => [r.round, r]))
  const touched = rows.filter((r) => !r.locked && r.marks && original.get(r.round)?.userId !== r.userId)
  const removed = (fixed ?? []).filter((o) => !o.confirmed && (o.markCount ?? 0) > 0 && !rows.some((r) => r.round === o.round))

  const columns: ColumnsType<Row> = [
    {
      title: t('line.round'), width: 210,
      render: (_: unknown, r: Row, i: number) => isSelf(r)
        ? <Tag color="green" variant="filled">{t('line.roundN', { n: 1 })} · {t('eva.lineSelf')}</Tag>
        : r.locked ? <Tag color={ROUND_COLOR[r.round] ?? 'default'} variant="filled">{t('line.roundN', { n: r.round })} · {t(`line.roundName.${r.round}`)}</Tag>
          : <Select style={{ width: 190 }} value={r.round} onChange={(v) => setRow(i, { round: v })}
              options={[1, 2, 3, 4, 5].filter((n) => isOp || n > 1).map((n) => ({ value: n, label: `${t('line.roundN', { n })} · ${t(`line.roundName.${n}`)}` }))} />,
    },
    {
      title: t('line.person'),
      render: (_: unknown, r: Row, i: number) => isSelf(r) || r.locked
        ? (
          <Space size={6} wrap>
            <span><b>{isSelf(r) ? subject?.fullName : (r.fullName ?? known.get(r.userId) ?? r.userId)}</b> <span style={{ color: 'var(--c-muted)' }}>· {r.userId}</span></span>
            {r.locked && <Tag color="success" variant="filled">{t('eva.auditConfirmed')}</Tag>}
          </Space>
        )
        : (
          <Space size={6} style={{ width: '100%' }} wrap>
            <Select showSearch optionFilterProp="label" style={{ width: 320, maxWidth: '100%' }} value={r.userId || undefined} placeholder={t('line.person')}
              status={dupUsers.has(r.userId) ? 'error' : undefined} loading={lookups.isLoading} options={optionsFor(r.userId)}
              onChange={(v) => setRow(i, { userId: v, fullName: undefined, inactive: false })} />
            {r.round === 1 && !!subject && (
              <Button size="small" onClick={() => setRow(i, { userId: subject.employeeId, fullName: undefined, inactive: false })}>{t('eva.lineMakeSelf')}</Button>
            )}
            {r.inactive && <Tag color="error" variant="filled">{t('eva.issue.evaluator_inactive_short')}</Tag>}
            {!!r.marks && <Tag color="warning" variant="filled">{t('eva.auditMarks', { n: r.marks })}</Tag>}
          </Space>
        ),
    },
    {
      title: '', width: 60, align: 'center',
      render: (_: unknown, r: Row, i: number) => (selfLocked(r) || r.locked ? null : <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setRows((p) => p.filter((_, j) => j !== i))} />),
    },
  ]

  const newDateIso = date && date.format('YYYY-MM-DD') !== originalDate ? date.format('YYYY-MM-DD') : null
  const loading = !fixed && def.isLoading

  return (
    <AppModal open={!!subject} onClose={onClose} size="md" icon={<TeamOutlined />} title={t(fixed ? 'eva.auditFixTitle' : bulkCount ? 'eva.bulkTitle' : 'eva.lineTitle')}
      subtitle={subject ? (bulkCount ? t('eva.bulkSubtitle', { n: bulkCount, name: `${subject.employeeId} – ${subject.fullName}` }) : `${subject.employeeId} – ${subject.fullName}`) : undefined}
      extra={fixed ? undefined : <Button icon={<UndoOutlined />} onClick={() => { onSave(null, null); onClose() }}>{t(bulkCount ? 'eva.lineResetAll' : 'eva.lineReset')}</Button>}
      onOk={() => { onSave(rows.map(({ round, userId }) => ({ round, userId })), newDateIso); if (!fixed) onClose() }} okText={t(fixed ? 'eva.auditSave' : 'eva.lineApply')} okDisabled={!valid} okLoading={saving}>
      {loading ? <Skeleton active /> : !fixed && def.isError ? <Alert type="error" showIcon title={t('req.err.generic')} /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text type="secondary">{subject?.position} · {subject?.department} · {subject?.typeRate}</Typography.Text>
          <Space wrap>
            <b>{t('eva.lineDate')}</b>
            <DatePicker allowClear={false} format="DD/MM/YYYY" value={date} onChange={(v) => v && setDateValue(v)} />
            {newDateIso
              ? <Tag color="orange" variant="filled">{t('eva.dateChanged', { from: dayjs(originalDate).format('DD/MM/YYYY') })}</Tag>
              : <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>{t('eva.lineDateHint')}</span>}
          </Space>
          {bulkCount ? <Alert type="warning" showIcon title={t('eva.bulkHint', { n: bulkCount })} /> : null}
          <Alert type="info" showIcon title={t(fixed ? 'eva.auditFixHint' : isOp ? 'eva.lineHintOp' : 'eva.lineHintStaff')} />
          {(touched.length > 0 || removed.length > 0) && <Alert type="warning" showIcon title={t('eva.auditMarksWarn', { n: touched.reduce((s, r) => s + (r.marks ?? 0), 0) + removed.reduce((s, r) => s + (r.markCount ?? 0), 0) })} />}
          <MiniTable<Row> rowKey={(_, i) => String(i)} columns={columns} dataSource={rows}
            rowClassName={(r) => (isSelf(r) || r.locked ? 'eva-group-row' : '')} locale={{ emptyText: t('eva.lineEmpty') }} />
          <Space wrap>
            <Button icon={<PlusOutlined />} disabled={rows.length >= 8} onClick={() => setRows((p) => [...p, { round: Math.min(5, Math.max(isOp ? 1 : 2, ...p.map((r) => r.round)) + 1), userId: '' }])}>{t('eva.lineAdd')}</Button>
            {!hasSelf && <Button onClick={() => setRows((p) => [{ round: 1, userId: subject!.employeeId }, ...(isOp ? p : p.filter((r) => r.round !== 1))])}>{t('eva.lineAddSelf')}</Button>}
            {dupUsers.size > 0 && <Typography.Text type="danger">{t('eva.regErr.line_duplicate')}</Typography.Text>}
          </Space>
          {rows.some((r) => r.round > 0) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[...rows].sort((a, b) => a.round - b.round).map((r, i) => (
                <Tag key={i} color={ROUND_COLOR[r.round] ?? 'default'} variant="filled">{t('line.roundN', { n: r.round })}: {isSelf(r) ? subject?.fullName : (people.find((p) => p.value === r.userId)?.label ?? r.fullName ?? known.get(r.userId) ?? '—')}</Tag>
              ))}
            </div>
          )}
        </Space>
      )}
    </AppModal>
  )
}
