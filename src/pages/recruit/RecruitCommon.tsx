import { useEffect, useRef, useState } from 'react'
import { Spin } from 'antd'
import { useTranslation } from 'react-i18next'

const FRAME: React.CSSProperties = { width: '100%', border: '1px solid var(--border, #d9d9d9)', borderRadius: 8 }

/**
 * Xem CV (PDF) bằng pdf.js: mọi trang cuộn liên tục, dùng được trên iPad / tablet (khung PDF gốc của Safari chỉ hiện trang đầu).
 * Cùng nguồn gốc nên cookie phiên tự gửi kèm. Nếu pdf.js không đọc được thì quay về khung PDF của trình duyệt.
 * hideTools chỉ ẩn nút tải / in trên giao diện, quyền thật do máy chủ kiểm.
 */
export function CvViewer({ src, hideTools, height = '70vh' }: { src: string; hideTools?: boolean; height?: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading')

  useEffect(() => {
    let dead = false
    const el = host.current
    if (!el) return
    el.replaceChildren()
    setState('loading')
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        if (!pdfjs.GlobalWorkerOptions.workerPort) {
          // `?worker` cho ra tệp .js cùng nguồn gốc (hợp CSP script-src 'self' và kiểu MIME của máy chủ), không phải .mjs
          const Worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker')).default
          pdfjs.GlobalWorkerOptions.workerPort = new Worker()
        }
        const res = await fetch(src, { credentials: 'same-origin', headers: { 'X-Requested-With': 'cmsvn' } })
        if (!res.ok) throw new Error(String(res.status))
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise
        for (let n = 1; n <= doc.numPages && !dead; n++) {
          const page = await doc.getPage(n)
          const width = Math.max(el.clientWidth - 16, 280)
          const base = page.getViewport({ scale: 1 })
          const scale = width / base.width
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const vp = page.getViewport({ scale: scale * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height)
          canvas.style.cssText = `width:${width}px;height:${Math.floor(vp.height / dpr)}px;display:block;margin:8px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2)`
          el.appendChild(canvas)
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
          if (n === 1) setState('ready')
        }
        if (!dead) setState('ready')
      } catch {
        if (!dead) { el.replaceChildren(); setState('fallback') }
      }
    })()
    return () => { dead = true }
  }, [src])

  if (state === 'fallback') return <iframe title="cv" src={hideTools ? `${src}#toolbar=0&navpanes=0` : src} style={{ ...FRAME, height }} />
  return (
    <div style={{ ...FRAME, height, overflow: 'auto', background: 'var(--surface-2, #f5f5f5)', position: 'relative', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
      onContextMenu={hideTools ? (e) => e.preventDefault() : undefined}>
      {state === 'loading' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }} aria-label={t('rec.cv')}><Spin /></div>}
      <div ref={host} />
    </div>
  )
}
