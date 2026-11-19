import { useEffect, useRef, type ChangeEvent } from 'react'
import { Input } from 'antd'
import type { SearchProps } from 'antd/es/input'
import { SEARCH_DEBOUNCE_MS } from '../hooks/useDebounce'

type Props = Omit<SearchProps, 'onSearch'> & {
  /** Gọi khi ngừng gõ `delay` ms, hoặc ngay khi bấm Enter / nút tìm / xoá ô. */
  onSearch: (value: string) => void
  delay?: number
}

/**
 * Ô tìm kiếm có debounce: gõ tới đâu tìm tới đó nhưng chỉ gọi `onSearch` khi người dùng ngừng gõ,
 * không bắn một request cho mỗi phím. Enter / xoá ô thì tìm ngay.
 */
export function SearchBox({ onSearch, onChange, delay = SEARCH_DEBOUNCE_MS, ...rest }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const last = useRef<string | undefined>(undefined)
  const cb = useRef(onSearch)
  useEffect(() => { cb.current = onSearch }, [onSearch])
  useEffect(() => () => clearTimeout(timer.current), [])

  const emit = (v: string, force = false) => {
    clearTimeout(timer.current)
    if (v === last.current && !force) return
    last.current = v
    cb.current(v)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e)
    const v = e.target.value
    clearTimeout(timer.current)
    if (!v) { emit(''); return }
    timer.current = setTimeout(() => emit(v), delay)
  }

  return <Input.Search {...rest} onChange={handleChange} onSearch={(v) => emit(v, true)} />
}
