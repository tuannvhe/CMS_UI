import { useEffect, useState } from 'react'
import { Checkbox, DatePicker, Form, Input, Select, Tag } from 'antd'
import { CalendarOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { defaultDueAt, DUE_AT_FORMAT, recruit, type RecruitApplication } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'
import { PickGroups } from './RecruitCcGroups'
import { useDebouncedValue } from '../../hooks/useDebounce'
import { trData } from '../../utils/dataText'

/** Hồ sơ Staff còn ở bước đầu và đã có CV thì gửi bộ phận duyệt được. */
export const canBatchSend = (a: RecruitApplication) => a.level === 'staff' && ['new', 'screening'].includes(a.status) && a.hasFile
/** Hồ sơ chưa có lịch hoặc đã qua bộ phận thì đặt lịch phỏng vấn được (Staff không cần gửi CV trước). Hồ sơ đang có lịch chờ (scheduled) thì không: máy chủ từ chối already_scheduled để không tạo vòng trùng, đổi lịch thì huỷ lượt cũ trước. */
export const canBatchSchedule = (a: RecruitApplication) => ['new', 'to_schedule', 'evaluated', 'absent', 'postponed', 'consider'].includes(a.status)

interface Props { open: boolean; onClose: () => void; apps: RecruitApplication[]; onDone: () => void }

const errKey = (e: unknown) => { const { detail, code } = adminError(e); return detail || code }

/** Gửi CV của nhiều hồ sơ đã chọn cho cùng một nhóm người đánh giá (mỗi hồ sơ một phiếu như gửi từng cái). */
export function BatchSendModal({ open, onClose, apps, onDone }: Props) {
  const { t } = useTranslation()
  const msg = useToast()
  const [reviewers, setReviewers] = useState<string[]>([])
  const [dueAt, setDueAt] = useState<Dayjs | null>(null)
  useEffect(() => { if (open) setDueAt(defaultDueAt()) }, [open])
  const [cvVer, setCvVer] = useState<'en' | 'vi' | 'ko'>('vi')
  const [mailCv, setMailCv] = useState(true)
  const [sendCc, setSendCc] = useState<string[]>([])
  const ccEmails = (xs: string[]) => [...new Set(xs.map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0, 30)
  const lookups = useQuery({ queryKey: ['recruit', 'lookups'], queryFn: recruit.lookups, staleTime: 5 * 60_000, enabled: open })
  const [userQ, setUserQ] = useState('')
  const dUserQ = useDebouncedValue(userQ)   // chỉ gọi API khi ngừng gõ
  const [busy, setBusy] = useState(false)
  const users = useQuery({ queryKey: ['recruit', 'users', dUserQ], queryFn: () => recruit.users(dUserQ), enabled: open && dUserQ.trim().length >= 2 })
  const ok = apps.filter(canBatchSend)
  const skipped = apps.length - ok.length

  const run = async () => {
    setBusy(true)
    try {
      const r = await recruit.sendMany(ok.map((x) => x.id), reviewers, undefined, lookups.data?.translateCv ? cvVer : undefined, mailCv && lookups.data?.maskSalary ? { cc: sendCc } : undefined, dueAt?.format(DUE_AT_FORMAT))
      if (r.sent > 0) msg.success(t('rec.batch.sentOk', { n: r.sent }))
      // Đã gửi nhưng CV đính kèm khác lựa chọn: chưa có bản dịch (gửi bản gốc đã che), quá nặng / chưa che được (không đính kèm, xem trong CMS)
      if ((r.notes ?? []).length > 0) msg.warning({ title: t('rec.batch.notesTitle', { n: r.notes!.length }), description: r.notes!.slice(0, 6).map((f) => `${f.name}: ${t(`rec.batch.note.${f.reason}`, { defaultValue: f.reason })}`).join(' · ') })
      if (r.failed.length > 0) msg.error({ title: t('rec.batch.someFailed', { n: r.failed.length }), description: r.failed.slice(0, 4).map((f) => `${f.name}: ${t(`rec.err.${f.reason}`, { defaultValue: f.reason })}`).join(' · ') })
      if (r.sent > 0) { setReviewers([]); setSendCc([]); onDone() }
      if (r.failed.length === 0) onClose()
    } catch (e) {
      msg.error(t(`rec.err.${errKey(e)}`, { defaultValue: t('usr.err.generic') }))
    } finally { setBusy(false) }
  }

  return (
    <AppModal open={open} onClose={onClose} size="sm" icon={<SendOutlined />} title={t('rec.batch.sendTitle', { n: ok.length })} subtitle={t('rec.sendHint')}
      okText={t('rec.send')} okDisabled={reviewers.length === 0 || ok.length === 0 || !dueAt} okLoading={busy} onOk={run}>
      <Form layout="vertical">
        <Form.Item label={t('rec.batch.candidates')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{ok.map((a) => <Tag key={a.id}>{a.fullName}</Tag>)}</div>
          {skipped > 0 && <div className="cell-muted" style={{ marginTop: 6 }}>{t('rec.batch.skippedSend', { n: skipped })}</div>}
        </Form.Item>
        <Form.Item label={t('rec.reviewers')}>
          <Select mode="multiple" showSearch filterOption={false} value={reviewers} onChange={setReviewers} onSearch={setUserQ} maxCount={5} placeholder={t('rec.reviewerPh')}
            notFoundContent={userQ.trim().length < 2 ? t('rec.typeMore') : null}
            options={(users.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))} />
        </Form.Item>
        <Form.Item label={t('rec.dueAt')} required extra={t('rec.dueAtHint')}><DatePicker showTime={{ format: 'HH:mm', minuteStep: 15 }} format="DD/MM/YYYY HH:mm" value={dueAt} onChange={setDueAt} disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.isAfter(dayjs().add(30, 'day'), 'day')} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label={t('rec.cvx.sendVer')} extra={t('rec.cvx.sendVerHint')}><Select value={cvVer} onChange={setCvVer} options={[{ value: 'vi', label: t('rec.cvx.verVi') }, ...(lookups.data?.translateCv ? [{ value: 'en' as const, label: t('rec.cvx.verEn') }, { value: 'ko' as const, label: t('rec.cvx.verKo', { defaultValue: 'Tiếng Hàn (bản dịch, đã che lương)' }) }] : [])]} /></Form.Item>
        <PickGroups groups={lookups.data?.ccGroups ?? []} onPickCc={(e) => setSendCc(ccEmails([...sendCc, ...e]))} />
        <Form.Item label={t('rec.sendCc', { defaultValue: 'Đồng gửi (CC)' })} extra={t('rec.sendCcHint', { defaultValue: 'Nhận bản sao thư kèm CV, gõ tên để tìm hoặc gõ email rồi Enter.' })}>
          <Select mode="tags" disabled={!mailCv || !lookups.data?.maskSalary} value={sendCc} onChange={(v: string[]) => setSendCc(ccEmails(v))} tokenSeparators={[',', ';', ' ']} placeholder={t('rec.ccPh')} notFoundContent={null} open={false} />
        </Form.Item>
        <Form.Item extra={t('rec.batch.mailCvMerged', { defaultValue: 'Mỗi người đánh giá nhận một thư gộp: bảng tất cả ứng viên và các CV đính kèm. Chỉ gửi bản đã che lương: chưa bật che lương thì không gửi CV qua mail.' })}><Checkbox checked={mailCv && !!lookups.data?.maskSalary} disabled={!lookups.data?.maskSalary} onChange={(e) => setMailCv(e.target.checked)}>{t('rec.cvx.mailCv')}</Checkbox></Form.Item>
      </Form>
    </AppModal>
  )
}

/** Đặt lịch phỏng vấn cho nhiều hồ sơ: giờ đầu tiên + khoảng cách giữa các ứng viên, cùng một hội đồng và địa điểm. */
export function BatchScheduleModal({ open, onClose, apps, onDone }: Props) {
  const { t } = useTranslation()
  const msg = useToast()
  const [first, setFirst] = useState<Dayjs | null>(null)
  const [where, setWhere] = useState('')
  const [note, setNote] = useState('')
  const [panel, setPanel] = useState<string[]>([])
  const [panelQ, setPanelQ] = useState('')
  const dPanelQ = useDebouncedValue(panelQ)   // chỉ gọi API khi ngừng gõ
  const [busy, setBusy] = useState(false)
  const users = useQuery({ queryKey: ['recruit', 'users', dPanelQ], queryFn: () => recruit.users(dPanelQ), enabled: open && dPanelQ.trim().length >= 2 })
  const ok = apps.filter(canBatchSchedule)
  const skipped = apps.length - ok.length

  const run = async () => {
    if (!first) return
    setBusy(true)
    let done = 0
    const failed: string[] = []
    // Một lần gọi cho cả nhóm (mỗi lần tối đa 20 hồ sơ) để hội đồng nhận một thư gộp kèm các CV, không tách từng ứng viên
    const body = { startAt: first.format('YYYY-MM-DDTHH:mm:ss'), location: where.trim() || undefined, note: note.trim() || undefined, interviewers: panel }
    for (let i = 0; i < ok.length; i += 20) {
      const chunk = ok.slice(i, i + 20)
      try {
        const r = await recruit.scheduleMany(chunk.map((a) => a.id), body)
        done += r.scheduled
        for (const f of r.failed) failed.push(`${f.name}: ${t(`rec.err.${f.reason}`, { defaultValue: f.reason })}`)
      } catch (e) {
        const why = t(`rec.err.${errKey(e)}`, { defaultValue: t('usr.err.generic') })
        for (const a of chunk) failed.push(`${a.fullName}: ${why}`)
      }
    }
    setBusy(false)
    if (done > 0) msg.success(t('rec.batch.scheduledOk', { n: done }))
    if (failed.length > 0) msg.error({ title: t('rec.batch.someFailed', { n: failed.length }), description: failed.slice(0, 4).join(' · ') })
    if (done > 0) { setFirst(null); setPanel([]); onDone() }
    if (failed.length === 0) onClose()
  }

  return (
    <AppModal open={open} onClose={onClose} size="md" icon={<CalendarOutlined />} title={t('rec.batch.scheduleTitle', { n: ok.length })} subtitle={t('rec.batch.scheduleHint')}
      okText={t('rec.schedule')} okDisabled={!first || panel.length === 0 || ok.length === 0} okLoading={busy} onOk={run}>
      <Form layout="vertical">
        <Form.Item label={t('rec.startAt')} required>
          <DatePicker showTime={{ format: 'HH:mm', minuteStep: 5 }} format="DD/MM/YYYY HH:mm" value={first} onChange={setFirst} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label={t('rec.location')}><Input value={where} maxLength={100} onChange={(e) => setWhere(e.target.value)} /></Form.Item>
        <Form.Item label={t('rec.interviewers')} required>
          <Select mode="multiple" showSearch filterOption={false} value={panel} onChange={setPanel} onSearch={setPanelQ} maxCount={6} placeholder={t('rec.reviewerPh')}
            notFoundContent={panelQ.trim().length < 2 ? t('rec.typeMore') : null}
            options={(users.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))} />
        </Form.Item>
        <Form.Item label={t('rec.note')}><Input.TextArea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></Form.Item>
        <Form.Item label={t('rec.batch.candidates')}>
          <div style={{ display: 'grid', gap: 2, maxHeight: 180, overflow: 'auto' }}>
            {ok.map((a, i) => (
              <div key={a.id}>
                <span>{i + 1}. <b>{a.fullName}</b> <span className="cell-muted">{trData(a.position)}</span></span>
              </div>
            ))}
          </div>
          {skipped > 0 && <div className="cell-muted" style={{ marginTop: 6 }}>{t('rec.batch.skippedSchedule', { n: skipped })}</div>}
        </Form.Item>
      </Form>
    </AppModal>
  )
}
