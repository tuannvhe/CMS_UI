import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Modal, Skeleton, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ojt } from '../../api/ojt'
import './ojt.css'

const MAX = 5

/**
 * Popup khi lập OJT: đề xuất người được báo (leader) trong phòng ban của nhân viên mới. Người có chức vụ leader / quản lý lên trước và được tick sẵn;
 * HR đổi lại tuỳ ý (tối đa 5 người, gồm cả người đã chọn trước đó).
 */
export function OjtLeaderModal({ employeeId, open, current, onClose, onPick }: { employeeId?: string; open: boolean; current: string[]; onClose: () => void; onPick: (ids: string[]) => void }) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['ojt-leaders', employeeId], queryFn: () => ojt.leaders(employeeId!), enabled: open && !!employeeId, staleTime: 60_000 })
  const [sel, setSel] = useState<string[]>([])
  useEffect(() => {
    if (open && q.data) setSel([...new Set([...current, ...q.data.filter((x) => x.isLeader).map((x) => x.person.id)])].slice(0, MAX))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q.data])
  const leaders = (q.data ?? []).filter((x) => x.isLeader)
  const others = (q.data ?? []).filter((x) => !x.isLeader)
  const dept = q.data?.[0]?.person.department
  const toggle = (id: string, on: boolean) => setSel((s) => (on ? (s.includes(id) || s.length >= MAX ? s : [...s, id]) : s.filter((x) => x !== id)))
  const row = (x: NonNullable<typeof q.data>[number]) => (
    <Checkbox key={x.person.id} className="ojt-leader-row" checked={sel.includes(x.person.id)} disabled={!sel.includes(x.person.id) && sel.length >= MAX} onChange={(e) => toggle(x.person.id, e.target.checked)}>
      <b>{x.person.name}</b> <span className="ojt-by">{x.person.id}{x.person.position ? ` · ${x.person.position}` : ''}</span>
    </Checkbox>
  )
  return (
    <Modal open={open} onCancel={onClose} destroyOnHidden width={560} title={t('ojt.leaderTitle', { dept: dept ?? '' })}
      footer={[<Button key="x" onClick={onClose}>{t('ojt.leaderSkip')}</Button>, <Button key="ok" type="primary" disabled={sel.length === 0} onClick={() => { onPick(sel); onClose() }}>{t('ojt.leaderUse', { n: sel.length })}</Button>]}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('ojt.leaderHint', { max: MAX })} />
      {q.isLoading && <Skeleton active />}
      {q.isError && <Alert type="error" showIcon message={t('ojt.err.generic')} />}
      {q.data && q.data.length === 0 && <Empty description={t('ojt.leaderNone')} />}
      {leaders.length > 0 && <div className="ojt-leader-group"><Tag color="blue">{t('ojt.leaderGroup')}</Tag>{leaders.map(row)}</div>}
      {leaders.length === 0 && others.length > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('ojt.leaderNoMatch')} />}
      {others.length > 0 && <div className="ojt-leader-group"><Tag>{t('ojt.leaderOthers')}</Tag>{others.map(row)}</div>}
    </Modal>
  )
}
