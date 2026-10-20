import { useLayoutEffect, useRef, useState } from 'react'
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
import { WORKSPACES, canSee, homeOf, useCurrentNav } from '../config/navigation'

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

  // Thanh nền trượt tới mục đang chọn (có hiệu ứng khi đổi trang); lần đo đầu tiên không chạy hiệu ứng.
  const list = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null)
  const [animate, setAnimate] = useState(false)
  const measure = () => {
    const el = list.current?.querySelector<HTMLElement>('.side-item.active')
    setBar(el ? { top: el.offsetTop, height: el.offsetHeight } : null)
  }
  useLayoutEffect(() => {
    measure()
    const t = window.setTimeout(() => setAnimate(true), 60)
    const ro = typeof ResizeObserver !== 'undefined' && list.current ? new ResizeObserver(measure) : null
    if (ro && list.current) ro.observe(list.current)
    return () => { window.clearTimeout(t); ro?.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.key, workspace.key])

  return (
    <>
      <Dropdown
        trigger={['click']}
        menu={{
          selectedKeys: [workspace.key],
          items: WORKSPACES.filter((w) => w.pages.some((p) => canSee(p, user))).map((w) => ({ key: w.key, icon: w.icon, label: t(w.labelKey) })),
          onClick: ({ key }) => go(homeOf(WORKSPACES.find((w) => w.key === key)!, user)),
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
          {((p.key === 'qa' && qaDots.reply) || (p.key === 'qaManage' && qaDots.pending)) && <Badge dot status="error" style={{ marginLeft: 'auto' }} />}
          {badgeOf(p.key) > 0 && <Badge count={badgeOf(p.key)} overflowCount={99} style={{ marginLeft: 'auto' }} />}
        </button>
      ))}
      </div>
    </>
  )
}
