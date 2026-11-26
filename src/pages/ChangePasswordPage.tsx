import { Alert, Avatar, Button, Card, Form, Input } from 'antd'
import { CheckCircleFilled, CloseCircleOutlined, LockOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { adminError } from '../api/userAdmin'
import { useAuth } from '../auth/AuthContext'
import { siteHome } from '../config/navigation'
import { PageBanner } from '../components/PageBanner'
import { useToast } from '../hooks/useToast'

interface Form_ { current: string; password: string; confirm: string }

/** Quy tắc mật khẩu, khớp PasswordPolicy ở máy chủ: 8–24 ký tự ASCII không khoảng trắng, có chữ hoa, chữ thường, chữ số, ký tự đặc biệt. */
const RULES: { key: string; ok: (p: string) => boolean }[] = [
  { key: 'len', ok: (p) => p.length >= 8 && p.length <= 24 && /^[!-~]+$/.test(p) },
  { key: 'upper', ok: (p) => /[A-Z]/.test(p) },
  { key: 'lower', ok: (p) => /[a-z]/.test(p) },
  { key: 'digit', ok: (p) => /[0-9]/.test(p) },
  { key: 'special', ok: (p) => /[^A-Za-z0-9\s]/.test(p) },
]

/** Đổi mật khẩu của chính mình. Tài khoản đang dùng mật khẩu mặc định (vina + mã nhân viên) bị buộc vào đây trước khi dùng các màn khác. */
export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const navigate = useNavigate()
  const { user, passwordChanged } = useAuth()
  const [form] = Form.useForm<Form_>()
  const forced = !!user?.mustChangePassword
  const pw = Form.useWatch('password', form) ?? ''

  const change = useMutation({
    mutationFn: (v: Form_) => api.post('/auth/change-password', { current: v.current, newPassword: v.password }),
    onSuccess: () => { msg.success(t('pw.done')); form.resetFields(); passwordChanged(); navigate(siteHome(user), { replace: true }) },
    onError: (e) => {
      const { code } = adminError(e)
      msg.error(code === 'wrong_current' ? t('pw.err.wrong_current') : code === 'same_as_current' ? t('pw.err.same') : code === 'too_weak' ? t('pw.err.weak') : t('usr.err.generic'))
    },
  })

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <PageBanner avatar={<Avatar size={56} icon={<LockOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('pw.title')} subtitle={t('pw.subtitle')} />
      {forced && <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={t('pw.forcedTitle')} description={t('pw.forced')} />}
      <Card>
        <Form form={form} layout="vertical" autoComplete="off" onFinish={(v) => change.mutate(v)}>
          <Form.Item name="current" label={t('pw.current')} rules={[{ required: true }]}><Input.Password autoComplete="current-password" maxLength={50} /></Form.Item>
          <Form.Item name="password" label={t('usr.newPassword')} validateTrigger="onBlur"
            rules={[{ required: true }, { validator: (_, v: string) => (!v || RULES.every((r) => r.ok(v)) ? Promise.resolve() : Promise.reject(new Error(t('pw.err.weak')))) }]}
            extra={(
              <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                {RULES.map((r) => {
                  const ok = r.ok(pw)
                  return (
                    <li key={r.key} style={{ color: ok ? 'var(--ant-color-success, #12B76A)' : undefined }}>
                      {ok ? <CheckCircleFilled /> : <CloseCircleOutlined />} {t(`pw.rule.${r.key}`)}
                    </li>
                  )
                })}
              </ul>
            )}>
            <Input.Password autoComplete="new-password" maxLength={24} />
          </Form.Item>
          <Form.Item name="confirm" label={t('pw.confirm')} dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || getFieldValue('password') === v ? Promise.resolve() : Promise.reject(new Error(t('pw.err.mismatch')))) })]}>
            <Input.Password autoComplete="new-password" maxLength={24} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={change.isPending}>{t('pw.submit')}</Button>
        </Form>
      </Card>
    </div>
  )
}
