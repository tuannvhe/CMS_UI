import type { ReactNode } from 'react'
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

/** Dải tab ở đầu vùng nội dung (dính trên cùng khi cuộn). */
export function PageTabs({ items, active, onChange }: Props) {
  return (
    <div className="page-tabs-wrap">
      <div className="page-tabs" role="tablist">
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
