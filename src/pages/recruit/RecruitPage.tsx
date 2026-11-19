import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Checkbox, DatePicker, Form, Input, Popconfirm, Radio, Select, Space, Modal, Switch, Tabs, Tag, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, CalendarOutlined, CheckCircleOutlined, DownloadOutlined, FilePdfOutlined, PauseCircleOutlined, PlusOutlined, SendOutlined, SolutionOutlined, StopOutlined, TeamOutlined, UnorderedListOutlined, UploadOutlined, UserAddOutlined, FileExcelOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { CV_ACCEPT, defaultDueAt, dueText, DUE_AT_FORMAT, cvOriginalUrl, exportRankingUrl, importTemplateUrl, recruit, type FinalResult, type ImportResult, averageOfPanel, RECRUIT_FACTORIES, RECRUIT_FILTERS, STATUS_TONE, type RecruitApplication, waitsRound2, isRound2Wait, type RecruitDetail, type RecruitInterview, type RecruitLevel } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { printEvaluation } from './RecruitPrint'
import { CandidatePhoto, CvPane, evalUntil, EditEvaluationButton, ExtendEvalButton, isRecruitLead, isResultEditor, resTone, ScoreAverageBox, PanelScoreList, ScoreLine, ScoreSummary, ScoreTag, UnlockButton } from './RecruitCommon'
import { RecruitBulkModal } from './RecruitBulkModal'
import { PhotoPasteButton } from './RecruitPhotoPaste'
import { CcGroupsModal, PickGroups } from './RecruitCcGroups'
import { BatchScheduleModal, BatchSendModal, canBatchSchedule, canBatchSend } from './RecruitBatchModals'
import { BlacklistButton, BlacklistPanel, DuplicateCheck } from './RecruitBlacklist'
import { OnboardingBlock, OnboardingPanel } from './RecruitOnboarding'
import { CorrectFinalButton, ResultMailButton } from './RecruitResultMail'
import { MailComposeButton, MailTemplatesButton } from './RecruitMailCompose'
import { InkImages } from './InkPad'
import { ALL_NODE, BatchTree, inNode, MoveToBatchButton } from './RecruitBatchTree'
import { RecruitExportMenu } from './RecruitSummaryCard'
import { findDuplicates } from './recruitDuplicates'
import { applyFilter, loadDefaultFilter, RecruitFilterPanel, type RecFilter } from './RecruitFilterPanel'
import { useResizableColumns } from '../../components/ResizableColumns'
import { ApplicantProfileBlock, ScreeningChangeButton } from './RecruitProfile'
import { AgeCell, AiAllButton, BackfillButton, RereadPickedButton, byExperienceThenAge, CvDetailBlock, CvFactsInfo, EduCell, ExpCell } from './RecruitCvFacts'
import { foldFilter } from '../../utils/search'
import { SearchBox } from '../../components/SearchBox'
import { useDebouncedValue } from '../../hooks/useDebounce'
import { trData } from '../../utils/dataText'
import { CvLiveTitle, CvReadCell, eduOptions, genderOptions, GridCell, GridEditBar, useGridEdit } from './RecruitGridEdit'

type View = 'list' | 'onboarding' | 'blacklist'

interface CreateValues { fullName: string; phone?: string; email?: string; position: string; level: RecruitLevel; department?: string; factory?: string; note?: string; restricted?: boolean; idNo?: string }

