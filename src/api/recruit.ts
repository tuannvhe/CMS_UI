import { api } from './client'

export type RecruitStatus = 'new' | 'screening' | 'screen_fail' | 'to_schedule' | 'scheduled' | 'evaluated' | 'pass' | 'fail' | 'withdrawn' | 'absent' | 'postponed' | 'consider'
export type RecruitLevel = 'op' | 'staff'
export const RECRUIT_STATUSES: RecruitStatus[] = ['new', 'screening', 'to_schedule', 'scheduled', 'evaluated', 'consider', 'postponed', 'absent', 'pass', 'fail', 'screen_fail', 'withdrawn']
/** Nhóm lọc trên màn HR: một nhóm có thể gồm nhiều trạng thái (gửi lên API cách nhau dấu phẩy). */
export const RECRUIT_FILTERS: { key: string; statuses: RecruitStatus[] }[] = [
  { key: 'new', statuses: ['new', 'screening'] },
  { key: 'waiting', statuses: ['to_schedule', 'scheduled'] },
  { key: 'evaluated', statuses: ['evaluated'] },
  /** Chỉ hiện khi đã có cột số vòng: hồ sơ 2 vòng đã xong vòng 1, chờ đặt lịch vòng 2 (lọc thêm ở client). */
  { key: 'round2', statuses: ['evaluated', 'consider', 'to_schedule'] },
  { key: 'postponed', statuses: ['postponed'] },
  { key: 'absent', statuses: ['absent'] },
  { key: 'consider', statuses: ['consider'] },
  { key: 'pass', statuses: ['pass'] },
  { key: 'fail', statuses: ['fail', 'screen_fail'] },
  { key: 'withdrawn', statuses: ['withdrawn'] },
]
/** Hồ sơ phỏng vấn 2 vòng mà mới xong vòng 1 (hoặc chưa vòng nào): chưa chốt Đạt được. */
export const waitsRound2 = (a: { rounds?: number | null; doneRounds?: number; status: string }) => (a.rounds ?? 1) >= 2 && (a.doneRounds ?? 0) < 2 && !['pass', 'fail', 'screen_fail', 'withdrawn'].includes(a.status)
/** Hồ sơ 2 vòng đã xong đúng vòng 1 và còn đang chờ đặt lịch vòng 2. */
export const isRound2Wait = (a: { rounds?: number | null; doneRounds?: number; status: string }) => waitsRound2(a) && (a.doneRounds ?? 0) === 1 && ['evaluated', 'consider', 'to_schedule'].includes(a.status)
export const STATUS_TONE: Record<RecruitStatus, string> = { new: 'warn', screening: 'info', to_schedule: 'good', scheduled: 'info', evaluated: 'warn', pass: 'good', fail: 'bad', screen_fail: 'bad', withdrawn: 'muted', absent: 'bad', postponed: 'warn', consider: 'info' }

