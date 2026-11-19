import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Popconfirm, Radio, Segmented, Spin, Tag, Tooltip } from 'antd'
import { DownloadOutlined, EditOutlined, FieldTimeOutlined, TranslationOutlined, UnlockOutlined, UserOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cvEnglishUrl, cvKoreanUrl, cvMaskedUrl, cvUrl, photoUrl, recruit, SCORE_CRITERIA, scoreTotal, type PanelMember, type PanelScore, type RecruitEvent, type RecruitScores, type ScoreAverage } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

const FRAME: React.CSSProperties = { width: '100%', border: '1px solid var(--border, #d9d9d9)', borderRadius: 8 }

/**
 * Xem CV (PDF, hoặc bản PDF máy chủ chuyển từ Word / Excel) bằng pdf.js: mọi trang cuộn liên tục, dùng được trên iPad / tablet (khung PDF gốc của Safari chỉ hiện trang đầu).
 * Cùng nguồn gốc nên cookie phiên tự gửi kèm. Nếu pdf.js không đọc được thì quay về khung PDF của trình duyệt.
 * hideTools chỉ ẩn nút tải / in trên giao diện, quyền thật do máy chủ kiểm.
 */
/** Một vùng che trên trang (page đếm từ 0), toạ độ theo tỉ lệ 0..1 của trang. */
export interface MaskArea { page: number; x0: number; y0: number; x1: number; y1: number; auto?: boolean }

