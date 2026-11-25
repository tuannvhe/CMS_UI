import { Badge, Drawer } from 'antd'
import { CloseOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { WORKSPACES, canSee, useCurrentNav, type Workspace } from '../config/navigation'
import { usePendingApprovals } from '../hooks/usePendingApprovals'
import { usePendingEvaluations } from '../hooks/usePendingEvaluations'
import { usePendingRegistrations } from '../hooks/usePendingRegistrations'
import { usePendingReview } from '../hooks/usePendingReview'
import { useQaDots } from '../hooks/useQaDots'
import { UserPanel } from './UserPanel'

/** Số đơn / việc chờ của từng trang (cùng quy tắc với thanh bên trên máy tính). */
function usePageBadges() {
  const pending = usePendingApprovals()
  const evaluationCount = usePendingEvaluations()
  const registrationCount = usePendingRegistrations()
  const reviewCount = usePendingReview()
  const qaDots = useQaDots()
  const count = (key: string) => key === 'approvalFinger' ? pending.forms('finger') : key === 'approvalOvertime' ? pending.forms('overtime') : key === 'approvalLeave' ? pending.forms('leave') : key === 'approvalGoOut' ? pending.forms('goout') : key === 'approvalLate' ? pending.forms('late') : key === 'approvalEarly' ? pending.forms('early') : key === 'evaluation' ? evaluationCount : key === 'evaluationRegister' ? registrationCount : key === 'evaluationHr' ? reviewCount : 0
  const dot = (key: string) => (key === 'qa' && qaDots.reply) || (key === 'qaManage' && qaDots.pending)
  return { count, dot }
}

/** Danh sách trang của một phân hệ dạng nhóm kiểu iOS: icon, tên, số chờ, mũi tên. */
export function PageList({ workspace, onNavigate }: { workspace: Workspace; onNavigate: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { page } = useCurrentNav()
  const badges = usePageBadges()
  return (
    <div className="mm-group">
      {workspace.pages.filter((p) => canSee(p, user)).map((p) => (
        <button key={p.key} type="button" className={`mm-item${p.key === page.key ? ' active' : ''}`} onClick={() => { navigate(p.path); onNavigate() }}>
          <span className="mm-ico">{p.icon}</span>
          <span className="mm-text">
            <span className="mm-title">{t(p.labelKey)}</span>
            <span className="mm-desc">{t(p.descKey)}</span>
          </span>
          {badges.dot(p.key) && <Badge dot status="error" />}
          {badges.count(p.key) > 0 && <Badge count={badges.count(p.key)} overflowCount={99} />}
          <RightOutlined className="mm-chev" />
        </button>
      ))}
    </div>
  )
}

/** Màn Menu toàn màn hình trên điện thoại: tài khoản + mọi phân hệ và trang người dùng được thấy. */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const visible = WORKSPACES.filter((w) => w.pages.some((p) => canSee(p, user)))
  return (
    <Drawer placement="right" open={open} onClose={onClose} closable={false} size="100%" className="mobile-menu" styles={{ body: { padding: 0 } }}>
      <div className="mm-head">
        <h2>{t('common.menu')}</h2>
        <button type="button" className="mm-close" aria-label="Close" onClick={onClose}><CloseOutlined /></button>
      </div>
      <div className="mm-body">
        <div className="mm-group mm-user"><UserPanel block /></div>
        {visible.map((w) => (
          <section key={w.key}>
            <div className="mm-label">{t(w.labelKey)}</div>
            <PageList workspace={w} onNavigate={onClose} />
          </section>
        ))}
      </div>
    </Drawer>
  )
}