export interface RecruitApplication {
  id: number; fullName: string; phone: string | null; email: string | null; position: string; level: RecruitLevel; department: string | null; factory: string | null
  status: RecruitStatus; note: string | null; restricted: boolean; hasFile: boolean; createdBy: string; createdAt: string; closedAt: string | null; hrNote: string | null
  /** Tổng điểm trung bình hội đồng ở vòng gần nhất (tối đa 20); chỉ HR thấy. */
  score?: number | null; recommendation?: 'pass' | 'consider' | 'fail' | null
  /** 4 số cuối CCCD (chỉ HR). */
  idLast4?: string | null
  /** Đọc từ CV hoặc HR nhập: năm sinh, tổng số tháng kinh nghiệm, bậc học; factsSource auto | ai | hr (null = chưa đọc). */
  birthYear?: number | null; expMonths?: number | null; education?: EduLevel | null; factsSource?: 'auto' | 'ai' | 'hr' | null
  /** Số vòng phỏng vấn cần có (1 hoặc 2) và số vòng đã xong; chỉ có khi đã chạy SQL cột ROUNDS_REQ. */
  rounds?: number | null; doneRounds?: number
  /** Đợt tuyển dụng / thư mục chứa hồ sơ (null = chưa xếp). */
  batchId?: number | null
}
export type EduLevel = 'thpt' | 'trung_cap' | 'cao_dang' | 'dai_hoc' | 'thac_si' | 'tien_si'
export const EDU_LEVELS: EduLevel[] = ['thpt', 'trung_cap', 'cao_dang', 'dai_hoc', 'thac_si', 'tien_si']
export interface CvFacts { birthYear: number | null; expMonths: number | null; education: EduLevel | null }
/** Một dòng kinh nghiệm: from / to dạng yyyy-MM-dd (ngày 1 của tháng); current = đang làm (to = null). */
export interface CvExperience { from: string | null; to: string | null; current: boolean; company: string | null; position: string | null }
export interface CvEducation { school: string | null; major: string | null; degree: EduLevel | null; fromYear: number | null; toYear: number | null }
/** en: bản tiếng Anh của công ty / chức danh / trường / chuyên ngành (chữ gốc → tiếng Anh), có khi CV đã được dịch. */
export interface CvDetail { experience: CvExperience[]; education: CvEducation[]; en?: Record<string, string> | null }
export interface DuplicateHit { applicationId: number; fullName: string; position: string; status: RecruitStatus; createdAt: string; match: 'phone' | 'idno' }
export interface BlacklistRow {
  id: number; fullName: string; idLast4: string | null; phone: string | null; reason: string; applicationId: number | null; createdBy: string; createdAt: string
  removedBy: string | null; removedAt: string | null; removeNote: string | null
}
/** Lịch nhận việc của người trúng tuyển (không có offer). Ngày dạng yyyy-MM-dd. */
export interface Onboarding {
  applicationId: number; startDate: string; probationEnd: string | null; location: string | null; note: string | null; hasOffer: boolean
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null
  /** Theo dõi sau nhận việc (cần SQL đợt F): yes = có đến, no = không đến. */
  arrival?: 'yes' | 'no' | null; arrivedDate?: string | null; leftDate?: string | null; leftNote?: string | null; onTime?: boolean; leftEarly?: boolean
}
export interface OnboardingTrack { arrival: 'yes' | 'no' | null; arrivedDate?: string | null; leftDate?: string | null; leftNote?: string | null }
/** Offer (chỉ người có quyền "Xem offer"). */
export interface RecruitOffer {
  probationSalary?: number | null; salary?: number | null; allowances?: string | null; contract?: string | null; note?: string | null
  /** Lương cơ bản (lương giờ = cơ bản / 208) và tổng offer (lương KRW = tổng / 20); trống thì dùng lương chính thức. */
  baseSalary?: number | null; totalOffer?: number | null
}
/** Lương KRW và lương giờ theo cách tính của HR. */
export const offerKrw = (o: RecruitOffer | null | undefined) => { const v = o?.totalOffer ?? o?.salary; return v == null ? null : Math.round(v / 20) }
export const offerHourly = (o: RecruitOffer | null | undefined) => { const v = o?.baseSalary ?? o?.salary; return v == null ? null : Math.round(v / 208) }
export interface OnboardingInput { startDate: string; probationEnd?: string; location?: string; note?: string }
export interface RecruitCheck { duplicates: DuplicateHit[]; blacklist: BlacklistRow[] }
/** enabled: đã chạy SQL đợt C; idNo: nhập được CCCD (đã đặt khoá Recruit:IdKey). */
export interface RecruitIdentityState { enabled: boolean; idNo: boolean }
/** Điểm 4 tiêu chí, mỗi tiêu chí 1–5. */
export interface RecruitScores { skill: number; comm: number; attitude: number; culture: number; total?: number }
export const SCORE_CRITERIA = ['skill', 'comm', 'attitude', 'culture'] as const
export const scoreTotal = (s: RecruitScores) => s.skill + s.comm + s.attitude + s.culture
/** Điểm trung bình của hội đồng ở một lượt phỏng vấn (count = số người đã chấm, panelSize = cả hội đồng). */
export interface ScoreAverage { skill: number; comm: number; attitude: number; culture: number; total: number; count: number; panelSize: number }
/** Trung bình các phiếu có điểm (làm tròn 1 chữ số, giống máy chủ); null nếu chưa ai chấm. */
export function averageOfPanel(panel: { scores?: RecruitScores | null }[]): ScoreAverage | null {
  const s = panel.map((p) => p.scores).filter((x): x is RecruitScores => !!x)
  if (s.length === 0) return null
  const avg = (f: (x: RecruitScores) => number) => Math.round((s.reduce((n, x) => n + f(x), 0) / s.length) * 10) / 10
  return { skill: avg((x) => x.skill), comm: avg((x) => x.comm), attitude: avg((x) => x.attitude), culture: avg((x) => x.culture), total: avg(scoreTotal), count: s.length, panelSize: panel.length }
}
export interface RecruitScoring { enabled: boolean; passScore: number; considerScore: number; maxScore: number }
export type ScreenDecision = 'invite' | 'reject' | 'consider'
/** Nút cây đợt tuyển dụng: parentId null = đợt (gốc), có parentId = thư mục con. applications = số hồ sơ nằm trực tiếp trong nút. */
export interface RecruitBatch {
  id: number; parentId: number | null; name: string; department: string | null; position: string | null; headcount: number | null
  fromDate: string | null; toDate: string | null; status: 'open' | 'closed'; createdBy: string; createdAt: string; applications: number
}
export interface BatchInput { parentId: number | null; name: string; department?: string | null; position?: string | null; headcount?: number | null; fromDate?: string | null; toDate?: string | null; closed?: boolean }
export type Gender = 'male' | 'female' | 'other'
/** Thông tin thêm do HR nhập ở vòng gọi sơ loại (không gồm lương). */
export interface ApplicantProfile { gender: Gender | null; address: string | null; major: string | null; languages: string | null; availableFrom: string | null; birthDate?: string | null }
/** Lương hiện tại / mong muốn: chỉ người có quyền "Xem lương ứng viên". */
export interface ApplicantSalary { currentSalary: number | null; expectedSalary: number | null }
export interface RecruitScreening {
  id: number; applicationId: number; reviewerId: string; reviewerName: string | null; sentAt: string; dueDate: string
  decision: ScreenDecision | null; comment: string | null; decidedAt: string | null; revoked: boolean; overdue: boolean
}
export interface RecruitEvent { id: number; kind: string; fromStatus: string | null; toStatus: string | null; byUser: string; at: string; note: string | null }
export type InterviewStatus = 'planned' | 'done' | 'cancelled' | 'no_show'
export interface PanelMember { id: number; interviewerId: string; interviewerName: string | null; result: 'pass' | 'fail' | null; strengths: string | null; weaknesses: string | null; comment: string | null; submittedAt: string | null; scores?: RecruitScores | null }
export interface RecruitInterview { id: number; applicationId: number; round: number; startAt: string; location: string | null; note: string | null; status: InterviewStatus; panel: PanelMember[] }
export interface RecruitDetail { application: RecruitApplication; screenings: RecruitScreening[]; events: RecruitEvent[]; file: { id: number; name: string; size: number; uploadedAt: string; ext: string; preview: boolean } | null; interviews: RecruitInterview[]
  /** Hồ sơ khác của cùng người (trùng SĐT / CCCD), chỉ HR. */
  related?: DuplicateHit[]; cv?: CvDetail | null; /** Bản CV HR chọn khi gửi cho người đánh giá (en | vi | ko). */ cvVersion?: 'en' | 'vi' | 'ko' | null }
