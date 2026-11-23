import { useRef, useState } from 'react'
import { Button, Popconfirm, Space, Tooltip } from 'antd'
import { CameraOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { idCards } from '../api/idCards'
import { useToast } from '../hooks/useToast'
import { PhotoCropModal } from './PhotoCropModal'
import { UserAvatar } from './UserAvatar'

const PHOTO_MAX = 8 * 1024 * 1024

/**
 * Ảnh nhân viên theo mã nhân viên: bấm ảnh để phóng to; bấm máy ảnh để chọn ảnh, cắt rồi tải lên (dùng chung màn CCCD, nhân sự ERP, cây Dept).
 * Chưa có mã nhân viên thì chỉ hiện ảnh / chữ cái đầu, không cho tải lên.
 * Ảnh hiển thị có thể là ảnh người đó tự tải hoặc ảnh hệ thống cũ: chỉ ảnh nhân sự tải (đường dẫn /api/id-card-photo/) mới có nút xoá.
 */
export function EmployeePhoto({ employeeId, src, name, size = 36, editable = true, onUploaded }: {
  employeeId?: string | null; src?: string | null; name?: string; size?: number; editable?: boolean; onUploaded?: (url: string | null) => void
}) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const pick = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const code = (employeeId ?? '').trim()
  const refresh = () => { qc.invalidateQueries({ queryKey: ['id-cards'] }); qc.invalidateQueries({ queryKey: ['orgModel'] }) }
  const up = useMutation({
    mutationFn: (f: File) => idCards.uploadEmployeePhoto(code, f),
    onSuccess: (url) => { msg.success(t('idc.col.photoSaved')); setFile(null); onUploaded?.(url); refresh() },
    onError: () => msg.error(t('idc.col.photoBad')),
  })
  const del = useMutation({
    mutationFn: () => idCards.removeEmployeePhoto(code),
    onSuccess: (url) => { onUploaded?.(url); refresh() },
    onError: () => msg.error(t('idc.col.photoBad')),
  })
  const choose = (list: FileList | null) => {
    const f = list?.[0]
    if (pick.current) pick.current.value = ''
    if (!f) return
    if (!f.type.startsWith('image/') || f.size > PHOTO_MAX) { msg.error(t('idc.col.photoBad')); return }
    setFile(f)
  }
  const canEdit = editable && !!code
  const hrOwned = !!src && src.includes('/api/id-card-photo/')
  return (
    <Space size={4} align="center">
      <UserAvatar name={name} size={size} src={src} />
      {canEdit && (
        <Space size={0} direction="vertical">
          <Tooltip title={t('idc.col.photoAdd')}>
            <Button type="text" size="small" icon={<CameraOutlined />} aria-label={t('idc.col.photoAdd')} onClick={() => pick.current?.click()} />
          </Tooltip>
          {src && (
            <Tooltip title={t('idc.col.photoDownload')}>
              <Button type="text" size="small" icon={<DownloadOutlined />} aria-label={t('idc.col.photoDownload')} href={src} download={`${code}.jpg`} />
            </Tooltip>
          )}
          {hrOwned && (
            <Popconfirm title={t('avatar.removeAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => del.mutate()}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('idc.col.photoRemove')} loading={del.isPending} />
            </Popconfirm>
          )}
        </Space>
      )}
      {canEdit && <input ref={pick} type="file" hidden accept="image/*" onChange={(e) => choose(e.target.files)} />}
      <PhotoCropModal file={file} busy={up.isPending} onCancel={() => setFile(null)} onDone={(f) => up.mutate(f)} />
    </Space>
  )
}
