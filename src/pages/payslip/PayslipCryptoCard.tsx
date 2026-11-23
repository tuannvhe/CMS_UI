import { useState } from 'react'
import { Alert, Button, Card, Input, Modal, Progress, Space, Tag, Typography } from 'antd'
import { LockOutlined, UnlockOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useToast } from '../../hooks/useToast'

interface CryptoStatus { totalRows: number; plainRows: number; encryptedRows: number; columnsWide: boolean; enabled: boolean; keyReady: boolean }
interface RunResult { changed: number; done: boolean; status: CryptoStatus }

const getStatus = () => api.get<CryptoStatus>('/admin/payslip-crypto').then((r) => r.data)
const run = (encrypt: boolean, confirm: string) => api.post<RunResult>('/admin/payslip-crypto/run', { encrypt, confirm }, { timeout: 120000 }).then((r) => r.data)

/**
 * Mã hóa số tiền của các phiếu lương đã có (Tbl_ViewSalary). Chỉ quản trị thật thấy và dùng được.
 * Chạy theo lô ~60 giây mỗi lần gọi, tự gọi tiếp đến khi xong. Có nút giải mã lại để quay về chữ thường nếu cần.
 */
export function PayslipCryptoCard() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const status = useQuery({ queryKey: ['payslip', 'crypto'], queryFn: getStatus, retry: false })
  const [mode, setMode] = useState<'enc' | 'dec' | null>(null)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const s = status.data
  const word = mode === 'dec' ? 'GIAI MA' : 'MA HOA'

  const start = async () => {
    if (!mode) return
    setBusy(true); setDone(0)
    try {
      for (;;) {
        const r = await run(mode === 'enc', confirm)
        setDone((d) => d + r.changed)
        qc.setQueryData(['payslip', 'crypto'], r.status)
        if (r.done) break
      }
      toast.success(mode === 'enc' ? t('pcc.doneEnc') : t('pcc.doneDec'))
      setMode(null); setConfirm('')
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(detail === 'columns_narrow' ? t('pcc.errNarrow') : detail === 'encryption_key_missing' ? t('pcc.errKey') : t('pcc.errRun'))
    } finally { setBusy(false); qc.invalidateQueries({ queryKey: ['payslip', 'crypto'] }) }
  }

  const pct = s && s.totalRows > 0 ? Math.round(((s.totalRows - s.plainRows) / s.totalRows) * 100) : 0
  return (
    <Card style={{ marginTop: 24 }} loading={status.isLoading} title={<Space><LockOutlined />{t('pcc.title')}</Space>}>
      {status.isError ? <Alert type="error" showIcon title={t('pcc.errStatus')} /> : s && (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color={s.keyReady ? 'green' : 'red'}>{s.keyReady ? t('pcc.keyReady') : t('pcc.keyMissing')}</Tag>
            <Tag color={s.columnsWide ? 'green' : 'orange'}>{s.columnsWide ? t('pcc.colsWide') : t('pcc.colsNarrow')}</Tag>
            <Tag color={s.enabled ? 'green' : 'default'}>{s.enabled ? t('pcc.newOn') : t('pcc.newOff')}</Tag>
          </Space>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            <Trans i18nKey="pcc.summary" values={{ total: s.totalRows.toLocaleString(i18n.language), plain: s.plainRows.toLocaleString(i18n.language), enc: s.encryptedRows.toLocaleString(i18n.language) }} components={{ b: <b /> }} />
          </Typography.Paragraph>
          <Progress percent={pct} style={{ maxWidth: 480 }} />
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            {t('pcc.note')}
          </Typography.Paragraph>
          <Space wrap>
            <Button type="primary" icon={<LockOutlined />} disabled={!s.keyReady || !s.columnsWide || s.plainRows === 0} onClick={() => setMode('enc')}>{t('pcc.encBtn')}</Button>
            <Button icon={<UnlockOutlined />} disabled={!s.keyReady || s.encryptedRows === 0} onClick={() => setMode('dec')}>{t('pcc.decBtn')}</Button>
          </Space>
        </>
      )}
      <Modal open={!!mode} title={mode === 'dec' ? t('pcc.decTitle') : t('pcc.encTitle')} okText={t('pcc.run')} cancelText={t('pcc.cancel')}
        okButtonProps={{ disabled: confirm.trim().toUpperCase() !== word, loading: busy, danger: mode === 'dec' }} cancelButtonProps={{ disabled: busy }}
        onOk={start} onCancel={() => { if (!busy) { setMode(null); setConfirm('') } }} maskClosable={!busy} closable={!busy}>
        <Typography.Paragraph>
          {mode === 'dec' ? t('pcc.decText') : t('pcc.encText')}
        </Typography.Paragraph>
        <Typography.Paragraph><Trans i18nKey="pcc.typeToConfirm" values={{ word }} components={{ b: <b /> }} /></Typography.Paragraph>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} />
        {busy && <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>{t('pcc.running', { n: done.toLocaleString(i18n.language) })}</Typography.Paragraph>}
      </Modal>
    </Card>
  )
}
