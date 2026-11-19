import { memo, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Input, Spin } from 'antd'
import { ScanOutlined } from '@ant-design/icons'

interface Props {
  /** Trang đang điền lưới / xin mã cho lần quét trước: giữ chuỗi mới trong ô, xử lý khi xong */
  processing: boolean
  onScan: (text: string) => void
  inputRef: MutableRefObject<HTMLTextAreaElement | null>
  placeholder: string
  ready: string
  scanning: string
  scanningSub: string
}

/**
 * Caps Lock đang bật khi máy quét gõ: máy quét gõ chữ HOA bằng Shift+chữ nên bị đảo thành thường, chữ thường thành HOA
 * ("Nam" → "nAM"), kể cả các ký tự mã hoá dấu tiếng Việt (Ã ↔ ã) nên chữ có dấu cũng hỏng. Đảo ngược lại từng chữ cái cho cả chuỗi
 * trước khi giải mã dấu; chữ số và dấu "|" không đổi.
 */
const swapCase = (txt: string) => Array.from(txt).map((ch) => {
  const up = ch.toUpperCase(), lo = ch.toLowerCase()
  return up === lo || up.length !== 1 || lo.length !== 1 ? ch : ch === up ? lo : up
}).join('')

/** Hai thẻ quét liền nhau không có xuống dòng (14 dấu "|" trở lên): tách mỗi thẻ 7 trường để không bị dồn vào một dòng. */
const splitCards = (txt: string) => {
  const p = txt.split('|')
  if (/[\r\n]/.test(txt) || p.length < 15) return txt
  const out: string[] = []
  for (let i = 0; i < p.length; i += 7) { const c = p.slice(i, i + 7); if (c.some((x) => x.trim())) out.push(c.join('|') + (c.length === 7 ? '|' : '')) }
  return out.join(String.fromCharCode(10))
}

/** Gán giá trị cho ô nhập qua setter gốc + sự kiện input để React (onChange) nhận như người gõ. */
const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Nhận ra máy quét theo tốc độ gõ: từ SCAN_MIN ký tự liền nhau, mỗi phím cách phím trước không quá SCAN_GAP ms (người gõ tay chậm hơn nhiều). */
const SCAN_GAP = 50
const SCAN_MIN = 6

/**
 * Ô quét QR. Chuỗi đang gõ nằm trong state RIÊNG của component này (không ở trang): máy quét đổ cả trăm ký tự trong ~1 giây,
 * nếu state nằm ở trang thì mỗi ký tự làm vẽ lại cả lưới 20 cột → lag. Trang chỉ nhận chuỗi hoàn chỉnh qua onScan.
 * Máy quét không gửi Enter: chuỗi QR đầy đủ kết thúc bằng "|" thì đẩy ngay (20 ms), chưa thấy dấu kết thúc thì đợi ngừng gõ 300 ms.
 * Lớp phủ khoá màn hiện lúc chuỗi QR đang được đổ vào ô; đứng yên quá 3 giây mà chưa thành thẻ thì thôi phủ để không kẹt màn.
 */
