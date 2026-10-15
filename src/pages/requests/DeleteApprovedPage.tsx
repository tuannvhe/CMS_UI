import { useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Empty, Input, Popconfirm, Select, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { requestDeletions, type ApprovedRow, type DeletableKind } from '../../api/requestDeletions'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { fmtDate } from '../../utils/format'

/** Kỳ chốt công là mùng 7 hàng tháng: thao tác xóa trong khoảng ngày 1–7 được cảnh báo (đơn của ngày nào cũng xóa được). */
const CLOSING_LAST_DAY = 7

interface Applied { kind: DeletableKind; employeeId: string; from: string; to: string }

/**
 * Xóa đơn ĐÃ DUYỆT (tăng ca, quên vân tay, nghỉ phép) theo từng đơn: chọn nhân viên + khoảng ngày, tick đúng các ngày cần xóa.
 * Chỉ quản trị. Máy chủ kiểm tra lại từng đơn còn "đã duyệt đủ cấp" ngay lúc xóa.
 */
export default function DeleteApprovedPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [kind, setKind] = useState<DeletableKind>('overtime')
  const [empId, setEmpId] = useState('')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [applied, setApplied] = useState<Applied | null>(null)
  const [picked, setPicked] = useState<number[]>([])

  const list = useQuery({
    queryKey: ['request-deletions', applied],
    queryFn: () => requestDeletions.find(applied!.kind, applied!.employeeId, applied!.from, applied!.to),
    enabled: applied !== null,
    retry: false,
  })
  const rows = list.data ?? []
  const inClosing = dayjs().date() <= CLOSING_LAST_DAY

  const errText = (e: unknown) => {
    const d = axios.isAxiosError(e) ? e.response?.data : undefined
    if (d?.title === 'invalid_input' && d?.detail === 'employeeId') return t('del.err.employeeId')
    if (d?.title === 'range_too_long') return t('del.err.range_too_long')
    if (d?.title === 'invalid_range') return t('del.err.invalid_range')
    return t('del.err.generic')
  }

  const search = () => {
    if (!empId.trim()) { message.error(t('del.err.employeeId')); return }
    setPicked([])
    setApplied({ kind, employeeId: empId.trim(), from: fmtDate(range[0]), to: fmtDate(range[1]) })
  }

  const remove = useMutation({
    mutationFn: (ids: number[]) => requestDeletions.remove(applied!.kind, ids),
    onSuccess: (r) => {
      const n = r.deleted.length
      if (r.skipped > 0) message.warning(t('del.doneSkipped', { n, m: r.skipped }))
      else message.success(t('del.done', { n }))
      if (!r.archived && n > 0) message.info(t('del.logOnly'))
      setPicked([])
      qc.invalidateQueries({ queryKey: ['request-deletions'] })
    },
    onError: (e) => message.error(errText(e)),
  })

  const isLeave = applied?.kind === 'leave'
  const day = (v: string) => dayjs(v)
  const columns: ColumnsType<ApprovedRow> = [
    {
      title: t('del.date'), width: isLeave ? 190 : 120,
      render: (_: unknown, r) => (isLeave && r.dateTo && !day(r.dateTo).isSame(day(r.date), 'day')
        ? <b>{day(r.date).format('DD/MM/YYYY')} → {day(r.dateTo).format('DD/MM/YYYY')}</b>
        : <b>{day(r.date).format('DD/MM/YYYY')}</b>),
    },
    { title: t('cal.dow.label'), width: 90, render: (_: unknown, r) => t(`cal.dow.${day(r.date).day()}`) },
    { title: t('del.time'), width: 130, render: (_: unknown, r) => (r.timeFrom || r.timeTo ? `${r.timeFrom} – ${r.timeTo}` : <span className="cell-muted">—</span>) },
    { title: isLeave ? t('del.days') : t('del.hours'), dataIndex: 'amount', width: 90, align: 'right' },
    { title: t('del.reason'), dataIndex: 'reason', ellipsis: true, render: (v: string) => v || <span className="cell-muted">—</span> },
    { title: t('del.group'), dataIndex: 'groupId', width: 190, ellipsis: true },
    { title: t('del.sender'), width: 170, ellipsis: true, render: (_: unknown, r) => (r.senderName ? `${r.senderName} (${r.senderId})` : r.senderId) },
    { title: t('del.submittedAt'), width: 130, render: (_: unknown, r) => (r.submittedAt ? dayjs(r.submittedAt).format('DD/MM/YYYY HH:mm') : <span className="cell-muted">—</span>) },
  ]

  const who = rows[0] ? `${rows[0].fullName} (${rows[0].employeeId})` : applied?.employeeId ?? ''
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<DeleteOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.deleteApproved')} subtitle={t('nav.deleteApprovedDesc')}
        chips={applied ? [who, `${dayjs(applied.from).format('DD/MM/YYYY')} – ${dayjs(applied.to).format('DD/MM/YYYY')}`] : []} />
      <Alert type="warning" showIcon title={t('del.info')} style={{ marginBottom: 16 }} />
      {inClosing && <Alert type="error" showIcon title={t('del.closingWarn')} style={{ marginBottom: 16 }} />}
      {applied && (
        <StatTiles items={[
          { label: t('del.tileFound'), value: rows.length, color: '#2F6FB0' },
          { label: t('del.tilePicked'), value: picked.length, color: '#D92D20' },
        ]} />
      )}
      <DataTable<ApprovedRow>
        rowKey="id" loading={list.isFetching} columns={columns} dataSource={rows} size="small"
        pagination={{ pageSize: 50, showSizeChanger: false }}
        rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]), preserveSelectedRowKeys: true }}
        locale={{ emptyText: applied === null ? <Empty description={t('del.pressSearch')} /> : list.isError ? errText(list.error) : t('del.empty') }}
        toolbar={(
          <Space wrap>
            <Select<DeletableKind> value={kind} onChange={(v) => { setKind(v); setPicked([]) }} style={{ width: 170 }} aria-label={t('del.kind')}
              options={[
                { value: 'overtime', label: t('del.kindOvertime') },
                { value: 'finger', label: t('del.kindFinger') },
                { value: 'leave', label: t('del.kindLeave') },
              ]} />
            <Input allowClear value={empId} onChange={(e) => setEmpId(e.target.value)} onPressEnter={search} placeholder={t('del.employeePh')} style={{ width: 170 }} maxLength={50} />
            <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range}
              onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
              presets={[
                { label: t('att.thisMonth'), value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                { label: t('att.lastMonth'), value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
              ]} />
            <Button type="primary" loading={list.isFetching} onClick={search}>{t('del.search')}</Button>
            <Popconfirm title={t('del.confirmTitle', { n: picked.length })} description={(
                <div style={{ maxWidth: 320 }}>
                  <div>{t('del.confirmBody', { emp: who })}</div>
                  {inClosing && <div style={{ color: '#D92D20', fontWeight: 600, marginTop: 6 }}>{t('del.closingWarn')}</div>}
                </div>
              )}
              okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} disabled={picked.length === 0}
              onConfirm={() => remove.mutate(picked)}>
              <Button danger icon={<DeleteOutlined />} disabled={picked.length === 0} loading={remove.isPending}>{t('del.deleteN', { n: picked.length })}</Button>
            </Popconfirm>
          </Space>
        )}
      />
    </div>
  )
}
