import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Dropdown, Tooltip } from 'antd'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { NotificationBell } from './NotificationBell'
import { HnNotificationBell } from './HnNotificationBell'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ALL_PAGES, HN_ALL_PAGES, siteHome, useCurrentNav } from '../config/navigation'
import { useAuth } from '../auth/AuthContext'

const MAX_TABS = 12
/** Tra trang theo khóa một lần (không dò cả danh sách mỗi lần vẽ) */
const PAGE_BY_KEY = new Map([...ALL_PAGES, ...HN_ALL_PAGES].map((p) => [p.key, p]))
interface OpenTab { key: string; url: string }

// Cơ sở HN lưu tab riêng (khóa có tiền tố hn:) để không lẫn với tab của VINA khi cùng mã tài khoản
const storeKey = (uid: string, hn: boolean) => `cmsvn.openTabs:${hn ? 'hn:' : ''}${uid}`
function load(uid: string, hn: boolean): OpenTab[] {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(uid, hn)) ?? '[]') as OpenTab[]
    return Array.isArray(v) ? v.filter((x) => x && typeof x.key === 'string' && typeof x.url === 'string' && x.url.startsWith('/')) : []
  } catch { return [] }
}

/**
 * Nhiều tab kiểu trình duyệt: mỗi màn đã mở là một tab (một tab cho mỗi màn, nhớ địa chỉ cuối cùng gồm cả ?tham số), bấm để quay lại,
 * X / chuột giữa để đóng, chuột phải để đóng các tab khác. Lưu theo tài khoản trên trình duyệt. Đổi tab thì màn được tải lại
 * (dữ liệu đã tải vẫn lấy từ bộ nhớ đệm nên nhanh), không giữ chữ đang gõ dở.
 */
function useOpenTabs() {
  const authUser = useAuth().user
  const uid = authUser?.userId ?? ''
  const hn = authUser?.site === 'HN'
  const { pathname, search } = useLocation()
  const { page } = useCurrentNav()
  const [tabs, setTabs] = useState<OpenTab[]>(() => (uid ? load(uid, hn) : []))
  const loaded = useRef(uid)
  useEffect(() => { if (loaded.current !== uid) { loaded.current = uid; setTabs(uid ? load(uid, hn) : []) } }, [uid, hn])

  const url = pathname + search
  useEffect(() => {
    setTabs((prev) => {
      const i = prev.findIndex((x) => x.key === page.key)
      if (i >= 0) return prev[i].url === url ? prev : prev.map((x, j) => (j === i ? { ...x, url } : x))
      const next = [...prev, { key: page.key, url }]
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next   // quá giới hạn: bỏ tab cũ nhất bên trái
    })
  }, [page.key, url])

  useEffect(() => { if (uid) { try { localStorage.setItem(storeKey(uid, hn), JSON.stringify(tabs)) } catch { /* không lưu được thì chỉ nhớ trong phiên */ } } }, [uid, hn, tabs])
  return { tabs, setTabs, active: page.key }
}

/**
 * Một tab. memo: đổi màn chỉ vẽ lại 2 tab đổi trạng thái (cũ / mới), không vẽ lại cả dải. Không có hàm riêng cho từng tab:
 * bấm / chuột giữa / chuột phải / bàn phím đều bắt ở dải tab (data-key), và chỉ có một menu chuột phải dùng chung.
 */
const TabItem = memo(function TabItem({ id, label, icon, on, closable, closeLabel }: { id: string; label: string; icon: ReactNode; on: boolean; closable: boolean; closeLabel: string }) {
  return (
    <div role="tab" aria-selected={on} tabIndex={0} className={`otab${on ? ' on' : ''}`} title={label} data-key={id}>
      <span className="otab-ico" aria-hidden>{icon}</span>
      <span className="otab-txt">{label}</span>
      {closable && <button type="button" className="otab-x" data-close={id} aria-label={`${closeLabel}: ${label}`}><CloseOutlined /></button>}
    </div>
  )
})