function IdCardScanBox({ processing, onScan, inputRef, placeholder, ready, scanning, scanningSub }: Props) {
  const [scan, setScan] = useState('')
  const [stale, setStale] = useState(false)
  const caps = useRef(false)   // Caps Lock bật ở bất kỳ phím nào của lần quét này
  const [capsOn, setCapsOn] = useState(false)
  const flush = (txt: string) => { const fix = caps.current; caps.current = false; onScanRef.current(fix ? swapCase(txt) : txt) }
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    setStale(false)
    if (!scan) return
    const h = setTimeout(() => setStale(true), 3000)
    return () => clearTimeout(h)
  }, [scan])

  useEffect(() => {
    const parts = scan.split('|')
    if (parts.length < 7 || processing) return
    const h = setTimeout(() => { flush(splitCards(scan)); setScan('') }, parts.length >= 8 && parts[parts.length - 1] === '' ? 20 : 300)
    return () => clearTimeout(h)
  }, [scan, processing])

  const locked = scan.length > 0 && !stale && /^\d{6}|\|/.test(scan)

  // Giữ con trỏ ở ô quét: máy quét gõ như bàn phím, nếu ô mất focus thì chữ rơi ra ngoài trang (thanh địa chỉ / tab mới của trình duyệt).
  // (1) Phím gõ khi không có ô nhập nào đang focus thì kéo focus về ô quét và nhận luôn ký tự đó; (2) ô quét mất focus vào chỗ không phải ô nhập thì lấy lại.
  // (3) Con trỏ đang nằm ở ô nhập KHÁC trên trang (ô tìm kiếm, ô trong lưới, ô ngày...) mà máy quét gõ: trước đây chuỗi QR rơi vào ô đó
  // (hay gặp nhất là ô tìm kiếm sau khi vừa tìm xong). Nay theo dõi tốc độ gõ: thấy một loạt ký tự máy gõ bắt đầu bằng chữ số (QR CCCD mở đầu
  // bằng số CCCD) thì trả ô kia về giá trị trước lúc quét, chuyển các ký tự đã gõ sang ô quét và để phần còn lại đổ thẳng vào ô quét.
  // Gõ tay bình thường không bị ảnh hưởng. Trong hộp thoại (modal) thì không can thiệp.
  const modalOpen = () => !!document.querySelector('.ant-modal-wrap:not([style*="display: none"]), .ant-drawer-open')
  const burst = useRef<{ el: HTMLInputElement | HTMLTextAreaElement; before: string; text: string; last: number; caps: boolean } | null>(null)
  useEffect(() => {
    const catchScan = (e: KeyboardEvent, el: HTMLElement) => {
      if (e.key === 'Shift' || e.key === 'CapsLock') return   // máy quét bấm Shift trước chữ HOA: không tính là ngắt chuỗi
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.repeat || e.isComposing) {
        burst.current = null
        return
      }
      const now = e.timeStamp
      const b = burst.current
      if (!b || b.el !== el || now - b.last > SCAN_GAP) burst.current = { el, before: el.value, text: e.key, last: now, caps: e.getModifierState('CapsLock') }
      else { b.text += e.key; b.last = now; if (e.getModifierState('CapsLock')) b.caps = true }
      const cur = burst.current
      const ta = inputRef.current
      if (!cur || !ta || cur.text.length < SCAN_MIN || !/^\d/.test(cur.text)) return
      e.preventDefault()
      burst.current = null
      setNativeValue(cur.el, cur.before)   // ô tìm kiếm / ô lưới trở lại như trước khi quét
      if (cur.caps) caps.current = true
      ta.focus()
      setNativeValue(ta, ta.value + cur.text)
    }
    const onKey = (e: KeyboardEvent) => {
      // Máy quét gõ chữ có dấu bằng Alt + số (bàn phím số). Thỉnh thoảng phím Alt nhả CHẬM hơn chữ kế tiếp → trình duyệt hiểu là phím tắt:
      // Alt+D = nhảy lên thanh địa chỉ (chuỗi quét đổ lên đó), Alt+F/E = mở menu… Trên màn quét: chặn mọi Alt + chữ cái và nhận chữ đó vào ô quét.
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[a-z]$/i.test(e.key) && !modalOpen()) {
        e.preventDefault()
        const ta = inputRef.current
        if (!ta) return
        const cur = document.activeElement as HTMLElement | null
        if (cur !== ta && cur && (cur.tagName === 'INPUT' || cur.tagName === 'TEXTAREA' || cur.tagName === 'SELECT' || cur.isContentEditable)) return   // đang gõ ô khác: chỉ chặn phím tắt
        if (e.getModifierState('CapsLock')) caps.current = true
        ta.focus()
        setNativeValue(ta, ta.value + e.key)
        return
      }
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        if (el !== inputRef.current && !modalOpen()) catchScan(e, el)
        return
      }
      burst.current = null
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || modalOpen()) return
      e.preventDefault()
      if (e.getModifierState('CapsLock')) caps.current = true
      const ta = inputRef.current
      if (!ta) return
      ta.focus()
      // Chèn qua chính ô nhập (sự kiện input) thay vì setScan, để giá trị DOM và state luôn khớp, không rơi mất ký tự khi máy quét gõ nhanh.
      setNativeValue(ta, ta.value + e.key)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [inputRef])
  useEffect(() => { if (!locked && !modalOpen() && document.activeElement === document.body) inputRef.current?.focus() }, [locked, processing, inputRef])

  return (
    <>
      {locked && createPortal(
        <div className="idc-lock" role="status" aria-live="polite">
          <div className="idc-lock-box"><Spin size="large" /><b>{scanning}</b><span>{scanningSub}</span></div>
        </div>, document.body)}
      <div className={`idc-station${locked ? ' busy' : ''}`}>
        <span className="idc-station-icon"><ScanOutlined /></span>
        <Input.TextArea
          variant="borderless" ref={(el) => { inputRef.current = el?.resizableTextArea?.textArea ?? null }} autoFocus value={scan} placeholder={placeholder} rows={1} style={{ resize: 'none' }}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => { const on = e.getModifierState('CapsLock'); if (on !== capsOn) setCapsOn(on); if (on && e.key.length === 1) caps.current = true; if (e.key === 'Tab' && scan) e.preventDefault() }}   // máy quét có thể gửi Tab cuối chuỗi: không cho nhảy focus ra khỏi ô quét
          onBlur={(e) => { if (!e.relatedTarget && !modalOpen()) setTimeout(() => { if (document.activeElement === document.body && !modalOpen()) inputRef.current?.focus() }, 0) }}
          onPressEnter={(e) => { if (e.shiftKey) return; e.preventDefault(); flush(scan); setScan('') }}
          onPaste={(e) => { const txt = e.clipboardData.getData('text'); if (/[\t\n]/.test(txt.trim())) { e.preventDefault(); onScanRef.current(txt); setScan('') } }}
        />
        <span className="idc-state">{capsOn && <b className="idc-caps">Caps Lock</b>}<i className="idc-dot" />{locked ? scanning : ready}</span>
      </div>
    </>
  )
}

export default memo(IdCardScanBox)
