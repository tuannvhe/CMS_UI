import { useEffect, type RefObject } from 'react'

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Hiệu ứng trang landing: các khối khớp `selectors` (trong `root`) ẩn nhẹ và trượt lên khi cuộn tới.
 * Lăn chuột lên làm khối ra khỏi mép dưới màn hình thì khối ẩn lại (cuộn xuống lại hiện lên): khối ngoài màn hình ở trạng thái ẩn
 * (visibility: hidden sau khi mờ hết) nên trình duyệt không phải vẽ. Khối ra khỏi mép TRÊN (đang đọc tiếp xuống) thì giữ nguyên để không nháy.
 * Chỉ gắn lớp ẩn bằng JS (không có JS thì nội dung vẫn hiện). Khối nằm cạnh nhau trong cùng một hàng hiện lần lượt (trễ 70ms mỗi khối).
 * Người dùng bật "giảm chuyển động" thì không làm gì. `deps`: chạy lại khi nội dung đổi (ví dụ đổi tab).
 */
export function useScrollReveal(root: RefObject<HTMLElement | null>, selectors: string, deps: unknown[] = []) {
  useEffect(() => {
    const el = root.current
    if (!el || reduced() || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      // các khối vào màn hình cùng lúc: hiện lần lượt theo thứ tự trên trang
      let i = 0
      for (const e of entries) {
        const t = e.target as HTMLElement
        if (e.isIntersecting) {
          t.style.setProperty('--rv-delay', `${Math.min(i++, 6) * 70}ms`)
          t.classList.add('rv-in')
        } else if (e.rootBounds && e.boundingClientRect.top >= e.rootBounds.bottom) {
          t.classList.remove('rv-in')   // đã trôi xuống dưới màn hình (lăn chuột lên): ẩn lại
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 })
    const watch = () => {
      el.querySelectorAll<HTMLElement>(selectors).forEach((t) => {
        if (t.classList.contains('rv')) return
        t.classList.add('rv')
        io.observe(t)
      })
    }
    watch()
    // khối hiện muộn (dữ liệu tải xong mới vẽ) cũng được gắn hiệu ứng
    const mo = new MutationObserver(watch)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      io.disconnect(); mo.disconnect()
      // gỡ hết lớp hiệu ứng: khi effect chạy lại (StrictMode, đổi tab) các khối được gắn và theo dõi lại từ đầu, không khối nào bị ẩn mãi
      el.querySelectorAll<HTMLElement>('.rv').forEach((t) => t.classList.remove('rv', 'rv-in'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, selectors, ...deps])
}

/**
 * Banner đầu trang trôi chậm và mờ dần khi cuộn xuống (đặt biến CSS --hp từ 0 tới 1 trên phần tử).
 * Lắng nghe cuộn ở mọi khung cuộn (capture) vì trang có thể cuộn trong khung nội dung chứ không phải cửa sổ.
 */
export function useHeroScroll(hero: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = hero.current
    if (!el || reduced()) return
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))
      el.style.setProperty('--hp', p.toFixed(3))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => { document.removeEventListener('scroll', onScroll, { capture: true }); window.removeEventListener('resize', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [hero])
}
