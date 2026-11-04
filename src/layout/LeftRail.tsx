import type { ReactNode } from 'react'
import { Badge, Popover, Tooltip } from 'antd'
import { useQaDots } from '../hooks/useQaDots'
import { usePendingApprovals } from '../hooks/usePendingApprovals'
import { usePendingEvaluations } from '../hooks/usePendingEvaluations'
import { SearchOutlined } from '@ant-design/icons'
import { NotificationBell } from './NotificationBell'
import { ForgotPunchReminder } from '../components/ForgotPunchReminder'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORKSPACES, canSee, useCurrentNav } from '../config/navigation'
import { useAuth } from '../auth/AuthContext'
import { homeOf } from '../config/navigation'
import { UserAvatar } from '../components/UserAvatar'
import logoMark from '../assets/logo1.png'
import { UserPanel } from './UserPanel'

function RailButton({ label, icon, active, onClick }: { label: string; icon: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <Tooltip title={label} placement="right" mouseEnterDelay={0.3}>
      <button type="button" aria-label={label} aria-current={active ? 'page' : undefined} className={`rail-btn${active ? ' active' : ''}`} onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  )
}

/** Thanh icon bên trái (left rail): Trang chủ, Tìm kiếm, Thông báo, các phân hệ, Cài đặt, tài khoản. */
export function LeftRail({ onSearch, flyout }: { onSearch: () => void; flyout?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspace, page } = useCurrentNav()
  const { user } = useAuth()
  const pending = usePendingApprovals()
  const evaluationCount = usePendingEvaluations()
  const qaDots = useQaDots()

  const byKey = (k: string) => WORKSPACES.find((w) => w.key === k)!
  /** Chỉ hiện phân hệ mà người dùng có ít nhất một trang được phép thấy (cùng tiêu chí với thanh bên) */
  const vis = (k: string) => byKey(k).pages.some((p) => canSee(p, user))
  const nav = (k: string) => {
    const w = byKey(k)
    const raw = <RailButton key={k} label={t(w.labelKey)} icon={w.icon} active={workspace.key === k} onClick={() => navigate(homeOf(w, user))} />
    // Menu bên cạnh đang ẩn: rê chuột vào icon phân hệ sẽ bung danh sách màn của phân hệ đó
    const pages = w.pages.filter((p) => canSee(p, user))
    const btn = flyout && pages.length > 1 ? (
      <Popover key={k} placement="rightTop" arrow={false} mouseEnterDelay={0.1} mouseLeaveDelay={0.15} styles={{ container: { padding: 8 } }}
        content={(
          <div className="rail-fly">
            <div className="side-fly-title"><span className="sft-icon">{w.icon}</span><span className="sft-text"><b>{t(w.labelKey)}</b><span>{t(w.subKey)}</span></span></div>
            {pages.map((p) => (
              <button key={p.key} type="button" className={`side-fly-item${p.key === page.key ? ' active' : ''}`} onClick={() => navigate(p.path)}>
                <span className="si-icon">{p.icon}</span><span className="si-title">{t(p.labelKey)}</span>
              </button>
            ))}
          </div>
        )}>
        <span>{raw}</span>
      </Popover>
    ) : raw
    const count = k === 'requests' ? pending.total : k === 'evaluation' ? evaluationCount : 0
    if (k === 'attendance' && (qaDots.reply || qaDots.pending)) return <Badge key={k} dot status="error" offset={[-8, 8]}>{btn}</Badge>
    return count > 0 ? <Badge key={k} count={count} size="small" overflowCount={99} offset={[-6, 6]}>{btn}</Badge> : btn
  }

  return (
    <nav className="app-rail" aria-label="Primary">
      <div className="rail-logo" aria-hidden><img src={logoMark} alt="" /></div>

      {nav('home')}
      <RailButton label={`${t('common.search')}  (Ctrl+K)`} icon={<SearchOutlined />} onClick={onSearch} />
      <NotificationBell />
      <ForgotPunchReminder />

      <div className="rail-sep" />
      {(['attendance', 'payroll', 'forms', 'requests', 'evaluation', 'recruit', 'meeting', 'security', 'org', 'system', 'other'] as const).map((k) => (vis(k) ? nav(k) : null))}

      <div className="rail-spacer" />
      {nav('settings')}
      <Popover trigger="click" placement="rightBottom" content={<UserPanel />}>
        <button type="button" aria-label={user?.fullName} className="rail-btn" style={{ marginTop: 4 }}>
          <UserAvatar name={user?.fullName} src={user?.avatarUrl} size={36} preview={false} />
        </button>
      </Popover>
    </nav>
  )
}
