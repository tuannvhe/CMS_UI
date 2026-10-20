import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Radio, Select, Tag, Typography } from 'antd'
import { PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { hrRecipients } from '../api/notifications'
import { noticeSettings, MAIL_ROUTE_SQL, type MailRecipient, type MailRouteMode } from '../api/noticeSettings'
import { useToast } from '../hooks/useToast'
import { AppModal } from './AppModal'
import { SqlNotReady } from './SqlNotReady'

const EMAIL_RX = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/

/**
 * Người nhận EMAIL riêng của một loại thông báo: mặc định (người nhận thông thường), chỉ gửi cho danh sách riêng, hoặc gửi thêm cho danh sách riêng.
 * Chọn người từ danh sách tài khoản (lấy sẵn email) hoặc nhập địa chỉ email bất kỳ. Thông báo chuông không đổi.
 */
export function MailRecipientsModal({ caseKey, caseName, open, onClose }: { caseKey: string; caseName: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const cur = useQuery({ queryKey: ['notice-settings', 'recipients', caseKey], queryFn: () => noticeSettings.getRecipients(caseKey), enabled: open })
  const [mode, setMode] = useState<MailRouteMode>('default')
  const [list, setList] = useState<MailRecipient[]>([])
  const [search, setSearch] = useState('')
  const [free, setFree] = useState('')
  const [notReady, setNotReady] = useState(false)
  const seeded = useRef<unknown>(null)

  useEffect(() => {
    if (cur.data && seeded.current !== cur.data) { seeded.current = cur.data; setMode(cur.data.mode); setList(cur.data.recipients); setNotReady(false) }
  }, [cur.data])

  const users = useQuery({ queryKey: ['hr-recipients', 'users', search], queryFn: () => hrRecipients.users(search), enabled: open && search.trim().length >= 2 })
  const add = (r: MailRecipient) => setList((l) => (l.some((x) => x.email.toLowerCase() === r.email.toLowerCase()) ? l : [...l, r]))

  const save = useMutation({
    mutationFn: () => noticeSettings.setRecipients(caseKey, mode, mode === 'default' ? [] : list),
    onSuccess: () => { message.success(t('line.updated')); qc.invalidateQueries({ queryKey: ['notice-settings'] }); onClose() },
    onError: (e) => {
      const d = axios.isAxiosError(e) ? e.response?.data : undefined
      if (d?.title === 'not_ready') { setNotReady(true); return }
      message.error(t(`ns.route.err.${d?.detail}`, { defaultValue: t('req.err.generic') }))
    },
  })

  const invalid = mode !== 'default' && list.length === 0
  return (
    <AppModal open={open} onClose={onClose} size="md" icon={<TeamOutlined />} title={t('ns.route.title')} subtitle={caseName}
      onOk={() => save.mutate()} okText={t('req.saveChanges')} okLoading={save.isPending} okDisabled={invalid}>
      <Radio.Group className="mr-modes" value={mode} onChange={(e) => setMode(e.target.value)}>
        {(['default', 'only', 'also'] as const).map((m) => (
          <Radio key={m} value={m}><b>{t(`ns.route.mode.${m}`)}</b><span>{t(`ns.route.modeHint.${m}`)}</span></Radio>
        ))}
      </Radio.Group>

      {mode !== 'default' && (
        <div className="mr-list">
          <Typography.Text strong>{t('ns.route.people', { n: list.length })}</Typography.Text>
          <div className="mr-tags">
            {list.length === 0 && <span className="mr-empty">{t('ns.route.empty')}</span>}
            {list.map((r) => (
              <Tag key={r.email} closable onClose={(e) => { e.preventDefault(); setList((l) => l.filter((x) => x.email !== r.email)) }}>
                {r.fullName ? `${r.fullName} · ` : ''}{r.email}
              </Tag>
            ))}
          </div>
          <Select<string> showSearch filterOption={false} style={{ width: '100%' }} placeholder={t('ns.route.searchPh')} value={null} suffixIcon={null}
            notFoundContent={search.trim().length < 2 ? t('ns.route.typeMore') : users.isFetching ? '…' : t('ns.route.noUser')}
            onSearch={setSearch}
            options={(users.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})${u.email ? ' · ' + u.email : ''}`, disabled: !u.email }))}
            onSelect={(id) => { const u = users.data?.find((x) => x.userId === id); if (u?.email) add({ userId: u.userId, email: u.email, fullName: u.fullName }) }} />
          <div className="mr-free">
            <Input value={free} placeholder={t('ns.route.freePh')} onChange={(e) => setFree(e.target.value)}
              onPressEnter={() => { if (EMAIL_RX.test(free.trim())) { add({ userId: null, email: free.trim(), fullName: null }); setFree('') } }} />
            <Button icon={<PlusOutlined />} disabled={!EMAIL_RX.test(free.trim())} onClick={() => { add({ userId: null, email: free.trim(), fullName: null }); setFree('') }}>{t('ns.route.add')}</Button>
          </div>
          <Alert type="info" showIcon title={t('ns.route.note')} style={{ marginTop: 12 }} />
        </div>
      )}
      {notReady && <div style={{ marginTop: 12 }}><SqlNotReady title={t('ns.route.notReady')} sql={MAIL_ROUTE_SQL} onRetry={() => save.mutate()} loading={save.isPending} /></div>}
    </AppModal>
  )
}
