import { useEffect, useState } from 'react'
import { Alert, Button, Card, Space, Switch, Tag, Typography } from 'antd'
import { BellOutlined, SendOutlined, SoundOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushApi, pushSupported } from '../api/push'
import { useToast } from '../hooks/useToast'
import { noticeSoundOn, playNoticeSound, setNoticeSound } from '../utils/notifySound'

/**
 * Bật / tắt thông báo đẩy cho THIẾT BỊ đang dùng (mỗi điện thoại / trình duyệt bật riêng). Khi bật, thông báo chuông (đơn chờ duyệt, lịch phỏng vấn,
 * kết quả đánh giá…) hiện cả khi không mở CMS. iPhone cần "Thêm vào Màn hình chính" rồi mở CMS từ biểu tượng đó.
 */
export function PushSettingsCard() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  // Trình duyệt chỉ cho thông báo đẩy trên trang HTTPS (hoặc localhost): trang http thì không có service worker, đừng báo nhầm là trình duyệt không hỗ trợ
  const insecure = typeof window !== 'undefined' && !window.isSecureContext
  const supported = !insecure && pushSupported()
  const key = useQuery({ queryKey: ['push-key'], queryFn: pushApi.key, enabled: supported, retry: false })
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [sound, setSound] = useState(noticeSoundOn)
  useEffect(() => { if (supported) currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false)) }, [supported])

  const iosNeedsInstall = isIos() && !isStandalone()
  const denied = supported && Notification.permission === 'denied'
  const usable = supported && !!key.data?.enabled && !!key.data?.ready && !!key.data.publicKey && !iosNeedsInstall

  const toggle = async (want: boolean) => {
    setBusy(true)
    try {
      if (want) {
        const r = await enablePush(key.data!.publicKey!)
        if (r === 'denied') { msg.warning(t('push.denied')); setOn(false); return }
        setOn(true); msg.success(t('push.enabled'))
      } else {
        await disablePush(); setOn(false); msg.success(t('push.disabled'))
      }
      qc.invalidateQueries({ queryKey: ['push-key'] })
    } catch {
      msg.error(t('push.error'))
    } finally { setBusy(false) }
  }
  const test = async () => {
    setBusy(true)
    try { const r = await pushApi.test(); if (r.sent > 0) msg.success(t('push.testSent', { n: r.sent })); else msg.warning(t('push.testNone')) }
    catch { msg.error(t('push.error')) } finally { setBusy(false) }
  }

  return (
    <Card style={{ marginTop: 16 }} title={<Space><BellOutlined />{t('push.title')}</Space>}
      extra={usable && <Switch checked={!!on} loading={busy || on === null} onChange={toggle} />}>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>{t('push.hint')}</Typography.Paragraph>
      {insecure && <Alert type="warning" showIcon title={t('push.needHttps')} />}
      {!insecure && !supported && <Alert type="warning" showIcon title={t('push.unsupported')} />}
      {supported && iosNeedsInstall && <Alert type="info" showIcon title={t('push.iosInstall')} />}
      {supported && key.data && !key.data.enabled && <Alert type="info" showIcon title={t('push.serverOff')} />}
      {supported && key.data?.enabled && !key.data.ready && <Alert type="warning" showIcon title={t('push.notReady')} />}
      {denied && <Alert type="warning" showIcon style={{ marginTop: 8 }} title={t('push.blocked')} />}
      {/* Tiếng "ting" khi có thông báo mới lúc đang mở CMS (2026-11-26) */}
      <Space wrap style={{ marginTop: 8, marginBottom: 8 }}>
        <SoundOutlined />
        <span>{t('push.sound')}</span>
        <Switch size="small" checked={sound} onChange={(v) => { setSound(v); setNoticeSound(v); if (v) playNoticeSound(true) }} />
        <Button size="small" type="link" onClick={() => playNoticeSound(true)}>{t('push.soundTest')}</Button>
      </Space>
      {usable && (
        <Space wrap style={{ marginTop: 4 }}>
          {on ? <Tag color="success" variant="filled">{t('push.onHere')}</Tag> : <Tag variant="filled">{t('push.offHere')}</Tag>}
          <span className="cell-muted">{t('push.devices', { n: key.data?.devices ?? 0 })}</span>
          {on && <Button size="small" icon={<SendOutlined />} loading={busy} onClick={test}>{t('push.test')}</Button>}
        </Space>
      )}
    </Card>
  )
}
