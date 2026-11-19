import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Popconfirm, Space, Table, Tag } from 'antd'
import { AppModal } from '../../components/AppModal'
import { CloudUploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { idCardError, idCards, type ErpPushRow } from '../../api/idCards'
import { useToast } from '../../hooks/useToast'

const COLOR: Record<string, string> = { ready: 'blue', update: 'cyan', created: 'green', updated: 'green', same: 'default', exists: 'default', place: 'purple', placed: 'green', failed: 'red', no_show: 'orange' }
const MAX = 200

/**
 * Hộp "Đồng bộ ERP": xét các dòng CCCD đang hiện trong danh sách, cho biết dòng nào tạo được bên ERP,
 * rồi tạo các dòng "Sẵn sàng" và cập nhật người đã có mà khác ERP (CCCD / ngày sinh / giới tính); máy chủ kiểm lại từng người trước khi ghi.
 */
export default function IdCardErpModal({ open, ids, onClose }: { open: boolean; ids: number[]; onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const [result, setResult] = useState<ErpPushRow[] | null>(null)
  const [onlyReady, setOnlyReady] = useState(false)
  const tooMany = ids.length > MAX

  const info = useQuery({ queryKey: ['id-cards', 'erp-info'], queryFn: idCards.erpInfo, enabled: open, retry: false })
  const preview = useQuery({
    queryKey: ['id-cards', 'erp-preview', ids], queryFn: () => idCards.erpPreview(ids), retry: false,
    enabled: open && !tooMany && ids.length > 0 && !!info.data?.configured,
  })
  useEffect(() => { if (open) setResult(null) }, [open])

  const errText = (e: unknown) => {
    const { code, detail } = idCardError(e)
    if (code === 'erp_write_not_configured') return t(detail === 'user_seq_missing' ? 'idcErp.userSeqMissing' : 'idcErp.notConfigured')
    if (code === 'erp_unreachable') return t('idcErp.unreachable')
    return detail || code || String(e)
  }

  const rows = result ?? preview.data ?? []
  const nNew = (preview.data ?? []).filter((r) => r.status === 'ready').length
  const nUpd = (preview.data ?? []).filter((r) => r.status === 'update').length
  const nPlace = (preview.data ?? []).filter((r) => r.status === 'place').length
  const ready = (preview.data ?? []).filter((r) => r.status === 'ready' || r.status === 'update' || r.status === 'place').map((r) => r.id)
  const ACT = new Set(['ready', 'update', 'place', 'created', 'updated', 'placed', 'failed'])
  const shown = onlyReady ? rows.filter((r) => ACT.has(r.status)) : rows

  const push = useMutation({
    mutationFn: () => idCards.erpPush(ready),
    onSuccess: (r) => {
      setResult(r)
      const ok = r.filter((x) => x.status === 'created').length
      const upd = r.filter((x) => x.status === 'updated' || x.status === 'placed').length
      const fail = r.filter((x) => x.status === 'failed').length
      if (fail) msg.warning(t('idcErp.done', { ok, upd, fail })); else msg.success(t('idcErp.done', { ok, upd, fail }))
    },
    onError: (e) => msg.error(errText(e)),
  })

  const db = info.data?.target ?? ''
  return (
    <AppModal open={open} onClose={onClose} size="xl" icon={<CloudUploadOutlined />} title={t('idcErp.title')}
      subtitle={<Space size={6} wrap>
        <Tag color="blue" variant="filled">{t('idcErp.st.ready')}: {nNew}</Tag>
        {nUpd > 0 && <Tag color="cyan" variant="filled">{t('idcErp.st.update')}: {nUpd}</Tag>}
        {nPlace > 0 && <Tag color="purple" variant="filled">{t('idcErp.st.place')}: {nPlace}</Tag>}
      </Space>}
      footer={(
        <Space>
          <Button onClick={onClose}>{t('idc.close')}</Button>
          <Popconfirm title={t('idcErp.confirm', { c: nNew, u: nUpd, db }) + (nPlace ? ` ${t('idcErp.confirmPlace', { n: nPlace })}` : '')} onConfirm={() => push.mutate()} disabled={!ready.length || !!result}>
            <Button type="primary" danger icon={<CloudUploadOutlined />} disabled={!ready.length || !!result} loading={push.isPending}>{t('idcErp.push', { n: ready.length })}</Button>
          </Popconfirm>
        </Space>
      )}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {info.error && <Alert type="error" showIcon message={errText(info.error)} />}
        {info.data && !info.data.configured && <Alert type="warning" showIcon message={t('idcErp.notConfigured')} />}
        {tooMany && <Alert type="warning" showIcon message={t('idcErp.tooMany')} />}
        {preview.error && <Alert type="error" showIcon message={errText(preview.error)} />}
        <Checkbox checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)}>{t('idcErp.onlyReady')}</Checkbox>
        <Table<ErpPushRow> size="small" rowKey="id" loading={preview.isLoading || push.isPending} dataSource={shown} pagination={{ pageSize: 50, showSizeChanger: false }}
          scroll={{ y: 420 }} columns={[
            { title: t('idcErp.col.code'), dataIndex: 'employeeId', width: 110, render: (v: string | null) => <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{v}</span> },
            { title: t('idcErp.col.name'), dataIndex: 'fullName', width: 200 },
            { title: t('idcErp.col.status'), dataIndex: 'status', width: 170, render: (s: string) => <Tag color={COLOR[s] ?? 'gold'}>{t(`idcErp.st.${s}`, { defaultValue: s })}</Tag> },
            { title: t('idcErp.col.empSeq'), dataIndex: 'empSeq', width: 100 },
            { title: t('idcErp.col.error'), dataIndex: 'error', ellipsis: true, render: (v: string | null, r) => r.changes?.length
              ? <span>{t('idcErp.changes')}: {r.changes.map((c) => t(`idcErp.chg.${c}`, { defaultValue: c })).join(', ')}</span> : v },
          ]} />
      </Space>
    </AppModal>
  )
}
