import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Popconfirm, Segmented, Space, Tag } from 'antd'
import { FileExcelOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { recruit, type BlacklistRow, type RecruitApplication } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { useToast } from '../../hooks/useToast'
import { isRecruitLead } from './RecruitCommon'

const useErr = () => {
  const { t } = useTranslation()
  return (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
}

/**
 * Dò trùng khi HR nhập SĐT / CCCD ở form tạo hồ sơ (chờ 0,5 giây sau lần gõ cuối): hồ sơ cũ trùng chỉ cảnh báo, người trong danh sách đen thì báo đỏ
 * (máy chủ sẽ chặn tạo). CCCD gửi trong thân POST.
 */
export function DuplicateCheck({ phone, idNo, onOpen }: { phone?: string; idNo?: string; onOpen?: (id: number) => void }) {
  const { t, i18n } = useTranslation()
  const [args, setArgs] = useState<{ phone?: string; idNo?: string }>({})
  useEffect(() => {
    const h = setTimeout(() => setArgs({ phone: (phone ?? '').trim() || undefined, idNo: (idNo ?? '').trim() || undefined }), 500)
    return () => clearTimeout(h)
  }, [phone, idNo])
  const digits = (args.phone ?? '').replace(/\D/g, '')
  const idOk = /^(\d{9}|\d{12})$/.test((args.idNo ?? '').replace(/[\s.-]/g, ''))
  const q = useQuery({ queryKey: ['recruit', 'check', args], queryFn: () => recruit.check({ phone: args.phone, idNo: idOk ? args.idNo : undefined }), enabled: digits.length >= 8 || idOk, retry: false, staleTime: 30_000 })
  const r = q.data
  if (!r || (r.duplicates.length === 0 && r.blacklist.length === 0)) return null
  return (
    <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
      {r.blacklist.length > 0 && (
        <Alert type="error" showIcon message={t('rec.bl.hit')} description={r.blacklist.map((b) => <div key={b.id}><b>{b.fullName}</b>: {b.reason}</div>)} />
      )}
      {r.duplicates.length > 0 && (
        <Alert type="warning" showIcon message={t('rec.dup.title', { n: r.duplicates.length })} description={r.duplicates.map((d) => (
          <div key={d.applicationId}>
            <Tag>{t(`rec.dup.${d.match}`)}</Tag>
            {onOpen ? <a onClick={() => onOpen(d.applicationId)}>{d.fullName}</a> : <b>{d.fullName}</b>} · {d.position} · {t(`rec.st.${d.status}`)} · {new Date(d.createdAt).toLocaleDateString(i18n.language)}
          </div>
        ))} />
      )}
    </Space>
  )
}

/** Đưa người của hồ sơ đang xem vào danh sách đen (bắt buộc lý do). */
export function BlacklistButton({ app }: { app: RecruitApplication }) {
  const { t } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: () => recruit.addBlacklist({ applicationId: app.id, reason: reason.trim() }),
    onSuccess: () => { msg.success(t('rec.bl.added')); setOpen(false); setReason(''); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(err(e)),
  })
  return (
    <>
      <Button type="text" danger icon={<StopOutlined />} onClick={() => setOpen(true)}>{t('rec.bl.add')}</Button>
      <AppModal open={open} onClose={() => setOpen(false)} size="sm" icon={<StopOutlined />} title={t('rec.bl.addTitle', { name: app.fullName })} subtitle={t('rec.bl.addHint')}
        okText={t('rec.bl.add')} danger okDisabled={reason.trim().length < 5} okLoading={m.isPending} onOk={() => m.mutate()}>
        <div style={{ marginBottom: 6 }}>{t('rec.bl.reason')}</div>
        <Input.TextArea rows={3} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
      </AppModal>
    </>
  )
}

/** Tab "Danh sách đen": HR xem và thêm tay; chỉ Admin / Trưởng HR gỡ. */
export function BlacklistPanel({ idNo }: { idNo: boolean }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const { user } = useAuth()
  const lead = isRecruitLead(user)
  const [all, setAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form] = Form.useForm<{ fullName: string; phone?: string; idNo?: string; reason: string }>()
  const q = useQuery({ queryKey: ['recruit', 'blacklist', all], queryFn: () => recruit.blacklist(all), retry: false })
  const add = useMutation({
    mutationFn: (v: { fullName: string; phone?: string; idNo?: string; reason: string }) => recruit.addBlacklist(v),
    onSuccess: () => { msg.success(t('rec.bl.added')); setAdding(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(err(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => recruit.removeBlacklist(id),
    onSuccess: () => { msg.success(t('rec.bl.removed')); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(err(e)),
  })
  const day = (v: string) => new Date(v).toLocaleDateString(i18n.language)
  // Xuất danh sách đang xem ra tệp CSV (UTF-8 có BOM, Excel mở trực tiếp)
  const exportCsv = () => {
    const cell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = [t('rec.fullName'), t('rec.phone'), 'CCCD', t('rec.bl.reason'), t('rec.bl.addedBy'), 'Ngày thêm', 'Ngày gỡ', 'Người gỡ', 'Ghi chú gỡ']
    const lines = (q.data ?? []).map((r) => [r.fullName, r.phone, r.idLast4 ? `****${r.idLast4}` : '', r.reason, r.createdBy, day(r.createdAt), r.removedAt ? day(r.removedAt) : '', r.removedBy, r.removeNote].map(cell).join(','))
    const url = URL.createObjectURL(new Blob(['\ufeff' + [head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'DanhSachDen.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  return (
    <>
      <DataTable<BlacklistRow>
        rowKey="id" loading={q.isLoading} dataSource={q.data ?? []} pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: q.isError ? err(q.error) : t('rec.bl.empty') }}
        rowClassName={(r) => (r.removedAt ? 'row-muted' : '')}
        toolbar={(
          <Space wrap>
            <Segmented value={all ? 'all' : 'active'} onChange={(v) => setAll(v === 'all')} options={[{ value: 'active', label: t('rec.bl.active') }, { value: 'all', label: t('rec.bl.all') }]} />
            <Button type="primary" danger icon={<StopOutlined />} onClick={() => setAdding(true)}>{t('rec.bl.addManual')}</Button>
            <Button icon={<FileExcelOutlined />} disabled={!(q.data ?? []).length} onClick={exportCsv}>{t('rec.ex.btn')}</Button>
          </Space>
        )}
        columns={[
          { title: t('rec.fullName'), render: (_: unknown, r) => <span><b>{r.fullName}</b>{r.applicationId && <div className="cell-muted">#{r.applicationId}</div>}</span> },
          { title: t('rec.phone'), dataIndex: 'phone', width: 140, render: (v: string | null) => v ?? '—' },
          { title: 'CCCD', dataIndex: 'idLast4', width: 110, render: (v: string | null) => (v ? `•••• ${v}` : '—') },
          { title: t('rec.bl.reason'), dataIndex: 'reason' },
          { title: t('rec.bl.addedBy'), width: 150, render: (_: unknown, r) => <span>{r.createdBy}<div className="cell-muted">{day(r.createdAt)}</div></span> },
          { title: '', width: 150, render: (_: unknown, r) => r.removedAt
            ? <span className="cell-muted">{t('rec.bl.removedOn', { d: day(r.removedAt), by: r.removedBy })}</span>
            : lead ? <Popconfirm title={t('rec.bl.removeAsk')} onConfirm={() => remove.mutate(r.id)}><Button size="small">{t('rec.bl.remove')}</Button></Popconfirm> : null },
        ]}
      />
      <AppModal open={adding} onClose={() => setAdding(false)} size="sm" icon={<StopOutlined />} title={t('rec.bl.addManual')} subtitle={t('rec.bl.manualHint')} okText={t('rec.bl.add')} danger
        okLoading={add.isPending} onOk={() => form.validateFields().then((v) => add.mutate(v))}>
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item name="fullName" label={t('rec.fullName')} rules={[{ required: true }, { max: 100 }]}><Input /></Form.Item>
          <Form.Item name="phone" label={t('rec.phone')} rules={[{ max: 30 }]}><Input /></Form.Item>
          {idNo && <Form.Item name="idNo" label="CCCD" rules={[{ pattern: /^[\d\s.-]{9,15}$/, message: t('rec.err.idNo') }]}><Input inputMode="numeric" /></Form.Item>}
          <Form.Item name="reason" label={t('rec.bl.reason')} rules={[{ required: true, min: 5, max: 500 }]}><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
        </Form>
      </AppModal>
    </>
  )
}
