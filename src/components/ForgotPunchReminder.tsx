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
    getForgotReminder().then((r) => {
      const evals = r.evaluations ?? []
      if (r.days.length > 0 || evals.length > 0) { setData({ ...r, evaluations: evals }) }
    }).catch(() => release(k))   // lỗi mạng: lần mở sau thử lại
  }, [uid, hasEmployee])

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return `${dt.toLocaleDateString(i18n.language, { weekday: 'short' })} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }
  const close = () => setData(null)
  const evals = data?.evaluations ?? []
  const hasDays = (data?.days.length ?? 0) > 0

  return (
    <Modal open={!!data} onCancel={close} title={<span><FieldTimeOutlined style={{ color: '#d97706', marginRight: 8 }} />{t(hasDays && evals.length > 0 ? 'notif.forgot.bothTitle' : hasDays ? 'notif.forgot.title' : 'notif.forgot.evalTitle')}</span>} width={evals.length > 0 ? 560 : 460} centered
      footer={data && (
        <>
          <Button onClick={close}>{data.isWorker && evals.length === 0 ? t('notif.forgot.ok') : t('notif.forgot.later')}</Button>
          {hasDays && !data.isWorker && <Button type={evals.length > 0 ? 'default' : 'primary'} onClick={() => { close(); navigate('/finger-forms') }}>{t('notif.forgot.go')}</Button>}
          {evals.length > 0 && <Button type="primary" onClick={() => { close(); navigate('/evaluation?tab=pending') }}>{t('notif.forgot.evalGo')}</Button>}
        </>
      )}>
      {data && (
        <div>
          {hasDays && (
            <>
              <p style={{ marginTop: 0 }}>{t('notif.forgot.intro')}</p>
              <ul style={{ paddingInlineStart: 20, margin: '0 0 12px' }}>
                {data.days.map((d) => (
                  <li key={d.date}><b>{fmt(d.date)}</b> <span style={{ color: 'var(--c-muted)' }}>– {d.onlyPunch ? t('notif.forgot.single', { time: d.onlyPunch }) : d.missingIn ? t('notif.forgot.missIn') : t('notif.forgot.missOut')}</span></li>
                ))}
              </ul>
              <p style={{ marginBottom: evals.length > 0 ? 16 : 0 }}>{data.isWorker ? t('notif.forgot.worker') : t('notif.forgot.staff')}</p>
            </>
          )}
          {evals.length > 0 && (
            <>
              <p style={{ marginTop: 0, fontWeight: 600 }}>{t('notif.forgot.evalIntro', { n: evals.length })}</p>
              <ul style={{ paddingInlineStart: 20, margin: 0 }}>
                {evals.slice(0, 8).map((e) => (
                  <li key={`${e.employeeId}|${e.dateRate}|${e.round}`}><b>{e.name || e.employeeId}</b> <span style={{ color: 'var(--c-muted)' }}>– {e.typeRate} · {t('notif.forgot.evalLate', { n: e.daysLate })}</span></li>
                ))}
              </ul>
              {evals.length > 8 && <p style={{ margin: '4px 0 0', color: 'var(--c-muted)' }}>{t('notif.forgot.evalMore', { n: evals.length - 8 })}</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
