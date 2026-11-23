import { useCallback, useMemo, useRef, useState, type ThHTMLAttributes } from 'react'
import type { ColumnsType } from 'antd/es/table'

// Kiểu tay kéo: gắn một lần khi module được nạp (không phụ thuộc index.css)
const CSS = `.col-resize{position:absolute;top:0;right:-4px;width:9px;height:100%;cursor:col-resize;z-index:3;touch-action:none}
.col-resize::after{content:"";position:absolute;top:25%;bottom:25%;left:4px;width:1px;background:var(--c-border,#d0d5dd);transition:background .12s}
th:hover>.col-resize::after,.col-resize:hover::after{background:var(--c-primary,#1677ff);width:2px}
body.col-resizing,body.col-resizing *{cursor:col-resize!important;user-select:none!important}`
if (typeof document !== 'undefined' && !document.getElementById('col-resize-css')) {
  const el = document.createElement('style'); el.id = 'col-resize-css'; el.textContent = CSS; document.head.appendChild(el)
}

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & { onResizeWidth?: (w: number) => void; onResetWidth?: () => void }

/** Ô tiêu đề có tay kéo ở mép phải: kéo để đổi độ rộng cột, bấm đúp để về độ rộng mặc định. */
function ResizableTh({ onResizeWidth, onResetWidth, children, ...rest }: ThProps) {
  const ref = useRef<HTMLTableCellElement>(null)
  if (!onResizeWidth) return <th {...rest}>{children}</th>
  const start = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault(); e.stopPropagation()
    const x0 = e.clientX, w0 = ref.current?.getBoundingClientRect().width ?? 100
    let frame = 0
    const move = (ev: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => onResizeWidth(Math.round(Math.min(900, Math.max(56, w0 + ev.clientX - x0)))))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('col-resizing') }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    document.body.classList.add('col-resizing')
  }
  return (
    <th ref={ref} {...rest} style={{ ...rest.style, position: 'relative' }}>
      {children}
      <span className="col-resize" role="separator" aria-orientation="vertical" onPointerDown={start} onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.stopPropagation(); onResetWidth?.() }} />
    </th>
  )
}

const load = (key: string): Record<string, number> => { try { return JSON.parse(localStorage.getItem(`colw.${key}`) ?? '{}') as Record<string, number> } catch { return {} } }

/**
 * Cho kéo giãn / thu nhỏ độ rộng cột của bảng antd, nhớ theo trình duyệt (localStorage "colw.{storageKey}").
 * Cột nhận diện theo key, nếu không có thì theo vị trí; cột không đặt width thì không kéo được.
 */
export function useResizableColumns<T>(storageKey: string, columns: ColumnsType<T>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => load(storageKey))
  const save = useCallback((next: Record<string, number>) => { try { localStorage.setItem(`colw.${storageKey}`, JSON.stringify(next)) } catch { /* trình duyệt chặn lưu */ } }, [storageKey])
  const cols = useMemo(() => columns.map((c, i) => {
    const id = String(c.key ?? (('dataIndex' in c && c.dataIndex) ? String(c.dataIndex) : `c${i}`))
    if (typeof c.width !== 'number') return c
    const width = widths[id] ?? c.width
    return {
      ...c, width,
      onHeaderCell: (col: unknown) => ({
        ...(c.onHeaderCell?.(col as never) ?? {}),
        onResizeWidth: (w: number) => setWidths((s) => { const n = { ...s, [id]: w }; save(n); return n }),
        onResetWidth: () => setWidths((s) => { const n = { ...s }; delete n[id]; save(n); return n }),
      }),
    }
  }) as ColumnsType<T>, [columns, widths, save])
  const reset = useCallback(() => { setWidths({}); save({}) }, [save])
  return { columns: cols, components: { header: { cell: ResizableTh } }, resized: Object.keys(widths).length > 0, reset }
}
