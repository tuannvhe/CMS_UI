import { useState } from 'react'
import { Alert, Button, Input, Popconfirm, Segmented, Space, Spin, Tag } from 'antd'
import { RobotOutlined, SaveOutlined, TranslationOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { announcementTranslations, type AnnouncementTranslation } from '../api/announcementTranslations'
import { adminError } from '../api/userAdmin'
import { useToast } from '../hooks/useToast'
import { AnnouncementBody, joinHtmlPage, splitHtmlPage } from './AnnouncementBody'
import { AppModal } from './AppModal'
import { RichTextEditor } from './RichTextEditor'

type Lang = 'ko' | 'en'

/**
 * Bản dịch tiếng Hàn / tiếng Anh của một thông báo: máy chủ tự dịch bằng AI ở nền sau khi đăng / sửa; HR xem, sửa và lưu,
 * hoặc bấm dịch lại. Bài gốc sửa sau đó thì bản dịch cũ không hiện nữa và AI dịch lại.
 */
export function AnnouncementTranslationsModal({ id, title, sourceHtml, onClose }: { id: number | null; title: string; sourceHtml: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [lang, setLang] = useState<Lang>('ko')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftHtml, setDraftHtml] = useState('')
  const [dirty, setDirty] = useState(false)

  const q = useQuery({ queryKey: ['announcement-tr', id], queryFn: () => announcementTranslations.get(id!), enabled: id !== null, refetchInterval: (x) => (x.state.data?.items.some((i) => i.status === 'none') ? 30_000 : false) })
  const cur: AnnouncementTranslation | undefined = q.data?.items.find((i) => i.lang === lang)
  const page = splitHtmlPage(sourceHtml).page   // tệp HTML đính kèm giữ nguyên (không dịch)

  // Chưa sửa: hiện bản trên máy chủ; bắt đầu sửa thì chép cả tiêu đề + nội dung vào bản nháp
  const serverTitle = cur?.title ?? ''
  const serverHtml = splitHtmlPage(cur?.html ?? '').rest
  const shownTitle = dirty ? draftTitle : serverTitle
  const shownHtml = dirty ? draftHtml : serverHtml
  const edit = (title: string, html: string) => { setDraftTitle(title); setDraftHtml(html); setDirty(true) }

  const errText = (e: unknown) => t(`ctr.err.${adminError(e).code}`, { defaultValue: t('ctr.err.generic') })
  const done = () => { qc.invalidateQueries({ queryKey: ['announcement-tr', id] }); qc.invalidateQueries({ queryKey: ['announcements'] }); setDirty(false) }
  const save = useMutation({
    mutationFn: () => announcementTranslations.save(id!, lang, { title: draftTitle.trim() || null, html: joinHtmlPage(draftHtml, page) }),
    onSuccess: () => { msg.success(t('ctr.saved')); done() },
    onError: (e) => msg.error(errText(e)),
  })
  const ai = useMutation({
    mutationFn: () => announcementTranslations.retranslate(id!, lang),
    onSuccess: () => { msg.success(t('ctr.aiDone')); done() },
    onError: (e) => msg.error(errText(e)),
  })

  const status = !cur || cur.status === 'none' ? <Tag>{t('ctr.stNone')}</Tag>
    : cur.status === 'failed' ? <Tag color="red">{t('ctr.stFailed')}</Tag>
    : cur.stale ? <Tag color="orange">{t('ctr.stStale')}</Tag>
    : cur.status === 'ok' ? <Tag color="green">{t('ctr.stOk')}</Tag> : <Tag color="gold">{t('ctr.stAi')}</Tag>
  const when = cur?.updatedAt ? new Date(cur.updatedAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) : ''

  return (
    <AppModal open={id !== null} onClose={() => { setDirty(false); onClose() }} size="lg" icon={<TranslationOutlined />} title={t('ctr.title')} subtitle={title}
      footer={
        <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Popconfirm title={t('ctr.aiAsk')} onConfirm={() => ai.mutate()} disabled={!q.data?.ready || !q.data?.aiEnabled}>
            <Button icon={<RobotOutlined />} loading={ai.isPending} disabled={!q.data?.ready || !q.data?.aiEnabled}>{t('ctr.aiRun')}</Button>
          </Popconfirm>
          <Button type="primary" icon={<SaveOutlined />} loading={save.isPending} disabled={!q.data?.ready || !dirty || !shownHtml.trim()} onClick={() => save.mutate()}>{t('ctr.save')}</Button>
        </Space>
      }>
      {q.isLoading ? <Spin /> : (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('ctr.intro')} />
          {q.data && !q.data.ready && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('ctr.err.table_missing')} />}
          {q.data?.ready && !q.data.aiEnabled && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('ctr.err.ai_disabled')} />}
          {ai.isPending && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('ctr.aiRunning')} />}
          <Space style={{ marginBottom: 12 }} wrap>
            <Segmented<Lang> value={lang} onChange={(v) => { setLang(v); setDirty(false) }} options={[{ value: 'ko', label: '한국어' }, { value: 'en', label: 'English' }]} />
            {status}
            {cur?.updatedBy && <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>{t('ctr.changedBy', { by: cur.updatedBy, at: when })}</span>}
          </Space>
          <div style={{ display: 'grid', gap: 10 }}>
            <Input value={shownTitle} maxLength={500} placeholder={t('ctr.titlePh')} lang={lang} onChange={(e) => edit(e.target.value, shownHtml)} />
            <RichTextEditor value={shownHtml} onChange={(v) => edit(shownTitle, v)} resetKey={`${id}-${lang}-${cur?.updatedAt ?? ''}-${cur?.status ?? ''}`} />
            {page && <AnnouncementBody html={joinHtmlPage('', page)} frameHeight={200} />}
          </div>
        </>
      )}
    </AppModal>
  )
}
