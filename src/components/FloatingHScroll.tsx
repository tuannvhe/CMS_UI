import { useEffect, useRef } from 'react'

/**
 * Thanh cuộn ngang nổi dùng chung cho MỌI bảng (antd Table / DataTable / FilterTable / bảng <table> tự vẽ):
 * khi bảng rộng hơn khung mà đáy bảng (nơi có thanh cuộn ngang gốc) còn nằm dưới mép màn hình,
 * hiện một thanh cuộn ngang dính ở đáy vùng nội dung, đồng bộ hai chiều với bảng — kéo ngang được ngay
 * mà không phải cuộn xuống cuối bảng. Cuộn tới đáy bảng thì thanh nổi tự ẩn (dùng lại thanh gốc).
 * Kèm: Shift + lăn chuột trên bảng = cuộn ngang (trình duyệt nào chưa tự làm), lăn chuột trên thanh nổi = cuộn ngang.
 * Chỉ gắn một lần trong AppShell; không đổi giao diện bảng. Kiểu ở khối ".fhs" cuối index.css.
 */

const MIN_VISIBLE = 60   // phần bảng lộ ra tối thiểu (px) mới hiện thanh nổi

function isHScrollable(el: HTMLElement): boolean {
  if (el.scrollWidth <= el.clientWidth + 1) return false
  const ox = getComputedStyle(el).overflowX
  return ox === 'auto' || ox === 'scroll'
}

/** Khối cuộn ngang bao quanh một <table> (đi lên tối đa vài cấp, không vượt khỏi vùng scope). */
function hScrollHost(table: HTMLElement, scope: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = table.parentElement
  for (let i = 0; el && el !== scope && i < 6; i++, el = el.parentElement) {
    if (isHScrollable(el)) return el
  }
  return null
}

/** Vùng đang ở trên cùng: modal / drawer đang mở (cái mở sau cùng), nếu không thì vùng nội dung chính. */
function activeScope(): { el: HTMLElement; z: number } | null {
  const modals = Array.from(document.querySelectorAll<HTMLElement>('.ant-modal-wrap, .ant-drawer-open .ant-drawer-body'))
    .filter((m) => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
  if (modals.length) return { el: modals[modals.length - 1], z: 1049 }
  const main = document.querySelector<HTMLElement>('.app-main')
  return main ? { el: main, z: 899 } : null
}

export function FloatingHScroll() {
  const barRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current, inner = innerRef.current
    if (!bar || !inner) return
    let target: HTMLElement | null = null
    let raf = 0

    const hide = () => { if (bar.style.display !== 'none') bar.style.display = 'none'; target = null }

    const update = () => {
      raf = 0
      const scope = activeScope()
      if (!scope) return hide()
      const sr = scope.el.getBoundingClientRect()
      const clipTop = Math.max(sr.top, 0)
      const clipBottom = Math.min(sr.bottom, window.innerHeight)
      // Chọn bảng cuộn ngang được, còn lộ đủ trong khung nhưng đáy (thanh cuộn gốc) đang khuất dưới mép.
      let best: HTMLElement | null = null, bestArea = 0
      const seen = new Set<HTMLElement>()
      scope.el.querySelectorAll<HTMLElement>('table').forEach((tb) => {
        const host = hScrollHost(tb, scope.el)
        if (!host || seen.has(host)) return
        seen.add(host)
        const r = host.getBoundingClientRect()
        if (r.width < 40 || r.bottom <= clipBottom + 2 || r.top >= clipBottom - MIN_VISIBLE) return
        const area = (Math.min(r.bottom, clipBottom) - Math.max(r.top, clipTop)) * r.width
        if (area > bestArea) { bestArea = area; best = host }
      })
      if (!best) return hide()
      const host: HTMLElement = best
      const r = host.getBoundingClientRect()
      const left = Math.max(r.left, sr.left), right = Math.min(r.right, sr.right)
      target = host
      bar.style.display = 'block'
      bar.style.zIndex = String(scope.z)
      bar.style.left = `${left}px`
      bar.style.width = `${Math.max(0, right - left)}px`
      bar.style.top = `${clipBottom - bar.offsetHeight}px`
      // Tỉ lệ kéo giống thanh gốc: phần cuộn được của thanh nổi = phần cuộn được của bảng.
      inner.style.width = `${host.scrollWidth - host.clientWidth + Math.max(0, right - left)}px`
      if (Math.abs(bar.scrollLeft - host.scrollLeft) > 1) bar.scrollLeft = host.scrollLeft
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }

    const onAnyScroll = (e: Event) => {
      if (e.target === bar) return
      if (target && e.target === target) {
        if (Math.abs(bar.scrollLeft - target.scrollLeft) > 1) bar.scrollLeft = target.scrollLeft
        return
      }
      schedule()
    }
    const onBarScroll = () => {
      if (target && Math.abs(target.scrollLeft - bar.scrollLeft) > 1) target.scrollLeft = bar.scrollLeft
    }
    // Lăn chuột trên thanh nổi = cuộn ngang.
    const onBarWheel = (e: WheelEvent) => {
      if (!target) return
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!d) return
      e.preventDefault()
      target.scrollLeft += d
    }
    // Shift + lăn chuột trên bảng: trình duyệt thường đã tự đổi thành cuộn ngang (deltaX ≠ 0); chỉ xử lý khi chưa.
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey || e.defaultPrevented || e.deltaX !== 0 || e.deltaY === 0) return
      const t = e.target as HTMLElement | null
      const tb = t?.closest?.('table') as HTMLElement | null
      if (!tb) return
      const host = hScrollHost(tb, document.body)
      if (!host) return
      e.preventDefault()
      host.scrollLeft += e.deltaY
    }

    document.addEventListener('scroll', onAnyScroll, true)
    window.addEventListener('resize', schedule)
    document.addEventListener('wheel', onWheel, { passive: false })
    bar.addEventListener('scroll', onBarScroll)
    bar.addEventListener('wheel', onBarWheel, { passive: false })
    // Dữ liệu tải xong / đổi trang / mở modal làm bảng đổi kích thước: tính lại (gộp theo khung hình).
    const mo = new MutationObserver((ms) => { if (ms.some((m) => m.target !== bar && m.target !== inner)) schedule() })
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
    const timer = window.setInterval(schedule, 1000)   // phòng khi kích thước đổi mà không có sự kiện nào
    schedule()
    return () => {
      document.removeEventListener('scroll', onAnyScroll, true)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('wheel', onWheel)
      bar.removeEventListener('scroll', onBarScroll)
      bar.removeEventListener('wheel', onBarWheel)
      mo.disconnect()
      window.clearInterval(timer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={barRef} className="fhs" style={{ display: 'none' }} aria-hidden>
      <div ref={innerRef} className="fhs-inner" />
    </div>
  )
}
