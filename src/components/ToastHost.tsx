import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircleFilled, CloseCircleFilled, CloseOutlined, ExclamationCircleFilled, InfoCircleFilled } from '@ant-design/icons'

export type ToastType = 'success' | 'error' | 'warning' | 'info'
export interface ToastItem { id: number; type: ToastType; title: ReactNode; description?: ReactNode; duration: number; leaving?: boolean }
export type ToastPush = (t: Omit<ToastItem, 'id' | 'leaving'>) => void

const ICON: Record<ToastType, ReactNode> = {
  success: <CheckCircleFilled />, error: <CloseCircleFilled />, warning: <ExclamationCircleFilled />, info: <InfoCircleFilled />,
}
const MAX = 5
const LEAVE_MS = 220

const ToastContext = createContext<ToastPush | null>(null)
// eslint-disable-next-line react-refresh/only-export-components
export const useToastPush = () => useContext(ToastContext)

/** Một toast: tự đóng sau `duration` giây, rê chuột vào thì tạm dừng cả bộ đếm lẫn thanh tiến trình. */
function Toast({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const remaining = useRef(item.duration * 1000)
  const startedAt = useRef(Date.now())
  const timer = useRef<number | undefined>(undefined)
  const [paused, setPaused] = useState(false)

  const start = useCallback(() => {
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => onClose(item.id), remaining.current)
  }, [item.id, onClose])
  const stop = useCallback(() => {
    window.clearTimeout(timer.current)
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
  }, [])

  useEffect(() => { start(); return () => window.clearTimeout(timer.current) }, [start])

  return (
    <div
      className={`cms-toast cms-toast-${item.type}${item.leaving ? ' leaving' : ''}`} role={item.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => { setPaused(true); stop() }} onMouseLeave={() => { setPaused(false); start() }}
    >
      <span className={`toast-ico ${item.type}`}>{ICON[item.type]}</span>
      <div className="toast-body">
        <div className="toast-title">{item.title}</div>
        {item.description ? <div className="toast-desc">{item.description}</div> : null}
      </div>
      <button type="button" className="toast-close" aria-label="Close" onClick={() => onClose(item.id)}><CloseOutlined /></button>
      <div className="toast-progress" aria-hidden><i style={{ animationDuration: `${item.duration}s`, animationPlayState: paused ? 'paused' : 'running' }} /></div>
    </div>
  )
}

/**
 * Bộ hiển thị toast riêng của hệ thống (không dùng notification của AntD vì cơ chế xếp chồng của nó đo sai chiều cao thẻ):
 * góc phải trên, tối đa 5 thẻ, thanh tiến trình nhỏ theo thời gian tồn tại, tạm dừng khi rê chuột.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const close = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), LEAVE_MS)
  }, [])

  const push = useCallback<ToastPush>((t) => {
    seq.current += 1
    const id = seq.current
    setItems((list) => [...list.filter((x) => !x.leaving).slice(-(MAX - 1)), { ...t, id }])
  }, [])

  const host = useMemo(() => (
    <div className="toast-host" aria-live="polite">{items.map((t) => <Toast key={t.id} item={t} onClose={close} />)}</div>
  ), [items, close])

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(host, document.body)}
    </ToastContext.Provider>
  )
}
