import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'
import { LanguageSelect } from '../components/LanguageSelect'

interface FormValues { userId: string; password: string }

/** Đăng nhập: thẻ form nằm giữa màn hình trên nền thương hiệu; chọn ngôn ngữ (có cờ) ở góc phải trên. */
export default function LoginPage() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const onFinish = async (v: FormValues) => {
    setError(null)
    setSubmitting(true)
    try {
      await login(v.userId, v.password)
      navigate('/', { replace: true })
    } catch (e) {
      const code = axios.isAxiosError(e) ? e.response?.data?.title : undefined
      setError(t(`login.${code ?? 'network'}`, { defaultValue: t('login.network') }))
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="login-page">
      <div className="login-ring r1" aria-hidden /><div className="login-ring r2" aria-hidden /><div className="login-ring r3" aria-hidden />

      <main className="login-center">
        <section className="login-card">
          <div className="login-card-head">
            <div className="login-brand"><span className="login-logo">V</span><span><b>VINATECH VINA</b><small>{t('appName')}</small></span></div>
            <LanguageSelect width={158} />
          </div>
          <div className="login-card-body">
          <h1>{t('login.welcome')}</h1>
          <p className="login-sub">{t('login.title')}</p>

          {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

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
          </div>
        </section>

      </main>

      <footer className="login-foot">© VietNam EA Team VINATECH VINA 2022 - V2.0.0</footer>
    </div>
  )
}
