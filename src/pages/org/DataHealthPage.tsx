import { Avatar, Button, Collapse, Popconfirm, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleFilled, MedicineBoxOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dataHealth, type HealthCheck, type HealthRow } from '../../api/dataHealth'
import { lines } from '../../api/lines'
import { userAdmin } from '../../api/userAdmin'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'

const COLOR = { error: 'red', warning: 'orange', info: 'blue' } as const

/** Liên kết "sửa ở màn tương ứng" theo từng phép kiểm tra. */
function fixLink(key: string, r: HealthRow): string | null {
  switch (key) {
    case 'approver_gone':
    case 'approver_no_account':
    case 'dept_no_approver': return `/lines/approval?department=${encodeURIComponent(r.department ?? '')}`
    case 'emp_no_part': return '/org'
    case 'emp_odd_start':
    case 'emp_no_email':
    case 'emp_dup_email': return '/system/employee-import'
    case 'emp_no_account': return '/system/users'
    default: return null
  }
}

/** Sức khỏe dữ liệu: tự kiểm tra chỗ dữ liệu bẩn, mỗi dòng có nút sửa ngay (khoá tài khoản nghỉ việc, tắt người duyệt không còn hiệu lực) hoặc mở sẵn màn sửa. */
export default function DataHealthPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['data-health'], queryFn: () => dataHealth.report(), retry: false, staleTime: 0 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['data-health'] })
  const lock = useMutation({ mutationFn: (id: string) => userAdmin.toggle(Number(id)), onSuccess: () => { msg.success(t('dh.locked')); refresh() }, onError: () => msg.error(t('usr.err.generic')) })
  const bulk = useMutation({
    mutationFn: (key: string) => (key === 'user_resigned' ? dataHealth.lockResigned() : dataHealth.disableApprovers(key)),
    onSuccess: (r, key) => { msg.success(t(key === 'user_resigned' ? 'dh.bulkLocked' : 'dh.bulkDisabled', { n: r.count })); refresh() },
    onError: () => msg.error(t('usr.err.generic')),
  })
  const off = useMutation({ mutationFn: (id: string) => lines.toggleApprover(Number(id)), onSuccess: () => { msg.success(t('dh.disabled')); refresh() }, onError: () => msg.error(t('usr.err.generic')) })

  const d = q.data
  const checks = d?.checks ?? []

  const columns = (c: HealthCheck): ColumnsType<HealthRow> => [
    { title: t('dh.item'), dataIndex: 'title' },
    { title: t('dh.detail'), dataIndex: 'detail', render: (v: string | null) => <span className="cell-muted">{v}</span> },
    {
      title: '', width: 260, align: 'right',
      render: (_: unknown, r) => {
        const link = fixLink(c.key, r)
        return (
          <Space size="small">
            {c.key === 'user_resigned' && (
              <Popconfirm title={t('dh.lockAsk', { name: r.title })} okText={t('dh.lock')} cancelText={t('req.cancel')} onConfirm={() => lock.mutate(r.id)}>
                <Button size="small" danger loading={lock.isPending && lock.variables === r.id}>{t('dh.lock')}</Button>
              </Popconfirm>
            )}
            {(c.key === 'approver_gone' || c.key === 'approver_no_account') && (
              <Popconfirm title={t('dh.disableAsk', { name: r.title })} okText={t('dh.disable')} cancelText={t('req.cancel')} onConfirm={() => off.mutate(r.id)}>
                <Button size="small" danger loading={off.isPending && off.variables === r.id}>{t('dh.disable')}</Button>
              </Popconfirm>
            )}
            {link && <Link to={link}>{t(`dh.fix.${c.key}`)}</Link>}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<MedicineBoxOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.dataHealth')} subtitle={t('nav.dataHealthDesc')}
        extra={<Button icon={<ReloadOutlined />} onClick={refresh} loading={q.isFetching}>{t('dh.recheck')}</Button>} />
      {d && (
        <StatTiles items={[
          { label: t('dh.tileProblems'), value: d.problems, color: d.problems ? '#D48806' : undefined },
          { label: t('dh.tileErrors'), value: checks.filter((c) => c.severity === 'error').reduce((s, c) => s + c.total, 0), color: '#D92D20' },
          { label: t('dh.tileOk'), value: checks.filter((c) => c.total === 0).length, unit: `/ ${checks.length}` },
        ]} />
      )}
      {q.isError && <div className="cell-muted">{t('usr.err.generic')}</div>}
      <Collapse
        style={{ marginTop: 12 }}
        items={checks.map((c) => ({
          key: c.key,
          label: (
            <Space wrap>
              {c.total === 0 ? <CheckCircleFilled style={{ color: '#12B76A' }} /> : <Tag color={COLOR[c.severity]} variant="filled">{c.total}</Tag>}
              <b>{t(`dh.check.${c.key}`)}</b>
            </Space>
          ),
          children: c.total === 0 ? <span className="cell-muted">{t('dh.allGood')}</span> : (
            <>
              <p className="cell-muted" style={{ marginTop: 0 }}>{t(`dh.why.${c.key}`)}</p>
              {(c.key === 'user_resigned' || c.key === 'approver_gone' || c.key === 'approver_no_account') && (
                <Popconfirm title={t(`dh.bulkAsk.${c.key}`, { n: c.total })} okText={t('dh.bulkDo')} cancelText={t('req.cancel')} okButtonProps={{ danger: true }} onConfirm={() => bulk.mutate(c.key)}>
                  <Button danger style={{ marginBottom: 12 }} loading={bulk.isPending && bulk.variables === c.key}>{t(`dh.bulk.${c.key}`, { n: c.total })}</Button>
                </Popconfirm>
              )}
              <Table<HealthRow> size="small" rowKey="id" columns={columns(c)} dataSource={c.rows} pagination={false} />
              {c.total > c.rows.length && <p className="cell-muted" style={{ marginBottom: 0 }}>{t('dh.more', { shown: c.rows.length, total: c.total })}</p>}
            </>
          ),
        }))}
      />
    </div>
  )
}
