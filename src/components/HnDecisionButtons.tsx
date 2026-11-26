import { useState } from 'react'
import { App, Button, Input, Modal, Popconfirm, Space } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorCode, hnErrorKey, type HnDecisionBody, type HnRequestKind } from '../api/hn'

const MAX_REASON = 500

type Target = { kind: Exclude<HnRequestKind, 'overtime'> | 'overtime'; id: number | string } | { groupId: string; count: number }

/* 2026-11-26 [Truong] - HN requests: approve / reject buttons (single request or a whole OT group) */
/** Nút Duyệt (hỏi lại) và Từ chối (bắt buộc lý do) cho đơn đang chờ chính tôi. Xong thì tải lại các danh sách đơn HN. */
export function HnDecisionButtons({ target, size = 'small' }: { target: Target; size?: 'small' | 'middle' }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const isGroup = 'groupId' in target

  const m = useMutation({
    mutationFn: (body: HnDecisionBody) => (isGroup ? hnApi.decideOtGroup(target.groupId, body) : hnApi.decide(target.kind, target.id, body)),
    onSuccess: (r, body) => {
      message.success(isGroup ? t('hn.reqForm.groupDone', { n: r.count }) : t(body.action === 'approve' ? 'hn.reqForm.approved' : 'hn.reqForm.rejected'))
      setRejectOpen(false); setReason('')
    },
    onError: (e) => { message.error(t(hnErrorKey(e))); if (hnErrorCode(e) === 'already_decided') setRejectOpen(false) },
    // Thành công hay "đã xử lý trước" đều tải lại để danh sách đúng với CSDL.
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['hn', 'requests'] }); void qc.invalidateQueries({ queryKey: ['hn', 'otGroups'] }); void qc.invalidateQueries({ queryKey: ['hn', 'otGroup'] }) },
  })

  return (
    <>
      <Space size={4} onClick={(e) => e.stopPropagation()}>
        <Popconfirm title={isGroup ? t('hn.reqForm.approveGroupAsk', { n: target.count }) : t('hn.reqForm.approveAsk')} okText={t('hn.reqForm.approve')} cancelText={t('hn.common.cancel')}
          onConfirm={() => m.mutate({ action: 'approve' })}>
          <Button size={size} type="primary" icon={<CheckOutlined />} loading={m.isPending && m.variables?.action === 'approve'} disabled={m.isPending}>{t('hn.reqForm.approve')}</Button>
        </Popconfirm>
        <Button size={size} danger icon={<CloseOutlined />} disabled={m.isPending} onClick={() => setRejectOpen(true)}>{t('hn.reqForm.reject')}</Button>
      </Space>
      <Modal open={rejectOpen} title={isGroup ? t('hn.reqForm.rejectGroupTitle', { n: target.count }) : t('hn.reqForm.rejectTitle')}
        okText={t('hn.reqForm.reject')} okButtonProps={{ danger: true, disabled: !reason.trim(), loading: m.isPending }} cancelText={t('hn.common.cancel')}
        onOk={() => m.mutate({ action: 'reject', reason: reason.trim() })} onCancel={() => { if (!m.isPending) setRejectOpen(false) }} destroyOnHidden>
        <div style={{ marginBottom: 6 }}>{t('hn.reqForm.rejectReason')}</div>
        <Input.TextArea autoFocus rows={3} maxLength={MAX_REASON} showCount value={reason} placeholder={t('hn.reqForm.rejectPh')} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  )
}