export interface HrReview { userId: string; name: string | null; scores: RecruitScores | null; note: string | null; updatedAt: string }
export interface AllInterview { interview: RecruitInterview; /** HR đã điểm danh có mặt cho lượt này. */ attended?: boolean; /** Điểm / ghi chú riêng của nhân sự (không thuộc hội đồng). */ hrReviews?: HrReview[]; application: RecruitApplication; /** Từng dòng kinh nghiệm / học vấn đọc từ CV (có khi đã chạy SQL bảng chi tiết). */ cv?: CvDetail | null }
export interface MyInterview {
  interview: Omit<RecruitInterview, 'panel'>
  mine: { result: 'pass' | 'fail' | null; strengths: string | null; weaknesses: string | null; comment: string | null; submittedAt: string | null; scores?: RecruitScores | null }
  /** Có khi cả hội đồng đã nộp phiếu: chỉ điểm trung bình, không kèm phiếu của người khác. */
  average?: ScoreAverage | null
  application: RecruitApplication
  cv?: CvDetail | null
  /** Ngày có thể đi làm + trình độ ngoại ngữ HR đã nhập (tự hiện trên phiếu đánh giá). */
  profile?: { availableFrom: string | null; languages: string | null } | null
  /** Hạn nhập phiếu (hết ngày phỏng vấn hoặc tới hết ngày được trưởng HR gia hạn); chỉ có khi phiếu của mình còn chờ. */
  evalUntil?: string | null
}
/** Điểm một người phỏng vấn ở vòng gần nhất có điểm (scores = null: chưa nộp). */
export interface PanelScore { userId: string; name: string | null; result: 'pass' | 'fail' | null; scores: RecruitScores | null; round: number }
export interface RecruitList { ready: boolean; items: RecruitApplication[]; panelScores?: Record<number, PanelScore[]> }
export interface RecruitMine { screening: RecruitScreening; application: RecruitApplication }
export interface RecruitUser { userId: string; fullName: string; email?: string | null }
export type CcRole = '' | 'it' | 'dept' | 'payroll'
/** Nhóm người nhận: bộ phận + người nhận (userIds để chọn nhanh người đánh giá / phỏng vấn, emails để CC / thông báo), role = vai trò khi tự thông báo nhân viên mới. */
export interface RecruitCcGroup { name: string; emails: string[]; toEmails?: string[]; department?: string | null; role?: CcRole; userIds?: string[] }
export type FinalResult = 'pass' | 'fail' | 'consider'
/** Đuôi CV được nhận: PDF xem ngay; Word / Excel được máy chủ chuyển sang PDF để xem, HR vẫn tải được file gốc. */
export const CV_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx'

export interface RecruitCreate {
  fullName: string; phone?: string; email?: string; position: string; level: RecruitLevel; department?: string; factory?: string; note?: string; restricted?: boolean; idNo?: string; file?: File
  /** Tải nhiều CV: họ tên đang lấy theo tên file, máy chủ thay bằng họ tên đọc trong CV. */
  nameFromFile?: boolean
}

const form = (v: Record<string, unknown>) => {
  const f = new FormData()
  Object.entries(v).forEach(([k, val]) => { if (val !== undefined && val !== null && val !== '') f.append(k, val instanceof File ? val : String(val)) })
  return f
}

/** Đường dẫn xem CV (PDF) — cùng nguồn gốc nên cookie phiên tự gửi kèm, không có đường dẫn công khai. */
export interface ImportResult { created: number; errors: { row: number; reason: string }[] }
/** Excel danh sách một ca phỏng vấn (slot = "yyyy-MM-dd HH:mm", trống = mọi lượt đang chờ) và bảng xếp hạng theo vị trí. */
export const exportSlotUrl = (slot: string) => `/api/admin/recruit/interviews/export?slot=${encodeURIComponent(slot)}`
export const exportRankingUrl = (position?: string) => `/api/admin/recruit/ranking/export${position ? `?position=${encodeURIComponent(position)}` : ''}`
export const importTemplateUrl = '/api/admin/recruit/import/template'
export const cvUrl = (id: number, admin: boolean) => (admin ? `/api/admin/recruit/${id}/cv` : `/api/recruit/${id}/cv`)
/** Ảnh chân dung lấy từ CV (JPEG); 404 nếu CV không có ảnh riêng. */
export const photoUrl = (id: number) => `/api/recruit/${id}/photo`
export const cvOriginalUrl = (id: number) => `/api/admin/recruit/${id}/cv/original`
/** Bản CV đã che dòng lương (HR xem thử; người ngoài HR luôn nhận bản này khi bật che lương). */
export const cvMaskedUrl = (id: number) => `/api/admin/recruit/${id}/cv?masked=true`
/** Nhà máy chọn khi nhập CV. */
export const RECRUIT_FACTORIES = ['Bắc Ninh', 'Hưng Yên']
/** Quy mã nhà máy cũ (BN, HY, "VINA HY"...) về Bắc Ninh / Hưng Yên giống máy chủ, để lọc không tách nhóm. */
export function normFactory(v: string | null | undefined): string | null {
  if (!v || !v.trim()) return null
  const f = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toUpperCase()
  if (f.trim() === 'VVT_F5') return 'Hưng Yên'
  if (f.trim() === 'VVT_F1') return 'Bắc Ninh'
  if (/HUNG ?YEN/.test(f) || /(^|[^A-Z])HY([^A-Z]|$)/.test(f)) return 'Hưng Yên'
  if (/BAC ?NINH/.test(f) || /(^|[^A-Z])BN([^A-Z]|$)/.test(f)) return 'Bắc Ninh'
  return v.trim()
}

const cvKoBase = (id: number, admin: boolean) => (admin ? `/admin/recruit/${id}/cv/ko` : `/recruit/${id}/cv/ko`)
/** Bản CV tiếng Hàn (PDF giữ bố cục; người ngoài HR nhận bản dịch từ CV đã che lương khi bật che). */
export const cvKoreanUrl = (id: number, admin: boolean) => `/api${cvKoBase(id, admin)}`
const cvEnBase = (id: number, admin: boolean) => (admin ? `/admin/recruit/${id}/cv/en` : `/recruit/${id}/cv/en`)
/** Bản CV tiếng Anh (PDF giữ bố cục; người ngoài HR nhận bản dịch từ CV đã che lương khi bật che). */
export const cvEnglishUrl = (id: number, admin: boolean) => `/api${cvEnBase(id, admin)}`
/** Bản viết tay của một người phỏng vấn ở một lượt phỏng vấn (PNG; chỉ chính người đó và HR xem được). */
export type InkField = 'strengths' | 'weaknesses' | 'comment'
export const inkUrl = (interviewId: number, interviewerId: string, field: InkField) => `/api/recruit/interviews/${interviewId}/ink/${encodeURIComponent(interviewerId)}/${field}`

