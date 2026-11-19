import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'
const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null)

/** true khi màn hình hẹp kiểu điện thoại (≤ 767px), tự cập nhật khi xoay hoặc đổi cỡ cửa sổ. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = mq(); m?.addEventListener('change', cb); return () => m?.removeEventListener('change', cb) },
    () => mq()?.matches ?? false,
    () => false,
  )
}
