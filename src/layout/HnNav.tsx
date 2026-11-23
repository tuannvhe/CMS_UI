import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Dropdown, Popover, Tooltip } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HN_WORKSPACES, canSee, homeOf, useCurrentNav } from '../config/navigation'
import { useAuth } from '../auth/AuthContext'
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

/**
 * Left rail cho cơ sở HN: cùng kiểu LeftRail của VINA nhưng không gọi API VINA nào (số đơn chờ duyệt, đánh giá, hỏi đáp, nhắc quên chấm công).
 * Chỉ hiện phân hệ có ít nhất một trang được phép thấy.
 */
export function HnLeftRail({ flyout }: { flyout?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspace, page } = useCurrentNav()
  const { user } = useAuth()

  return (
    <nav className="app-rail" aria-label="Primary">
      <div className="rail-logo" aria-hidden><img src={logoMark} alt="" /></div>

      {HN_WORKSPACES.map((w, i) => {
        const pages = w.pages.filter((p) => canSee(p, user))
        if (pages.length === 0) return null
        const btn = <RailButton key={w.key} label={t(w.labelKey)} icon={w.icon} active={workspace.key === w.key} onClick={() => navigate(homeOf(w, user))} />
        const node = flyout && pages.length > 1 ? (
          <Popover key={w.key} placement="rightTop" arrow={false} mouseEnterDelay={0.1} mouseLeaveDelay={0.15} styles={{ container: { padding: 8 } }}
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
            <span>{btn}</span>
          </Popover>
        ) : btn
        return i === 1 ? <Fragment key={w.key}><div className="rail-sep" />{node}</Fragment> : node
      })}

      <div className="rail-spacer" />
      <Popover trigger="click" placement="rightBottom" content={<UserPanel />}>
        <button type="button" aria-label={user?.fullName} className="rail-btn" style={{ marginTop: 4 }}>
          <UserAvatar name={user?.fullName} src={user?.avatarUrl} size={36} preview={false} />
        </button>
      </Popover>
    </nav>
  )
}

/** Sidebar cho cơ sở HN: bộ chọn phân hệ + danh sách trang được phép thấy (không có huy hiệu đếm của VINA). */
export function HnWorkspaceSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { page, workspace } = useCurrentNav()
  const go = (path: string) => { navigate(path); onNavigate?.() }

  const list = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null)
  const [animate, setAnimate] = useState(false)
  const measure = () => {
    const el = list.current?.querySelector<HTMLElement>('.side-item.active')
    setBar(el ? { top: el.offsetTop, height: el.offsetHeight } : null)
  }
  useLayoutEffect(() => {
    measure()
    const timer = window.setTimeout(() => { measure(); setAnimate(true) }, 60)
    const ro = typeof ResizeObserver !== 'undefined' && list.current ? new ResizeObserver(measure) : null
    if (ro && list.current) ro.observe(list.current)
    return () => { window.clearTimeout(timer); ro?.disconnect() }
  }, [page.key, workspace.key, user?.hnModules])

  return (
    <>
      <Dropdown
        trigger={['click']}
        menu={{
          selectedKeys: [workspace.key],
          items: HN_WORKSPACES.filter((w) => w.pages.some((p) => canSee(p, user))).map((w) => ({ key: w.key, icon: w.icon, label: t(w.labelKey) })),
          onClick: ({ key }) => go(homeOf(HN_WORKSPACES.find((w) => w.key === key)!, user)),
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
      <div className="side-list" ref={list} key={workspace.key}>
        {bar && <span className={`side-bar${animate ? ' animate' : ''}`} style={{ transform: `translateY(${bar.top}px)`, height: bar.height }} aria-hidden />}
        {workspace.pages.filter((p) => canSee(p, user)).map((p, i) => (
          <button
            key={p.key}
            type="button"
            className={`side-item${p.key === page.key ? ' active' : ''}`}
            aria-current={p.key === page.key ? 'page' : undefined}
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => go(p.path)}
          >
            <span className="si-icon">{p.icon}</span>
            <span className="si-text" title={`${t(p.labelKey)} – ${t(p.descKey)}`}>
              <div className="si-title">{t(p.labelKey)}</div>
              <div className="si-desc">{t(p.descKey)}</div>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
