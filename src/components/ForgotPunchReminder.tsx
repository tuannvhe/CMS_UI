import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { FieldTimeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getForgotReminder, type ForgotReminder as Reminder } from '../api/attendance'
import { useAuth } from '../auth/AuthContext'

// Đã kiểm tra / nhắc trong ngày cho tài khoản này chưa (lưu trên trình duyệt; không đọc được bộ nhớ thì nhớ tạm trong phiên).
const claimed = new Set<string>()
const keyOf = (uid: string) => { const d = new Date(); return `cms.forgotRemind:${uid}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
function claim(k: string) {
  if (claimed.has(k)) return false
  claimed.add(k)
  try { if (localStorage.getItem(k)) return false; localStorage.setItem(k, '1') } catch { /* chế độ riêng tư: chỉ nhớ trong phiên */ }
  return true
}
function release(k: string) {
  claimed.delete(k)
  try { localStorage.removeItem(k) } catch { /* bỏ qua */ }
}

/**
 * Nhắc quên chấm vân tay vào / ra: lần đầu vào hệ thống trong ngày (mỗi trình duyệt), hỏi máy chủ các ngày gần đây thiếu giờ vào hoặc ra mà chưa có đơn.
 * Có thì mở hộp thoại: staff tự đăng ký đơn ở màn Quên vân tay, công nhân (OP) liên hệ HTSX. Không có gì cần nhắc hoặc lỗi thì im lặng.
 */
export function ForgotPunchReminder() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const uid = user?.userId
  const hasEmployee = !!user?.employeeId
  const [data, setData] = useState<Reminder | null>(null)

  useEffect(() => {
    if (!uid || !hasEmployee) return
    const k = keyOf(uid)
    if (!claim(k)) return
    getForgotReminder().then((r) => { if (r.days.length > 0) setData(r) }).catch(() => release(k))   // lỗi mạng: lần mở sau thử lại
  }, [uid, hasEmployee])

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return `${dt.toLocaleDateString(i18n.language, { weekday: 'short' })} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }
  const close = () => setData(null)

  return (
    <Modal open={!!data} onCancel={close} title={<span><FieldTimeOutlined style={{ color: '#d97706', marginRight: 8 }} />{t('notif.forgot.title')}</span>} width={460} centered
      footer={data && (
        <>
          <Button onClick={close}>{data.isWorker ? t('notif.forgot.ok') : t('notif.forgot.later')}</Button>
          {!data.isWorker && <Button type="primary" onClick={() => { close(); navigate('/finger-forms') }}>{t('notif.forgot.go')}</Button>}
        </>
      )}>
      {data && (
        <div>
          <p style={{ marginTop: 0 }}>{t('notif.forgot.intro')}</p>
          <ul style={{ paddingInlineStart: 20, margin: '0 0 12px' }}>
            {data.days.map((d) => (
              <li key={d.date}><b>{fmt(d.date)}</b> <span style={{ color: 'var(--c-muted)' }}>– {d.onlyPunch ? t('notif.forgot.single', { time: d.onlyPunch }) : d.missingIn ? t('notif.forgot.missIn') : t('notif.forgot.missOut')}</span></li>
            ))}
          </ul>
          <p style={{ marginBottom: 0 }}>{data.isWorker ? t('notif.forgot.worker') : t('notif.forgot.staff')}</p>
        </div>
      )}
    </Modal>
  )
}
