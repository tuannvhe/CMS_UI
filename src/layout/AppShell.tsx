import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Drawer } from 'antd'
import { MenuOutlined, SearchOutlined } from '@ant-design/icons'
import logoMark from '../assets/logo1.png'
import { useTranslation } from 'react-i18next'
import { useCurrentNav } from '../config/navigation'
import { useAuth } from '../auth/AuthContext'
import { CommandPalette } from './CommandPalette'
import { LeftRail } from './LeftRail'
import { StatusBar } from './StatusBar'
import { SupportBubble } from '../components/SupportBubble'
import { OccasionDecor } from '../components/OccasionDecor'
import { UserPanel } from './UserPanel'
import { WorkspaceSidebar } from './WorkspaceSidebar'

/**
 * Khung ứng dụng theo wireframe:
 *   left rail | sidebar | main (tabs + nội dung)
 *   bottom bar (trạng thái) trải suốt chiều ngang.
 * Trên điện thoại: rail + sidebar gộp vào Drawer, bottom bar ẩn.
 */
export default function AppShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { page } = useCurrentNav()
  const { user } = useAuth()
  // Trang bị ẩn theo menu của nhóm quyền: không cho vào bằng đường dẫn trực tiếp (về trang chủ).
  const blocked = !!user?.hiddenPages?.includes(page.key)
  // Còn dùng mật khẩu mặc định: chỉ được ở trang đổi mật khẩu.
  const mustChange = !!user?.mustChangePassword && pathname !== '/settings/security'
  const mainRef = useRef<HTMLElement>(null)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Về đầu trang khi đổi trang
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [pathname])

  // Ctrl/Cmd + K mở hộp tìm kiếm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <div className="app-shell">
        <header className="app-mobilebar">
          <button type="button" className="rail-btn" aria-label={t('common.menu')} onClick={() => setDrawerOpen(true)}><MenuOutlined /></button>
          <strong style={{ flex: 1, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(page.labelKey)}</strong>
          <button type="button" className="rail-btn" aria-label={t('common.search')} onClick={() => setPaletteOpen(true)}><SearchOutlined /></button>
        </header>

        <LeftRail onSearch={() => setPaletteOpen(true)} />

        <aside className="app-side" aria-label={t('common.menu')}>
          <WorkspaceSidebar />
        </aside>

        <main className="app-main" ref={mainRef}>
          {mustChange ? <Navigate to="/settings/security" replace /> : blocked ? <Navigate to="/" replace /> : <Outlet />}
        </main>


        <StatusBar />
        <SupportBubble />
        <OccasionDecor />
      </div>

      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        closable={false}
        size={300}
        styles={{ body: { padding: 12 } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="rail-logo" style={{ margin: 0 }} aria-hidden><img src={logoMark} alt="" /></div>
          <strong style={{ fontSize: 17 }}>{t('appName')}</strong>
        </div>
        <WorkspaceSidebar onNavigate={() => setDrawerOpen(false)} />
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--c-border)' }}>
          <UserPanel />
        </div>
      </Drawer>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