export type MailLang = 'vi' | 'en' | 'ko'
/** Bản nháp mail báo kết quả Đạt / Trượt theo ngôn ngữ chọn khi gửi (mẫu tạm phía máy chủ, HR sửa trước khi gửi). */
/** Mẫu mail gửi ứng viên. builtin = mẫu có sẵn, custom = HR đã sửa / thêm. */
export interface RecruitMailTemplate { key: string; name: string; subject: string; html: string; builtin: boolean; custom: boolean; updatedBy?: string | null; updatedAt?: string | null }
export type RecruitMailField = 'name' | 'position' | 'time' | 'location' | 'link' | 'contact' | 'deadline' | 'package' | 'address' | 'start'
export interface RecruitMailDraft { key: string; subject: string; html: string; fields: RecruitMailField[]; values: Record<string, string>; missing: string[]; email: string | null; withIcs: boolean; lastSentAt: string | null }
export interface RecruitMailSend { key: string; subject?: string; values?: Record<string, string>; file?: { name: string; base64: string } | null }
export interface ResultMailDraft { lang: MailLang; outcome: 'pass' | 'fail' | 'screen_fail'; subject: string; body: string; email: string | null; lastSentAt: string | null }

export const recruit = {
  /** Địa chỉ nhận thư trả lời của ứng viên khi mình gửi thư (null = không có, thư trả lời về hộp thư hệ thống gửi đi). */
  replyTo: () => api.get<{ address: string | null; mine: boolean }>('/admin/recruit/reply-to').then((r) => r.data),
  list: (p: { status?: string; level?: string; search?: string }) => api.get<RecruitList>('/admin/recruit', { params: p }).then((r) => r.data),
  get: (id: number) => api.get<RecruitDetail>(`/admin/recruit/${id}`).then((r) => r.data),
  create: (b: RecruitCreate) => api.post<{ id: number }>('/admin/recruit', form({ ...b, restricted: b.restricted ? 'true' : 'false', nameFromFile: b.nameFromFile ? 'true' : 'false' })).then((r) => r.data),
  replaceCv: (id: number, file: File) => api.post(`/admin/recruit/${id}/cv`, form({ file })).then(() => undefined),
  /** Gửi nhiều hồ sơ cho cùng nhóm người đánh giá; kèm CV qua mail thì mỗi người nhận một thư gộp. */
  sendMany: (ids: number[], reviewers: string[], dueDays?: number, cvVersion?: 'en' | 'vi' | 'ko', mail?: { cc?: string[] }) =>
    api.post<{ sent: number; failed: { id: number; name: string; reason: string }[] }>('/admin/recruit/send-many', { ids, reviewers, dueDays, cvVersion, mailCv: !!mail, cc: mail?.cc }).then((r) => r.data),
  send: (id: number, reviewers: string[], dueDays?: number, cvVersion?: 'en' | 'vi' | 'ko', mail?: { cc?: string[] }) => api.post(`/admin/recruit/${id}/send`, { reviewers, dueDays, cvVersion, mailCv: !!mail, cc: mail?.cc }).then(() => undefined),
  revoke: (id: number, userId: string) => api.post(`/admin/recruit/${id}/revoke`, { userId }).then(() => undefined),
  toSchedule: (id: number) => api.post(`/admin/recruit/${id}/to-schedule`).then(() => undefined),
  reopen: (id: number) => api.post(`/admin/recruit/${id}/reopen`).then(() => undefined),
  withdraw: (id: number, note?: string) => api.post(`/admin/recruit/${id}/withdraw`, { note }).then(() => undefined),
  postpone: (id: number, note: string) => api.post(`/admin/recruit/${id}/postpone`, { note }).then(() => undefined),
  /** Đã có bản CV tiếng Anh chưa (không ghi nhật ký xem). */
  hasCvEnglish: (id: number, admin: boolean) => api.get(cvEnBase(id, admin), { params: { check: true } }).then(() => true, (e) => { if (e?.response?.status === 404) return false; throw e }),
  /** Như hasCvEnglish, kèm lý do lần dịch gần nhất lỗi (chỉ HR): no_text / english / no_source / service. */
  cvEnglishState: (id: number, admin: boolean) => api.get(cvEnBase(id, admin), { params: { check: true } })
    .then((): { has: boolean; failed?: string } => ({ has: true }), (e) => { if (e?.response?.status === 404) return { has: false, failed: e.response.data?.failed as string | undefined }; throw e }),
  /** Đưa mọi CV của hồ sơ đang mở vào hàng chờ AI (đọc lại, che lương, dịch). */
  queueAiAll: () => api.post<{ queued: number }>('/admin/recruit/cv-ai/all').then((r) => r.data.queued),
  /** HR che thêm vùng trên bản CV đã che lương (toạ độ theo tỉ lệ trang). */
  maskAreas: (id: number, areas: { page: number; x0: number; y0: number; x1: number; y1: number }[]) => api.post(`/admin/recruit/${id}/cv/mask-areas`, { areas }).then(() => undefined),
  /** Làm lại bản che lương tự động (bỏ vùng che tay). */
  maskReset: (id: number) => api.post(`/admin/recruit/${id}/cv/mask-reset`).then(() => undefined),
  translateCv: (id: number) => api.post(`/admin/recruit/${id}/cv/translate`).then(() => undefined),
  /** Đã có bản CV tiếng Hàn chưa, kèm lý do lần dịch gần nhất lỗi (chỉ HR). */
  cvKoreanState: (id: number, admin: boolean) => api.get(cvKoBase(id, admin), { params: { check: true } })
    .then((): { has: boolean; failed?: string } => ({ has: true }), (e) => { if (e?.response?.status === 404) return { has: false, failed: e.response.data?.failed as string | undefined }; throw e }),
  translateCvKorean: (id: number) => api.post(`/admin/recruit/${id}/cv/translate-ko`).then(() => undefined),
  rebuildPreview: (id: number) => api.post<{ preview: boolean }>(`/admin/recruit/${id}/cv/preview`).then((r) => r.data.preview),
  readCv: (id: number) => api.post<CvFacts>(`/admin/recruit/${id}/cv-facts/read`).then((r) => r.data),
  setContact: (id: number, b: { fullName: string; phone: string | null; email: string | null }) => api.put(`/admin/recruit/${id}/contact`, b).then(() => undefined),
  setCvFacts: (id: number, b: { birthYear?: number | null; expYears?: number | null; education?: EduLevel | null }) => api.put(`/admin/recruit/${id}/cv-facts`, b).then(() => undefined),
  setCvDetail: (id: number, d: CvDetail) => api.put(`/admin/recruit/${id}/cv-detail`, d).then(() => undefined),
  backfillCvFacts: () => api.post<{ done: number; left: number }>('/admin/recruit/cv-facts/backfill').then((r) => r.data),
  hrReview: (interviewId: number, scores: RecruitScores | null, note: string) => api.put(`/admin/recruit/interviews/${interviewId}/hr-review`, { scores, note }).then(() => undefined),
  attend: (interviewId: number, present: boolean, note?: string) => api.post(`/admin/recruit/interviews/${interviewId}/attend`, { present, note }).then(() => undefined),
  /** Trưởng HR gia hạn nhập đánh giá cho lượt đã quá hạn (tới hết hôm nay). */
  extendEvaluation: (interviewId: number, reason: string) => api.post(`/admin/recruit-lead/interviews/${interviewId}/extend`, { reason }).then(() => undefined),
  unlock: (interviewId: number, interviewerId: string, reason: string) => api.post(`/admin/recruit-lead/interviews/${interviewId}/unlock`, { interviewerId, reason }).then(() => undefined),
  importOp: (file: File) => { const f = new FormData(); f.append('file', file); return api.post<ImportResult>('/admin/recruit/import', f).then((r) => r.data) },
  saveCcGroups: (groups: RecruitCcGroup[]) => api.put<RecruitCcGroup[]>('/admin/recruit/cc-groups', { groups }).then((r) => r.data),
  lookups: () => api.get<{ departments: string[]; factories: string[]; ccGroups?: RecruitCcGroup[]; batches?: boolean; profile?: boolean; scoring?: RecruitScoring; identity?: RecruitIdentityState; onboarding?: boolean; tracking?: boolean; cvFacts?: boolean; cvDetail?: boolean; rounds?: boolean; ai?: boolean; maskSalary?: boolean; translateCv?: boolean; autoMail?: boolean }>('/admin/recruit/lookups').then((r) => r.data),
  users: (q: string) => api.get<RecruitUser[]>('/admin/recruit/users', { params: { q } }).then((r) => r.data),
  mine: (pending = false, all = false) => api.get<RecruitMine[]>('/recruit/mine', { params: { pending, all } }).then((r) => r.data),
  allInterviews: (pending = false, from?: string, to?: string) => api.get<AllInterview[]>('/recruit/interviews/all', { params: { pending, from, to } }).then((r) => r.data),
  mineGet: (id: number) => api.get<RecruitDetail>(`/recruit/${id}`).then((r) => r.data),
  batches: () => api.get<RecruitBatch[]>('/admin/recruit/batches').then((r) => r.data),
  createBatch: (b: BatchInput) => api.post<{ id: number }>('/admin/recruit/batches', b).then((r) => r.data.id),
  updateBatch: (id: number, b: BatchInput) => api.put(`/admin/recruit/batches/${id}`, b).then(() => undefined),
  moveToBatch: (ids: number[], batchId: number | null) => api.post<{ moved: number }>('/admin/recruit/batches/move', { ids, batchId }).then((r) => r.data.moved),
  profile: (id: number) => api.get<ApplicantProfile>(`/admin/recruit/${id}/profile`).then((r) => r.data),
  saveProfile: (id: number, p: ApplicantProfile) => api.put(`/admin/recruit/${id}/profile`, p).then(() => undefined),
  salary: (id: number) => api.get<ApplicantSalary>(`/admin/recruit-salary/${id}`).then((r) => r.data),
  saveSalary: (id: number, s: ApplicantSalary) => api.put(`/admin/recruit-salary/${id}`, s).then(() => undefined),
  /** HR sửa ý kiến duyệt CV của một người (bắt buộc lý do; lịch sử giữ ý kiến cũ). */
  changeScreening: (id: number, screeningId: number, decision: ScreenDecision, comment: string | undefined, reason: string) =>
    api.post(`/admin/recruit/${id}/screenings/${screeningId}/change`, { decision, comment, reason }).then(() => undefined),
  decide: (id: number, decision: ScreenDecision, comment?: string) => api.post(`/recruit/${id}/decide`, { decision, comment }).then(() => undefined),
  schedule: (id: number, b: { startAt: string; location?: string; note?: string; interviewers: string[] }) => api.post<{ id: number }>(`/admin/recruit/${id}/schedule`, b).then((r) => r.data),
  invite: (interviewId: number, message?: string, cc?: string[]) => api.post(`/admin/recruit/interviews/${interviewId}/invite`, { message, cc }).then(() => undefined),
  addInterviewers: (interviewId: number, interviewers: string[]) => api.post(`/admin/recruit/interviews/${interviewId}/interviewers`, { interviewers }).then(() => undefined),
  closeInterview: (interviewId: number, kind: 'cancel' | 'no_show' | 'close', note?: string) => api.post(`/admin/recruit/interviews/${interviewId}/close`, { kind, note }).then(() => undefined),
  setRounds: (id: number, rounds: number) => api.put(`/admin/recruit/${id}/rounds`, { rounds }).then(() => undefined),
  finalize: (id: number, result: FinalResult, note?: string) => api.post(`/admin/recruit/${id}/final`, { result, note }).then(() => undefined),
  myInterviews: (pending = false, from?: string, to?: string) => api.get<MyInterview[]>('/recruit/interviews/mine', { params: { pending, from, to } }).then((r) => r.data),
  evaluate: (interviewId: number, b: { result: 'pass' | 'fail'; strengths?: string; weaknesses?: string; comment?: string; scores?: RecruitScores; inkFields?: InkField[] }) => api.post(`/recruit/interviews/${interviewId}/evaluate`, b).then(() => undefined),
  /** Tải bản viết tay (PNG thô, không đi theo JSON của phiếu để khỏi vào nhật ký thao tác). */
  putPhoto: (id: number, img: Blob) => api.put(`/admin/recruit/${id}/photo`, img, { headers: { 'Content-Type': img.type || 'application/octet-stream' } }).then(() => undefined),
  deletePhoto: (id: number) => api.delete(`/admin/recruit/${id}/photo`).then(() => undefined),
  reread: (after: number) => api.post<{ done: number; next: number | null }>('/admin/recruit/cv-facts/reread', null, { params: { after } }).then((r) => r.data),
  merge: (id: number, dupId: number) => api.post(`/admin/recruit/${id}/merge/${dupId}`).then(() => undefined),
  uploadInk: (interviewId: number, field: InkField, png: Blob) => api.put(`/recruit/interviews/${interviewId}/ink/${field}`, png, { headers: { 'Content-Type': 'image/png' } }).then(() => undefined),
  scoring: () => api.get<RecruitScoring>('/recruit/scoring').then((r) => r.data),
  check: (b: { phone?: string; idNo?: string; excludeId?: number }) => api.post<RecruitCheck>('/admin/recruit/check', b).then((r) => r.data),
  blacklist: (all = false) => api.get<BlacklistRow[]>('/admin/recruit/blacklist', { params: { all } }).then((r) => r.data),
  addBlacklist: (b: { applicationId?: number; fullName?: string; phone?: string; idNo?: string; reason: string }) => api.post<{ id: number }>('/admin/recruit/blacklist', b).then((r) => r.data),
  onboarding: (id: number) => api.get<{ onboarding: Onboarding | null }>(`/admin/recruit/${id}/onboarding`).then((r) => r.data.onboarding),
  saveOnboarding: (id: number, b: OnboardingInput) => api.put<Onboarding>(`/admin/recruit/${id}/onboarding`, b).then((r) => r.data),
  saveOnboardingWithOffer: (id: number, b: OnboardingInput & { offer?: RecruitOffer }) => api.put<Onboarding>(`/admin/recruit-offer/${id}`, b).then((r) => r.data),
  offer: (id: number) => api.get<{ offer: RecruitOffer | null }>(`/admin/recruit-offer/${id}`).then((r) => r.data.offer),
  notifyOnboarding: (id: number, b: { message?: string; cc?: string[]; toCandidate?: boolean; lang?: MailLang }) => api.post(`/admin/recruit/${id}/onboarding/notify`, b).then(() => undefined),
  /** Như notifyOnboarding nhưng thư ứng viên kèm số liệu offer (cần quyền Xem offer). */
  notifyOnboardingWithOffer: (id: number, b: { message?: string; cc?: string[]; toCandidate?: boolean; lang?: MailLang }) => api.post(`/admin/recruit-offer/${id}/notify`, b).then(() => undefined),
  /** Xem trước thư gửi ứng viên (không gửi); withOffer cần quyền Xem offer. */
  previewOnboarding: (id: number, b: { message?: string; lang: MailLang }, withOffer: boolean) =>
    api.post<{ subject: string; html: string }>(withOffer ? `/admin/recruit-offer/${id}/preview` : `/admin/recruit/${id}/onboarding/preview`, b).then((r) => r.data),
  /** Trưởng HR sửa kết quả đã chốt (lý do bắt buộc). */
  correctFinal: (id: number, result: 'pass' | 'fail' | 'consider', reason: string) => api.post(`/admin/recruit-lead/applications/${id}/final`, { result, reason }).then(() => undefined),
  resultMailDraft: (id: number, lang: MailLang) => api.get<ResultMailDraft>(`/admin/recruit/${id}/result-mail`, { params: { lang } }).then((r) => r.data),
  mailTemplates: () => api.get<RecruitMailTemplate[]>('/admin/recruit/mail-templates').then((r) => r.data),
  saveMailTemplate: (key: string, b: { name: string; subject: string; html: string }) => api.put<RecruitMailTemplate>(`/admin/recruit/mail-templates/${encodeURIComponent(key)}`, b).then((r) => r.data),
  resetMailTemplate: (key: string) => api.delete(`/admin/recruit/mail-templates/${encodeURIComponent(key)}`).then(() => undefined),
  mailDraft: (id: number, b: RecruitMailSend) => api.post<RecruitMailDraft>(`/admin/recruit/${id}/mail/draft`, b).then((r) => r.data),
  sendMail: (id: number, b: RecruitMailSend) => api.post(`/admin/recruit/${id}/mail`, b).then(() => undefined),
  sendResultMail: (id: number, b: { lang: MailLang; subject: string; body: string }) => api.post(`/admin/recruit/${id}/result-mail`, b).then(() => undefined),
  trackOnboarding: (id: number, b: OnboardingTrack) => api.put<Onboarding>(`/admin/recruit/${id}/onboarding/track`, b).then((r) => r.data),
  onboardings: (from: string, to: string) => api.get<{ onboarding: Onboarding; application: RecruitApplication }[]>('/admin/recruit/onboarding', { params: { from, to } }).then((r) => r.data),
  removeBlacklist: (id: number, note?: string) => api.post(`/admin/recruit-lead/blacklist/${id}/remove`, { note }).then(() => undefined),
}

