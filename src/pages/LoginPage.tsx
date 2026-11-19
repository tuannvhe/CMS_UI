import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input } from 'antd'
import { CaretRightFilled, LockOutlined, PauseCircleOutlined, PauseOutlined, PlayCircleOutlined, SwapOutlined, UserOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import QRCode from 'qrcode'
import type { OtpChallenge } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { clearLastAccount, loadLastAccount, type LastAccount } from '../auth/lastAccount'
import { UserAvatar } from '../components/UserAvatar'
import { LanguageSelect } from '../components/LanguageSelect'
import { LoginLookBar, useLoginLook } from '../components/LoginLook'
import { OccasionDecor } from '../components/OccasionDecor'
import { useThemeMode } from '../theme/ThemeProvider'
import { badgeOf, greetingOf } from '../theme/occasions'
import logoMark from '../assets/logo1.png'
import logoWord from '../assets/logoB.png'
import loginPoster from '../assets/login-bg.jpg'

interface FormValues { userId: string; password: string }


/** Đăng nhập: thẻ form nằm giữa màn hình trên nền thương hiệu; chọn ngôn ngữ (có cờ) ở góc phải trên. */
export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const { user, login, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const look = useLoginLook()
  /** Hiệu ứng chuyển: tắt video thì giữ khung thêm 0,45 giây để mờ dần rồi mới gỡ. */
  const [stageOn, setStageOn] = useState(look.video)
  useEffect(() => {
    if (look.video) { setStageOn(true); return }
    const id = window.setTimeout(() => setStageOn(false), 450)
    return () => window.clearTimeout(id)
  }, [look.video])
  const showVideo = look.video || stageOn
  /** Bật/tắt video: dùng View Transitions (trình duyệt hỗ trợ) để cả bố cục chuyển mượt bằng ảnh chụp, nhẹ hơn animate độ rộng; không hỗ trợ thì dùng hiệu ứng mờ dần ở trên. */
  const switchVideo = () => {
    const next = !look.video
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => { flushSync(() => { look.setVideo(next); setStageOn(next) }) })
    else look.setVideo(next)
  }
  const videoRef = useRef<HTMLVideoElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const [paused, setPaused] = useState(false)
  const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) { userPaused.current = false; void v.play().catch(() => {}) } else { userPaused.current = true; v.pause() } }
  const { occasion } = useThemeMode()
  /** Dịp lễ đang diễn ra có video riêng (cấu hình ở Quản lý dịp) thì dùng, không thì video mặc định. */
  /** Video mặc định: bản 480p nhẹ cho màn nhỏ hoặc mạng chậm / tiết kiệm dữ liệu, bản 720p cho còn lại. */
  const [lite] = useState(() => {
    try {
      const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
      return window.matchMedia('(max-width: 991px)').matches || !!c?.saveData || (!!c?.effectiveType && c.effectiveType !== '4g')
    } catch { return false }
  })
  const videoSrc = occasion?.background?.videoUrl || (lite ? '/login-bg-sm.mp4' : '/login-bg.mp4')
  /** Tab bị ẩn thì tạm dừng video (đỡ CPU / pin), hiện lại thì phát tiếp trừ khi người dùng đã chủ động dừng. */
  const userPaused = useRef(false)
  useEffect(() => {
    const onVis = () => {
      const v = videoRef.current
      if (!v) return
      if (document.hidden) v.pause()
      else if (!userPaused.current) void v.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  /** Phím cách tạm dừng / phát video khi không đang gõ vào ô nhập hay bấm nút. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName))) return
      const v = videoRef.current
      if (!v) return
      e.preventDefault()
      if (v.paused) { userPaused.current = false; void v.play().catch(() => {}) } else { userPaused.current = true; v.pause() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [otp, setOtp] = useState<OtpChallenge | null>(null)
  const [qr, setQr] = useState<string>('')
  const [saved, setSaved] = useState<LastAccount | null>(() => loadLastAccount())
  /** Cơ sở đăng nhập (nhớ lần chọn trước): VINA dùng CSDL CMS_VINA, Hà Nội dùng CSDL riêng. */
  const [form] = Form.useForm<FormValues>()
  useEffect(() => {
    if (otp?.otpUri) QRCode.toDataURL(otp.otpUri, { width: 200, margin: 1 }).then(setQr).catch(() => setQr(''))
    else setQr('')
  }, [otp])

  if (user) return <Navigate to="/" replace />

  /** Đăng nhập tài khoản khác: quên tài khoản đã lưu, về form nhập đủ mã + mật khẩu. */
  const switchAccount = () => {
    clearLastAccount()
    setSaved(null)
    setError(null)
    form.resetFields()
  }

  const onOtp = async (v: { code: string }) => {
    setError(null)
    setSubmitting(true)
    try {
      await verifyOtp(v.code)
      navigate('/', { replace: true })
    } catch (e) {
      const code = axios.isAxiosError(e) ? e.response?.data?.title : undefined
      if (code === 'otp_ticket_expired') setOtp(null)   // vé 5 phút đã hết: nhập lại mật khẩu
      setError(t(`login.${code ?? 'network'}`, { defaultValue: t('login.network') }))
    } finally {
      setSubmitting(false)
    }
  }

  const onFinish = async (v: FormValues) => {
    setError(null)
    setSubmitting(true)
    try {
      const ch = await login(v.userId, v.password)
      if (ch) setOtp(ch)   // quản trị: còn bước nhập mã OTP
      else navigate('/', { replace: true })
    } catch (e) {
      const code = axios.isAxiosError(e) ? e.response?.data?.title : undefined
      setError(t(`login.${code ?? 'network'}`, { defaultValue: t('login.network') }))
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className={`login-page${showVideo ? ' has-video' : ''}${stageOn && !look.video ? ' video-out' : ''}`} data-bg={look.bg} data-layout={look.layout}>
      {showVideo && (<>
        <div className="login-stage">
          <video key={videoSrc} ref={videoRef} className="login-video" autoPlay muted loop playsInline preload="auto" poster={loginPoster} aria-hidden tabIndex={-1} disablePictureInPicture
            onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
            onTimeUpdate={(e) => { const v = e.currentTarget; if (barRef.current && v.duration) barRef.current.style.width = `${(v.currentTime / v.duration) * 100}%` }}
            onEnded={(e) => { const v = e.currentTarget; v.currentTime = 0; void v.play().catch(() => {}) }}>
            <source src={videoSrc} />
          </video>
          <div className="login-caption">
            <img src={logoMark} alt="" />
            <div><b>VINATECH VINA</b><span>{t('login.look.caption')}</span></div>
            <button type="button" className="login-pause" onClick={togglePlay} aria-label={paused ? t('login.look.play') : t('login.look.pause')} title={paused ? t('login.look.play') : t('login.look.pause')}>{paused ? <CaretRightFilled /> : <PauseOutlined />}</button>
          </div>
          <div className="login-progress" aria-hidden><i ref={barRef} /></div>
        </div>
        <div className="login-video-shade" aria-hidden />
      </>)}
      <button type="button" className="login-video-toggle" onClick={switchVideo} aria-pressed={look.video} title={look.video ? t('login.look.videoOff') : t('login.look.videoOn')} aria-label={look.video ? t('login.look.videoOff') : t('login.look.videoOn')}>{look.video ? <PauseCircleOutlined /> : <PlayCircleOutlined />}</button>
      <div className="login-ring r1" aria-hidden /><div className="login-ring r2" aria-hidden /><div className="login-ring r3" aria-hidden />

      <OccasionDecor count={12} />
      <main className="login-center">
        {occasion && <div className="occ-login-greet">{badgeOf(occasion) ? <span className="occ-badge sm">{badgeOf(occasion)}</span> : occasion.emoji[0]} {greetingOf(occasion, i18n.language, t, new Date().getFullYear()).title} {occasion.emoji[1] ?? occasion.emoji[0]}</div>}
        <section className="login-card">
          <div className="login-card-head">
            <div className="login-brand"><span className="login-logo"><img src={logoMark} alt="" /></span><span><b>VINATECH VINA</b><small>{t('appName')}</small></span></div>
            <LanguageSelect width={158} />
          </div>
          <div className="login-card-body">
          <img className="login-wordmark" src={logoWord} alt="VINATech" />
          {saved ? (
            <div className="login-saved">
              <UserAvatar name={saved.fullName || saved.userId} src={saved.avatarUrl} size={64} />
              <div className="login-saved-info">
                <span className="login-saved-hi">{t('login.welcome')}</span>
                <h1>{saved.fullName || saved.userId}</h1>
                <span className="login-saved-id">{t('login.userId')}: <b>{saved.userId}</b></span>
              </div>
            </div>
          ) : (
            <>
              <h1>{t('login.welcome')}</h1>
              <p className="login-sub">{t('login.title')}</p>
            </>
          )}

          {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

          {otp ? (
            <Form<{ code: string }> layout="vertical" onFinish={onOtp} requiredMark={false} size="large">
              <p className="login-sub" style={{ marginTop: 0 }}>{otp.otpSetup ? t('login.otp.setupHint') : t('login.otp.enterHint')}</p>
              {otp.otpSetup && (
                <div className="otp-setup">
                  {qr && <img src={qr} alt="QR" width={180} height={180} />}
                  <div className="otp-secret"><span>{t('login.otp.secret')}</span><code>{otp.otpSecret}</code></div>
                </div>
              )}
              <Form.Item name="code" label={t('login.otp.code')} rules={[{ required: true, pattern: /^\s*\d{3}\s?\d{3}\s*$/, message: t('login.otp.codeFormat') }]}>
                <Input inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus placeholder="123456" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={submitting} className="login-submit">{t('login.otp.verify')}</Button>
              <Button type="link" block onClick={() => { setOtp(null); setError(null) }} style={{ marginTop: 8 }}>{t('login.otp.back')}</Button>
            </Form>
          ) : (
          <Form<FormValues> key={saved ? 'saved' : 'full'} form={form} layout="vertical" onFinish={onFinish} requiredMark={false} size="large" initialValues={saved ? { userId: saved.userId } : undefined}>
            <Form.Item
              name="userId"
              hidden={!!saved}
              label={t('login.userId')}
              rules={[{ required: true, whitespace: true, message: t('login.required', { field: t('login.userId') }) }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="username" autoFocus={!saved} />
            </Form.Item>
            <Form.Item
              name="password"
              label={saved ? t('login.savedPasswordHint') : t('login.password')}
              rules={[{ required: true, message: t('login.required', { field: t('login.password') }) }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" autoFocus={!!saved} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting} className="login-submit">{t('login.submit')}</Button>
            {saved && <Button type="link" block icon={<SwapOutlined />} onClick={switchAccount} className="login-switch">{t('login.switchAccount')}</Button>}
          </Form>
          )}
          <LoginLookBar />
          </div>
        </section>

      </main>

      <footer className="login-foot">© VietNam EA Team VINATECH VINA 2022 - V2.0.0</footer>
    </div>
  )
}
