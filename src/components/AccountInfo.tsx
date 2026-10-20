import { useRef, useState } from 'react'
import { Button, Card, Descriptions, Popconfirm, Typography } from 'antd'
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { avatarApi, AVATAR_MAX } from '../api/avatar'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { UserAvatar } from './UserAvatar'

/** Thẻ thông tin tài khoản dùng ở Trang chủ và Cài đặt, có đổi / xóa ảnh đại diện. */
export function AccountInfo() {
  const { t } = useTranslation()
  const { user, setAvatarUrl } = useAuth()
  const toast = useToast()
  const pick = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const rows = [
    { label: t('home.userId'), value: user.userId },
    { label: t('home.group'), value: user.groupName },
    { label: t('home.email'), value: user.email },
    { label: t('home.factory'), value: user.factoryCode },
  ].filter((r) => r.value)

  const upload = async (list: FileList | null) => {
    const f = list?.[0]
    if (pick.current) pick.current.value = ''
    if (!f) return
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { toast.error(t('avatar.type')); return }
    if (f.size > AVATAR_MAX) { toast.error(t('avatar.tooLarge')); return }
    setBusy(true)
    try { setAvatarUrl(await avatarApi.upload(f)); toast.success(t('avatar.updated')) }
    catch { toast.error(t('avatar.failed')) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await avatarApi.remove(); setAvatarUrl(null); toast.success(t('avatar.removed')) }
    catch { toast.error(t('avatar.failed')) }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" className="avatar-edit" onClick={() => pick.current?.click()} disabled={busy} aria-label={t('avatar.change')}>
          <UserAvatar name={user.fullName} src={user.avatarUrl} size={72} />
          <span className="avatar-edit-cam"><CameraOutlined /></span>
        </button>
        <input ref={pick} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => upload(e.target.files)} />
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>{user.fullName}</Typography.Title>
          <Typography.Text type="secondary">{user.userId}</Typography.Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Button size="small" icon={<CameraOutlined />} loading={busy} onClick={() => pick.current?.click()}>{t('avatar.change')}</Button>
            {user.avatarUrl && (
              <Popconfirm title={t('avatar.removeAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={remove}>
                <Button size="small" danger icon={<DeleteOutlined />} disabled={busy}>{t('avatar.remove')}</Button>
              </Popconfirm>
            )}
          </div>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>{t('avatar.hint')}</Typography.Text>
        </div>
      </div>
      <Descriptions column={{ xs: 1, sm: 2 }} colon={false} layout="vertical" size="small">
        {rows.map((r) => (
          <Descriptions.Item key={r.label} label={r.label}>{r.value}</Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  )
}