/** Script tạo các bảng tuyển dụng (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng, không đụng bảng cũ). */
export const RECRUIT_TABLES_SQL = `CREATE TABLE dbo.Tbl_Rec_Application (
    ID          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FULLNAME    nvarchar(100)  NOT NULL,
    PHONE       nvarchar(30)   NULL,
    EMAIL       nvarchar(200)  NULL,
    POSITION    nvarchar(100)  NOT NULL,
    LEVEL       nvarchar(10)   NOT NULL,   -- op | staff
    DEPARTMENT  nvarchar(100)  NULL,
    FACTORY     nvarchar(50)   NULL,
    STATUS      nvarchar(16)   NOT NULL,   -- new | screening | to_schedule | scheduled | evaluated | consider | postponed | absent | pass | fail | screen_fail | withdrawn
    NOTE        nvarchar(1000) NULL,
    RESTRICTED  bit            NOT NULL DEFAULT 0,
    CREATEDBY   nvarchar(50)   NOT NULL,
    CREATEDATE  datetime       NULL,
    UPDATEDATE  datetime       NULL,
    CLOSEDDATE  datetime       NULL,
    HRNOTE      nvarchar(1000) NULL        -- ghi chú chốt cuối của HR
);
CREATE INDEX IX_Tbl_Rec_Application_STATUS ON dbo.Tbl_Rec_Application (STATUS, ID);

CREATE TABLE dbo.Tbl_Rec_File (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    STOREDNAME   nvarchar(64)   NOT NULL,
    ORIGINALNAME nvarchar(200)  NOT NULL,
    SIZE         bigint         NOT NULL,
    UPLOADEDBY   nvarchar(50)   NOT NULL,
    UPLOADEDAT   datetime       NULL,
    PURGEDAT     datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_File_APP ON dbo.Tbl_Rec_File (APPLICATIONID);

CREATE TABLE dbo.Tbl_Rec_Screening (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    REVIEWERID   nvarchar(50)   NOT NULL,
    SENTBY       nvarchar(50)   NOT NULL,
    SENTAT       datetime       NULL,
    DUEDATE      date           NOT NULL,
    DECISION     nvarchar(10)   NULL,       -- invite | reject
    COMMENT      nvarchar(1000) NULL,
    DECIDEDAT    datetime       NULL,
    REVOKED      bit            NOT NULL DEFAULT 0
);
CREATE INDEX IX_Tbl_Rec_Screening_APP ON dbo.Tbl_Rec_Screening (APPLICATIONID, REVIEWERID);
CREATE INDEX IX_Tbl_Rec_Screening_REV ON dbo.Tbl_Rec_Screening (REVIEWERID, REVOKED, DECISION);

CREATE TABLE dbo.Tbl_Rec_Event (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    KIND         nvarchar(30)   NOT NULL,
    FROMSTATUS   nvarchar(16)   NULL,
    TOSTATUS     nvarchar(16)   NULL,
    BYUSER       nvarchar(50)   NOT NULL,
    AT           datetime       NULL,
    NOTE         nvarchar(1000) NULL
);
CREATE INDEX IX_Tbl_Rec_Event_APP ON dbo.Tbl_Rec_Event (APPLICATIONID);

CREATE TABLE dbo.Tbl_Rec_FileAccess (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    FILEID       int            NOT NULL,
    USERID       nvarchar(50)   NOT NULL,
    ACTION       nvarchar(10)   NOT NULL,
    AT           datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_FileAccess_APP ON dbo.Tbl_Rec_FileAccess (APPLICATIONID, AT);

CREATE TABLE dbo.Tbl_Rec_Interview (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    APPLICATIONID int           NOT NULL,
    ROUNDNO      int            NOT NULL,
    STARTAT      datetime       NOT NULL,
    LOCATION     nvarchar(100)  NULL,
    NOTE         nvarchar(1000) NULL,
    STATUS       nvarchar(10)   NOT NULL,   -- planned | done | cancelled | no_show
    CREATEDBY    nvarchar(50)   NOT NULL,
    CREATEDATE   datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_Interview_APP ON dbo.Tbl_Rec_Interview (APPLICATIONID, ROUNDNO);
CREATE INDEX IX_Tbl_Rec_Interview_START ON dbo.Tbl_Rec_Interview (STARTAT);

CREATE TABLE dbo.Tbl_Rec_InterviewPanel (
    ID           int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    INTERVIEWID  int            NOT NULL,
    INTERVIEWERID nvarchar(50)  NOT NULL,
    RESULT       nvarchar(10)   NULL,       -- pass | fail
    STRENGTHS    nvarchar(1000) NULL,
    WEAKNESSES   nvarchar(1000) NULL,
    COMMENT      nvarchar(1000) NULL,
    SUBMITTEDAT  datetime       NULL
);
CREATE INDEX IX_Tbl_Rec_InterviewPanel_IV ON dbo.Tbl_Rec_InterviewPanel (INTERVIEWID);
CREATE INDEX IX_Tbl_Rec_InterviewPanel_USER ON dbo.Tbl_Rec_InterviewPanel (INTERVIEWERID, RESULT);`

