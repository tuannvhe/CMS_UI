import { useCallback, useEffect, useRef, useState } from 'react'

/** Thời gian chờ mặc định sau phím gõ cuối cùng trước khi tìm (ms). */
export const SEARCH_DEBOUNCE_MS = 400

/**
 * Trả về `value` sau khi người dùng ngừng gõ `ms` mili-giây.
 * Dùng cho queryKey / bộ lọc để không gọi API hay lọc lại sau mỗi phím.
 * Giá trị rỗng (xoá ô tìm) được áp dụng ngay.
 */
export function useDebouncedValue<T>(value: T, ms = SEARCH_DEBOUNCE_MS): T {
  const [v, setV] = useState(value)
  const empty = value === '' || value == null
  useEffect(() => {
    const h = setTimeout(() => setV(value), empty ? 0 : ms)
    return () => clearTimeout(h)
  }, [value, ms, empty])
  return empty ? value : v
}

/**
 * Bọc một hàm (vd. onSearch gọi API) để chỉ chạy sau khi ngừng gõ `ms` mili-giây.
 * Hàm luôn dùng bản `fn` mới nhất; huỷ hẹn giờ khi component unmount.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms = SEARCH_DEBOUNCE_MS) {
  const fnRef = useRef(fn)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { fnRef.current = fn }, [fn])
  useEffect(() => () => clearTimeout(timer.current), [])
  return useCallback((...args: A) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fnRef.current(...args), ms)
  }, [ms])
}