export function CvViewer({ src, hideTools, height = '70vh', draw, areas, onArea, onAreaClick, removed }: { src: string; hideTools?: boolean; height?: string; draw?: boolean; areas?: MaskArea[]; onArea?: (a: MaskArea) => void; onAreaClick?: (i: number) => void; removed?: number[] }) {
  const { t: tr } = useTranslation()
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'fallback' | 'missing'>('loading')
  const [why, setWhy] = useState('')

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
        if (res.status === 409) { const p = await res.json().catch(() => null); if (!dead) { setWhy(p?.detail ?? ''); setState('missing') } return }   // CV Word / Excel chưa có bản PDF xem trước, hoặc chưa che được lương
        if (!res.ok) throw new Error(String(res.status))
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise
        for (let n = 1; n <= doc.numPages && !dead; n++) {
          const page = await doc.getPage(n)
          const width = Math.max(el.clientWidth - 16, 280)
          const base = page.getViewport({ scale: 1 })
          const scale = width / base.width
          const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5)   // vẽ ít nhất gấp đôi để CV scan / chữ nhỏ đỡ nhòe
          const vp = page.getViewport({ scale: scale * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height)
          canvas.style.cssText = `width:${width}px;height:${Math.floor(vp.height / dpr)}px;display:block;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2)`
          // Mỗi trang một khung (data-page) để vẽ vùng che chồng lên
          const wrap = document.createElement('div')
          wrap.dataset.page = String(n - 1)
          wrap.style.cssText = `position:relative;width:${width}px;margin:8px auto`
          wrap.appendChild(canvas)
          el.appendChild(wrap)
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

  // Vẽ các vùng che (chờ lưu) lên từng trang
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.querySelectorAll('[data-mask]').forEach((x) => x.remove())
    ;(areas ?? []).forEach((a, i) => {
      const wrap = el.querySelector<HTMLElement>(`[data-page="${a.page}"]`)
      if (!wrap) return
      const box = document.createElement('div')
      box.dataset.mask = '1'
      const pos = `position:absolute;left:${a.x0 * 100}%;top:${a.y0 * 100}%;width:${(a.x1 - a.x0) * 100}%;height:${(a.y1 - a.y0) * 100}%`
      if (onAreaClick) {
        // Chế độ bỏ vùng che nhầm (trên CV gốc): bấm vào vùng để bỏ / giữ lại; vùng bỏ hiện khung xanh, chữ bên dưới nhìn rõ
        const off = removed?.includes(i)
        box.style.cssText = `${pos};cursor:pointer;background:${off ? 'rgba(82,196,26,.08)' : 'rgba(0,0,0,.55)'};outline:2px ${off ? 'dashed #52c41a' : `solid ${a.auto === false ? '#faad14' : '#ff4d4f'}`}`
        box.title = off ? tr('rec.cvx.unmaskKeepTip') : tr('rec.cvx.unmaskDropTip')
        box.onclick = (e) => { e.stopPropagation(); onAreaClick(i) }
      } else {
        box.style.cssText = `${pos};background:rgba(0,0,0,.55);outline:2px solid #ff4d4f;pointer-events:none`
      }
      wrap.appendChild(box)
    })
  }, [areas, state, removed, onAreaClick, tr])

  const start = useRef<{ wrap: HTMLElement; x: number; y: number; box: HTMLDivElement } | null>(null)
  const rel = (wrap: HTMLElement, e: React.PointerEvent) => {
    const r = wrap.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const down = (e: React.PointerEvent) => {
    const wrap = (e.target as HTMLElement).closest<HTMLElement>('[data-page]')
    if (!draw || !wrap) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const p = rel(wrap, e)
    const box = document.createElement('div')
    box.dataset.mask = 'draft'
    box.style.cssText = 'position:absolute;background:rgba(0,0,0,.4);outline:2px dashed #ff4d4f;pointer-events:none'
    wrap.appendChild(box)
    start.current = { wrap, x: p.x, y: p.y, box }
  }
  const move = (e: React.PointerEvent) => {
    const s0 = start.current
    if (!s0) return
    const p = rel(s0.wrap, e)
    Object.assign(s0.box.style, { left: `${Math.min(s0.x, p.x) * 100}%`, top: `${Math.min(s0.y, p.y) * 100}%`, width: `${Math.abs(p.x - s0.x) * 100}%`, height: `${Math.abs(p.y - s0.y) * 100}%` })
  }
  const up = (e: React.PointerEvent) => {
    const s0 = start.current
    if (!s0) return
    start.current = null
    s0.box.remove()
    const p = rel(s0.wrap, e)
    const a = { page: Number(s0.wrap.dataset.page), x0: Math.min(s0.x, p.x), y0: Math.min(s0.y, p.y), x1: Math.max(s0.x, p.x), y1: Math.max(s0.y, p.y) }
    if (a.x1 - a.x0 > 0.01 && a.y1 - a.y0 > 0.005) onArea?.(a)
  }

  if (state === 'missing') return <div className="cell-muted" style={{ ...FRAME, padding: 16 }}>{why.startsWith('mask_') ? t(`rec.err.${why}`) : t('rec.cvNoPreview')}</div>
  if (state === 'fallback') return <iframe title="cv" src={hideTools ? `${src}#toolbar=0&navpanes=0` : src} style={{ ...FRAME, height }} />
  return (
    <div style={{ ...FRAME, height, overflow: 'auto', background: 'var(--surface-2, #f5f5f5)', position: 'relative', WebkitOverflowScrolling: 'touch', touchAction: draw ? 'none' : 'pan-x pan-y pinch-zoom', cursor: draw ? 'crosshair' : undefined }}
      onContextMenu={hideTools ? (e) => e.preventDefault() : undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current?.box.remove(); start.current = null }}>
      {state === 'loading' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }} aria-label={t('rec.cv')}><Spin /></div>}
      <div ref={host} />
    </div>
  )
}

/**
 * Khung CV kèm lựa chọn bản xem: CV (người ngoài HR nhận bản đã che lương khi bật che), bản đã che (HR xem thử), bản tiếng Anh nếu đã dịch.
 * Bản tiếng Anh là PDF giữ nguyên bố cục CV (chỉ thay chữ). Giao diện tiếng Anh / Hàn mở sẵn bản tiếng Anh. HR có nút dịch (lại) khi bật dịch CV.
 */