export interface RecruitReportData {
  ready?: boolean
  byStatus: Record<string, number>
  byLevel: Record<string, number>
  byDepartment: { key: string; value: number }[]
  screeningsSent: number; screeningsInvite: number; screeningsReject: number; screeningsPending: number; screeningsOverdue: number; avgScreeningHours: number | null
  interviewsPlanned: number; interviewsDone: number; interviewsNoShow: number; interviewsCancelled: number
  evaluationsPass: number; evaluationsFail: number
  finalPass: number; finalFail: number; avgDaysToFinal: number | null
}

export const recruitReport = (from: string, to: string) => api.get<RecruitReportData>('/admin/recruit/report', { params: { from, to } }).then((r) => r.data)

export interface RecruitPositionStat { position: string; department: string | null; level: string; total: number; open: number; interviewed: number; passed: number; failed: number }

/** Dashboard tuyển dụng: số liệu báo cáo + xu hướng (ngày / tuần / tháng), phễu, nhà máy, vị trí. ready = false khi chưa tạo bảng. */
export interface RecruitDashboardData {
  ready?: boolean
  from: string
  to: string
  report: RecruitReportData
  bucket: 'day' | 'week' | 'month'
  trend: { start: string; created: number; passed: number; failed: number }[]
  funnel: { received: number; screened: number; invited: number; interviewed: number; passed: number }
  byFactory: { key: string; value: number }[]
  positions: RecruitPositionStat[]
}