const keyOf = (e: { target: EventTarget }) => (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key

/** Thanh trên cùng: các màn đang mở (tab) + góc phải Tìm kiếm (Ctrl+K) và chuông thông báo. Hỏi đáp là thanh chat nổi ở góc dưới bên phải (QaPanel). */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const home = siteHome(user)
  const isHn = user?.site === 'HN'
  const { tabs, setTabs, active } = useOpenTabs()
  const strip = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ l: false, r: false })
  const [menuKey, setMenuKey] = useState<string | null>(null)
  const measure = useCallback(() => {
    const el = strip.current
    if (!el) return
    const l = el.scrollLeft > 2, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setFade((f) => (f.l === l && f.r === r ? f : { l, r }))
  }, [])

  // Tab đang mở luôn nằm trong vùng nhìn thấy (chỉ cuộn khi đang bị khuất)
  useEffect(() => {
    const el = strip.current, on = el?.querySelector<HTMLElement>('.otab.on')
    if (el && on && (on.offsetLeft < el.scrollLeft || on.offsetLeft + on.offsetWidth > el.scrollLeft + el.clientWidth)) on.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
  }, [active, tabs.length, measure])
  // Con lăn chuột dọc cuộn dải tab theo chiều ngang; đổi kích thước cửa sổ thì tính lại phần bị khuất
  useEffect(() => {
    const el = strip.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(el)
    return () => { el.removeEventListener('wheel', onWheel); ro?.disconnect() }
  }, [measure])

  const keep = (fn: (list: OpenTab[], i: number) => OpenTab[], key: string) => {
    const i = tabs.findIndex((x) => x.key === key)
    if (i < 0) return
    const next = fn(tabs, i)
    setTabs(next)
    // Đóng mất tab đang xem: chuyển sang tab bên cạnh (ưu tiên bên trái), hết tab thì về trang chủ
    if (!next.some((x) => x.key === active)) {
      const to = next[Math.min(i, next.length) - 1] ?? next[0]
      navigate(to?.url ?? home)
    }
  }
  const close = (key: string) => keep((l, i) => l.filter((_, j) => j !== i), key)
  const go = (key: string | undefined) => { const tab = tabs.find((x) => x.key === key); if (tab && tab.key !== active) navigate(tab.url) }

  const onClick = (e: React.MouseEvent) => {
    const x = (e.target as HTMLElement).closest<HTMLElement>('[data-close]')?.dataset.close
    if (x) { close(x); return }
    go(keyOf(e))
  }
  const onAux = (e: React.MouseEvent) => { const k = keyOf(e); if (e.button === 1 && k && tabs.length > 1) { e.preventDefault(); close(k) } }
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).dataset.close) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(keyOf(e)) }
  }
  const last = tabs[tabs.length - 1]?.key
  const menuItems = [
    ...(menuKey ? [
      { key: 'close', label: t('openTabs.close'), disabled: tabs.length <= 1 },
      { key: 'others', label: t('openTabs.closeOthers'), disabled: tabs.length <= 1 },
      { key: 'right', label: t('openTabs.closeRight'), disabled: last === menuKey },
      { type: 'divider' as const },
    ] : []),
    { key: 'all', label: t('openTabs.closeAll') },
  ]
  const onMenu = ({ key }: { key: string }) => {
    if (key === 'all') { setTabs([]); navigate(home); return }
    if (!menuKey) return
    if (key === 'close') close(menuKey)
    else if (key === 'others') keep((l, i) => [l[i]], menuKey)
    else if (key === 'right') keep((l, i) => l.slice(0, i + 1), menuKey)
  }
  const closeLabel = t('openTabs.close')

  return (
    <header className="app-topbar">
      <div className="otabs-wrap">
        {tabs.length > 1 && <Tooltip title={t('openTabs.label')} placement="bottom"><span className="otabs-count" aria-label={`${t('openTabs.label')}: ${tabs.length}`}>{tabs.length}</span></Tooltip>}
        <Dropdown trigger={['contextMenu']} menu={{ items: menuItems, onClick: onMenu }}>
          <div
            className={`otabs${fade.l ? ' fade-l' : ''}${fade.r ? ' fade-r' : ''}`} ref={strip} onScroll={measure} role="tablist" aria-label={t('openTabs.label')}
            onClick={onClick} onAuxClick={onAux} onKeyDown={onKey} onContextMenuCapture={(e) => setMenuKey(keyOf(e) ?? null)}
          >
            {tabs.map((tab) => {
              const p = PAGE_BY_KEY.get(tab.key)
              return p ? <TabItem key={tab.key} id={tab.key} label={t(p.labelKey)} icon={p.icon} on={tab.key === active} closable={tabs.length > 1} closeLabel={closeLabel} /> : null
            })}
          </div>
        </Dropdown>
      </div>
      <div className="topbar-actions">
        <Tooltip title={`${t('common.search')}  (Ctrl+K)`} placement="bottom" mouseEnterDelay={0.3}>
          <button type="button" className="topbar-btn" aria-label={t('common.search')} onClick={onSearch}><SearchOutlined /></button>
        </Tooltip>
        {isHn ? <HnNotificationBell className="topbar-btn" placement="bottomRight" tipPlacement="bottom" /> : <NotificationBell className="topbar-btn" placement="bottomRight" tipPlacement="bottom" />}
      </div>
    </header>
  )
}
