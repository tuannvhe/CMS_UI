import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface TabItem { key: string; label: ReactNode }

/** Tab hiện tại lưu trên URL (?tab=...) để tải lại trang / chia sẻ link vẫn đúng tab. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePageTab(items: TabItem[]) {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('tab')
  const active = items.find((i) => i.key === wanted)?.key ?? items[0].key
  const setActive = (key: string) =>
    setParams((p) => { const n = new URLSearchParams(p); n.set('tab', key); return n }, { replace: true })
  return [active, setActive] as const
}

interface Props {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
}

/**
 * Dải tab ở đầu vùng nội dung (dính trên cùng khi cuộn): viên thuốc có thanh nền trượt sang tab được chọn,
 * và nội dung bên dưới (khối .page kế tiếp) hiện lại dịu dần mỗi lần đổi tab.
 */
export function PageTabs({ items, active, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null)

  const measure = () => {
    const el = track.current?.querySelector<HTMLElement>('.page-tab.active')
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth })
  }
  useLayoutEffect(() => {
    measure()
    const ro = typeof ResizeObserver !== 'undefined' && track.current ? new ResizeObserver(measure) : null
    if (ro && track.current) ro.observe(track.current)
    return () => ro?.disconnect()
  }, [active, items.length])

  // Hiệu ứng chuyển tab cho nội dung: chạy lại animation trên khối trang kế tiếp (không chạy ở lần hiện đầu tiên).
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const next = wrap.current?.nextElementSibling as HTMLElement | null
    if (!next) return
    next.classList.remove('tab-enter')
    void next.offsetWidth
    next.classList.add('tab-enter')
  }, [active])

  return (
    <div className="page-tabs-wrap" ref={wrap}>
      <div className="page-tabs" role="tablist" ref={track}>
        {bar && <span className="page-tab-bar" style={{ transform: `translateX(${bar.left}px)`, width: bar.width }} aria-hidden />}
        {items.map((i) => (
          <button
            key={i.key}
            role="tab"
            aria-selected={i.key === active}
            className={`page-tab${i.key === active ? ' active' : ''}`}
            onClick={() => onChange(i.key)}
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  )
}