export const recruitDashboard = (from: string, to: string) => api.get<RecruitDashboardData>('/admin/recruit/dashboard', { params: { from, to } }).then((r) => r.data)

/** Tải file Excel dashboard (tổng quan, xu hướng, theo vị trí, hồ sơ, phỏng vấn) của khoảng ngày. */
export async function recruitDashboardExport(from: string, to: string) {
  const res = await api.get<Blob>('/admin/recruit/dashboard/export', { params: { from, to }, responseType: 'blob', timeout: 180000 })
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = m ? decodeURIComponent(m[1]) : `BaoCaoTuyenDung_${from}_${to}.xlsx`
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** Một dòng báo cáo tổng thể (7.1) theo bộ phận + vị trí. */
export interface RecruitSummaryRow {
  department: string | null; position: string; applied: number; invited: number; attend1: number; pass1: number; attend2: number; pass2: number; hired: number
  onboardFrom: string | null; onboardTo: string | null; tracked: number; onTime: number; onTimeRate: number | null; arrived: number; leftEarly: number; leftEarlyRate: number | null
}
export interface RecruitSummary { from: string; to: string; batchId: number | null; batchName: string | null; tracking: boolean; rows: RecruitSummaryRow[]; total: RecruitSummaryRow }
export interface ExportScope { from: string; to: string; batch?: number | null; ids?: number[] }

export const recruitSummary = (from: string, to: string, batch?: number | null) =>
  api.get<RecruitSummary>('/admin/recruit/summary', { params: { from, to, batch: batch || undefined } }).then((r) => r.data)

async function downloadXlsx(url: string, params: Record<string, unknown>, fallback: string) {
  const res = await api.get<Blob>(url, { params, responseType: 'blob', timeout: 300000 })
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''))
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href; a.download = m ? decodeURIComponent(m[1]) : fallback
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 60000)
}
const scopeParams = (s: ExportScope, cols?: string[]) => ({ from: s.from, to: s.to, batch: s.batch || undefined, ids: s.ids?.length ? s.ids.join(',') : undefined, cols: cols?.length ? cols.join('|') : undefined })

