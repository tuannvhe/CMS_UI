import { Alert, Button, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

interface Props { savedAt: number | null; restoredAt: number | null; onDiscard: () => void }

/** Báo form vừa tự lưu (mỗi 2 phút) hoặc vừa được nạp lại từ bản nháp đã lưu, kèm nút bỏ bản nháp. */
export function AutosaveNote({ savedAt, restoredAt, onDiscard }: Props) {
  const { t } = useTranslation()
  return (
    <>
      {restoredAt !== null && (
        <Alert type="info" showIcon style={{ fontSize: 12 }} title={t('req.draftRestored', { time: dayjs(restoredAt).format('HH:mm DD/MM') })}
          action={<Button size="small" onClick={onDiscard}>{t('req.draftDiscard')}</Button>} />
      )}
      {savedAt !== null && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('req.draftSaved', { time: dayjs(savedAt).format('HH:mm') })}</Typography.Text>}
    </>
  )
}