export function CvPane({ id, admin, hideTools, height = '70vh', maskable, translatable, preferred, downloadName }: { id: number; admin: boolean; hideTools?: boolean; height?: string; maskable?: boolean; translatable?: boolean; preferred?: 'en' | 'vi' | 'ko' | null; downloadName?: string }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const [view, setView] = useState<'cv' | 'masked' | 'en' | 'ko' | null>(null)
  useEffect(() => setView(null), [id])
  // Bấm dịch xong thì hỏi lại 10 giây / lần (tối đa 30 phút) tới khi có bản tiếng Anh hoặc có lý do lỗi
  const [waitSince, setWaitSince] = useState<number | null>(null)
  useEffect(() => setWaitSince(null), [id])
  const enState = useQuery({
    queryKey: ['recruit', 'cv-en', id, 'has'], queryFn: () => recruit.cvEnglishState(id, admin), staleTime: 60_000, retry: false,
    refetchInterval: (q) => waitSince && Date.now() - waitSince < 30 * 60_000 && !q.state.data?.has && !q.state.data?.failed ? 10_000 : false,
  })
  const hasEn = { data: enState.data?.has, isLoading: enState.isLoading }
  // Bản tiếng Hàn: HR bấm dịch riêng (chạy nền), người xem chọn tab Tiếng Hàn khi đã có
  const [waitKo, setWaitKo] = useState<number | null>(null)
  useEffect(() => setWaitKo(null), [id])
  const koState = useQuery({
    queryKey: ['recruit', 'cv-ko', id, 'has'], queryFn: () => recruit.cvKoreanState(id, admin), staleTime: 60_000, retry: false,
    refetchInterval: (q) => waitKo && Date.now() - waitKo < 30 * 60_000 && !q.state.data?.has && !q.state.data?.failed ? 10_000 : false,
  })
  const hasKo = !!koState.data?.has
  const failedKo = hasKo ? undefined : koState.data?.failed
  const waitingKo = !!waitKo && !hasKo && !failedKo && Date.now() - waitKo < 30 * 60_000
  const failed = enState.data?.has ? undefined : enState.data?.failed
  const waiting = !!waitSince && !enState.data?.has && !failed && Date.now() - waitSince < 30 * 60_000
  const qc = useQueryClient()
  const [drawing, setDrawing] = useState(false)
  const [areas, setAreas] = useState<MaskArea[]>([])
  const [maskVer, setMaskVer] = useState(0)
  useEffect(() => { setDrawing(false); setAreas([]) }, [id])
  // Bỏ vùng che nhầm: xem CV gốc với các vùng đang che, bấm vùng nào để bỏ, lưu thì làm lại bản che chỉ với vùng còn giữ
  const [unmasking, setUnmasking] = useState(false)
  const [removed, setRemoved] = useState<number[]>([])
  useEffect(() => { setUnmasking(false); setRemoved([]) }, [id])
  const maskList = useQuery({ queryKey: ['recruit', 'mask-list', id], queryFn: () => recruit.maskList(id), enabled: unmasking, staleTime: 0, gcTime: 0, retry: false })
  const maskListErr = maskList.error ? (({ detail, code }) => t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }))(adminError(maskList.error)) : null
  const toggleRemoved = useCallback((i: number) => setRemoved((x) => (x.includes(i) ? x.filter((v) => v !== i) : [...x, i])), [])
  const rebuildMask = useMutation({
    mutationFn: () => recruit.maskRebuild(id, (maskList.data ?? []).filter((_, i) => !removed.includes(i))),
    onSuccess: () => { msg.success(t('rec.cvx.unmaskSaved', { n: removed.length })); setUnmasking(false); setRemoved([]); setMaskVer((v) => v + 1); qc.invalidateQueries({ queryKey: ['recruit', 'cv-en', id] }); qc.invalidateQueries({ queryKey: ['recruit', 'cv-ko', id] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  const saveMask = useMutation({
    mutationFn: () => recruit.maskAreas(id, areas),
    onSuccess: () => { msg.success(t('rec.cvx.maskSaved')); setDrawing(false); setAreas([]); setMaskVer((v) => v + 1); qc.invalidateQueries({ queryKey: ['recruit', 'cv-en', id] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  const resetMask = useMutation({
    mutationFn: () => recruit.maskReset(id),
    onSuccess: () => { msg.success(t('rec.cvx.maskResetOk')); setAreas([]); setMaskVer((v) => v + 1); qc.invalidateQueries({ queryKey: ['recruit', 'cv-en', id] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  const translateKo = useMutation({
    mutationFn: () => recruit.translateCvKorean(id),
    onSuccess: () => { msg.success(t('rec.cvx.queued')); setWaitKo(Date.now()); qc.setQueryData(['recruit', 'cv-ko', id, 'has'], { has: false }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  const translate = useMutation({
    mutationFn: () => recruit.translateCv(id),
    onSuccess: () => { msg.success(t('rec.cvx.queued')); setWaitSince(Date.now()); qc.setQueryData(['recruit', 'cv-en', id, 'has'], { has: false }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  // Chưa chọn thì: giao diện không phải tiếng Việt và đã có bản tiếng Anh → mở bản tiếng Anh
  // HR chọn bản khi gửi (preferred) thì theo đó (chưa có bản dịch thì dùng bản gốc đã che); không thì theo ngôn ngữ giao diện
  const shown = view ?? (i18n.language.startsWith('ko') && hasKo && !preferred ? 'ko' : preferred === 'en' ? (hasEn.data ? 'en' : 'cv') : preferred === 'ko' ? (hasKo ? 'ko' : 'cv') : preferred === 'vi' ? 'cv' : hasEn.data && !i18n.language.startsWith('vi') ? 'en' : 'cv')
  const options = [
    { value: 'cv', label: admin && maskable ? t('rec.cvx.original') : t('rec.cv') },
    ...(admin && maskable ? [{ value: 'masked', label: t('rec.cvx.masked') }] : []),
    ...(hasEn.data ? [{ value: 'en', label: t('rec.cvx.english') }] : []),
    ...(hasKo ? [{ value: 'ko', label: t('rec.cvx.korean') }] : []),
  ]
  // Tải bản CV đang xem (gốc / đã che / EN / KO) về máy, đủ độ nét để phóng to: máy chủ trả đúng bản người xem được phép thấy (bật che lương thì là bản đã che)
  const [downloading, setDownloading] = useState(false)
  const downloadTranslated = async () => {
    setDownloading(true)
    try {
      const src = shown === 'en' ? cvEnglishUrl(id, admin) : shown === 'ko' ? cvKoreanUrl(id, admin) : shown === 'masked' ? cvMaskedUrl(id) : cvUrl(id, admin)
      const res = await fetch(src, { credentials: 'same-origin', headers: { 'X-Requested-With': 'cmsvn' } })
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const base = (downloadName ?? `CV-${id}`).replace(/[\\/:*?"<>|]+/g, ' ').trim() || `CV-${id}`
      const ext = blob.type.includes('pdf') ? 'pdf' : blob.type.includes('word') ? 'docx' : blob.type.startsWith('image/') ? blob.type.slice(6).replace('jpeg', 'jpg') : 'pdf'
      a.href = url; a.download = `${base}${shown === 'cv' ? '' : `-${shown === 'masked' ? 'masked' : shown.toUpperCase()}`}.${ext}`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch { msg.error(t('usr.err.generic')) } finally { setDownloading(false) }
  }
  if (hasEn.isLoading) return <div style={{ ...FRAME, height, display: 'grid', placeItems: 'center' }}><Spin /></div>
  return (
    <div>
      {(
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {options.length > 1 && <Segmented size="small" value={shown} onChange={(v) => setView(v as typeof shown)} options={options} />}
          {admin && translatable && <Button size="small" icon={<TranslationOutlined />} loading={translate.isPending} onClick={() => translate.mutate()}>{hasEn.data ? t('rec.cvx.retranslate') : t('rec.cvx.translate')}</Button>}
          {admin && translatable && <Button size="small" icon={<TranslationOutlined />} loading={translateKo.isPending} onClick={() => translateKo.mutate()}>{hasKo ? t('rec.cvx.retranslateKo') : t('rec.cvx.translateKo')}</Button>}
          {!(shown === 'masked' && (drawing || unmasking)) && <Button size="small" icon={<DownloadOutlined />} loading={downloading} onClick={downloadTranslated}>{t('rg.cvDownload')}</Button>}
          {(shown === 'en' || shown === 'ko') && <span className="cell-muted">{t('rec.cvx.machine')}</span>}
          {admin && translatable && waitingKo && <span className="cell-muted"><Spin size="small" /> {t('rec.cvx.translating')}</span>}
          {admin && translatable && failedKo && <Tag color="warning">{t(`rec.cvx.fail.${failedKo}`, { defaultValue: t('rec.cvx.fail.service') })}</Tag>}
          {admin && translatable && waiting && <span className="cell-muted"><Spin size="small" /> {t('rec.cvx.translating')}</span>}
          {admin && translatable && failed && <Tag color="warning">{t(`rec.cvx.fail.${failed}`, { defaultValue: t('rec.cvx.fail.service') })}</Tag>}
          {shown === 'masked' && admin && unmasking && (
            <>
              <Button size="small" type="primary" danger disabled={removed.length === 0} loading={rebuildMask.isPending} onClick={() => rebuildMask.mutate()}>{t('rec.cvx.unmaskSave', { n: removed.length })}</Button>
              <Button size="small" onClick={() => { setUnmasking(false); setRemoved([]) }}>{t('common.cancel', { defaultValue: 'Huỷ' })}</Button>
              {maskListErr ? <Tag color="warning">{maskListErr}</Tag> : maskList.isFetching ? <Spin size="small" /> : <span className="cell-muted">{(maskList.data ?? []).length === 0 ? t('rec.cvx.unmaskNone') : t('rec.cvx.unmaskHint')}</span>}
            </>
          )}
          {shown === 'masked' && admin && !unmasking && (drawing ? (
            <>
              <Button size="small" type="primary" disabled={areas.length === 0} loading={saveMask.isPending} onClick={() => saveMask.mutate()}>{t('rec.cvx.maskSave', { n: areas.length })}</Button>
              <Button size="small" disabled={areas.length === 0} onClick={() => setAreas((x) => x.slice(0, -1))}>{t('rec.cvx.maskUndo')}</Button>
              <Button size="small" onClick={() => { setDrawing(false); setAreas([]) }}>{t('common.cancel', { defaultValue: 'Huỷ' })}</Button>
              <span className="cell-muted">{t('rec.cvx.maskHint')}</span>
            </>
          ) : (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => setDrawing(true)}>{t('rec.cvx.maskMore')}</Button>
              <Button size="small" icon={<UnlockOutlined />} onClick={() => { setRemoved([]); setUnmasking(true) }}>{t('rec.cvx.unmask')}</Button>
              <Popconfirm title={t('rec.cvx.maskResetAsk')} onConfirm={() => resetMask.mutate()}><Button size="small" loading={resetMask.isPending}>{t('rec.cvx.maskReset')}</Button></Popconfirm>
            </>
          ))}
        </div>
      )}
      <CvViewer src={shown === 'masked' && unmasking ? cvUrl(id, admin) : shown === 'masked' ? `${cvMaskedUrl(id)}&v=${maskVer}` : shown === 'en' ? cvEnglishUrl(id, admin) : shown === 'ko' ? cvKoreanUrl(id, admin) : cvUrl(id, admin)} hideTools={hideTools} height={height}
        draw={shown === 'masked' && drawing && !unmasking} areas={shown === 'masked' ? (unmasking ? maskList.data : areas) : undefined} onArea={(a) => setAreas((x) => [...x, a].slice(0, 50))}
        onAreaClick={shown === 'masked' && unmasking ? toggleRemoved : undefined} removed={unmasking ? removed : undefined} />
    </div>
  )
}

/** Trưởng HR tuyển dụng: Admin hoặc người / nhóm được cấp trang "recruitLead" (máy chủ kiểm lại). */
/** Xem / sửa offer: Admin hoặc người / nhóm được cấp trang "recruitOffer" (máy chủ kiểm lại). */
export const isOfferViewer = (user: { isAdmin?: boolean; grantedPages?: string[] } | null | undefined) => !!user?.isAdmin || !!user?.grantedPages?.includes('recruitOffer')

/** Xem / sửa lương hiện tại, mong muốn của ứng viên: Admin hoặc người / nhóm được cấp trang "recruitSalary" (máy chủ kiểm lại). */
export const isSalaryViewer = (user: { isAdmin?: boolean; grantedPages?: string[] } | null | undefined) => !!user?.isAdmin || !!user?.grantedPages?.includes('recruitSalary')

/** Sửa kết quả phỏng vấn (phiếu đã nộp + kết quả chốt): Admin hoặc người / nhóm được cấp riêng trang "recruitEditResult" (máy chủ kiểm lại). */
export const isResultEditor = (user: { isAdmin?: boolean; grantedPages?: string[] } | null | undefined) => !!user?.isAdmin || !!user?.grantedPages?.includes('recruitEditResult')

export const isRecruitLead = (user: { isAdmin?: boolean; grantedPages?: string[] } | null | undefined) => !!user?.isAdmin || !!user?.grantedPages?.includes('recruitLead')

/** Mở lại phiếu đánh giá đã nộp (phiếu nộp xong bị khoá): bắt buộc ghi lý do, người phỏng vấn được báo để nộp lại. */
export function UnlockButton({ interviewId, interviewerId, name }: { interviewId: number; interviewerId: string; name: string }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: () => recruit.unlock(interviewId, interviewerId, reason.trim()),
    onSuccess: () => { msg.success(t('rec.unlocked')); setOpen(false); setReason(''); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  return (
    <>
      <Button size="small" type="link" icon={<UnlockOutlined />} onClick={(e) => { e.stopPropagation(); setOpen(true) }}>{t('rec.unlock')}</Button>
      <AppModal open={open} onClose={() => setOpen(false)} size="sm" icon={<UnlockOutlined />} title={t('rec.unlockTitle', { name })} subtitle={t('rec.unlockHint')} okText={t('rec.unlock')} okDisabled={reason.trim().length < 5} okLoading={m.isPending} onOk={() => m.mutate()}>
        <div style={{ marginBottom: 6 }}>{t('rec.unlockReason')}</div>
        <Input.TextArea rows={3} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
      </AppModal>
    </>
  )
}

/**
 * Sửa kết quả phỏng vấn của một người (quyền riêng recruitEditResult): sửa tại chỗ kết quả Đạt / Không đạt, điểm 4 tiêu chí và nhận xét của phiếu đã nộp.
 * Lý do bắt buộc; máy chủ ghi lịch sử hồ sơ (ai, lúc nào, giá trị cũ → mới, lý do). `final`: hồ sơ đã chốt, nhắc là kết quả chốt không tự đổi.
 */
export function EditEvaluationButton({ interviewId, member, final }: { interviewId: number; member: PanelMember; final?: boolean }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<'pass' | 'fail' | 'consider'>(member.result ?? 'pass')
  const [scores, setScores] = useState<Partial<RecruitScores>>({})
  const [strengths, setStrengths] = useState('')
  const [weaknesses, setWeaknesses] = useState('')
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const sq = useQuery({ queryKey: ['recruit', 'scoring'], queryFn: recruit.scoring, staleTime: 5 * 60_000, retry: false, enabled: open })
  const scoringOn = !!sq.data?.enabled || !!member.scores
  const full = SCORE_CRITERIA.every((k) => !!scores[k])
  const start = () => {
    setResult(member.result ?? 'pass'); setScores(member.scores ?? {}); setStrengths(member.strengths ?? ''); setWeaknesses(member.weaknesses ?? ''); setComment(member.comment ?? ''); setReason(''); setOpen(true)
  }
  const m = useMutation({
    mutationFn: () => recruit.editEvaluation(interviewId, member.interviewerId, {
      result, scores: scoringOn && full ? (scores as RecruitScores) : undefined,
      strengths: strengths.trim() || null, weaknesses: weaknesses.trim() || null, comment: comment.trim() || null, reason: reason.trim(),
    }),
    onSuccess: () => { msg.success(t('rec.ed.saved')); setOpen(false); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  const name = member.interviewerName ?? member.interviewerId
  const field = (label: string, value: string, set: (v: string) => void) => (
    <div style={{ marginBottom: 10 }}><div style={{ marginBottom: 4 }}>{label}</div><Input.TextArea rows={2} maxLength={1000} showCount value={value} onChange={(e) => set(e.target.value)} /></div>
  )
  return (
    <>
      <Button size="small" type="link" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); start() }}>{t('rec.ed.btn')}</Button>
      <AppModal open={open} onClose={() => setOpen(false)} size="md" icon={<EditOutlined />} title={t('rec.ed.title', { name })} subtitle={t('rec.ed.hint')}
        okDisabled={reason.trim().length < 5 || (scoringOn && !full)} okLoading={m.isPending} onOk={() => m.mutate()}>
        {final && <div className="cell-muted" style={{ marginBottom: 10 }}>{t('rec.ed.finalHint')}</div>}
        <div style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 4 }}>{t('rec.ed.result')}</div>
          <Radio.Group optionType="button" buttonStyle="solid" value={result} onChange={(e) => setResult(e.target.value)} options={[{ value: 'pass', label: t('rec.res.pass') }, { value: 'consider', label: t('rec.res.consider') }, { value: 'fail', label: t('rec.res.fail') }]} />
        </div>
        {scoringOn && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 4 }}>{t('rec.ed.scores')}</div>
            {SCORE_CRITERIA.map((k) => (
              <div key={k} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ minWidth: 190 }}>{t(`rec.sc.${k}`)}</span>
                <ScorePicker value={scores[k]} onChange={(v) => setScores((p) => ({ ...p, [k]: v }))} />
              </div>
            ))}
          </div>
        )}
        {field(t('rec.ed.strengths'), strengths, setStrengths)}
        {field(t('rec.ed.weaknesses'), weaknesses, setWeaknesses)}
        {field(t('rec.ed.comment'), comment, setComment)}
        <div style={{ marginBottom: 4 }}>{t('rec.ed.reason')}</div>
        <Input.TextArea rows={3} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
      </AppModal>
    </>
  )
}

/** Chọn điểm 1–5 cho một tiêu chí (nút lớn, bấm được trên tablet). */
export function ScorePicker({ value, onChange }: { value?: number; onChange?: (v: number) => void }) {
  return <Radio.Group size="large" optionType="button" buttonStyle="solid" value={value} onChange={(e) => onChange?.(e.target.value)} options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))} />
}

/** Điểm một người: "16/20", di chuột xem từng tiêu chí. */
export function ScoreTag({ scores }: { scores: RecruitScores }) {
  const { t } = useTranslation()
  return (
    <Tooltip title={SCORE_CRITERIA.map((k) => `${t(`rec.sc.${k}`)}: ${scores[k]}`).join(' · ')}>
      <Tag color="geekblue">{scoreTotal(scores)}/20</Tag>
    </Tooltip>
  )
}

/** Từng tiêu chí, dạng dòng ngắn để hiện dưới tên người phỏng vấn. */
export function ScoreLine({ scores }: { scores: RecruitScores }) {
  const { t } = useTranslation()
  return <div className="cell-muted">{SCORE_CRITERIA.map((k) => `${t(`rec.sc.${k}`)} ${scores[k]}`).join(' · ')} = <b>{scoreTotal(scores)}/20</b></div>
}

/** Khung "Điểm trung bình hội đồng": tổng trung bình trên 20 và trung bình từng tiêu chí; chưa đủ người chấm thì ghi "tạm tính". */
export function ScoreAverageBox({ avg }: { avg: ScoreAverage }) {
  const { t } = useTranslation()
  const partial = avg.count < avg.panelSize
  return (
    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--c-tint)', border: '1px solid color-mix(in srgb, var(--c-primary) 30%, var(--c-border))', marginTop: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{t('rec.avg.title')}</span>
        <b style={{ fontSize: 22 }}>{avg.total}</b><span className="cell-muted">/20</span>
        {partial && <Tag color="gold">{t('rec.avg.partial')}</Tag>}
        <span className="cell-muted">{t('rec.avg.people', { n: avg.count, m: avg.panelSize })}</span>
      </div>
      <div className="cell-muted" style={{ marginTop: 2 }}>{SCORE_CRITERIA.map((k) => `${t(`rec.sc.${k}`)} ${avg[k]}`).join(' · ')}</div>
    </div>
  )
}

const REC_COLOR = { pass: 'green', consider: 'gold', fail: 'red' } as const

/** Tổng điểm trung bình của hồ sơ kèm đề xuất (đạt / xem xét / không đạt) và hạng trong cùng vị trí. */
export function ScoreSummary({ score, recommendation, rank }: { score?: number | null; recommendation?: 'pass' | 'consider' | 'fail' | null; rank?: number }) {
  const { t } = useTranslation()
  if (score == null) return <span className="cell-muted">—</span>
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <b>{score}</b><span className="cell-muted">/20</span>{' '}
      {recommendation && <Tag color={REC_COLOR[recommendation]}>{t(`rec.recm.${recommendation}`)}</Tag>}
      {rank != null && <span className="cell-muted">#{rank}</span>}
    </span>
  )
}

/** Ảnh chân dung lấy từ CV (dáng ảnh thẻ 3x4); CV không có ảnh riêng thì hiện khung người. */
export function CandidatePhoto({ id, name, height = 72, version = 0 }: { id: number; name: string; height?: number; version?: number }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [version])
  const box: React.CSSProperties = { width: Math.round(height * 0.75), height, borderRadius: 6, flex: 'none', border: '1px solid var(--c-border, #e5e7eb)', background: 'var(--c-surface-2, #f3f4f6)' }
  return bad
    ? <span aria-hidden style={{ ...box, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: height / 2.4 }}><UserOutlined /></span>
    : <img src={version ? `${photoUrl(id)}?v=${version}` : photoUrl(id)} alt={name} loading="lazy" onError={() => setBad(true)} style={{ ...box, objectFit: 'cover', display: 'block' }} />
}

/** Điểm từng người phỏng vấn đã nhập (dưới điểm trung bình ở cột Điểm PV); rê chuột để xem 4 tiêu chí. */
export function PanelScoreList({ items }: { items?: PanelScore[] }) {
  const { t } = useTranslation()
  if (!items || items.length === 0) return null
  const multi = new Set(items.map((p) => p.round)).size > 1   // hồ sơ nhiều vòng: ghi rõ V1 / V2
  return (
    <div className="rec-pscores">
      {items.map((p) => (
        <Tooltip key={`${p.round}-${p.userId}`} title={p.scores ? SCORE_CRITERIA.map((k) => `${t(`rec.sc.${k}`)}: ${p.scores![k]}`).join(' · ') : undefined}>
          <div>
            {multi && <span className="rd">V{p.round}</span>}
            <span className="who">{p.name ?? p.userId}</span>
            {p.scores ? <b>{scoreTotal(p.scores)}/20</b> : <span className="cell-muted">{t('rec.waiting')}</span>}
            {p.result && <span className={p.result === 'pass' ? 'ok' : 'bad'}>{p.result === 'pass' ? '✓' : p.result === 'consider' ? '?' : '✗'}</span>}
          </div>
        </Tooltip>
      ))}
    </div>
  )
}

/** Hạn nhập phiếu đánh giá của một lượt: 0 giờ ngày sau ngày phỏng vấn, hoặc hạn gia hạn muộn nhất (sự kiện eval_extended "#{id}|{hạn}|..."), giống máy chủ. */
/** Màu thẻ kết quả của một người phỏng vấn: Đạt xanh, Xem xét vàng, Không đạt đỏ. */
export const resTone = (r: string | null | undefined) => r === 'pass' ? 'green' : r === 'consider' ? 'gold' : r === 'fail' ? 'red' : undefined

export function evalUntil(iv: { id: number; startAt: string }, events: RecruitEvent[]): Date {
  const d = new Date(iv.startAt); let until = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  for (const e of events) {
    if (e.kind !== 'eval_extended' || !(e.note ?? '').startsWith(`#${iv.id}|`)) continue
    const x = new Date(e.note!.split('|')[1])
    if (!Number.isNaN(x.getTime()) && x > until) until = x
  }
  return until
}

/** Nút của trưởng HR: gia hạn nhập đánh giá tới hết hôm nay cho lượt đã quá hạn (lý do bắt buộc, người chưa nộp được báo). */
export function ExtendEvalButton({ interviewId }: { interviewId: number }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: () => recruit.extendEvaluation(interviewId, reason.trim()),
    onSuccess: () => { msg.success(t('rec.el.extended')); setOpen(false); setReason(''); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  return (
    <>
      <Button icon={<FieldTimeOutlined />} onClick={() => setOpen(true)}>{t('rec.el.extend')}</Button>
      <AppModal open={open} onClose={() => setOpen(false)} size="sm" icon={<FieldTimeOutlined />} title={t('rec.el.extend')} subtitle={t('rec.el.extendHint')} okText={t('rec.el.extend')} okDisabled={reason.trim().length < 5} okLoading={m.isPending} onOk={() => m.mutate()}>
        <div style={{ marginBottom: 6 }}>{t('rec.unlockReason')}</div>
        <Input.TextArea rows={3} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
      </AppModal>
    </>
  )
}
