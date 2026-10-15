import { useAuth } from '../auth/AuthContext'
import { Badge, Dropdown } from 'antd'
import { useQaDots } from '../hooks/useQaDots'
import { usePendingApprovals } from '../hooks/usePendingApprovals'
import { usePendingEvaluations } from '../hooks/usePendingEvaluations'
import { usePendingRegistrations } from '../hooks/usePendingRegistrations'
import { usePendingReview } from '../hooks/usePendingReview'
import { DownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORKSPACES, canSee, useCurrentNav } from '../config/navigation'

/** Sidebar: bộ chọn phân hệ ở trên + danh sách trang của phân hệ đang mở (icon tròn + tên + mô tả). */
export function WorkspaceSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { page, workspace } = useCurrentNav()
  const pending = usePendingApprovals()
  const evaluationCount = usePendingEvaluations()
  const registrationCount = usePendingRegistrations()
  const reviewCount = usePendingReview()
  const qaDots = useQaDots()
  const badgeOf = (key: string) => key === 'approvalFinger' ? pending.forms('finger') : key === 'approvalOvertime' ? pending.forms('overtime') : key === 'approvalLeave' ? pending.forms('leave') : key === 'approvalGoOut' ? pending.forms('goout') : key === 'approvalLate' ? pending.forms('late') : key === 'approvalEarly' ? pending.forms('early') : key === 'evaluation' ? evaluationCount : key === 'evaluationRegister' ? registrationCount : key === 'evaluationHr' ? reviewCount : 0

  const go = (path: string) => { navigate(path); onNavigate?.() }

  return (
    <>
      <Dropdown
        trigger={['click']}
        menu={{
          selectedKeys: [workspace.key],
          items: WORKSPACES.filter((w) => w.pages.some((p) => canSee(p, user))).map((w) => ({ key: w.key, icon: w.icon, label: t(w.labelKey) })),
          onClick: ({ key }) => go(WORKSPACES.find((w) => w.key === key)!.home),
        }}
      >
        <button type="button" className="side-selector" aria-label={t(workspace.labelKey)}>
          <span className="ws-icon">{workspace.icon}</span>
          <span className="ws-name">
            {t(workspace.labelKey)}
            <br />
            <span className="ws-sub">{t(workspace.subKey)}</span>
          </span>
          <DownOutlined style={{ fontSize: 11, color: 'var(--c-muted)' }} />
        </button>
      </Dropdown>

      <div className="side-label">{t('common.menu')}</div>
      {workspace.pages.filter((p) => canSee(p, user)).map((p) => (
        <button
          key={p.key}
          type="button"
          className={`side-item${p.key === page.key ? ' active' : ''}`}
          aria-current={p.key === page.key ? 'page' : undefined}
          onClick={() => go(p.path)}
        >
          <span className="si-icon">{p.icon}</span>
          <span className="si-text" title={`${t(p.labelKey)} – ${t(p.descKey)}`}>
            <div className="si-title">{t(p.labelKey)}</div>
            <div className="si-desc">{t(p.descKey)}</div>
          </span>
          {((p.key === 'qa' && qaDots.reply) || (p.key === 'qaManage' && qaDots.pending)) && <Badge dot status="error" style={{ marginLeft: 'auto' }} />}
          {badgeOf(p.key) > 0 && <Badge count={badgeOf(p.key)} overflowCount={99} style={{ marginLeft: 'auto' }} />}
        </button>
      ))}
    </>
  )
}
