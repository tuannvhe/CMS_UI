import type { ReactNode } from 'react'
import { Badge } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { WORKSPACES, canSee, homeOf, useCurrentNav } from '../config/navigation'
import { usePendingApprovals } from '../hooks/usePendingApprovals'
import { usePendingEvaluations } from '../hooks/usePendingEvaluations'
import { useQaDots } from '../hooks/useQaDots'

/** Phân hệ có tab riêng dưới đáy (theo thứ tự); phân hệ người dùng không được thấy thì bỏ qua. Các phân hệ còn lại nằm trong Menu. */
export const TAB_WORKSPACES = ['home', 'attendance', 'forms', 'requests'] as const

function Tab({ label, icon, active, onClick, badge, dot }: { label: string; icon: ReactNode; active: boolean; onClick: () => void; badge?: number; dot?: boolean }) {
  return (
    <button type="button" className={`mtab${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Badge count={badge} dot={!badge && dot} size="small" overflowCount={99} offset={[2, 2]}>
        <span className="mtab-ico">{icon}</span>
      </Badge>
      <span className="mtab-label">{label}</span>
    </button>
  )
}

/** Thanh tab dưới đáy màn hình trên điện thoại (kiểu ứng dụng iOS / Android). */
export function MobileTabBar({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { workspace } = useCurrentNav()
  const pending = usePendingApprovals()
  const evaluationCount = usePendingEvaluations()
  const qaDots = useQaDots()

  const tabs = TAB_WORKSPACES.map((k) => WORKSPACES.find((w) => w.key === k)!).filter((w) => w.pages.some((p) => canSee(p, user)))
  const inTabs = tabs.some((w) => w.key === workspace.key)

  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      {tabs.map((w) => (
        <Tab
          key={w.key}
          label={t(w.labelKey)}
          icon={w.icon}
          active={!menuOpen && workspace.key === w.key}
          badge={w.key === 'requests' ? pending.total : undefined}
          dot={w.key === 'attendance' && (qaDots.reply || qaDots.pending)}
          onClick={() => navigate(homeOf(w, user))}
        />
      ))}
      <Tab label={t('common.menu')} icon={<MenuOutlined />} active={menuOpen || !inTabs} badge={evaluationCount || undefined} onClick={onMenu} />
    </nav>
  )
}
