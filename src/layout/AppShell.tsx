import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Drawer } from 'antd'
import { DownOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, SearchOutlined } from '@ant-design/icons'
import logoMark from '../assets/logo1.png'
import { useTranslation } from 'react-i18next'
import { canSee, siteHome, useCurrentNav } from '../config/navigation'
import { useIsMobile } from '../hooks/useIsMobile'
import { MobileMenu, PageList } from './MobileMenu'
import { MobileTabBar } from './MobileTabBar'
import { NotificationBell } from './NotificationBell'
import { useAuth } from '../auth/AuthContext'
import { useDataDictionaryLoader } from '../utils/dataText'
import { CommandPalette } from './CommandPalette'
import { LeftRail } from './LeftRail'
import { StatusBar } from './StatusBar'
import { TopBar } from './TopBar'
import { QaPanel } from './QaPanel'
import { HnLeftRail, HnWorkspaceSidebar } from './HnNav'
import { OccasionDecor } from '../components/OccasionDecor'
import { UserPanel } from './UserPanel'
import { WorkspaceSidebar } from './WorkspaceSidebar'

/**
 * Khung ứng dụng theo wireframe:
 *   left rail | sidebar | top bar (các màn đang mở) / main; Hỏi đáp = nút chat nổi góc dưới bên phải
 *   bottom bar (trạng thái) trải suốt chiều ngang.
 * Trên điện thoại: thanh tiêu đề (bấm để đổi trang cùng phân hệ) + thanh tab dưới đáy + màn Menu toàn màn hình (cơ sở HN: rail + sidebar gộp vào Drawer); bottom bar ẩn.
 */
export default function AppShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { page, workspace } = useCurrentNav()
  const isMobile = useIsMobile()
  const { user } = useAuth()
  // Trang bị ẩn theo menu của nhóm quyền: không cho vào bằng đường dẫn trực tiếp (về trang chủ).
  const blocked = !!user?.hiddenPages?.includes(page.key)
  // Cơ sở HN: không dùng các phần của khung gọi API VINA (đơn chờ duyệt, hỏi đáp, nhắc quên chấm công, SignalR VINA...)
  const isHn = user?.site === 'HN'
  useDataDictionaryLoader(!!user?.userId && !isHn)   // tên bộ phận / chức vụ… hiển thị theo ngôn ngữ đang chọn
  // Còn dùng mật khẩu mặc định: chỉ được ở trang đổi mật khẩu.
  const mustChange = !isHn && !!user?.mustChangePassword && pathname !== '/settings/security'
  const mainRef = useRef<HTMLElement>(null)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Điện thoại (VINA): thanh tab dưới đáy + màn Menu toàn màn hình + bấm tiêu đề để đổi trang cùng phân hệ. Cơ sở HN giữ drawer bên trái.
  const appNav = isMobile && !isHn
  const [menuOpen, setMenuOpen] = useState(false)
  const [pagesOpen, setPagesOpen] = useState(false)
  const siblings = workspace.pages.filter((p) => canSee(p, user))
  useEffect(() => { setMenuOpen(false); setPagesOpen(false) }, [pathname])
  // Ẩn / hiện thanh menu bên cạnh (nhớ theo trình duyệt)
  const [sideHidden, setSideHidden] = useState(() => { try { return localStorage.getItem('cmsvn.sideHidden') === '1' } catch { return false } })
  const toggleSide = () => setSideHidden((v) => { try { localStorage.setItem('cmsvn.sideHidden', v ? '0' : '1') } catch { /* bỏ qua */ } return !v })

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
      <div className={`app-shell${sideHidden ? ' side-hidden' : ''}`}>
        <header className="app-mobilebar">
          {appNav ? (
            <button type="button" className="mb-title" disabled={siblings.length < 2} onClick={() => setPagesOpen(true)}>
              <span className="mb-ws">{t(workspace.labelKey)}</span>
              <span className="mb-page">{t(page.labelKey)}{siblings.length > 1 && <DownOutlined />}</span>
            </button>
          ) : (
            <>
              <button type="button" className="rail-btn" aria-label={t('common.menu')} onClick={() => setDrawerOpen(true)}><MenuOutlined /></button>
              <strong style={{ flex: 1, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(page.labelKey)}</strong>
            </>
          )}
          <button type="button" className="rail-btn" aria-label={t('common.search')} onClick={() => setPaletteOpen(true)}><SearchOutlined /></button>
          {appNav && <NotificationBell placement="bottomRight" tipPlacement="bottom" />}
        </header>

        <TopBar onSearch={() => setPaletteOpen(true)} />

        {isHn ? <HnLeftRail flyout={sideHidden} /> : <LeftRail flyout={sideHidden} />}

        <aside className="app-side" aria-label={t('common.menu')}>
          {!sideHidden && (isHn ? <HnWorkspaceSidebar /> : <WorkspaceSidebar />)}
        </aside>

        <button type="button" className="side-toggle" onClick={toggleSide} aria-label={t(sideHidden ? 'common.showMenu' : 'common.hideMenu')} title={t(sideHidden ? 'common.showMenu' : 'common.hideMenu')}>
          {sideHidden ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>

        <main className="app-main" ref={mainRef}>
          {mustChange ? <Navigate to="/settings/security" replace /> : blocked ? <Navigate to={siteHome(user)} replace /> : <Outlet />}
        </main>


        <StatusBar />
        {appNav && <MobileTabBar menuOpen={menuOpen} onMenu={() => setMenuOpen((v) => !v)} />}
        {!isHn && <QaPanel />}
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
        {isHn ? <HnWorkspaceSidebar onNavigate={() => setDrawerOpen(false)} /> : <WorkspaceSidebar onNavigate={() => setDrawerOpen(false)} />}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--c-border)' }}>
          <UserPanel />
        </div>
      </Drawer>

      {appNav && <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />}
      {appNav && (
        <Drawer placement="bottom" open={pagesOpen} onClose={() => setPagesOpen(false)} closable={false} size="auto" className="sheet-drawer" title={t(workspace.labelKey)}>
          <PageList workspace={workspace} onNavigate={() => setPagesOpen(false)} />
        </Drawer>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
