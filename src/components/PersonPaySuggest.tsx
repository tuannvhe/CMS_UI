import { useEffect, useState } from 'react'
import { Alert, Button, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeInvisibleOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { payrollError, payrollPeople, type PersonPayCompare, type PersonPayDiff } from '../api/payroll'
import { useToast } from '../hooks/useToast'
import { AppModal } from './AppModal'

/**
 * Sau khi nhập / đăng phiếu lương một kỳ: so sánh lương hợp đồng suy ra từ phiếu với hồ sơ lương từng người và gợi ý cập nhật
 * (chưa có hồ sơ, lương thay đổi). Không ghi gì cho tới khi HR xem và xác nhận. Người không có quyền trang "Lương từng người" hoặc chưa cấu hình khóa thì không thấy gợi ý.
 */
export function PersonPaySuggest({ period }: { period: string | null }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const [cmp, setCmp] = useState<PersonPayCompare | null>(null)
  const [open, setOpen] = useState(false)
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)

  const compare = useMutation({
    mutationFn: (p: string) => payrollPeople.fromPayslips(p),
    onSuccess: (c) => { setCmp(c); setDone(false) },
    onError: (e) => { setCmp(null); const c = payrollError(e).code; if (c !== 'forbidden' && c !== 'table_missing' && c !== 'key_missing') msg.error(t('cls.err.generic')) },
  })
  const commit = useMutation({
    mutationFn: () => payrollPeople.commit(cmp!.token),
    onSuccess: (r) => { msg.success(t('prp.committed', { n: r.rows })); setOpen(false); setDone(true); setCmp(null) },
    onError: () => msg.error(t('cls.err.generic')),
  })
  useEffect(() => { if (period) compare.mutate(period); else { setCmp(null); setDone(false) } }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number | null) => (n == null ? '—' : show ? n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language) : '••••••')
  const todo = (cmp?.new ?? 0) + (cmp?.changed ?? 0)
  if (done) return <Alert type="success" showIcon style={{ marginTop: 12 }} title={t('prp.sug.done')} closable />
  if (!cmp || todo === 0) return null

  const cols = (changed: boolean): ColumnsType<PersonPayDiff> => [
    { title: t('org.colEmp'), dataIndex: 'employeeId', width: 110 },
    { title: t('org.colName'), dataIndex: 'fullName' },
    ...(changed ? [{ title: t('prp.sug.old'), dataIndex: 'old', width: 140, align: 'right' as const, render: (v: number | null) => fmt(v) }] : []),
    { title: t('prp.sug.new'), dataIndex: 'new', width: 140, align: 'right' as const, render: (v: number) => <b>{fmt(v)}</b> },
    ...(changed ? [{ title: '%', width: 80, align: 'right' as const, render: (_: unknown, r: PersonPayDiff) => <Tag color={r.new > (r.old ?? 0) ? 'green' : 'red'}>{r.old ? `${(((r.new - r.old) / r.old) * 100).toFixed(1)}%` : ''}</Tag> }] : []),
  ]

  return (
    <>
      <Alert type="info" showIcon style={{ marginTop: 12 }} title={t('prp.sug.title', { period: cmp.period })}
        description={t('prp.sug.text', { added: cmp.new, changed: cmp.changed, same: cmp.same })}
        action={<Button type="primary" size="small" icon={<LockOutlined />} onClick={() => setOpen(true)}>{t('prp.sug.view')}</Button>} />
      <AppModal open={open} onClose={() => setOpen(false)} size="lg" icon={<LockOutlined />} title={t('prp.sug.modalTitle', { period: cmp.period })} subtitle={t('prp.sug.modalSub')}
        okText={t('prp.sug.confirm', { n: todo })} okLoading={commit.isPending} onOk={() => commit.mutate()}
        extra={<span><Switch checked={show} onChange={setShow} checkedChildren={<EyeOutlined />} unCheckedChildren={<EyeInvisibleOutlined />} /> {t(show ? 'pay.hide' : 'pay.show')}</span>}>
        <Space wrap style={{ marginBottom: 10 }}>
          <Tag color="blue">{t('prp.sug.new_', { n: cmp.new })}</Tag>
          <Tag color="orange">{t('prp.sug.changed', { n: cmp.changed })}</Tag>
          <Tag>{t('prp.sug.same', { n: cmp.same })}</Tag>
          <Tag>{t('prp.sug.low', { n: cmp.lowHours })}</Tag>
          {cmp.suspect > 0 && <Tag color="red">{t('prp.sug.suspect', { n: cmp.suspect })}</Tag>}
        </Space>
        <Typography.Paragraph type="secondary">{t('prp.sug.help')}</Typography.Paragraph>
        <Tabs items={[
          { key: 'changed', label: t('prp.sug.changed', { n: cmp.changed }), children: <Table<PersonPayDiff> rowKey="employeeId" size="small" columns={cols(true)} dataSource={cmp.changedSample} pagination={{ pageSize: 8, showSizeChanger: false }} /> },
          { key: 'new', label: t('prp.sug.new_', { n: cmp.new }), children: <Table<PersonPayDiff> rowKey="employeeId" size="small" columns={cols(false)} dataSource={cmp.newSample} pagination={{ pageSize: 8, showSizeChanger: false }} /> },
        ]} />
      </AppModal>
    </>
  )
}
