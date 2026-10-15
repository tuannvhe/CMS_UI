import { useMemo, type ReactNode } from 'react'
import { useToastPush, type ToastType } from '../components/ToastHost'

type ToastInput = ReactNode | { title: ReactNode; description?: ReactNode; duration?: number }

/** Thời gian hiển thị (giây): lỗi và cảnh báo ở lâu hơn để kịp đọc. */
const DURATION: Record<ToastType, number> = { success: 3.5, info: 4, warning: 5, error: 6 }

const isConfig = (x: ToastInput): x is { title: ReactNode; description?: ReactNode; duration?: number } =>
  typeof x === 'object' && x !== null && 'title' in (x as object)

/**
 * Toast thống nhất cho mọi thao tác: thẻ hiện đại có biểu tượng, vạch màu theo loại và thanh tiến trình nhỏ chạy hết thời gian hiển thị
 * (rê chuột vào thì tạm dừng). Dùng giống message: toast.success('Đã lưu'), hoặc toast.error({ title, description }).
 */
export function useToast() {
  const push = useToastPush()
  return useMemo(() => {
    const open = (type: ToastType, input: ToastInput) => {
      const cfg = isConfig(input) ? input : { title: input }
      push?.({ type, title: cfg.title, description: cfg.description, duration: cfg.duration ?? DURATION[type] })
    }
    return {
      success: (c: ToastInput) => open('success', c),
      error: (c: ToastInput) => open('error', c),
      warning: (c: ToastInput) => open('warning', c),
      info: (c: ToastInput) => open('info', c),
    }
  }, [push])
}