/** HR tuyển dụng: tạo hồ sơ + CV, gửi CV tới người đánh giá ở bộ phận, theo dõi kết quả sàng lọc. HR là người duy nhất tải / thay CV và cấp / thu hồi quyền xem. */
export default function RecruitPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [picked, setPicked] = useState<number[]>([])   // hồ sơ đã tích chọn để thao tác hàng loạt
  const [node, setNode] = useState<number>(ALL_NODE)   // nút đang chọn trên cây đợt tuyển dụng
  const [batch, setBatch] = useState<'send' | 'schedule' | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRes, setImportRes] = useState<ImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [reviewers, setReviewers] = useState<string[]>([])
  const [dueAt, setDueAt] = useState<Dayjs | null>(null)
  useEffect(() => { if (sending) setDueAt(defaultDueAt()) }, [sending])   // mở màn gửi: hạn mặc định sau 2 ngày, 17:00
  const [cvVer, setCvVer] = useState<'en' | 'vi' | 'ko'>('vi')
  const [mailCv, setMailCv] = useState(true)
  const [sendCc, setSendCc] = useState<string[]>([])
  const [userQ, setUserQ] = useState('')
  const dUserQ = useDebouncedValue(userQ)   // chỉ gọi API khi ngừng gõ
  const [scheduling, setScheduling] = useState(false)
  const [addingTo, setAddingTo] = useState<number | null>(null)   // lượt phỏng vấn đang thêm người
  const [addIds, setAddIds] = useState<string[]>([])
  const [addQ, setAddQ] = useState('')
  const dAddQ = useDebouncedValue(addQ)   // chỉ gọi API khi ngừng gõ
  const [when, setWhen] = useState<Dayjs | null>(null)
  const [where, setWhere] = useState('')
  const [ivNote, setIvNote] = useState('')
  const [panelIds, setPanelIds] = useState<string[]>([])
  const [panelQ, setPanelQ] = useState('')
  const dPanelQ = useDebouncedValue(panelQ)   // chỉ gọi API khi ngừng gõ
  const [finalizing, setFinalizing] = useState<FinalResult | null>(null)
  const [postponing, setPostponing] = useState(false)
  const [postponeNote, setPostponeNote] = useState('')
  const [inviting, setInviting] = useState<number | null>(null)   // lượt phỏng vấn đang soạn thư mời
  const replyTo = useQuery({ queryKey: ['recruit', 'reply-to'], queryFn: recruit.replyTo, enabled: inviting !== null, staleTime: 60_000 })
  // Ứng viên bấm "Trả lời" sẽ về đâu: email của mình, hộp mail tuyển dụng chung, hay (không có) hộp thư hệ thống
  const replyHint = (email: string) => !replyTo.data ? t('rec.inviteHintTo', { email })
    : replyTo.data.address ? t(replyTo.data.mine ? 'rec.inviteHintMine' : 'rec.inviteHintShared', { email, reply: replyTo.data.address })
    : t('rec.inviteHintNone', { email })
  const [cc, setCc] = useState<string[]>([])
  const [ccQ, setCcQ] = useState('')
  const dCcQ = useDebouncedValue(ccQ)   // chỉ gọi API khi ngừng gõ
  const [inviteMsg, setInviteMsg] = useState('')
  const [managingCc, setManagingCc] = useState(false)
  const { user } = useAuth()
  const lead = isRecruitLead(user)
  const editor = isResultEditor(user)
  // Bộ lọc tổng hợp (vị trí, bộ phận, kinh nghiệm, tuổi…); mở màn thì áp dụng bộ lọc mặc định đã lưu của người dùng
  const [filter, setFilter] = useState<RecFilter>(() => loadDefaultFilter(user?.userId))
  const status = filter.status ?? ''
  const [finalNote, setFinalNote] = useState('')
  const [form] = Form.useForm<CreateValues>()

  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const refresh = () => { qc.invalidateQueries({ queryKey: ['recruit'] }) }
  const q = useQuery({ queryKey: ['recruit', 'list', status, search], queryFn: () => recruit.list({ status: RECRUIT_FILTERS.find((f) => f.key === status)?.statuses.join(',') || undefined, search: search.trim() || undefined }), retry: false })
  // Số hồ sơ trên từng thẻ lọc: lấy toàn bộ danh sách (cùng khoá với lần tải "Tất cả" nên dùng chung bộ nhớ đệm)
  const everything = useQuery({ queryKey: ['recruit', 'list', '', ''], queryFn: () => recruit.list({}), retry: false, staleTime: 30_000 })
  const lookups = useQuery({ queryKey: ['recruit', 'lookups'], queryFn: recruit.lookups, staleTime: 5 * 60_000, retry: false })
  // Hồ sơ Đạt đã lập lịch nhận việc chuyển sang tab Nhận việc, không còn hiện ở danh sách Quản lý CV (máy chủ trả cờ hasOnboarding, không giới hạn khoảng ngày)
  const inList = (r: RecruitApplication) => !(r.hasOnboarding && r.status === 'pass')
  const everyItems = (everything.data?.items ?? []).filter(inList)
  const counts: Record<string, number> = { '': everyItems.length }
  for (const f of RECRUIT_FILTERS) counts[f.key] = everyItems.filter((r) => f.statuses.includes(r.status) && (f.key !== 'round2' || isRound2Wait(r))).length
  const opts = (xs?: string[]) => (xs ?? []).map((x) => ({ value: x, label: x }))
  const detail = useQuery({ queryKey: ['recruit', 'detail', openId], queryFn: () => recruit.get(openId!), enabled: openId !== null, retry: false })
  const panelUsers = useQuery({ queryKey: ['recruit', 'users', dPanelQ], queryFn: () => recruit.users(dPanelQ), enabled: scheduling && dPanelQ.trim().length >= 2 })
  const addUsers = useQuery({ queryKey: ['recruit', 'users', dAddQ], queryFn: () => recruit.users(dAddQ), enabled: addingTo !== null && dAddQ.trim().length >= 2 })
  const users = useQuery({ queryKey: ['recruit', 'users', dUserQ], queryFn: () => recruit.users(dUserQ), enabled: sending && dUserQ.trim().length >= 2 })
  const ccUsers = useQuery({ queryKey: ['recruit', 'users', dCcQ], queryFn: () => recruit.users(dCcQ), enabled: (inviting !== null || sending) && dCcQ.trim().length >= 2 && !dCcQ.includes('@') })

  const done = (text: string) => () => { msg.success(text); refresh() }
  const onError = (e: unknown) => msg.error(errText(e))
  const newPhone = Form.useWatch('phone', form)
  const newIdNo = Form.useWatch('idNo', form)
  const create = useMutation({
    mutationFn: (v: CreateValues) => recruit.create({ ...v, file: file ?? undefined }),
    onSuccess: (r) => { msg.success(t('rec.created')); setCreating(false); form.resetFields(); setFile(null); setOpenId(r.id); refresh() }, onError,
  })
  const importOp = useMutation({ mutationFn: (f: File) => recruit.importOp(f), onSuccess: (r) => { setImportRes(r); setImportFile(null); refresh() }, onError })
  const replace = useMutation({ mutationFn: (f: File) => recruit.replaceCv(openId!, f), onSuccess: done(t('rec.cvSaved')), onError })
  const send = useMutation({
    mutationFn: () => recruit.send(openId!, reviewers, undefined, lookups.data?.translateCv ? cvVer : undefined, mailCv && lookups.data?.maskSalary ? { cc: sendCc } : undefined, dueAt?.format(DUE_AT_FORMAT)),
    onSuccess: () => { msg.success(t('rec.sent')); setSending(false); setReviewers([]); setMailCv(true); setSendCc([]); refresh() }, onError,
  })
  const revoke = useMutation({ mutationFn: (uid: string) => recruit.revoke(openId!, uid), onSuccess: done(t('rec.revoked')), onError })
  const skipSend = useMutation({ mutationFn: () => recruit.toSchedule(openId!), onSuccess: done(t('usr.saved')), onError })
  const reopen = useMutation({
    mutationFn: () => recruit.reopen(openId!),
    onSuccess: (r) => { if (r.blacklisted) msg.warning(t('rec.reopenBlack')); done(t('usr.saved'))() }, onError,
  })
  const [declining, setDeclining] = useState(false)
  const [declineNote, setDeclineNote] = useState('')
  const declineOffer = useMutation({
    mutationFn: () => recruit.declineOffer(openId!, declineNote.trim()),
    onSuccess: () => { setDeclining(false); setDeclineNote(''); done(t('usr.saved'))() }, onError,
  })
  const schedule = useMutation({
    mutationFn: () => recruit.schedule(openId!, { startAt: when!.format('YYYY-MM-DDTHH:mm:ss'), location: where.trim() || undefined, note: ivNote.trim() || undefined, interviewers: panelIds }),
    onSuccess: () => { msg.success(t('rec.scheduledOk')); setScheduling(false); setWhen(null); setWhere(''); setIvNote(''); setPanelIds([]); refresh() }, onError,
  })
  const invite = useMutation({
    mutationFn: () => recruit.invite(inviting!, inviteMsg.trim() || undefined, cc.length ? cc : undefined),
    onSuccess: () => { setInviting(null); setCc([]); setCcQ(''); setInviteMsg(''); done(t('rec.inviteSent'))() }, onError,
  })
  const attend = useMutation({ mutationFn: (id: number) => recruit.attend(id, true), onSuccess: done(t('rec.presentOk')), onError })
  const postpone = useMutation({
    mutationFn: () => recruit.postpone(openId!, postponeNote.trim()),
    onSuccess: () => { msg.success(t('rec.postponedOk')); setPostponing(false); setPostponeNote(''); refresh() }, onError,
  })
  const rebuild = useMutation({ mutationFn: () => recruit.rebuildPreview(openId!), onSuccess: (ok) => { if (ok) msg.success(t('rec.previewOk')); else msg.error(t('rec.previewFail')); refresh() }, onError })
  const addPeople = useMutation({ mutationFn: () => recruit.addInterviewers(addingTo!, addIds), onSuccess: () => { setAddingTo(null); setAddIds([]); setAddQ(''); done(t('rec.peopleAdded'))() }, onError })
  const closeIv = useMutation({ mutationFn: (v: { id: number; kind: 'cancel' | 'no_show' | 'close' }) => recruit.closeInterview(v.id, v.kind), onSuccess: done(t('usr.saved')), onError })
  const finalize = useMutation({
    mutationFn: () => recruit.finalize(openId!, finalizing!, finalNote.trim() || undefined),
    onSuccess: () => { msg.success(t('rec.finalOk')); setFinalizing(null); setFinalNote(''); refresh() }, onError,
  })
  const delApp = useMutation({ mutationFn: (id: number) => recruit.deleteApplication(id), onSuccess: (_r, id) => { setOpenId(null); setPicked((p) => p.filter((x) => x !== id)); msg.success(t('rec.del.done', { n: 1 })); refresh() }, onError })
  const delCv = useMutation({ mutationFn: (v: { id: number; fileId: number }) => recruit.deleteCv(v.id, v.fileId), onSuccess: done(t('rec.del.cvDone')), onError })
  const delMany = useMutation({
    mutationFn: async (ids: number[]) => {
      const deleted: number[] = []; const failed: { id: number; reason: string }[] = []
      for (let i = 0; i < ids.length; i += 100) { const r = await recruit.deleteMany(ids.slice(i, i + 100)); deleted.push(...r.deleted); failed.push(...r.failed) }
      return { deleted, failed }
    },
    onSuccess: (r) => {
      setPicked((p) => p.filter((x) => !r.deleted.includes(x)))
      if (r.deleted.length > 0) msg.success(t('rec.del.done', { n: r.deleted.length }))
      if (r.failed.length > 0) {
        const names = new Map(pickedApps.map((a) => [a.id, a.fullName]))
        Modal.warning({ title: t('rec.del.someFailed'), content: <ul style={{ paddingLeft: 18 }}>{r.failed.map((f) => <li key={f.id}><b>{names.get(f.id) ?? `#${f.id}`}</b>: {t(`rec.err.${f.reason}`, { defaultValue: t('usr.err.generic') })}</li>)}</ul> })
      }
      refresh()
    },
    onError,
  })
  const withdraw = useMutation({ mutationFn: () => recruit.withdraw(openId!), onSuccess: done(t('usr.saved')), onError })
  const canSchedule = (a: RecruitApplication) => ['new', 'to_schedule', 'scheduled', 'evaluated', 'absent', 'postponed', 'consider'].includes(a.status)
  const [photoV, setPhotoV] = useState(0)
  const putPhoto = useMutation({
    mutationFn: (v: { id: number; f: File }) => recruit.putPhoto(v.id, v.f),
    onSuccess: () => { msg.success(t('usr.saved')); setPhotoV((n) => n + 1); refresh() }, onError,
  })
  const delPhoto = useMutation({
    mutationFn: (id: number) => recruit.deletePhoto(id),
    onSuccess: () => { msg.success(t('usr.saved')); setPhotoV((n) => n + 1) }, onError,
  })
  const merge = useMutation({
    mutationFn: (v: { id: number; dupId: number }) => recruit.merge(v.id, v.dupId),
    onSuccess: () => { msg.success(t('rec.mergeOk')); refresh() }, onError,
  })
  const setRounds = useMutation({
    mutationFn: (v: { id: number; rounds: number }) => recruit.setRounds(v.id, v.rounds),
    onSuccess: () => { msg.success(t('usr.saved')); refresh() }, onError,
  })
  const canFinal = (a: RecruitApplication) => ['to_schedule', 'scheduled', 'evaluated', 'absent', 'postponed', 'consider'].includes(a.status)
  const canPostpone = (a: RecruitApplication) => ['new', 'to_schedule', 'absent'].includes(a.status)
  const closed = (a: RecruitApplication) => ['screen_fail', 'withdrawn', 'pass', 'fail', 'offer_declined'].includes(a.status)
  /** Vòng đã điểm danh có mặt: sự kiện "attended" ghi chú bắt đầu bằng "V{vòng}". */
  const attendedRound = (round: number) => (detail.data?.events ?? []).some((e) => e.kind === 'attended' && (e.note ?? '').split(' ')[0] === `V${round}`)
  const ccEmails = (xs: string[]) => [...new Set(xs.map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0, 30)
  const IV_COLOR: Record<RecruitInterview['status'], string> = { planned: 'blue', done: 'green', cancelled: 'default', no_show: 'red' }
  const ivTime = (v: string) => new Date(v).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })

  // Thứ tự danh sách: theo kinh nghiệm rồi tuổi (mặc định khi đã bật đọc CV) hoặc mới nhất; nhớ theo trình duyệt
  const cvFacts = !!lookups.data?.cvFacts
  const [order, setOrder] = useState<'exp' | 'new'>(() => { try { return localStorage.getItem('rec.order') === 'new' ? 'new' : 'exp' } catch { return 'exp' } })
  const changeOrder = (v: 'exp' | 'new') => { setOrder(v); try { localStorage.setItem('rec.order', v) } catch { /* trình duyệt chặn lưu */ } }
  const batchesOn = !!lookups.data?.batches
  const batchesQ = useQuery({ queryKey: ['recruit', 'batches'], queryFn: recruit.batches, enabled: batchesOn, retry: false })
  const batchList = batchesQ.data ?? []
  const listAll = (q.data?.items ?? []).filter(inList)
  const all = batchesOn ? inNode(listAll, batchList, node) : listAll
  const position = filter.positions?.length === 1 ? filter.positions[0] : undefined   // xuất bảng xếp hạng theo một vị trí
  // Trùng tính trên toàn bộ hồ sơ (không chỉ đợt / bộ lọc đang xem) để không bỏ sót người nộp ở đợt khác
  const dups = useMemo(() => findDuplicates(everyItems), [everything.data])
  const byPos = applyFilter(all, filter, undefined, dups)
  const filtered = status === 'round2' ? byPos.filter(isRound2Wait) : byPos
  const shown = cvFacts && order === 'exp' ? [...filtered].sort(byExperienceThenAge) : filtered
  const pickedApps = shown.filter((r) => picked.includes(r.id))
  const day = (v: string | null) => (v ? new Date(v).toLocaleDateString(i18n.language) : '')
  // Nhãn phụ cạnh trạng thái: ai cần làm gì tiếp, vòng phỏng vấn, đã lập lịch nhận việc hay chưa
  const subTag = (s: RecruitApplication['status'], a?: RecruitApplication): { text: string; color?: string } | null => {
    if (!a) return null   // chỉ ở danh sách (có hồ sơ), không ở tiêu đề / lịch sử
    const multi = (a?.rounds ?? 1) >= 2
    if (s === 'new') return { text: t('rec.stx.new'), color: 'default' }
    if ((s === 'scheduled' || s === 'to_schedule') && multi) return { text: t('rec.stx.round', { n: (a?.doneRounds ?? 0) + 1 }), color: 'blue' }
    if (s === 'scheduled') return { text: t('rec.stx.scheduled'), color: 'blue' }
    if (s === 'evaluated' && multi && (a?.doneRounds ?? 0) > 0) return { text: t('rec.stx.done', { n: a?.doneRounds }), color: 'cyan' }
    if (s === 'consider') return { text: t('rec.stx.consider'), color: 'gold' }
    if (s === 'pass') return onboarding ? { text: a?.hasOnboarding ? t('rec.stx.passSched') : t('rec.stx.pass'), color: a?.hasOnboarding ? 'green' : 'orange' } : null
    if (s === 'fail' || s === 'screen_fail') return { text: t(`rec.stx.${s}`), color: 'default' }
    if (s === 'withdrawn' || s === 'offer_declined') return { text: t('rec.stx.withdrawn'), color: 'default' }
    return null
  }
  const chip = (s: RecruitApplication['status'], a?: RecruitApplication) => { const sub = subTag(s, a); return <span><span className={`org-chip ${STATUS_TONE[s]}`}>{t(`rec.st.${s}`)}</span>{sub && <Tag color={sub.color} style={{ marginLeft: 4 }}>{sub.text}</Tag>}{a && waitsRound2(a) && (a.doneRounds ?? 0) === 1 && ['evaluated', 'consider', 'to_schedule'].includes(s) && <Tag color="orange" style={{ marginLeft: 4 }}>{t('rec.r2.wait')}</Tag>}{a && (a.rounds ?? 1) >= 2 && !['scheduled', 'to_schedule'].includes(s) && <Tag style={{ marginLeft: 4 }}>{t('rec.r2.tag')}</Tag>}</span> }

  // Hạng theo tổng điểm trong cùng vị trí (chỉ hồ sơ đã có điểm, trong danh sách đang tải).
  const rankOf = new Map<number, number>()
  for (const p of new Set(all.map((r) => r.position))) {
    all.filter((r) => r.position === p && r.score != null && !waitsRound2(r)).sort((a, b) => b.score! - a.score!).forEach((r, _i, arr) => rankOf.set(r.id, arr.findIndex((x) => x.score === r.score) + 1))
  }
  const scoring = !!lookups.data?.scoring?.enabled || all.some((r) => r.score != null)
  // Sửa trực tiếp trên bảng (lưu một lần) + trạng thái đọc CV cập nhật liên tục: RecruitGridEdit.tsx
  const g = useGridEdit(all, { profile: !!lookups.data?.profile, ai: !!lookups.data?.ai })
  const deptOpts = opts(lookups.data?.departments)
  const facOpts = opts(RECRUIT_FACTORIES)
  const pfOf = (r: RecruitApplication) => g.profiles[String(r.id)]
  const txt = (v?: string | null) => (v ? <span style={{ whiteSpace: 'pre-wrap' }}>{v}</span> : <span className="cell-muted">—</span>)
  const ymd = (v?: string | null) => (v ? <span>{dayjs(v).format('DD/MM/YYYY')}</span> : <span className="cell-muted">—</span>)
  const columns: ColumnsType<RecruitApplication> = [
    { title: t('rec.fullName'), width: 250, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'name'), render: (_: unknown, r) => g.open(r.id, 'name') ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{r.hasFile && <CandidatePhoto id={r.id} name={r.fullName} height={56} />}<div style={{ flex: 1, display: 'grid', gap: 4 }}><GridCell g={g} app={r} field="fullName" /><GridCell g={g} app={r} field="phone" placeholder={t('rg.phone')} /></div></div> : <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{r.hasFile && <CandidatePhoto id={r.id} name={r.fullName} height={56} />}<span><b>{r.fullName}</b>{r.restricted && <Tag color="red" style={{ marginLeft: 6 }}>{t('rec.restricted')}</Tag>}{dups.get(r.id) && <Tag color="orange" style={{ marginLeft: 6, cursor: 'pointer' }} title={t('rec.dup.tagHint', { ids: dups.get(r.id)!.ids.map((i) => '#' + i).join(', ') })} onClick={() => setFilter((f) => ({ ...f, dupOnly: true }))}>{t('rec.dup.tag', { reasons: dups.get(r.id)!.reasons.map((x) => t(`rec.dup.r.${x}`)).join(' / ') })}</Tag>}<div className="cell-muted">{r.phone ?? ''}</div></span></div> },
    { title: t('rec.position'), width: 240, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'pos'), render: (_: unknown, r) => g.open(r.id, 'pos') ? <div style={{ display: 'grid', gap: 4 }}><GridCell g={g} app={r} field="position" placeholder={t('rg.position')} /><GridCell g={g} app={r} field="department" kind="select" options={deptOpts} placeholder={t('rg.department')} /><GridCell g={g} app={r} field="factory" kind="select" options={facOpts} placeholder={t('rg.factory')} /></div> : <span><b className="rec-pos">{trData(r.position)}</b><div className="cell-muted">{[r.department, r.factory].filter(Boolean).join(' · ')}</div></span> },
    { title: t('rec.level'), dataIndex: 'level', width: 100, render: (v: RecruitLevel) => <Tag color={v === 'op' ? 'blue' : 'purple'} title={t(`rec.lv.${v}`)}>{v === 'op' ? 'OP' : 'Staff+'}</Tag> },
    ...(cvFacts ? [
      { title: t('rec.cvf.exp'), key: 'exp', width: 140, sorter: (a: RecruitApplication, b: RecruitApplication) => (a.expMonths ?? -1) - (b.expMonths ?? -1), onCell: (r: RecruitApplication) => g.cellProps(r.id, 'exp'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'exp') ? <GridCell g={g} app={r} field="expMonths" kind="years" min={0} max={50} /> : <ExpCell app={r} /> },
      { title: t('rec.cvf.birth'), key: 'birth', width: 120, sorter: (a: RecruitApplication, b: RecruitApplication) => (b.birthYear ?? 9999) - (a.birthYear ?? 9999), onCell: (r: RecruitApplication) => g.cellProps(r.id, 'birth'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'birth') ? <GridCell g={g} app={r} field="birthYear" kind="number" min={1940} max={new Date().getFullYear() - 14} /> : <AgeCell app={r} /> },
      { title: t('rec.cvf.edu'), key: 'edu', width: 120, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'edu'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'edu') ? <GridCell g={g} app={r} field="education" kind="select" options={eduOptions(t)} /> : <EduCell value={r.education} /> },
      { title: <CvLiveTitle cv={g.cv} />, key: 'cvRead', width: 160, render: (_: unknown, r: RecruitApplication) => <CvReadCell app={r} cv={g.cv} ai={!!lookups.data?.ai} /> },
    ] : []),
    { title: t('rg.email'), key: 'email', width: 200, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'email'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'email') ? <GridCell g={g} app={r} field="email" /> : txt(r.email) },
    ...(g.profileOn ? [
      { title: t('rec.pf.gender'), key: 'gender', width: 110, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'gender'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'gender') ? <GridCell g={g} app={r} field="gender" kind="select" options={genderOptions(t)} /> : txt(pfOf(r)?.gender ? t(`rec.pf.g.${pfOf(r)!.gender}`) : null) },
      { title: t('rec.pf.birthDate'), key: 'birthDate', width: 140, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'birthDate'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'birthDate') ? <GridCell g={g} app={r} field="birthDate" kind="date" /> : ymd(pfOf(r)?.birthDate) },
      { title: t('rec.pf.address'), key: 'address', width: 220, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'address'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'address') ? <GridCell g={g} app={r} field="address" kind="textarea" /> : txt(pfOf(r)?.address) },
      { title: t('rec.pf.major'), key: 'major', width: 170, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'major'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'major') ? <GridCell g={g} app={r} field="major" /> : txt(pfOf(r)?.major) },
      { title: t('rec.pf.languages'), key: 'languages', width: 180, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'languages'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'languages') ? <GridCell g={g} app={r} field="languages" placeholder={t('rec.pf.languagesPh')} /> : txt(pfOf(r)?.languages) },
      { title: t('rec.pf.availableFrom'), key: 'availableFrom', width: 140, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'availableFrom'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'availableFrom') ? <GridCell g={g} app={r} field="availableFrom" kind="date" /> : ymd(pfOf(r)?.availableFrom) },
    ] : []),
    { title: t('rg.note'), key: 'note', width: 220, onCell: (r: RecruitApplication) => g.cellProps(r.id, 'note'), render: (_: unknown, r: RecruitApplication) => g.open(r.id, 'note') ? <GridCell g={g} app={r} field="note" kind="textarea" /> : txt(r.note) },
    { title: t('rec.cv'), dataIndex: 'hasFile', width: 70, align: 'center' as const, render: (v: boolean) => (v ? <span className="rec-yes">✓</span> : <span className="cell-muted">—</span>) },
    { title: t('cov.status'), dataIndex: 'status', width: 150, render: (_: unknown, r) => chip(r.status, r) },
    ...(scoring ? [{ title: t('rec.scoreCol'), key: 'score', width: 240, sorter: (a: RecruitApplication, b: RecruitApplication) => (a.score ?? -1) - (b.score ?? -1),
      render: (_: unknown, r: RecruitApplication) => <div><ScoreSummary score={r.score} recommendation={r.recommendation} rank={rankOf.get(r.id)} /><PanelScoreList items={q.data?.panelScores?.[r.id]} /></div> }] : []),
    { title: t('rec.createdAt'), dataIndex: 'createdAt', width: 110, render: day },
    { title: '', width: batchesOn ? 130 : 90, fixed: 'right' as const, render: (_: unknown, r) => <Space size={4}>{batchesOn && <MoveToBatchButton compact ids={[r.id]} batches={batchList} onDone={() => undefined} />}<Button size="small" onClick={() => setOpenId(r.id)}>{t('rec.open')}</Button></Space> },
  ]

  const resizable = useResizableColumns('recruit.list', columns)
  const [view, setView] = useState<View>('list')
  const identity = lookups.data?.identity
  const onboarding = !!lookups.data?.onboarding
  const d: RecruitDetail | undefined = detail.data
  const app = d?.application

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<SolutionOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.recruit')} subtitle={t('nav.recruitDesc')} />
      <Tabs className="rec-tabs" size="large" activeKey={view} onChange={(v) => setView(v as View)}
        items={[
          { key: 'list', label: <span><UnorderedListOutlined /> {t('rec.view.list')}</span> },
          ...(onboarding ? [{ key: 'onboarding', label: <span><TeamOutlined /> {t('rec.ob.tab')}</span> }] : []),
          ...(identity?.enabled ? [{ key: 'blacklist', label: <span><StopOutlined /> {t('rec.bl.tab')}</span> }] : []),
        ]} />
      {view === 'onboarding' && onboarding ? <OnboardingPanel onOpen={(id) => setOpenId(id)} batches={batchesOn ? batchList : []} /> : view === 'blacklist' ? <BlacklistPanel idNo={!!identity?.idNo} /> : q.data && !q.data.ready ? <SqlNotReady title={t('rec.notReady')} onRetry={() => q.refetch()} loading={q.isFetching} /> : (
        <>
          <div className={batchesOn ? 'rec-split' : undefined}>
          {batchesOn && <BatchTree batches={batchList} total={everyItems.length} unassigned={everyItems.filter((r) => r.batchId == null).length} selected={node} onSelect={(id) => { setNode(id); setPicked([]) }} />}
          <DataTable<RecruitApplication>
            className="rec-list" rowKey="id" loading={q.isLoading} columns={resizable.columns} components={resizable.components} dataSource={shown} pagination={{ pageSize: 20, showSizeChanger: false }}
            rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]), preserveSelectedRowKeys: true }}
            locale={{ emptyText: q.isError ? t('usr.err.generic') : t('rec.empty') }}
            toolbar={(
              <div className="rec-bar">
                <div className="rec-bar-row">
                  <span className="rec-bar-label">{t('rec.bar.find')}</span>
                  <SearchBox allowClear style={{ width: 260 }} placeholder={t('rec.searchPh')} onSearch={setSearch} />
                  <RecruitFilterPanel apps={all} value={filter} onChange={(f) => { setFilter(f); setPicked([]) }} userId={user?.userId} cvFacts={cvFacts} scoring={scoring}
                    statuses={[{ key: '', label: t('org.all') }, ...RECRUIT_FILTERS.filter((f) => f.key !== 'round2' || !!lookups.data?.rounds).map((f) => ({ key: f.key, label: t(`rec.fl.${f.key}`) }))].map((s) => ({ value: s.key, label: s.label, count: counts[s.key] ?? 0 }))}
                    order={cvFacts ? order : undefined} onOrder={changeOrder} />
                </div>
                <div className="rec-bar-row">
                  <span className="rec-bar-label">{t('rec.bar.actions')}</span>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ level: 'staff' }); setCreating(true) }}>{t('rec.new')}</Button>
                  <Button icon={<UploadOutlined />} onClick={() => setBulk(true)}>{t('rec.bulk.btn')}</Button>
                  <Button icon={<FileExcelOutlined />} onClick={() => { setImportRes(null); setImportFile(null); setImporting(true) }}>{t('rec.import.btn')}</Button>
                  <GridEditBar g={g} />
                  {cvFacts && <BackfillButton count={all.filter((r) => r.hasFile && !r.factsSource).length} />}
                  <MailTemplatesButton />
                  {lookups.data?.ai && <AiAllButton count={all.filter((r) => r.hasFile && !closed(r)).length} />}
                  {all.some((r) => r.score != null) && <Button icon={<FileExcelOutlined />} href={exportRankingUrl(position)}>{t('rec.rankExport')}</Button>}
                  {resizable.resized && <Button onClick={resizable.reset}>{t('rec.fp.resetCols')}</Button>}
                  {shown.length > 0 && <Button onClick={() => setPicked(picked.length === shown.length ? [] : shown.map((r) => r.id))}>{picked.length === shown.length ? t('rec.batch.clear') : t('rec.batch.selectAll', { n: shown.length })}</Button>}
                </div>
                {pickedApps.length > 0 && (
                  <div className="rec-picked">
                    <b>{t('rec.batch.picked', { n: pickedApps.length })}</b>
                    <Button type="primary" icon={<SendOutlined />} disabled={!pickedApps.some(canBatchSend)} onClick={() => setBatch('send')}>{t('rec.batch.send', { n: pickedApps.filter(canBatchSend).length })}</Button>
                    <Button type="primary" icon={<CalendarOutlined />} disabled={!pickedApps.some(canBatchSchedule)} onClick={() => setBatch('schedule')}>{t('rec.batch.schedule', { n: pickedApps.filter(canBatchSchedule).length })}</Button>
                    <Popconfirm title={t('rec.del.title')} description={t('rec.del.warn')} okText={t('rec.del.ok')} okButtonProps={{ danger: true }} disabled={!pickedApps.some((r) => r.status === 'new')} onConfirm={() => delMany.mutate(pickedApps.filter((r) => r.status === 'new').map((r) => r.id))}>
                      <Button danger icon={<DeleteOutlined />} loading={delMany.isPending} disabled={!pickedApps.some((r) => r.status === 'new')}>{t('rec.del.picked', { n: pickedApps.filter((r) => r.status === 'new').length })}</Button>
                    </Popconfirm>
                    {pickedApps.some((r) => r.status !== 'new') && <span className="cell-muted">{t('rec.del.skipNote', { n: pickedApps.filter((r) => r.status !== 'new').length })}</span>}
                    {cvFacts && <RereadPickedButton ids={pickedApps.filter((r) => r.hasFile && r.factsSource !== 'hr').map((r) => r.id)} skipped={pickedApps.filter((r) => !r.hasFile || r.factsSource === 'hr').length} />}
                    {batchesOn && <MoveToBatchButton ids={pickedApps.map((r) => r.id)} batches={batchList} onDone={() => setPicked([])} />}
                    <RecruitExportMenu summary={false} scope={{
                      from: pickedApps.reduce((m, r) => (r.createdAt < m ? r.createdAt : m), pickedApps[0].createdAt).slice(0, 10),
                      to: pickedApps.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), pickedApps[0].createdAt).slice(0, 10),
                      ids: pickedApps.map((r) => r.id),
                    }} />
                    <Button onClick={() => setPicked([])}>{t('rec.batch.clear')}</Button>
                  </div>
                )}
              </div>
            )}
          />
          </div>
        </>
      )}

      <BatchSendModal open={batch === 'send'} onClose={() => setBatch(null)} apps={pickedApps} onDone={() => { setPicked([]); refresh() }} />
      <BatchScheduleModal open={batch === 'schedule'} onClose={() => setBatch(null)} apps={pickedApps} onDone={() => { setPicked([]); refresh() }} />

      <RecruitBulkModal open={bulk} onClose={() => setBulk(false)} departments={lookups.data?.departments ?? []} factories={RECRUIT_FACTORIES} onChanged={refresh} batches={batchesOn ? batchList : undefined} defaultBatch={node > 0 ? node : undefined} idNo={!!identity?.idNo} />

      <AppModal open={importing} onClose={() => setImporting(false)} size="md" icon={<FileExcelOutlined />} title={t('rec.import.title')} okText={t('rec.import.run')} okLoading={importOp.isPending} onOk={() => { if (importFile) importOp.mutate(importFile) }}>
        <p>{t('rec.import.hint')} <a href={importTemplateUrl}>{t('rec.import.template')}</a></p>
        <Upload accept=".xlsx" maxCount={1} beforeUpload={(f) => { setImportFile(f); setImportRes(null); return false }} onRemove={() => setImportFile(null)}>
          <Button icon={<UploadOutlined />}>{t('rec.import.pick')}</Button>
        </Upload>
        {importRes && (
          <div style={{ marginTop: 12 }}>
            <b>{t('rec.import.done', { n: importRes.created })}</b>
            {importRes.errors.map((e) => <div key={e.row} className="cell-muted">{t('rec.import.rowErr', { row: e.row, reason: t(`rec.import.err.${e.reason}`, { defaultValue: e.reason }) })}</div>)}
          </div>
        )}
      </AppModal>

      <AppModal open={creating} onClose={() => setCreating(false)} size="md" icon={<SolutionOutlined />} title={t('rec.new')} okText={t('rec.create')} okLoading={create.isPending} onOk={() => form.validateFields().then((v) => create.mutate(v))}>
        <Form form={form} layout="vertical" autoComplete="off" initialValues={{ level: 'staff', restricted: false }}>
          <Form.Item name="level" label={t('rec.level')} rules={[{ required: true }]}>
            <Radio.Group options={[{ value: 'staff', label: t('rec.lv.staff') }, { value: 'op', label: t('rec.lv.op') }]} />
          </Form.Item>
          <Form.Item name="fullName" label={t('rec.fullName')} rules={[{ required: true }, { max: 100 }]}><Input /></Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="phone" label={t('rec.phone')} rules={[{ max: 30 }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input style={{ width: 260 }} /></Form.Item>
            {identity?.idNo && <Form.Item name="idNo" label="CCCD" rules={[{ pattern: /^[\d\s.-]{9,15}$/, message: t('rec.err.idNo') }]}><Input inputMode="numeric" style={{ width: 170 }} /></Form.Item>}
          </Space>
          {creating && <DuplicateCheck phone={newPhone} idNo={newIdNo} onOpen={(id) => { setCreating(false); setOpenId(id) }} />}
          <Form.Item name="position" label={t('rec.position')} rules={[{ required: true }, { max: 100 }]}><Input /></Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="department" label={t('rec.department')}><Select allowClear showSearch filterOption={foldFilter('label')} style={{ width: 260 }} options={opts(lookups.data?.departments)} loading={lookups.isLoading} /></Form.Item>
            <Form.Item name="factory" label={t('rec.factory')}><Select allowClear showSearch filterOption={foldFilter('label')} style={{ width: 200 }} options={opts(RECRUIT_FACTORIES)} /></Form.Item>
          </Space>
          <Form.Item label={t('rec.cv')} extra={t('rec.cvOptional')}>
            <Upload accept={CV_ACCEPT} maxCount={1} beforeUpload={(f) => { setFile(f); return false }} onRemove={() => setFile(null)}>
              <Button icon={<UploadOutlined />}>{t('rec.pickPdf')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="note" label={t('rec.note')} rules={[{ max: 1000 }]}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
          <Form.Item name="restricted" label={t('rec.restricted')} valuePropName="checked" extra={t('rec.restrictedHint')}><Switch /></Form.Item>
        </Form>
      </AppModal>

      <AppModal open={openId !== null} onClose={() => setOpenId(null)} size="full" footer={null} icon={<SolutionOutlined />}
        title={app ? <span className="rec-title">{app.fullName}{chip(app.status)}{app.restricted && <Tag color="red">{t('rec.restricted')}</Tag>}</span> : ''} subtitle={app ? [app.position, app.department, app.factory].filter(Boolean).join(' · ') : undefined}>
        {app && d ? (
          <div className="rec-detail">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {(() => {
              // CV khớp danh sách đen (dò tự động khi tải CV): lần gần nhất
              const hit = [...d.events].reverse().find((e) => e.kind === 'cv_blacklist' || e.kind === 'cv_blacklist_name')
              return hit ? <Alert type={hit.kind === 'cv_blacklist' ? 'error' : 'warning'} showIcon message={t(hit.kind === 'cv_blacklist' ? 'rec.bl.cvHit' : 'rec.bl.cvName')} description={hit.note} /> : null
            })()}
            <div className="rec-toolbar">
              {app.level === 'staff' && ['new', 'screening'].includes(app.status) && <Button type="primary" icon={<SendOutlined />} disabled={!app.hasFile} onClick={() => setSending(true)}>{t('rec.send')}</Button>}
              {app.status === 'new' && app.level === 'staff' && <Popconfirm title={t('rec.skipSendAsk')} onConfirm={() => skipSend.mutate()}><Button loading={skipSend.isPending}>{t('rec.skipSend')}</Button></Popconfirm>}
              {canSchedule(app) && <Button type="primary" icon={<CalendarOutlined />} onClick={() => setScheduling(true)}>{t('rec.schedule')}</Button>}
              {canPostpone(app) && <Button icon={<PauseCircleOutlined />} onClick={() => { setPostponeNote(''); setPostponing(true) }}>{t('rec.postpone')}</Button>}
              {canFinal(app) && <Button icon={<CheckCircleOutlined />} onClick={() => setFinalizing('pass')}>{t('rec.finalize')}</Button>}
              {(app.status === 'screen_fail' || app.status === 'withdrawn') && <Button loading={reopen.isPending} onClick={() => reopen.mutate()}>{t('rec.reopen')}</Button>}
              {app.status === 'pass' && <Button onClick={() => { setDeclineNote(''); setDeclining(true) }}>{t('rec.declineOffer')}</Button>}
              {d.interviews.some((iv) => iv.panel.some((p) => p.result)) && <Button icon={<FilePdfOutlined />} onClick={() => { if (!printEvaluation(t, i18n.language, d)) msg.error(t('rec.popupBlocked')) }}>{t('rec.evalPdf')}</Button>}
              <MailComposeButton app={app} />
              <ResultMailButton app={app} />
              <span className="rec-round-gap" />
              {!closed(app) && (
                <Upload accept={CV_ACCEPT} showUploadList={false} beforeUpload={(f) => { replace.mutate(f); return false }}>
                  <Button type="text" icon={<UploadOutlined />} loading={replace.isPending}>{app.hasFile ? t('rec.replaceCv') : t('rec.addCv')}</Button>
                </Upload>
              )}
              {(isRecruitLead(user) || editor) && <CorrectFinalButton app={app} viaEdit={!isRecruitLead(user)} mailed={d.events.some((e) => e.kind === 'result_mailed' || (e.kind === 'mail_sent' && /^(result_fail|round2_pass|job_offer) /.test(e.note ?? '')))} />}
              {identity?.enabled && <BlacklistButton app={app} />}
              {app.status === 'new' && d.file && <Popconfirm title={t('rec.del.cvAsk')} onConfirm={() => delCv.mutate({ id: app.id, fileId: d.file!.id })}><Button type="text" danger loading={delCv.isPending}>{t('rec.del.cv')}</Button></Popconfirm>}
              {app.status === 'new' && <Popconfirm title={t('rec.del.title')} description={t('rec.del.warn')} okText={t('rec.del.ok')} okButtonProps={{ danger: true }} onConfirm={() => delApp.mutate(app.id)}><Button danger icon={<DeleteOutlined />} loading={delApp.isPending}>{t('rec.del.one')}</Button></Popconfirm>}
              {!closed(app) && <Popconfirm title={t('rec.withdrawAsk')} onConfirm={() => withdraw.mutate()}><Button type="text" danger>{t('rec.withdraw')}</Button></Popconfirm>}
            </div>
            <div className="rec-info">
              <div><label>{t('rec.phone')}</label><span>{app.phone ?? '—'}</span></div>
              <div><label>Email</label><span>{app.email ?? '—'}</span></div>
              <div><label>{t('rec.level')}</label><span>{t(`rec.lv.${app.level}`)}</span></div>
              {app.hasFile && (
                <div className="wide"><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <CandidatePhoto id={app.id} name={app.fullName} height={96} version={photoV} />
                  <Space direction="vertical" size={4}>
                    <Upload accept="image/*" showUploadList={false} beforeUpload={(f) => { putPhoto.mutate({ id: app.id, f }); return false }}><Button size="small" icon={<UploadOutlined />} loading={putPhoto.isPending}>{t('rec.photo.set')}</Button></Upload>
                    <PhotoPasteButton name={app.fullName} busy={putPhoto.isPending} onSave={(f) => putPhoto.mutateAsync({ id: app.id, f })} />
                    <Popconfirm title={t('rec.photo.removeAsk')} onConfirm={() => delPhoto.mutate(app.id)}><Button size="small" type="text" danger>{t('rec.photo.remove')}</Button></Popconfirm>
                  </Space>
                </div></div>
              )}
              {app.idLast4 && <div><label>CCCD</label><span>•••• {app.idLast4}</span></div>}
              <div><label>{t('rec.scoreCol')}</label><span><ScoreSummary score={app.score} recommendation={app.recommendation} /></span></div>
              {lookups.data?.rounds && (
                <div><label>{t('rec.r2.label')}</label><span>
                  <Select size="small" style={{ width: 130 }} value={app.rounds ?? 1} disabled={['pass', 'fail', 'screen_fail', 'withdrawn'].includes(app.status)} onChange={(v) => setRounds.mutate({ id: app.id, rounds: v })}
                    options={[{ value: 1, label: t('rec.r2.one') }, { value: 2, label: t('rec.r2.two') }]} />
                </span></div>
              )}
              {cvFacts && <CvFactsInfo app={app} />}
              {app.note && <div className="wide"><label>{t('rec.note')}</label><span>{app.note}</span></div>}
              {app.hrNote && <div className="wide"><label>{t('rec.hrNote')}</label><span>{app.hrNote}</span></div>}
            </div>
            {cvFacts && d.cv && <CvDetailBlock app={app} cv={d.cv} ai={lookups.data?.ai} />}
            {lookups.data?.profile && <ApplicantProfileBlock appId={app.id} />}
            {app.status === 'pass' && onboarding && <OnboardingBlock app={app} ccGroups={lookups.data?.ccGroups ?? []} />}
            {d.screenings.length > 0 && (
              <DataTable<RecruitDetail['screenings'][number]> rowKey="id" size="small" pagination={false} dataSource={d.screenings} columns={[
                { title: t('rec.reviewer'), render: (_: unknown, s) => s.reviewerName ?? s.reviewerId },
                { title: t('rec.dueDate'), width: 140, render: (_: unknown, s) => dueText(s, i18n.language) },
                { title: t('rec.decision'), render: (_: unknown, s) => s.revoked ? <Tag>{t('rec.revokedTag')}</Tag> : s.decision ? <Tag color={s.decision === 'invite' ? 'green' : s.decision === 'consider' ? 'gold' : 'red'}>{t(`rec.dec.${s.decision}`)}</Tag> : <Tag color={s.overdue ? 'red' : 'blue'}>{s.overdue ? t('rec.overdue') : t('rec.waiting')}</Tag> },
                { title: t('rec.comment'), dataIndex: 'comment', ellipsis: true },
                { title: '', width: 90, render: (_: unknown, s) => !s.revoked && !s.decision ? <Popconfirm title={t('rec.revokeAsk')} onConfirm={() => revoke.mutate(s.reviewerId)}><Button size="small" danger>{t('rec.revoke')}</Button></Popconfirm> : !s.revoked && s.decision ? <ScreeningChangeButton appId={app.id} screening={s} /> : null },
              ]} />
            )}
            {d.interviews.length > 0 && (
              <div>
                <div className="rec-section">{t('rec.ivRounds')}</div>
                {[...d.interviews].sort((x, y) => y.round - x.round || y.id - x.id).map((r) => (
                  <div key={r.id} className={`rec-round${r.status === 'planned' && !closed(app) ? ' is-open' : ''}`}>
                    <div className="rec-round-head">
                      <b>{t('rec.round')} {r.round}</b>
                      <span>{ivTime(r.startAt)}</span>
                      {r.location && <span className="cell-muted">· {r.location}</span>}
                      <span className="rec-round-tags">
                        {/* Hồ sơ đã chốt / dừng mà lượt vẫn chờ: không còn chấm được, không hiện như đang lên lịch */}
                        {r.status === 'planned' && closed(app) ? <Tag>{t('rec.ivx.unscored')}</Tag> : <Tag color={IV_COLOR[r.status]}>{t(`rec.iv.${r.status}`)}</Tag>}
                        {attendedRound(r.round) && <Tag color="green">{t('rec.presentTag')}</Tag>}
                        {r.status === 'planned' && !closed(app) && r.panel.some((p) => !p.result) && Date.now() >= evalUntil(r, d.events).getTime() && <Tag color="orange">{t('rec.el.expired')}</Tag>}
                      </span>
                    </div>
                    {r.panel.map((p) => (
                      <div key={p.id} className="rec-panel-row">
                        <div className="rec-panel-who">
                          <span>{p.interviewerName ?? p.interviewerId}</span>
                          {p.result ? <Tag color={resTone(p.result)}>{t(`rec.res.${p.result}`)}</Tag> : r.status === 'planned' && !closed(app) ? <Tag>{t('rec.waiting')}</Tag> : <Tag>{t('rec.ivx.noScore')}</Tag>}
                          {p.scores && <ScoreTag scores={p.scores} />}
                          {p.result && editor && !['screen_fail', 'withdrawn'].includes(app.status) && ['planned', 'done'].includes(r.status) && <EditEvaluationButton interviewId={r.id} member={p} final={closed(app)} />}
                          {p.result && lead && !closed(app) && r.status !== 'cancelled' && r.status !== 'no_show' && <UnlockButton interviewId={r.id} interviewerId={p.interviewerId} name={p.interviewerName ?? p.interviewerId} />}
                        </div>
                        {p.scores && <ScoreLine scores={p.scores} />}
                        {(p.comment || p.strengths || p.weaknesses) && <div className="rec-panel-note">{[p.strengths && `+ ${p.strengths}`, p.weaknesses && `− ${p.weaknesses}`, p.comment].filter(Boolean).join(' · ')}</div>}
                        {p.result && <InkImages interviewId={r.id} interviewerId={p.interviewerId} />}
                      </div>
                    ))}
                    {(() => { const avg = averageOfPanel(r.panel); return avg ? <div style={{ padding: '0 14px 10px' }}><ScoreAverageBox avg={avg} /></div> : null })()}
                    {r.status === 'planned' && !closed(app) && (
                      <div className="rec-round-actions">
                        {!attendedRound(r.round) && <Popconfirm title={t('rec.presentAsk')} onConfirm={() => attend.mutate(r.id)}><Button type="primary" icon={<CheckCircleOutlined />} loading={attend.isPending && attend.variables === r.id}>{t('rec.present')}</Button></Popconfirm>}
                        <Popconfirm title={t('rec.noShowAsk')} description={t('rec.absentHint')} onConfirm={() => closeIv.mutate({ id: r.id, kind: 'no_show' })}><Button danger>{t('rec.noShow')}</Button></Popconfirm>
                        <span className="rec-round-gap" />
                        <Button icon={<SendOutlined />} disabled={!app.email} onClick={() => { setCc([]); setCcQ(''); setInviteMsg(''); setInviting(r.id) }}>{t('rec.invite')}</Button>
                        <Button icon={<UserAddOutlined />} onClick={() => { setAddIds([]); setAddQ(''); setAddingTo(r.id) }}>{t('rec.addPeople')}</Button>
                        {lead && r.panel.some((p) => !p.result) && Date.now() >= evalUntil(r, d.events).getTime() && <ExtendEvalButton interviewId={r.id} />}
                        {r.panel.some((p) => !!p.result) && r.panel.some((p) => !p.result) && Date.now() >= evalUntil(r, d.events).getTime() && <Popconfirm title={t('rec.closeIvAsk')} description={t('rec.closeIvHint')} onConfirm={() => closeIv.mutate({ id: r.id, kind: 'close' })}><Button>{t('rec.closeIv')}</Button></Popconfirm>}
                        <Popconfirm title={t('rec.cancelIvAsk')} onConfirm={() => closeIv.mutate({ id: r.id, kind: 'cancel' })}><Button type="text" danger>{t('rec.cancelIv')}</Button></Popconfirm>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(d.related ?? []).length > 0 && (
              <div>
                <div className="rec-section">{t('rec.related', { n: d.related!.length })}</div>
                {d.related!.map((h) => (
                  <div key={h.applicationId} className="rec-panel-row">
                    <div className="rec-panel-who">
                      <span>#{h.applicationId} · <b>{trData(h.position)}</b></span>
                      {chip(h.status as RecruitApplication['status'])}
                      <Tag>{t(h.match === 'idno' ? 'rec.matchIdno' : 'rec.matchPhone')}</Tag>
                      <span className="cell-muted">{day(h.createdAt)}</span>
                      <span className="rec-round-gap" />
                      {!closed(app) && !['pass', 'fail', 'screen_fail', 'withdrawn'].includes(h.status) && <Popconfirm title={t('rec.mergeAsk', { id: h.applicationId })} onConfirm={() => merge.mutate({ id: app.id, dupId: h.applicationId })}><Button size="small" loading={merge.isPending}>{t('rec.merge')}</Button></Popconfirm>}
                      <Button size="small" onClick={() => setOpenId(h.applicationId)}>{t('rec.open')}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {d.events.length > 0 && (
              <div>
                <div className="rec-section">{t('rec.history')}</div>
                <div className="rec-timeline">
                  {[...d.events].reverse().map((e) => (
                    <div key={e.id} className="rec-tl-item">
                      <div><b>{t(`rec.ev.${e.kind}`, { defaultValue: e.kind })}</b> <span className="cell-muted">{new Date(e.at).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })} · {e.byUser}</span></div>
                      {e.note && <div className="rec-tl-note">{e.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Space>
          <div className="rec-detail-cv">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {d.file && d.file.ext !== 'pdf' && (
                <Space wrap>
                  <Tag>{d.file.name}</Tag>
                  <Button size="small" icon={<DownloadOutlined />} href={cvOriginalUrl(app.id)}>{t('rec.cvOriginal')}</Button>
                  {!d.file.preview && <Button size="small" loading={rebuild.isPending} onClick={() => rebuild.mutate()}>{t('rec.rebuildPreview')}</Button>}
                </Space>
              )}
              {!app.hasFile ? <span className="cell-muted">{t('rec.noCv')}</span>
                : d.file && !d.file.preview && d.file.ext !== 'pdf' ? <span className="cell-muted">{t('rec.noPreview', { ext: d.file.ext.toUpperCase() })}</span>
                : <CvPane id={app.id} admin downloadName={app.fullName} height="78vh" maskable={!!lookups.data?.maskSalary} translatable={!!lookups.data?.translateCv} />}
            </Space>
          </div>
          </div>
        ) : <div style={{ minHeight: 200 }} />}
      </AppModal>

      <AppModal open={scheduling} onClose={() => setScheduling(false)} size="sm" icon={<CalendarOutlined />} title={t('rec.schedule')} subtitle={t('rec.scheduleHint')} okText={t('rec.schedule')} okDisabled={!when || panelIds.length === 0} okLoading={schedule.isPending} onOk={() => schedule.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.startAt')} required><DatePicker showTime={{ format: 'HH:mm', minuteStep: 5 }} format="DD/MM/YYYY HH:mm" value={when} onChange={setWhen} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('rec.location')}><Input value={where} maxLength={100} onChange={(e) => setWhere(e.target.value)} /></Form.Item>
          <Form.Item label={t('rec.interviewers')} required>
            <Select mode="multiple" showSearch filterOption={false} value={panelIds} onChange={setPanelIds} onSearch={setPanelQ} maxCount={6} placeholder={t('rec.reviewerPh')}
              notFoundContent={panelQ.trim().length < 2 ? t('rec.typeMore') : null}
              options={(panelUsers.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))} />
          </Form.Item>
                    <Form.Item label={t('rec.note')}><Input.TextArea rows={2} maxLength={1000} value={ivNote} onChange={(e) => setIvNote(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>

      <AppModal open={addingTo !== null} onClose={() => setAddingTo(null)} size="sm" icon={<UserAddOutlined />} title={t('rec.addPeople')} subtitle={t('rec.addPeopleHint')} okText={t('rec.addPeople')} okDisabled={addIds.length === 0} okLoading={addPeople.isPending} onOk={() => addPeople.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.interviewers')} required>
            <Select mode="multiple" showSearch filterOption={false} value={addIds} onChange={setAddIds} onSearch={setAddQ} maxCount={6} placeholder={t('rec.reviewerPh')}
              notFoundContent={addQ.trim().length < 2 ? t('rec.typeMore') : null}
              options={(addUsers.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))} />
          </Form.Item>
        </Form>
      </AppModal>

      <AppModal open={finalizing !== null} onClose={() => setFinalizing(null)} size="sm" icon={<CheckCircleOutlined />} title={t('rec.finalize')} subtitle={t('rec.finalizeHint')} okText={t('rec.finalize')} danger={finalizing === 'fail'} okLoading={finalize.isPending} onOk={() => finalize.mutate()}>
        {app && waitsRound2(app) && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('rec.r2.hint')} />}
        <Form layout="vertical">
          <Form.Item label={t('rec.finalResult')}><Radio.Group size="large" optionType="button" buttonStyle="solid" value={finalizing} onChange={(e) => setFinalizing(e.target.value)} options={[{ value: 'pass', label: t('rec.st.pass') }, { value: 'consider', label: t('rec.st.consider') }, { value: 'fail', label: t('rec.st.fail') }]} /></Form.Item>
          <Form.Item label={t('rec.hrNote')} extra={t('rec.finalNoteHint')}><Input.TextArea rows={3} maxLength={1000} showCount value={finalNote} onChange={(e) => setFinalNote(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>

      <AppModal open={declining} onClose={() => setDeclining(false)} size="sm" icon={<PauseCircleOutlined />} title={t('rec.declineOffer')} subtitle={t('rec.declineHint')} okText={t('rec.declineOffer')} danger okDisabled={declineNote.trim().length < 2} okLoading={declineOffer.isPending} onOk={() => declineOffer.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.declineNote')} required><Input.TextArea rows={3} maxLength={1000} showCount value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>

      <AppModal open={postponing} onClose={() => setPostponing(false)} size="sm" icon={<PauseCircleOutlined />} title={t('rec.postpone')} subtitle={t('rec.postponeHint')} okText={t('rec.postpone')} okDisabled={postponeNote.trim().length < 2} okLoading={postpone.isPending} onOk={() => postpone.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.postponeNote')} required><Input.TextArea rows={3} maxLength={1000} showCount value={postponeNote} onChange={(e) => setPostponeNote(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>

      <AppModal open={inviting !== null} onClose={() => setInviting(null)} size="md" icon={<SendOutlined />} title={t('rec.inviteTitle')} subtitle={replyHint(app?.email ?? '')} okText={t('rec.invite')} okLoading={invite.isPending} onOk={() => invite.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.ccLabel')} extra={t('rec.ccHint')}>
            <Select mode="tags" showSearch filterOption={false} value={cc} onChange={(v: string[]) => setCc(ccEmails(v))} onSearch={setCcQ} tokenSeparators={[',', ';', ' ']} placeholder={t('rec.ccPh')}
              notFoundContent={null}
              options={(ccUsers.data ?? []).filter((u) => u.email).map((u) => ({ value: u.email!.toLowerCase(), label: `${u.fullName} <${u.email}>` }))} />
          </Form.Item>
          <Space wrap style={{ marginBottom: 12 }}>
            {(lookups.data?.ccGroups ?? []).length > 0 && <span className="cell-muted">{t('rec.ccGroups')}</span>}
            {(lookups.data?.ccGroups ?? []).map((g) => <Button key={g.name} size="small" onClick={() => setCc(ccEmails([...cc, ...g.emails]))}>{g.name} ({g.emails.length})</Button>)}
            <Button size="small" type="link" onClick={() => setManagingCc(true)}>{cc.length > 0 ? t('rec.ccSaveAsGroup') : t('rec.ccManage')}</Button>
          </Space>
          <div className="cell-muted" style={{ marginBottom: 12 }}>{t(lookups.data?.autoMail ? 'rec.mt.autoInvite' : 'rec.mt.manualInvite')}</div>
          <Form.Item label={t('rec.inviteMsg')}><Input.TextArea rows={3} maxLength={1000} value={inviteMsg} onChange={(e) => setInviteMsg(e.target.value)} /></Form.Item>
        </Form>
      </AppModal>

      <CcGroupsModal open={managingCc} onClose={() => setManagingCc(false)} groups={lookups.data?.ccGroups ?? []} seed={cc} departments={lookups.data?.departments ?? []} />

      <AppModal open={sending} onClose={() => setSending(false)} size="md" icon={<SendOutlined />} title={t('rec.send')} subtitle={t('rec.sendHint')} okText={t('rec.send')} okDisabled={reviewers.length === 0 || !dueAt} okLoading={send.isPending} onOk={() => send.mutate()}>
        <Form layout="vertical">
          <Form.Item label={t('rec.sendTo', { defaultValue: 'Gửi tới (To): người đánh giá' })} required extra={t('rec.sendToHint', { defaultValue: 'Tối đa 5 người, chọn tay; mỗi người nhận một thư riêng "Dear tên - chức vụ" và có phiếu đánh giá trong CMS.' })}>
            <Select mode="multiple" showSearch filterOption={false} value={reviewers} onChange={setReviewers} onSearch={setUserQ} maxCount={5} placeholder={t('rec.reviewerPh')}
              notFoundContent={userQ.trim().length < 2 ? t('rec.typeMore') : null}
              options={(users.data ?? []).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))} />
          </Form.Item>
          <PickGroups groups={lookups.data?.ccGroups ?? []} onPickCc={(e) => setSendCc(ccEmails([...sendCc, ...e]))} />
          <Form.Item label={t('rec.sendCc', { defaultValue: 'Đồng gửi (CC)' })} extra={t('rec.sendCcHint', { defaultValue: 'Nhận bản sao thư kèm CV, gõ tên để tìm hoặc gõ email rồi Enter.' })}>
            <Select mode="tags" showSearch filterOption={false} disabled={!mailCv || !lookups.data?.maskSalary} value={sendCc} onChange={(v: string[]) => setSendCc(ccEmails(v))} onSearch={setCcQ} tokenSeparators={[',', ';', ' ']} placeholder={t('rec.ccPh')}
              notFoundContent={null}
              options={(ccUsers.data ?? []).filter((u) => u.email).map((u) => ({ value: u.email!.toLowerCase(), label: `${u.fullName} <${u.email}>` }))} />
          </Form.Item>
          <Button size="small" type="link" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => setManagingCc(true)}>{t('rec.ccManage')}</Button>
          <Form.Item label={t('rec.dueAt')} required extra={t('rec.dueAtHint')}><DatePicker showTime={{ format: 'HH:mm', minuteStep: 15 }} format="DD/MM/YYYY HH:mm" value={dueAt} onChange={setDueAt} disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.isAfter(dayjs().add(30, 'day'), 'day')} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('rec.cvx.sendVer')} extra={t('rec.cvx.sendVerHint')}><Select value={cvVer} onChange={setCvVer} options={[{ value: 'vi', label: t('rec.cvx.verVi') }, ...(lookups.data?.translateCv ? [{ value: 'en' as const, label: t('rec.cvx.verEn') }, { value: 'ko' as const, label: t('rec.cvx.verKo', { defaultValue: 'Tiếng Hàn (bản dịch, đã che lương)' }) }] : [])]} /></Form.Item>
          <Form.Item extra={lookups.data?.maskSalary ? t('rec.cvx.mailCvHint') : t('rec.cvx.maskOffHint2')}><Checkbox checked={mailCv && !!lookups.data?.maskSalary} disabled={!lookups.data?.maskSalary} onChange={(e) => setMailCv(e.target.checked)}>{t('rec.cvx.mailCv')}</Checkbox></Form.Item>
        </Form>
      </AppModal>
    </div>
  )
}
