import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import QRCode from 'qrcode'
import type { OtpChallenge } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { LanguageSelect } from '../components/LanguageSelect'
import { LoginLookBar, useLoginLook } from '../components/LoginLook'
import { OccasionDecor } from '../components/OccasionDecor'
import { useThemeMode } from '../theme/ThemeProvider'
import { badgeOf, greetingOf } from '../theme/occasions'
import logoMark from '../assets/logo1.png'
import logoWord from '../assets/logoB.png'

interface FormValues { userId: string; password: string }

/** Đăng nhập: thẻ form nằm giữa màn hình trên nền thương hiệu; chọn ngôn ngữ (có cờ) ở góc phải trên. */
export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const { user, login, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const look = useLoginLook()
  const { occasion } = useThemeMode()
  const [otp, setOtp] = useState<OtpChallenge | null>(null)
  const [qr, setQr] = useState<string>('')
  useEffect(() => {
    if (otp?.otpUri) QRCode.toDataURL(otp.otpUri, { width: 200, margin: 1 }).then(setQr).catch(() => setQr(''))
    else setQr('')
  }, [otp])

  if (user) return <Navigate to="/" replace />

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
    <div className="login-page" data-bg={look.bg} data-layout={look.layout}>
      <div className="login-ring r1" aria-hidden /><div className="login-ring r2" aria-hidden /><div className="login-ring r3" aria-hidden />

      <OccasionDecor count={22} />
      <main className="login-center">
        {occasion && <div className="occ-login-greet">{badgeOf(occasion) ? <span className="occ-badge sm">{badgeOf(occasion)}</span> : occasion.emoji[0]} {greetingOf(occasion, i18n.language, t, new Date().getFullYear()).title} {occasion.emoji[1] ?? occasion.emoji[0]}</div>}
        <section className="login-card">
          <div className="login-card-head">
            <div className="login-brand"><span className="login-logo"><img src={logoMark} alt="" /></span><span><b>VINATECH VINA</b><small>{t('appName')}</small></span></div>
            <LanguageSelect width={158} />
          </div>
          <div className="login-card-body">
          <img className="login-wordmark" src={logoWord} alt="VINATech" />
          <h1>{t('login.welcome')}</h1>
          <p className="login-sub">{t('login.title')}</p>

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
          <Form<FormValues> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
            <Form.Item
              name="userId"
              label={t('login.userId')}
              rules={[{ required: true, whitespace: true, message: t('login.required', { field: t('login.userId') }) }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('login.password')}
              rules={[{ required: true, message: t('login.required', { field: t('login.password') }) }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting} className="login-submit">{t('login.submit')}</Button>
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
