import { useMemo, useState } from 'react'
import { Alert, Card, Skeleton, Switch, Tag, Typography } from 'antd'
import { BellOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { noticeSettings, type NoticeCaseState } from '../../api/noticeSettings'
import { MailRecipientsModal } from '../../components/MailRecipientsModal'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

const GROUP_ORDER = ['approval', 'eval', 'complaint', 'hungyen', 'payslip', 'qa', 'closing', 'feed']

/**
 * Quản lý thông báo (quản trị): bật / tắt EMAIL và THÔNG BÁO TRONG HỆ THỐNG (chuông) cho từng loại thông báo, và công tắc tổng cho mỗi kênh.
 * Công tắc tổng tắt thì mọi thông báo của kênh đó dừng, bất kể từng loại. Có hiệu lực trong vòng khoảng 30 giây.
 */
export default function NotificationSettingsPage() {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['notice-settings'], queryFn: noticeSettings.get })
  const refresh = () => qc.invalidateQueries({ queryKey: ['notice-settings'] })
  const onError = () => message.error(t('req.err.generic'))
  const master = useMutation({ mutationFn: (v: { channel: 'mail' | 'bell'; active: boolean }) => noticeSettings.setMaster(v.channel, v.active), onSuccess: () => { message.success(t('line.updated')); refresh() }, onError })
  const setCase = useMutation({ mutationFn: (v: { key: string; channel: 'mail' | 'bell'; active: boolean }) => noticeSettings.setCase(v.key, v.channel, v.active), onSuccess: () => { message.success(t('line.updated')); refresh() }, onError })

  const [routing, setRouting] = useState<string | null>(null)
  const routeLabel = (key: string) => {
    const r = q.data?.routes?.[key]
    return !r || r.mode === 'default' ? t('ns.route.btnDefault') : t(`ns.route.btn.${r.mode}`, { n: r.count })
  }

  const groups = useMemo(() => {
    const map = new Map<string, NoticeCaseState[]>()
    for (const c of q.data?.cases ?? []) map.set(c.group, [...(map.get(c.group) ?? []), c])
    return [...map.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
  }, [q.data])
  const m = q.data?.master

  const masterCard = (channel: 'mail' | 'bell', icon: React.ReactNode, on: boolean) => (
    <Card size="small" className={`ns-master${on ? '' : ' off'}`}>
      <div className="ns-master-row">
        <span className="ns-master-ic">{icon}</span>
        <div className="ns-master-txt">
          <b>{t(`ns.master.${channel}`)}</b>
          <span>{t(on ? `ns.master.${channel}On` : `ns.master.${channel}Off`)}</span>
        </div>
        <Switch checked={on} loading={master.isPending && master.variables?.channel === channel}
          checkedChildren={t('hrr.mailOn')} unCheckedChildren={t('hrr.mailOff')} onChange={(v) => master.mutate({ channel, active: v })} />
      </div>
    </Card>
  )

  return (
    <div className="page wide">
      <PageBanner avatar={<BellOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.notificationSettings')} subtitle={t('nav.notificationSettingsDesc')} />
      <Alert type="info" showIcon title={t('ns.note')} style={{ marginBottom: 16 }} />
      {q.isError && <Alert type="error" showIcon title={t('req.err.generic')} style={{ marginBottom: 16 }} />}
      {q.isLoading || !m ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          <div className="ns-masters">
            {masterCard('mail', <MailOutlined />, m.mail)}
            {masterCard('bell', <BellOutlined />, m.bell)}
          </div>
          {groups.map(([group, rows]) => (
            <Card key={group} size="small" style={{ marginBottom: 16 }} title={<b>{t(`ns.group.${group}`, { defaultValue: group })}</b>}>
              <div className="ns-head"><span /><span><MailOutlined /> {t('ns.email')}</span><span><BellOutlined /> {t('ns.bell')}</span></div>
              {rows.map((c) => (
                <div key={c.key} className="ns-row">
                  <div className="ns-name">
                    <span>{t(`ns.case.${c.key.replace('.', '_')}`, { defaultValue: c.key })}</span>
                    {c.updatedBy && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('ns.updated', { by: c.updatedBy, at: c.updatedAt ? dayjs(c.updatedAt).format('DD/MM/YYYY HH:mm') : '' })}</Typography.Text>}
                  </div>
                  <div className="ns-sw">
                    {c.hasMail ? (
                      <>
                        <Switch checked={c.mailEnabled} disabled={!m.mail} loading={setCase.isPending && setCase.variables?.key === c.key && setCase.variables?.channel === 'mail'}
                          onChange={(v) => setCase.mutate({ key: c.key, channel: 'mail', active: v })} />
                        {!c.mailDefault && <Tag variant="filled">{t('ns.defaultOff')}</Tag>}
                        {c.key !== 'payslip.published' && (
                          <button type="button" className={`ns-route${q.data?.routes?.[c.key] && q.data.routes[c.key].mode !== 'default' ? ' on' : ''}`} onClick={() => setRouting(c.key)} title={t('ns.route.title')}>
                            <TeamOutlined /> {routeLabel(c.key)}
                          </button>
                        )}
                      </>
                    ) : <Tag variant="filled">{t('ns.noMail')}</Tag>}
                  </div>
                  <div className="ns-sw">
                    <Switch checked={c.bellEnabled} disabled={!m.bell} loading={setCase.isPending && setCase.variables?.key === c.key && setCase.variables?.channel === 'bell'}
                      onChange={(v) => setCase.mutate({ key: c.key, channel: 'bell', active: v })} />
                  </div>
                </div>
              ))}
            </Card>
          ))}
        </>
      )}
      {routing && <MailRecipientsModal key={routing} caseKey={routing} caseName={t(`ns.case.${routing.replace('.', '_')}`, { defaultValue: routing })} open onClose={() => setRouting(null)} />}
    </div>
  )
}
