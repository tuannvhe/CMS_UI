import { useEffect, useState } from 'react'
import { Button, Dropdown, Empty, Form, Input, List, Segmented, Skeleton, Switch, Tag } from 'antd'
import { PlusOutlined, SendOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useQaDots } from '../hooks/useQaDots'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { qa, type QaChannel, type QaMode, type QaThread } from '../api/qa'
import { adminError } from '../api/userAdmin'
import { useToast } from '../hooks/useToast'
import { AppModal } from './AppModal'
import { QaTemplatesModal } from './QaTemplatesModal'

/**
 * Hỏi đáp hai khung: danh sách chủ đề bên trái, cuộc trò chuyện bên phải. mode = mine (nhân viên: chỉ chủ đề của mình, được đặt câu hỏi mới)
 * hoặc manage (nhân sự: mọi chủ đề, lọc "chưa trả lời", trả lời). Kênh và chủ đề đang mở nằm trên địa chỉ (?channel=&group=) để mở thẳng từ thông báo.
 */
export function QaWorkspace({ mode }: { mode: QaMode }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const channel: QaChannel = params.get('channel') === 'common' ? 'common' : 'salary'
  const group = params.get('group')
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(mode === 'manage')
  const [asking, setAsking] = useState(false)
  const [draft, setDraft] = useState('')
  const [tplOpen, setTplOpen] = useState(false)
  const [form] = Form.useForm<{ title: string; content: string }>()

  const list = useQuery({ queryKey: ['qa', mode, channel, search, pendingOnly], queryFn: () => qa.threads(mode, channel, mode === 'manage' ? { search: search || undefined, pendingOnly } : undefined), retry: false, refetchInterval: 60_000 })
  const conv = useQuery({ queryKey: ['qa', 'conv', mode, channel, group], queryFn: () => qa.conversation(mode, channel, group!), enabled: !!group, retry: false })
  const tpls = useQuery({ queryKey: ['qa-templates', channel], queryFn: () => qa.templates(channel), enabled: mode === 'manage', retry: false, staleTime: 60_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['qa'] })
  // Đang mở màn Hỏi đáp thì coi như đã thấy các trả lời mới nhất: tắt chấm trên menu.
  const { markSeen } = useQaDots()
  const latestReply = mode === 'mine' ? (list.data ?? []).filter((x) => !x.awaitingStaff).map((x) => x.lastAt).sort().pop() : undefined
  useEffect(() => { if (latestReply) markSeen(latestReply) }, [latestReply, markSeen])
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`qa.err.${code === 'too_many' ? 'too_many' : detail}`, { defaultValue: t('usr.err.generic') }) }

  const open = (g: string | null, ch: QaChannel = channel) => setParams(g ? { channel: ch, group: g } : { channel: ch }, { replace: true })
  useEffect(() => { setDraft('') }, [group])

  const ask = useMutation({
    mutationFn: (v: { title: string; content: string }) => qa.ask(channel, v),
    onSuccess: (r) => { msg.success(t('qa.sent')); setAsking(false); form.resetFields(); refresh(); open(r.groupId) },
    onError: (e) => msg.error(errText(e)),
  })
  const reply = useMutation({
    mutationFn: () => qa.reply(mode, channel, group!, draft),
    onSuccess: () => { setDraft(''); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const when = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
  const state = (th: QaThread) => (th.awaitingStaff ? <Tag color="orange" variant="filled">{t(mode === 'manage' ? 'qa.needsReply' : 'qa.waitingHr')}</Tag> : <Tag color="green" variant="filled">{t('qa.answered')}</Tag>)

  return (
    <div className="qa">
      <div className="qa-bar">
        <Segmented value={channel} onChange={(v) => open(null, v as QaChannel)} options={[{ value: 'salary', label: t('qa.ch.salary') }, { value: 'common', label: t('qa.ch.common') }]} />
        {mode === 'mine' && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAsking(true)}>{t('qa.ask')}</Button>}
        {mode === 'manage' && (
          <>
            <Input.Search allowClear style={{ width: 240 }} placeholder={t('qa.searchPh')} onSearch={setSearch} />
            <span><Switch checked={pendingOnly} onChange={setPendingOnly} /> {t('qa.pendingOnly')}</span>
          </>
        )}
      </div>
      <div className="qa-body">
        <aside className="qa-list">
          {list.isLoading ? <Skeleton active /> : (
            <List
              dataSource={list.data ?? []} locale={{ emptyText: <Empty description={t(mode === 'manage' ? 'qa.emptyManage' : 'qa.empty')} /> }}
              renderItem={(th) => (
                <List.Item className={`qa-item${th.groupId === group ? ' on' : ''}`} onClick={() => open(th.groupId)}>
                  <div className="qi-top"><b>{th.title}</b>{state(th)}</div>
                  <div className="qi-sub">{mode === 'manage' ? `${th.employeeName} · ${th.department ?? '—'} · ` : ''}{t('qa.postsN', { n: th.posts })} · {when(th.lastAt)}{mode === 'manage' && !th.awaitingStaff && th.lastByName ? ` · ${t('qa.repliedBy', { name: th.lastByName })}` : ''}</div>
                </List.Item>
              )}
            />
          )}
        </aside>
        <section className="qa-conv">
          {!group ? <Empty description={t('qa.pick')} /> : conv.isLoading ? <Skeleton active /> : conv.isError ? <Empty description={t('qa.gone')} /> : conv.data && (
            <>
              <header className="qc-head">
                <h3>{conv.data.thread.title}</h3>
                <span>{conv.data.thread.employeeName} · {conv.data.thread.employeeId}{conv.data.thread.department ? ` · ${conv.data.thread.department}` : ''}</span>
              </header>
              <div className="qc-posts">
                {conv.data.posts.map((p) => (
                  <div key={p.id} className={`qc-post ${p.isAsker ? 'asker' : 'staff'}`}>
                    <div className="qp-meta"><b>{p.name}</b><span>{when(p.createdAt)}</span></div>
                    <div className="qp-text">{p.content}</div>
                  </div>
                ))}
              </div>
              <footer className="qc-reply">
                <Input.TextArea rows={3} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t(mode === 'manage' ? 'qa.replyStaff' : 'qa.replyMine')} />
                {mode === 'manage' && (
                  <Dropdown trigger={['click']} menu={{
                    items: [
                      ...(tpls.data?.items ?? []).map((x) => ({ key: String(x.id), label: x.title })),
                      { type: 'divider' as const },
                      { key: 'manage', icon: <SettingOutlined />, label: t('qa.tpl.manage') },
                    ],
                    onClick: ({ key }) => {
                      if (key === 'manage') { setTplOpen(true); return }
                      const tpl = tpls.data?.items.find((x) => String(x.id) === key)
                      if (tpl) setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n` : '') + tpl.content.split('{ten}').join(conv.data?.thread.employeeName ?? ''))
                    },
                  }}>
                    <Button icon={<ThunderboltOutlined />}>{t('qa.tpl.use')}</Button>
                  </Dropdown>
                )}
                <Button type="primary" icon={<SendOutlined />} disabled={draft.trim().length < 2} loading={reply.isPending} onClick={() => reply.mutate()}>{t('qa.send')}</Button>
              </footer>
            </>
          )}
        </section>
      </div>

      {mode === 'manage' && <QaTemplatesModal open={tplOpen} onClose={() => { setTplOpen(false); tpls.refetch() }} />}
      <AppModal open={asking} onClose={() => setAsking(false)} size="md" icon={<PlusOutlined />} title={t(`qa.askTitle.${channel}`)} subtitle={t('qa.askHint')}
        okText={t('qa.send')} okLoading={ask.isPending} onOk={() => form.validateFields().then((v) => ask.mutate(v))}>
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item name="title" label={t('qa.title')} rules={[{ required: true }, { min: 3 }, { max: 200 }]}><Input maxLength={200} showCount /></Form.Item>
          <Form.Item name="content" label={t('qa.content')} rules={[{ required: true }, { min: 2 }, { max: 4000 }]} extra={t('qa.contentHint')}><Input.TextArea rows={6} maxLength={4000} showCount /></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