/** 7.1 Báo cáo tổng thể (Excel). */
export const recruitSummaryExport = (s: ExportScope) => downloadXlsx('/admin/recruit/summary/export', scopeParams(s), `BaoCaoTongThe_${s.from}_${s.to}.xlsx`)
/** 7.2 Danh sách ứng viên đầy đủ; withSalary chỉ cho người có quyền xem lương (máy chủ kiểm lại). */
export const recruitApplicantsExport = (s: ExportScope, withSalary: boolean, cols?: string[]) =>
  downloadXlsx(withSalary ? '/admin/recruit-salary/export' : '/admin/recruit/export/applicants', scopeParams(s, cols), `UngVien_${s.from}_${s.to}.xlsx`)
/** 7.3 Danh sách nhân viên mới trúng tuyển kèm offer (chỉ người có quyền Xem offer). */
/** Người đã đến nhận việc thực tế (ảnh + thông tin cá nhân); kind chọn thêm cột lương hiện tại / mong muốn (cần quyền Xem lương) hoặc offer (cần quyền Xem offer). */
export const recruitOnboardedExport = (s: ExportScope, kind: 'base' | 'salary' | 'offer' = 'base', cols?: string[]) =>
  downloadXlsx(kind === 'salary' ? '/admin/recruit-salary/export-onboarded' : kind === 'offer' ? '/admin/recruit-offer/export-onboarded' : '/admin/recruit/export/onboarded', scopeParams(s, cols), `NhanViecThucTe_${s.from}_${s.to}.xlsx`)
export const recruitHiresExport = (s: ExportScope, cols?: string[]) => downloadXlsx('/admin/recruit-offer/export', scopeParams(s, cols), `NhanVienMoi_${s.from}_${s.to}.xlsx`)

/** Tên cột Excel HR được chọn khi xuất (khớp dòng tiêu đề do máy chủ tạo). */
export const EXPORT_COLS = {
  applicants: ['Mã', 'Đợt / thư mục', 'Vị trí', 'Bộ phận', 'Nhà máy', 'Họ tên', 'Năm sinh', 'Giới tính', 'Số điện thoại', 'Email', 'Địa chỉ', 'Học vấn', 'Trường', 'Chuyên ngành', 'Mô tả kinh nghiệm', 'Tổng năm KN', 'Ngày có thể đi làm', 'Ngoại ngữ', 'Trạng thái', 'Ngày nhận hồ sơ'],
  applicantsSalary: ['Lương hiện tại', 'Lương mong muốn'],
  onboarded: ['Ảnh', 'Họ tên', 'Bộ phận', 'Chức vụ', 'Ngày tháng năm sinh', 'Giới tính', 'Trình độ', 'Tên trường', 'Chuyên ngành', 'Mô tả kinh nghiệm', 'Số năm kinh nghiệm'],
  onboardedSalary: ['Lương hiện tại', 'Lương mong muốn'],
  onboardedOffer: ['Lương offer thực tế công ty đề xuất'],
  onboardedDate: ['Ngày nhận việc'],
  hires: ['Mã', 'Đợt / thư mục', 'Họ tên', 'Vị trí', 'Bộ phận', 'Nhà máy', 'Số điện thoại', 'Email', 'Ngày dự PV', 'Kết quả PV', 'Điểm TB (/20)', 'Ngày chốt', 'Ngày hẹn đi làm', 'Hết thử việc', 'Đến nhận việc', 'Ngày nghỉ việc', 'Lương thử việc', 'Lương chính thức', 'Lương cơ bản', 'Tổng offer', 'Lương KRW (tổng / 20)', 'Lương giờ (cơ bản / 208)', 'Phụ cấp', 'Loại HĐ', 'Ghi chú offer'],
}
