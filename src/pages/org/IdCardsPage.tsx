import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Alert, AutoComplete, Avatar, Button, Card, DatePicker, Input, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, PictureOutlined, ClearOutlined, CloudUploadOutlined, DeleteOutlined, EditOutlined, UserDeleteOutlined, UndoOutlined, FileExcelOutlined, IdcardOutlined, ReloadOutlined, SaveOutlined, ScanOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FilterTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useToast } from '../../hooks/useToast'
import {
  DRAFT_FIELDS, toIsoDate, cleanCell, draftErrors, draftToInput, emptyDraft, newDraftKey, idCardError, idCards, isPending, parseClipboard, parseQr, qrLostAccents,
  type AddressConversion, type DraftField, type IdCardDraft, type IdCardInput, type IdCardRow,
} from '../../api/idCards'
import { matchRow, resolveSite, SITE_FACTORY } from '../../api/idCards'
import { erpKey, useErpMasters } from './erpMasters'
import { DEFAULT_ETHNICITY, ETHNICITIES } from '../../api/ethnicities'
import TempAddressPicker from './TempAddressPicker'
import IdCardEditModal from './IdCardEditModal'
import IdCardErpModal from './IdCardErpModal'
import IdCardOrgMapModal from './IdCardOrgMapModal'
import IdCardExportModal from './IdCardExportModal'
import { useCellColors } from './useCellColors'
import IdCardScanBox from './IdCardScanBox'
import { SearchBox } from '../../components/SearchBox'
import { AppModal } from '../../components/AppModal'
import { EmployeePhoto } from '../../components/EmployeePhoto'
import { foldFilter } from '../../utils/search'

const WIDTH: Record<DraftField, number> = {
  startDate: 110, employeeId: 100, position: 140, department: 140, factory: 100, fullName: 190, dob: 110, gender: 70, ethnicity: 100,
  address: 300, tempAddress: 260, newAddress: 300, idNo: 140, oldIdNo: 120, issueDate: 110, note: 160, bankName: 150, bankAccount: 170, fingerCode: 110, referrer: 180, title: 110,
}
const MONO = new Set<DraftField>(['employeeId', 'idNo', 'oldIdNo', 'bankAccount', 'fingerCode'])
const MONO_STYLE = { fontFamily: 'ui-monospace, Consolas, monospace' }
const fmtDate = (s: string | null) => (s ? dayjs(s).format('DD/MM/YYYY') : '')

/** Các ô sửa được trực tiếp trên bảng Đã lưu (số CCCD, ngày sinh… lấy từ thẻ nên sửa trong hộp Sửa). */
type ListEditKey = 'factory' | 'dob' | 'gender' | 'address' | 'issueDate' | 'startDate' | 'employeeId' | 'position' | 'department' | 'title' | 'fullName' | 'ethnicity' | 'newAddress' | 'tempAddress' | 'bankName' | 'bankAccount' | 'fingerCode' | 'referrer' | 'note' | 'phone' | 'emergencyPhone'
const listBase = (r: IdCardRow, k: ListEditKey): string => {
  switch (k) {
    case 'startDate': return fmtDate(r.extra.startDate)
    case 'dob': return fmtDate(r.dob)
    case 'issueDate': return fmtDate(r.issueDate)
    case 'gender': return r.gender ?? ''
    case 'address': return r.address ?? ''
    case 'employeeId': return r.employeeId ?? ''
    case 'fullName': return r.fullName
    case 'newAddress': return r.newAddress ?? ''
    case 'note': return r.note ?? ''
    default: return r.extra[k] ?? ''
  }
}
/** Dòng đã lưu + các ô vừa sửa → dữ liệu gửi lên (PUT ghi đè, các trường không sửa giữ nguyên). */
const listEditInput = (r: IdCardRow, e: Partial<Record<ListEditKey, string>>): IdCardInput => {
  const g = (k: ListEditKey, base: string | null | undefined) => (e[k] !== undefined ? (e[k]!.trim() || null) : (base ?? null))
  const date = (k: ListEditKey, base: string | null) => (e[k] !== undefined ? (e[k]!.trim() ? (toIsoDate(e[k]!) ?? base) : null) : base)   // gõ sai ngày thì giữ ngày cũ
  return {
    idNo: r.idNo, oldIdNo: r.oldIdNo, fullName: (e.fullName ?? r.fullName).trim() || r.fullName,
    dob: date('dob', r.dob), gender: g('gender', r.gender), address: g('address', r.address), issueDate: date('issueDate', r.issueDate),
    employeeId: g('employeeId', r.employeeId), note: g('note', r.note), newAddress: g('newAddress', r.newAddress),
    extra: {
      ...r.extra,
      startDate: date('startDate', r.extra.startDate), factory: g('factory', r.extra.factory),
      position: g('position', r.extra.position), department: g('department', r.extra.department), title: g('title', r.extra.title), ethnicity: g('ethnicity', r.extra.ethnicity),
      tempAddress: g('tempAddress', r.extra.tempAddress), bankName: g('bankName', r.extra.bankName), fingerCode: g('fingerCode', r.extra.fingerCode), referrer: g('referrer', r.extra.referrer), phone: g('phone', r.extra.phone), emergencyPhone: g('emergencyPhone', r.extra.emergencyPhone),
      bankAccount: e.bankAccount !== undefined ? (e.bankAccount.replace(/\D/g, '') || null) : (r.extra.bankAccount ?? null),
    },
  }
}
/** Nhãn ô trong khung chọn dưới ô quét: đậm, rõ hơn nhãn mặc định (xám nhạt). */
const PRESET_LABEL = { fontSize: 12.5, fontWeight: 600, color: 'var(--ant-color-text, #1f1f1f)' }
const DIRTY_STYLE = { background: 'rgba(250, 173, 20, 0.16)' }

/** Dòng trống hoàn toàn (dòng cuối để dán / gõ tiếp). */
const isBlank = (r: IdCardDraft) => DRAFT_FIELDS.every((f) => f === 'factory' || (f === 'position' && (!r.position.trim() || r.position === 'OP')) || (f === 'ethnicity' && (!r.ethnicity.trim() || r.ethnicity === DEFAULT_ETHNICITY)) || (f === 'startDate' && r.startDate === dayjs().format('DD/MM/YYYY')) || !r[f].trim())   // nhà máy và ngày vào làm mặc định (hôm nay) tự điền nên không tính
/** Luôn giữ đúng một dòng trống ở cuối lưới, như Excel. */
const withTail = (rs: IdCardDraft[]) => {
  const out = [...rs]
  while (out.length > 1 && isBlank(out[out.length - 1]) && isBlank(out[out.length - 2])) out.pop()
  if (out.length === 0 || !isBlank(out[out.length - 1])) out.push(emptyDraft())
  return out
}
/** Dán khối Excel vào lưới bắt đầu từ ô (row, col); thiếu dòng thì thêm. */
const pasteBlock = (rs: IdCardDraft[], row: number, col: number, block: string[][]) => {
  const out = [...rs]
  block.forEach((cells, i) => {
    while (out.length <= row + i) out.push(emptyDraft())
    const r = { ...out[row + i] }
    cells.forEach((v, j) => { const f = DRAFT_FIELDS[col + j]; if (f) r[f] = cleanCell(f, v) })
    out[row + i] = r
  })
  return out
}
/** Dòng nhận lần quét tiếp theo: dòng đầu tiên chưa có thông tin CCCD (thường là dòng đã dán mã NV). */
const targetIndex = (rs: IdCardDraft[]) => rs.findIndex((r) => isPending(r))

/**
 * Thông tin CCCD dạng lưới như Excel. Cột đầu là Mã NV: dán cả cột mã NV từ Excel vào, rồi đặt con trỏ ở ô quét và quét lần lượt từng thẻ,
 * mỗi lần quét điền vào dòng đầu tiên chưa có CCCD (lỗi font tự sửa). Sửa trực tiếp trên lưới rồi bấm Lưu một lần.
 * Số CCCD / CMND cũ lưu mã hoá; danh sách đã lưu chỉ hiện 4 số cuối. Lưới chưa lưu chỉ nằm trong bộ nhớ trang (không ghi vào trình duyệt).
 */
export default function IdCardsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  // Bộ phận / vị trí / mã bộ phận chọn sẵn dưới ô quét: áp cho mọi dòng mới quét và quyết định mã nhân viên tự sinh. Nhớ lại ở trình duyệt.
  // Có cây nhân sự: chọn như màn nhân sự (Bộ phận › Team › Part + Chức danh); department = chuỗi "Bộ phận / Team / Part" ghép từ 3 ô.
  const [pick, setPickRaw] = useState<{ department: string; position: string; group: string; title: string; oDept: string; oTeam: string; oPart: string }>(() => {
    const str = (x: unknown) => (typeof x === 'string' ? x : '')
    try { const v = JSON.parse(localStorage.getItem('idc-pick') ?? ''); return { department: str(v.department), position: str(v.position), group: str(v.group), title: str(v.title), oDept: str(v.oDept), oTeam: str(v.oTeam), oPart: str(v.oPart) } }
    catch { return { department: '', position: '', group: '', title: '', oDept: '', oTeam: '', oPart: '' } }
  })
  const setPick = (p: Partial<typeof pick>) => setPickRaw((o) => { const n = { ...o, ...p }; try { localStorage.setItem('idc-pick', JSON.stringify(n)) } catch { /* bỏ qua */ } return n })
  const [rows, setRowsRaw] = useState<IdCardDraft[]>(() => withTail([]))
  // Mỗi dòng có dữ liệu tự nhận nhà máy của sheet đang chọn (HY = Hưng Yên, BN = Bắc Ninh); dòng trống để trống.
  // Dòng vừa có dữ liệu mà chưa có ngày vào làm thì mặc định là hôm nay (xoá tay sau đó thì giữ nguyên, không điền lại).
  const setRows = (f: (p: IdCardDraft[]) => IdCardDraft[]) => setRowsRaw((p) => {
    const hadData = new Set(p.filter((r) => !isBlank(r)).map((r) => r.key))
    return withTail(f(p)).map((r) => {
      const blank = isBlank(r)
      const want = blank ? '' : (SITE_FACTORY[site as 'HY' | 'BN'] ?? '')
      const start = !blank && !hadData.has(r.key) && !r.startDate.trim() ? dayjs().format('DD/MM/YYYY') : r.startDate
      const fresh = !blank && !hadData.has(r.key)
      const pos = fresh && !r.position.trim() ? pick.position.trim() : r.position   // vị trí (chức danh ERP) chọn dưới ô quét
      const dep = fresh && !r.department.trim() ? pick.department : r.department
      const eth = fresh && !r.ethnicity.trim() ? DEFAULT_ETHNICITY : r.ethnicity   // dân tộc mặc định Kinh
      const grp = fresh && !r.codeGroup ? pick.group : r.codeGroup
      const ttl = fresh && !r.title.trim() ? pick.title.trim() : r.title   // chức danh (màn nhân sự) chọn dưới ô quét
      return r.factory === want && r.startDate === start && r.position === pos && r.department === dep && r.codeGroup === grp && r.ethnicity === eth && r.title === ttl ? r
        : { ...r, factory: want, startDate: start, position: pos, department: dep, codeGroup: grp, ethnicity: eth, title: ttl }
    })
  })
  // Mã NV tự cấp ngay khi quét (giữ chỗ ở máy chủ). tried = dòng đã thử cấp; auto = mã do lần quét cấp (để trả lại khi xoá dòng).
  const rowsRef = useRef<IdCardDraft[]>([])
  const tried = useRef(new Set<string>())
  const autoCodes = useRef(new Map<string, string>())
  const chain = useRef<Promise<void>>(Promise.resolve())
  // Khoá màn lúc đang xử lý quét QR (đọc + điền lưới + xin mã NV, khoảng 1 giây): chặn thao tác trên lưới để khỏi quá tải; ô quét vẫn nhận ký tự, lần quét sau xử lý nối tiếp.
  const [busy, setBusy] = useState(0)
  const [applying, setApplying] = useState(false)
  const processing = busy > 0 || applying   // đang điền lưới / xin mã: chưa nhận chuỗi quét kế tiếp, khoá nút Lưu (không phủ màn)
  const releaseRows = (keys: string[]) => keys.forEach((k) => { const c = autoCodes.current.get(k); if (c) { autoCodes.current.delete(k); idCards.releaseCode(c).catch(() => {}) } })
  const [existing, setExisting] = useState<Set<string>>(new Set())
  const [conv, setConv] = useState<Map<string, AddressConversion>>(new Map())
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(() => [dayjs(), dayjs()])   // ngày nhập (ngày lưu vào hệ thống); mặc định hôm nay, xoá ô để xem tất cả
  const [exportOpen, setExportOpen] = useState(false)   // hộp chọn trường cần xuất Excel
  const [status, setStatus] = useState<string>('')   // '' = tất cả; active = chưa đánh dấu; noshow = không nhận việc
  const [editing, setEditing] = useState<IdCardRow | null>(null)
  // Sửa trực tiếp trên bảng Đã lưu: thay đổi gom theo id, bấm một nút Lưu để ghi tất cả.
  const [edits, setEdits] = useState<Record<number, Partial<Record<ListEditKey, string>>>>({})
  const [savingEdits, setSavingEdits] = useState(false)
  // Chọn dở Bộ phận / Team trên bảng (chưa đủ để ra một nhóm): giữ theo id dòng.
  const [orgDraft, setOrgDraft] = useState<Record<number, { d: string; t: string }>>({})
  const [assigned, setAssigned] = useState<{ code: string; name: string; site: string }[] | null>(null)   // mã NV vừa cấp khi lưu
  const codeCfg = useQuery({ queryKey: ['id-cards', 'code-config'], queryFn: idCards.codeConfig, staleTime: 300000 })
  const erpM = useErpMasters()   // Bộ phận / Vị trí theo danh mục ERP
  const erpMode = codeCfg.data?.mode === 'Erp'
  const roleOptions: { value: string; label?: string }[] = erpM.posOptions
  const ethOptions: { value: string; label?: string }[] = ETHNICITIES.map((v) => ({ value: v }))
  const [noShow, setNoShow] = useState<{ row: IdCardRow; reason: string } | null>(null)
  const [erpOpen, setErpOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  // Mỗi nơi một sheet riêng: BN, HY (lưới quét riêng và danh sách riêng); dòng cũ chưa rõ nơi hiện ở sheet BN
  const [site, setSiteRaw] = useState<string>(() => { try { const v = localStorage.getItem('idc-site'); return v === 'HY' ? 'HY' : 'BN' } catch { return 'BN' } })
  const deptOptions: { value: string; label?: string }[] = erpM.deptOptionsFor(site)   // chỉ bộ phận ERP thuộc nhà máy của sheet (BN = Bắc Ninh Factory, HY = còn lại)
  const deptWarn = (v: string) => erpM.badDept(v) || erpM.otherSite(v, site)
  // Ô chọn Bộ phận › Team › Part dưới ô quét (giống màn nhân sự), chỉ các nhóm dùng được ở nhà máy của sheet.
  const orgHere = erpM.org.filter((o) => { const s = erpM.siteOf(o.value); return !s || !site || s === site })
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x && !!x.trim()))].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ value: v }))
  const fromValue = !pick.oDept && pick.department ? erpM.org.find((o) => erpKey(o.value) === erpKey(pick.department)) : undefined   // lựa chọn cũ chỉ lưu chuỗi ghép
  const oDept = pick.oDept || fromValue?.dept || '', oTeam = pick.oTeam || fromValue?.team || '', oPart = pick.oPart || fromValue?.part || ''
  const pickDepts = uniq(orgHere.map((o) => o.dept))
  const pickTeams = uniq(orgHere.filter((o) => erpKey(o.dept) === erpKey(oDept)).map((o) => o.team))
  const pickParts = uniq(orgHere.filter((o) => erpKey(o.dept) === erpKey(oDept) && erpKey(o.team) === erpKey(oTeam)).map((o) => o.part))
  const setOrgPick = (d: string, tm: string, pt: string) => {
    const o = orgHere.find((x) => erpKey(x.dept) === erpKey(d) && erpKey(x.team) === erpKey(tm) && erpKey(x.part) === erpKey(pt))
    setPick({ oDept: d, oTeam: tm, oPart: pt, department: o?.value ?? '', ...(pt && !pick.title.trim() ? { title: 'OP' } : {}) })   // quy tắc CMS: có Part là OP
  }
  const pickIncomplete = !!oDept && !pick.department   // đã chọn Bộ phận nhưng chưa chọn Team (bộ phận có Team)
  const gridStore = useRef<Record<string, IdCardDraft[]>>({})   // lưới đang quét dở của sheet kia, giữ khi chuyển sheet
  const setSite = (s: string) => {
    if (s === site) return
    saveDraftNow(site, rows)   // lưu ngay bản nháp của sheet đang rời
    gridStore.current[site] = rows
    setRowsRaw(gridStore.current[s] ?? withTail([]))
    setSiteRaw(s)
    try { localStorage.setItem('idc-site', s) } catch { /* bỏ qua */ }
  }
  const scanRef = useRef<HTMLTextAreaElement | null>(null)

  const state = useQuery({ queryKey: ['id-cards', 'state'], queryFn: idCards.state, retry: false })
  const ready = !!state.data?.keyReady && !!state.data?.tableReady
  const cc = useCellColors(ready)
  const filter = useMemo(() => ({ q, from: range?.[0].format('YYYY-MM-DD'), to: range?.[1].format('YYYY-MM-DD'), site, status: status || undefined }), [q, range, site, status])
  const list = useQuery({ queryKey: ['id-cards', 'list', filter], queryFn: () => idCards.list(filter), enabled: ready, retry: false, staleTime: 0, gcTime: 0 })

  const errText = (e: unknown) => {
    const { code, detail } = idCardError(e)
    if (code === 'table_missing') return t('idc.err.table')
    if (code === 'key_missing') return t('idc.err.key')
    if (code === 'column_missing') return t('idc.err.column')
    if (code === 'code_table_missing') return t('idc.err.codeTable')
    if (code === 'code_busy') return t('idc.err.codeBusy')
    const m = /^row_(\d+)_(\w+)$/.exec(detail)
    if (m) return t('idc.err.row', { n: m[1], what: t(`idc.err.${m[2]}`, { defaultValue: m[2] }) })
    return detail || code || t('idc.err.generic')
  }

  rowsRef.current = rows
  const filled = rows.filter((r) => !isPending(r))
  const pendingIds = rows.filter((r) => isPending(r) && r.employeeId.trim()).length
  const target = targetIndex(rows)
  const dirty = rows.some((r) => !isBlank(r))

  // Bản nháp: lưới quét chưa lưu được máy chủ giữ (mã hoá) cho từng người / từng nơi, mở lại trang hoặc mất mạng vẫn còn. draftOk[site] = đã nạp xong (mới được tự lưu, tránh ghi đè bản nháp bằng lưới trống).
  const draftOk = useRef<Record<string, boolean>>({})
  const draftLoading = useRef<Record<string, boolean>>({})
  const saveDraftNow = (s: string, rs: IdCardDraft[]) => {
    if (!draftOk.current[s]) return
    const keep = rs.filter((r) => !isBlank(r))
    idCards.saveDraft(s, keep.length ? JSON.stringify(keep) : '', keep.length).catch(() => {})
  }
  useEffect(() => {
    if (!ready || draftOk.current[site] || draftLoading.current[site]) return
    draftLoading.current[site] = true
    idCards.getDraft(site).then((d) => {
      if (d.exists && d.data) {
        try {
          const arr = JSON.parse(d.data) as Partial<IdCardDraft>[]
          const base = emptyDraft()
          const restored = arr.map((x) => { const r = { ...base, key: newDraftKey() } as Record<string, unknown>; for (const k of Object.keys(base)) if (k !== 'key' && typeof x[k as keyof IdCardDraft] === 'string') r[k] = x[k as keyof IdCardDraft]; return r as unknown as IdCardDraft })
          if (restored.length) {
            setRowsRaw((p) => (p.some((r) => !isBlank(r)) ? p : withTail(restored)))
            msg.info(t('idc.draftRestored', { n: restored.length, at: d.updatedAt ? dayjs(d.updatedAt).format('DD/MM HH:mm') : '' }))
          }
        } catch { /* bản nháp hỏng: bỏ qua */ }
      }
      draftOk.current[site] = true
    }).catch(() => { /* chưa có bảng nháp: không tự lưu */ }).finally(() => { draftLoading.current[site] = false })
  }, [ready, site])
  // Tự lưu nháp sau 2 giây kể từ lần sửa cuối.
  useEffect(() => {
    if (!ready || !draftOk.current[site]) return
    const h = setTimeout(() => saveDraftNow(site, rows), 2000)
    return () => clearTimeout(h)
  }, [rows, ready, site])

  // Dòng vừa quét xong (có CCCD, chưa có mã NV) thì xin mã ngay, lần lượt từng dòng theo thứ tự quét. Lỗi thì để trống, lúc Lưu máy chủ tự cấp.
  useEffect(() => {
    if (!ready || !codeCfg.data || erpMode) return
    for (const r of rows) {
      if (isPending(r) || r.employeeId.trim() || tried.current.has(r.key)) continue
      tried.current.add(r.key)
      const snap = { key: r.key, idNo: r.idNo || r.oldIdNo, department: r.department, position: r.position, startDate: toIsoDate(r.startDate) ?? null, codeGroup: r.codeGroup,
        site: resolveSite(r.factory, r.department) || site }   // nhóm 3: Bắc Ninh 001–299, Hưng Yên 300–999
      setBusy((b) => b + 1)
      chain.current = chain.current.then(async () => {
        try {
          const res = await idCards.reserveCode(snap)
          const alive = rowsRef.current.some((x) => x.key === snap.key)
          const own = !res.existing && !res.claimedBy   // mã do chính lần quét này cấp (mã cũ / mã người khác đã quét trước thì không trả lại khi xoá dòng)
          if (!alive) { if (own) idCards.releaseCode(res.code).catch(() => {}); return }
          if (own) autoCodes.current.set(snap.key, res.code)
          if (res.claimedBy) msg.warning(t('idc.claimedBy', { name: res.claimedBy, code: res.code }))
          setRowsRaw((p) => p.map((x) => (x.key === snap.key && !x.employeeId.trim() ? { ...x, employeeId: res.code } : x)))
        } catch { /* lúc Lưu máy chủ tự cấp */ } finally { setBusy((b) => b - 1) }
      })
    }
  }, [rows, ready, erpMode, codeCfg.data, site])

  // Cảnh báo khi rời trang mà lưới còn dòng chưa lưu.
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // Dò số CCCD nào trên lưới đã có trong bảng (lưu lại = cập nhật).
  const idsKey = useMemo(() => [...new Set(rows.map((r) => r.idNo).filter((x) => /^\d{12}$/.test(x)))].sort().join(','), [rows])
  useEffect(() => {
    if (!ready || !idsKey) { setExisting(new Set()); return }
    const h = setTimeout(() => { idCards.check(idsKey.split(',')).then((x) => setExisting(new Set(x))).catch(() => {}) }, 400)
    return () => clearTimeout(h)
  }, [idsKey, ready])

  // Đổi địa chỉ trên thẻ sang địa chỉ mới (máy chủ tra bảng sáp nhập lưu sẵn).
  const addrKey = useMemo(() => JSON.stringify([...new Set(rows.map((r) => r.address.trim()).filter((a) => a && !a.includes('�')))].sort()), [rows])
  useEffect(() => {
    const want = (JSON.parse(addrKey) as string[]).filter((a) => !conv.has(a))
    if (!ready || want.length === 0) return
    const h = setTimeout(() => {
      idCards.convertAddresses(want).then((res) => setConv((p) => { const m = new Map(p); want.forEach((a, i) => { if (res[i]) m.set(a, res[i]) }); return m })).catch(() => {})
    }, 400)
    return () => clearTimeout(h)
  }, [addrKey, ready, conv])
  // Tự điền địa chỉ mới khi đổi chắc chắn được; quét lại thẻ khác (địa chỉ gốc đổi) thì điền lại. Ô người dùng đã tự gõ / chọn thì giữ nguyên.
  useEffect(() => {
    setRowsRaw((prev) => {
      let changed = false
      const next = prev.map((r) => {
        const a = r.address.trim()
        const auto = r.newAddressFrom !== undefined || !r.newAddress
        if (!auto || r.newAddressFrom === a) return r
        const c = conv.get(a)
        if (a && !c) return r   // chưa có kết quả
        const v = c && (c.status === 'exact' || c.status === 'already_new') ? c.newAddress ?? '' : ''
        if (v === r.newAddress && (r.newAddressFrom ?? '') === (v ? a : '')) return r
        changed = true
        return { ...r, newAddress: v, newAddressFrom: v ? a : undefined }
      })
      return changed ? next : prev
    })
  }, [conv, rows])

  /** Ô quét: chuỗi QR → điền vào dòng chờ quét (hoặc dòng đã có cùng số CCCD); chữ khác / khối dán từ Excel → dán từ dòng chờ đầu tiên, cột Mã NV. */
  const applyScan = (base: IdCardDraft[], lines: string[]) => {
    let replaced = 0
    let next = [...base]
    for (const l of lines) {
      const qr = parseQr(l)
      if (qr) {
        const same = next.findIndex((r) => r.idNo && r.idNo === qr.idNo)
        if (same >= 0) replaced++
        const byName = same >= 0 ? -1 : matchRow(next, qr)
        const i = same >= 0 ? same : byName >= 0 ? byName : targetIndex(next)
        // Thông tin trên thẻ ghi đè; trường thẻ không có (rỗng) thì giữ giá trị đã dán / gõ.
        const card = Object.fromEntries(Object.entries(qr).filter(([, v]) => v)) as Partial<typeof qr>
        if (i < 0) next.push({ ...emptyDraft(), ...card })
        else next[i] = { ...next[i], ...card }
      } else {
        const i = targetIndex(next)
        const block = parseClipboard(l)
        // Một cột (danh sách mã NV) thì vào cột Mã NV; nhiều cột thì theo thứ tự bảng nhập nhân sự, từ cột Ngày vào làm.
        next = pasteBlock(next, i < 0 ? next.length : i, block.every((c) => c.length === 1) ? DRAFT_FIELDS.indexOf('employeeId') : 0, block)
      }
      next = withTail(next)
    }
    return { next, replaced }
  }
  /** Ghi lần quét lên lưới trên trạng thái MỚI NHẤT (không dùng bản chụp cũ), để mã NV vừa cấp / dữ liệu vừa sửa không bị ghi đè hay chèn lệch dòng. */
  const addScan = (text: string) => {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
    if (lines.length === 0) return
    if (lines.some((l) => parseQr(l))) { setApplying(true); requestAnimationFrame(() => requestAnimationFrame(() => setApplying(false))) }
    const { replaced } = applyScan(rowsRef.current, lines)
    setRows((p) => applyScan(p, lines).next)
    if (replaced > 0) msg.info(t('idc.dupScan', { n: replaced }))
    const noAccents = lines.filter((l) => qrLostAccents(l)).length
    if (noAccents > 0) msg.warning({ title: t('idc.noAccents', { n: noAccents }), description: t('idc.noAccentsHint'), duration: 15 })
  }


  const setCell = (key: string, field: DraftField, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key
      ? { ...r, [field]: field === 'idNo' || field === 'oldIdNo' ? value.replace(/\D/g, '') : value, ...(field === 'newAddress' ? { newAddressFrom: undefined } : {}) }
      : r)))
  const errors = useMemo(() => new Map(rows.map((r) => [r.key, isPending(r) ? {} : draftErrors(r)])), [rows])
  const invalid = filled.filter((r) => Object.keys(errors.get(r.key) ?? {}).length > 0).length
  const dupInGrid = useMemo(() => {
    const seen = new Map<string, number>()
    for (const r of rows) if (r.idNo) seen.set(r.idNo, (seen.get(r.idNo) ?? 0) + 1)
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k))
  }, [rows])

  /** Di chuyển giữa các ô như Excel: Enter / mũi tên lên xuống. */
  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(`.idc-grid input[data-cell="${row}:${col}"]`)
    if (el) { el.focus(); el.select() }
  }
  const onCellKey = (e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(row + 1, col) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(row - 1, col) }
  }
  /** Dán từ Excel vào một ô: nhiều dòng / nhiều cột thì trải ra lưới từ ô đó; một giá trị thì dán bình thường. */
  const onCellPaste = (e: ClipboardEvent<HTMLInputElement>, row: number, col: number) => {
    const txt = e.clipboardData.getData('text')
    if (!/[\t\n]/.test(txt.replace(/\r?\n$/, ''))) return
    e.preventDefault()
    setRows((prev) => pasteBlock(prev, row, col, parseClipboard(txt)))
  }

  const save = useMutation({
    mutationFn: (batch: IdCardDraft[]) => idCards.save(batch.map((r) => draftToInput(r, site === 'HY' || site === 'BN' ? site : undefined))).then((r) => ({ ...r, keys: new Set(batch.map((x) => x.key)) })),
    onSuccess: (r, batch) => {
      msg.success(t('idc.saved', { added: r.added, updated: r.updated }))
      if (r.renamed?.length) msg.info({ title: t('idc.renamed', { n: r.renamed.length }), description: r.renamed.map((x) => x.name).join(', '), duration: 15 })   // trùng tên người đã có: đã thêm _V(n)
      if (r.assigned?.length) setAssigned(r.assigned.map((a) => ({ code: a.code, name: batch[a.row - 1]?.fullName ?? '', site }))); 
      r.keys.forEach((k) => autoCodes.current.delete(k))
      setRows((p) => p.filter((x) => !r.keys.has(x.key)))
      qc.invalidateQueries({ queryKey: ['id-cards', 'list'] })
      scanRef.current?.focus()
    },
    onError: (e) => msg.error(errText(e)),
  })
  const exportPhotos = useMutation({
    mutationFn: () => idCards.exportPhotos(filter),
    onError: async (e) => {   // lỗi trả về dạng blob: đọc lại để biết có phải "không có ảnh"
      const data = (e as { response?: { data?: unknown } }).response?.data
      let code = ''
      if (data instanceof Blob) { try { code = (JSON.parse(await data.text()) as { title?: string }).title ?? '' } catch { /* không phải JSON */ } }
      msg.error(code === 'no_photos' ? t('idc.noPhotos') : errText(e))
    },
  })
  const exportXlsx = useMutation({
    mutationFn: (v: { columns: string[]; photos: boolean }) => idCards.exportXlsx(filter, v.photos, v.columns),
    onSuccess: () => setExportOpen(false),
    onError: (e) => msg.error(errText(e)),
  })
  const update = useMutation({
    mutationFn: (v: { id: number; item: IdCardInput }) => idCards.update(v.id, v.item),
    onSuccess: () => { msg.success(t('idc.updated')); setEditing(null); qc.invalidateQueries({ queryKey: ['id-cards', 'list'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const markNoShow = useMutation({
    mutationFn: (v: { id: number; on: boolean; reason: string | null }) => idCards.setNoShow(v.id, v.on, v.reason),
    onSuccess: (_d, v) => { msg.success(t(v.on ? 'idc.noShowSaved' : 'idc.noShowCleared')); setNoShow(null); qc.invalidateQueries({ queryKey: ['id-cards', 'list'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => idCards.remove(id),
    onSuccess: () => { msg.success(t('idc.deleted')); qc.invalidateQueries({ queryKey: ['id-cards', 'list'] }) },
    onError: (e) => msg.error(errText(e)),
  })

  /** Ô địa chỉ mới: tự điền khi đổi chắc chắn; xã cũ bị chia thì tô vàng và chọn trong danh sách (vẫn gõ tay được). */
  const newAddressCell = (r: IdCardDraft, row: number, col: number) => {
    const c = r.address.trim() ? conv.get(r.address.trim()) : undefined
    const pick = c?.status === 'check' && !r.newAddress
    const hint = !r.address.trim() ? undefined : c?.status === 'check' ? t(c.note === 'split' ? 'idc.addr.split' : 'idc.addr.ambiguous')
      : c?.status === 'not_found' ? t('idc.addr.notFound') : c?.status === 'already_new' ? t('idc.addr.alreadyNew') : undefined
    return (
      <Tooltip title={hint}>
        <AutoComplete variant="borderless" size="small" style={{ width: '100%' }} value={r.newAddress} options={(c?.candidates ?? []).map((v) => ({ value: v }))}
          className={`idc-cell${pick ? ' idc-cell-warn' : ''}`} placeholder={pick ? t('idc.addr.pick') : undefined}
          onChange={(v: string) => setCell(r.key, 'newAddress', v)}>
          <Input variant="borderless" size="small" data-cell={`${row}:${col}`} onPaste={(e) => onCellPaste(e, row, col)}
            onKeyDown={(e) => { if (!(c?.candidates.length && (e.key === 'Enter' || e.key.startsWith('Arrow')))) onCellKey(e, row, col) }} />
        </AutoComplete>
      </Tooltip>
    )
  }

  /** Mã bộ phận (chữ số đầu của mã NV tự sinh): để trống thì máy chủ đoán theo bộ phận + vị trí; mặc định sản xuất (3). */
  const codeGroupCol = {
    title: t('idc.col.codeGroup'), key: 'codeGroup', width: 150,
    render: (_: unknown, r: IdCardDraft) => isBlank(r) || erpMode || r.employeeId.trim() ? null : (
      <Select variant="borderless" size="small" style={{ width: '100%' }} allowClear placeholder={t('idc.codeGroupAuto')} value={r.codeGroup || undefined}
        options={(codeCfg.data?.groups ?? []).map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` }))} popupMatchSelectWidth={320}
        onChange={(v?: string) => setRows((p) => p.map((x) => (x.key === r.key ? { ...x, codeGroup: v ?? '' } : x)))} />
    ),
  }
  const gridCodes = useMemo(() => [...new Set(rows.map((r) => r.employeeId.trim()).filter(Boolean))].sort().slice(0, 300), [rows])
  const gridPhotos = useQuery({ queryKey: ['id-cards', 'photos', gridCodes.join(',')], queryFn: () => idCards.employeePhotos(gridCodes), enabled: gridCodes.length > 0, placeholderData: (p) => p })
  const gridCols: ColumnsType<IdCardDraft> = [
    { title: '#', key: 'n', width: 46, align: 'center', fixed: 'left', render: (_, __, i) => <span className="idc-rownum">{i + 1}</span> },
    { title: t('idc.col.photo'), key: 'photo', width: 96, render: (_: unknown, r: IdCardDraft) => <EmployeePhoto employeeId={r.employeeId} src={gridPhotos.data?.[r.employeeId.trim()]} name={r.fullName} onUploaded={() => gridPhotos.refetch()} /> },
    ...DRAFT_FIELDS.flatMap((field, col) => [{
      title: t(`idc.col.${field}`), key: field, width: WIDTH[field], fixed: undefined,
      render: (_: unknown, r: IdCardDraft, row: number) => field === 'newAddress' ? newAddressCell(r, row, col)
        : field === 'position' || field === 'department' || field === 'ethnicity' || field === 'title' ? (
        <AutoComplete variant="borderless" size="small" style={{ width: '100%' }} className="idc-cell" value={r[field]} options={field === 'position' ? roleOptions : field === 'ethnicity' ? ethOptions : field === 'title' ? erpM.titleOptions : deptOptions}
          status={(field === 'position' && erpM.badPos(r.position)) || (field === 'department' && deptWarn(r.department)) ? 'warning' : undefined}
          filterOption={foldFilter()} onChange={(v: string) => setCell(r.key, field, v)}>
          <Input variant="borderless" size="small" data-cell={`${row}:${col}`} onPaste={(e) => onCellPaste(e, row, col)} onKeyDown={(e) => onCellKey(e, row, col)} />
        </AutoComplete>
      ) : (
        <Input variant="borderless" size="small" value={r[field]} data-cell={`${row}:${col}`} placeholder={field === 'employeeId' && !erpMode && !isBlank(r) ? t('idc.codeAuto') : undefined}
          status={errors.get(r.key)?.[field] || (field === 'idNo' && dupInGrid.has(r.idNo)) ? 'error' : undefined}
          className={`idc-cell${errors.get(r.key)?.[field] ? ' idc-cell-err' : ''}`} style={MONO.has(field) ? MONO_STYLE : undefined}
          readOnly={field === 'factory'}
          suffix={field === 'tempAddress' ? <TempAddressPicker value={r.tempAddress} onApply={(v) => setCell(r.key, 'tempAddress', v)} /> : undefined}
          onChange={(e) => setCell(r.key, field, e.target.value)} onKeyDown={(e) => onCellKey(e, row, col)} onPaste={(e) => onCellPaste(e, row, col)} />
      ),
    }, ...(field === 'department' ? [codeGroupCol] : [])]),
    {
      title: t('idc.col.status'), key: 'status', width: 120, fixed: 'right',
      render: (_, r, i) => {
        if (isBlank(r)) return null
        if (isPending(r)) return <Tag color={i === target ? 'processing' : 'default'}>{i === target ? t('idc.st.next') : t('idc.st.waiting')}</Tag>
        if (Object.keys(errors.get(r.key) ?? {}).length > 0) return <Tag color="error">{t('idc.st.invalid')}</Tag>
        if (dupInGrid.has(r.idNo)) return <Tag color="error">{t('idc.st.dup')}</Tag>
        return existing.has(r.idNo) ? <Tooltip title={t('idc.st.updateHint')}><Tag color="warning">{t('idc.st.update')}</Tag></Tooltip> : <Tag color="success">{t('idc.st.new')}</Tag>
      },
    },
    { title: '', key: 'del', width: 44, fixed: 'right', render: (_, r) => (isBlank(r) ? null : <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => { releaseRows([r.key]); setRows((p) => p.filter((x) => x.key !== r.key)) }} />) },
  ]

  const editVal = (r: IdCardRow, k: ListEditKey) => edits[r.id]?.[k] ?? listBase(r, k)
  const setEdit = (r: IdCardRow, k: ListEditKey, v: string, extra?: Partial<Record<ListEditKey, string>>) => setEdits((p) => {
    const cur: Partial<Record<ListEditKey, string>> = { ...p[r.id], [k]: v, ...extra }
    for (const key of Object.keys(cur) as ListEditKey[]) if (cur[key] === listBase(r, key)) delete cur[key]
    const n = { ...p }
    if (Object.keys(cur).length) n[r.id] = cur; else delete n[r.id]
    return n
  })
  const editCount = Object.keys(edits).length
  // Cột Bộ phận ERP: chọn bộ phận ERP cho nhóm (Bộ phận / Team / Part) của dòng = gán tay quy đổi, áp cho mọi người cùng nhóm.
  const erpDeptOptions = useMemo(() => erpM.depts.map((d) => ({ value: d.seq, label: d.path })), [erpM.depts])
  const erpSeqOf = useMemo(() => new Map(erpM.depts.map((d) => [erpKey(d.name), d.seq])), [erpM.depts])
  const setGroupErp = useMutation({
    mutationFn: ({ value, seq }: { value: string; seq: number | null }) => idCards.setOrgMap(value, seq).then(() => value),
    onSuccess: (value) => { msg.success(t('idc.col.erpGroupSaved', { g: value })); qc.invalidateQueries({ queryKey: ['id-cards', 'erp-masters'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const saveEdits = async () => {
    const byId = new Map((list.data ?? []).map((r) => [r.id, r]))
    setSavingEdits(true)
    let ok = 0
    const failed: string[] = []
    const left: typeof edits = {}
    for (const [id, e] of Object.entries(edits)) {
      const r = byId.get(Number(id))
      if (!r) continue
      try { await idCards.update(r.id, listEditInput(r, e)); ok++ } catch (err) { failed.push(`${r.fullName}: ${errText(err)}`); left[r.id] = e }
    }
    setSavingEdits(false)
    setEdits(left)
    qc.invalidateQueries({ queryKey: ['id-cards', 'list'] })
    setOrgDraft({})
    if (ok) msg.success(t('idc.listSaved', { n: ok }))
    if (failed.length) msg.error(failed.join('\n'))
  }
  // Bộ phận trên bảng Đã lưu: 3 ô Bộ phận › Team › Part theo cây nhân sự (giống màn nhân sự), ghép lại thành chuỗi lưu trên thẻ.
  const orgOpts = (r: IdCardRow) => erpM.org.filter((o) => { const s = erpM.siteOf(o.value); return !s || !r.site || s === r.site })
  const sortedUniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x && !!x.trim()))].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ value: v }))
  const orgParts = (r: IdCardRow) => {
    const v = editVal(r, 'department')
    const o = erpM.org.find((x) => erpKey(x.value) === erpKey(v))
    const dr = orgDraft[r.id]
    return { o, legacy: !o && !!v.trim() ? v : '', d: o?.dept ?? dr?.d ?? '', t: o?.team ?? dr?.t ?? '', p: o?.part ?? '' }
  }
  const setOrgCell = (r: IdCardRow, d: string, tm: string, pt: string) => {
    const o = orgOpts(r).find((x) => erpKey(x.dept) === erpKey(d) && erpKey(x.team) === erpKey(tm) && erpKey(x.part) === erpKey(pt))
    setOrgDraft((p) => ({ ...p, [r.id]: { d, t: tm } }))
    setEdit(r, 'department', o?.value ?? '', pt && !editVal(r, 'title').trim() ? { title: 'OP' } : undefined)   // có Part mà chưa có chức danh: OP
  }
  const orgCell = (level: 'd' | 't' | 'p') => (_: unknown, r: IdCardRow) => {
    const x = orgParts(r)
    const list = orgOpts(r)
    const options = level === 'd' ? sortedUniq(list.map((o) => o.dept))
      : level === 't' ? sortedUniq(list.filter((o) => erpKey(o.dept) === erpKey(x.d)).map((o) => o.team))
      : sortedUniq(list.filter((o) => erpKey(o.dept) === erpKey(x.d) && erpKey(o.team) === erpKey(x.t)).map((o) => o.part))
    const value = level === 'd' ? x.d : level === 't' ? x.t : x.p
    const dirty = edits[r.id]?.department !== undefined
    const missing = level === 't' && !!x.d && !x.o && !x.t && options.length > 0   // bộ phận có Team mà chưa chọn Team
    return (
      <Select variant="underlined" size="small" showSearch allowClear style={{ width: '100%', ...(dirty ? DIRTY_STYLE : {}) }} value={value || undefined} options={options}
        placeholder={level === 'd' && x.legacy ? x.legacy : undefined} disabled={(level === 't' && !x.d) || (level === 'p' && !x.t) || (level !== 'd' && !options.length)}
        status={missing || (level === 'd' && !!x.legacy) ? 'warning' : undefined} popupMatchSelectWidth={280} filterOption={foldFilter()}
        onChange={(nv?: string) => (level === 'd' ? setOrgCell(r, nv ?? '', '', '') : level === 't' ? setOrgCell(r, x.d, nv ?? '', '') : setOrgCell(r, x.d, x.t, nv ?? ''))} />
    )
  }
  const editCell = (k: ListEditKey, opts?: { options?: { value: string; label?: string }[]; mono?: boolean; warn?: (v: string) => boolean; placeholder?: string }) =>
    (_: unknown, r: IdCardRow) => {
      const v = editVal(r, k)
      const style = { width: '100%', ...(edits[r.id]?.[k] !== undefined ? DIRTY_STYLE : {}), ...(opts?.mono ? MONO_STYLE : {}) }
      const onChange = (nv: string) => {
        // Chọn bộ phận có Part mà chưa có chức danh: quy tắc CMS chỉ OP mới xếp tới Part.
        const o = k === 'department' ? erpM.org.find((x) => erpKey(x.value) === erpKey(nv)) : undefined
        setEdit(r, k, nv ?? '', o?.part && !editVal(r, 'title').trim() ? { title: 'OP' } : undefined)
      }
      return opts?.options
        ? <AutoComplete variant="underlined" size="small" style={style} value={v} options={opts.options} filterOption={foldFilter()} popupMatchSelectWidth={k === 'department' ? 420 : 280}
            status={opts.warn?.(v) ? 'warning' : undefined} onChange={onChange} />
        : <Input variant="underlined" size="small" style={style} value={v} placeholder={opts?.placeholder} status={opts?.warn?.(v) ? 'warning' : undefined} onChange={(e) => onChange(e.target.value)} />
    }
  const photoCell = (r: IdCardRow) => <EmployeePhoto employeeId={r.employeeId} src={r.photoUrl} name={r.fullName} />
  const listCols: ColumnsType<IdCardRow> = [
    { title: t('idc.col.photo'), key: 'photo', width: 96, render: (_: unknown, r: IdCardRow) => photoCell(r) },
    { title: t('idc.col.startDate'), key: 'startDate', width: 115, render: editCell('startDate', { placeholder: 'dd/mm/yyyy', warn: (v) => !!v.trim() && !toIsoDate(v) }) },
    { title: t('idc.col.employeeId'), dataIndex: 'employeeId', width: 110, render: editCell('employeeId', { mono: true }) },
    { title: t('idc.col.fingerCode'), key: 'fingerCode', dataIndex: ['extra', 'fingerCode'], width: 110, render: editCell('fingerCode', { mono: true }) },
    { title: t('idc.col.phone'), key: 'phone', dataIndex: ['extra', 'phone'], width: 130, render: editCell('phone', { mono: true, placeholder: '09xx…' }) },
    { title: t('idc.col.emergencyPhone'), key: 'emergencyPhone', dataIndex: ['extra', 'emergencyPhone'], width: 150, render: editCell('emergencyPhone', { mono: true, placeholder: '09xx…' }) },
    { title: t('idc.col.position'), key: 'position', dataIndex: ['extra', 'position'], width: 170, render: editCell('position', { options: roleOptions, warn: erpM.badPos }) },
    ...(erpM.useOrg ? [
      { title: t('idc.col.department'), key: 'department', dataIndex: ['extra', 'department'], width: 170, render: orgCell('d') },
      { title: t('idc.col.team'), key: 'team', width: 170, render: orgCell('t') },
      { title: t('idc.col.part'), key: 'part', width: 190, render: orgCell('p') },
    ] as ColumnsType<IdCardRow> : [
      { title: t('idc.col.department'), key: 'department', dataIndex: ['extra', 'department'], width: 260, render: editCell('department', { options: deptOptions, warn: deptWarn }) },
    ] as ColumnsType<IdCardRow>),
    { title: t('idc.col.erpDept'), key: 'erpDept', width: 230, render: (_, r) => {   // bộ phận ERP sẽ ghi khi đồng bộ; đổi ở đây = gán quy đổi cho cả nhóm (như nút Quy đổi ERP)
      const v = editVal(r, 'department')
      if (!v.trim()) return null
      const o = erpM.org.find((x) => erpKey(x.value) === erpKey(v))
      const e = erpM.erpDeptOf(v)
      if (!o) return e ?? <Tag color="warning">{t('idc.col.erpNone')}</Tag>   // tên bộ phận ERP cũ trên thẻ: chính là bộ phận ERP
      return (
        <Tooltip title={t('idc.col.erpGroupHint', { g: o.value })}>
          <Select<number> variant="underlined" size="small" showSearch style={{ width: '100%' }} options={erpDeptOptions} filterOption={foldFilter('label')} popupMatchSelectWidth={380}
            value={e ? erpSeqOf.get(erpKey(e)) : undefined} placeholder={t('idc.col.erpNone')} status={e ? undefined : 'warning'} loading={setGroupErp.isPending}
            onChange={(seq) => setGroupErp.mutate({ value: o.value, seq: seq ?? null })} />
        </Tooltip>
      )
    } },
    { title: t('idc.col.title'), key: 'title', dataIndex: ['extra', 'title'], width: 100, render: editCell('title', { options: erpM.titleOptions }) },
    { title: t('idc.col.factory'), key: 'factory', dataIndex: ['extra', 'factory'], width: 120, render: editCell('factory', { options: Object.values(SITE_FACTORY).map((v) => ({ value: v })) }) },
    { title: t('idc.col.fullName'), dataIndex: 'fullName', width: 190, sorter: (a, b) => a.fullName.localeCompare(b.fullName, 'vi'), render: editCell('fullName') },
    { title: t('idc.col.dob'), dataIndex: 'dob', width: 115, render: editCell('dob', { placeholder: 'dd/mm/yyyy', warn: (v) => !!v.trim() && !toIsoDate(v) }) },
    { title: t('idc.col.gender'), dataIndex: 'gender', width: 85, render: editCell('gender', { options: [{ value: 'Nam', label: t('idc.gender.male') }, { value: 'Nữ', label: t('idc.gender.female') }] }) },
    { title: t('idc.col.ethnicity'), key: 'ethnicity', dataIndex: ['extra', 'ethnicity'], width: 100, render: editCell('ethnicity', { options: ethOptions }) },
    { title: t('idc.col.address'), dataIndex: 'address', width: 260, render: editCell('address') },
    { title: t('idc.col.newAddress'), dataIndex: 'newAddress', width: 260, render: editCell('newAddress') },
    { title: t('idc.col.idNo'), dataIndex: 'idNo', width: 150, render: (v: string) => <Typography.Text copyable style={MONO_STYLE}>{v}</Typography.Text> },
    { title: t('idc.col.oldIdNo'), dataIndex: 'oldIdNo', width: 140, render: (v: string | null) => (v ? <Typography.Text copyable style={MONO_STYLE}>{v}</Typography.Text> : null) },
    { title: t('idc.col.issueDate'), dataIndex: 'issueDate', width: 115, render: editCell('issueDate', { placeholder: 'dd/mm/yyyy', warn: (v) => !!v.trim() && !toIsoDate(v) }) },
    { title: t('idc.col.issuePlace'), key: 'issuePlace', width: 120, render: (_, r) => (r.issueDate ? (r.issueDate >= '2024-07-01' ? t('idc.issuer.mps') : t('idc.issuer.police')) : '') },   // như khi đẩy ERP: cấp từ 01/07/2024 = Bộ Công an
    { title: t('idc.col.tempAddress'), key: 'tempAddress', dataIndex: ['extra', 'tempAddress'], width: 220, render: editCell('tempAddress') },
    { title: t('idc.col.bankName'), key: 'bankName', dataIndex: ['extra', 'bankName'], width: 150, render: editCell('bankName') },
    { title: t('idc.col.bankAccount'), key: 'bankAccount', width: 170, render: editCell('bankAccount', { mono: true }) },
    { title: t('idc.col.referrer'), key: 'referrer', dataIndex: ['extra', 'referrer'], width: 170, render: editCell('referrer') },
    { title: t('idc.col.note'), dataIndex: 'note', width: 160, render: editCell('note') },
    { title: t('idc.col.status'), key: 'job', width: 150, render: (_, r) => (r.job?.noShow
      ? <Tooltip title={[r.job.reason, r.job.at ? dayjs(r.job.at).format('DD/MM/YYYY HH:mm') : '', r.job.by].filter(Boolean).join(' · ')}><Tag color="red">{t('idc.noShow')}</Tag></Tooltip>
      : <Tag>{t('idc.statusActive')}</Tag>) },
    { title: t('idc.col.savedAt'), key: 'at', width: 140, render: (_, r) => <Tooltip title={r.updatedBy ?? r.createdBy}>{dayjs(r.updatedAt ?? r.createdAt).format('DD/MM/YYYY HH:mm')}</Tooltip> },
    {
      title: '', key: 'act', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
        <Tooltip title={t('idc.edit')}><Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditing(r)} /></Tooltip>
        <Tooltip title={t(r.job?.noShow ? 'idc.noShowUndo' : 'idc.noShowMark')}>
          <Button type="text" size="small" icon={r.job?.noShow ? <UndoOutlined /> : <UserDeleteOutlined />}
            onClick={() => (r.job?.noShow ? markNoShow.mutate({ id: r.id, on: false, reason: null }) : setNoShow({ row: r, reason: '' }))} />
        </Tooltip>
        <Popconfirm title={t('idc.deleteAsk', { name: r.fullName })} onConfirm={() => remove.mutate(r.id)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide idc-page">
      <PageBanner avatar={<Avatar size={56} icon={<IdcardOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.idCards')} subtitle={t('nav.idCardsDesc')} />
      {state.data && !state.data.keyReady && <Alert type="error" showIcon message={t('idc.err.key')} />}
      {state.data?.keyReady && !state.data.tableReady && <SqlNotReady title={t('idc.notReady')} onRetry={() => state.refetch()} loading={state.isFetching} />}
      {state.error && <Alert type="error" showIcon message={errText(state.error)} />}
      {ready && (
        <>
          <div className="idc-sites" role="tablist">
            {(['BN', 'HY'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={site === k} className={`idc-site${site === k ? ' on' : ''}`} onClick={() => setSite(k)}>
                <span className="idc-site-code">{k}</span>
                <span className="idc-site-name">{t(k === 'BN' ? 'idc.sheetBN' : 'idc.sheetHY')}</span>
              </button>
            ))}
          </div>

          <Card className="idc-card idc-scan" title={<Space><ScanOutlined />{t('idc.gridTitle')}</Space>}
            extra={
              <Space>
                <Popconfirm title={t('idc.clearAsk')} onConfirm={() => { releaseRows(rows.map((x) => x.key).reverse()); setRows(() => []) }} disabled={!dirty}><Button icon={<ClearOutlined />} disabled={!dirty}>{t('idc.clear')}</Button></Popconfirm>
                <Button type="primary" icon={<SaveOutlined />} disabled={processing || filled.length === 0 || invalid > 0 || dupInGrid.size > 0} loading={save.isPending} onClick={() => save.mutate(filled)}>
                  {t('idc.save', { n: filled.length })}
                </Button>
              </Space>
            }
          >
            <IdCardScanBox key={site} inputRef={scanRef} processing={processing} onScan={addScan} placeholder={t('idc.scanPlaceholder')} ready={t('idc.readyScan')}
              scanning={t('idc.scanning')} scanningSub={t('idc.scanningSub')} />

            <div className="idc-stats">
              <span className="idc-stat ok"><b>{filled.length}</b>{t('idc.statReady')}</span>
              <span className="idc-stat"><b>{pendingIds}</b>{t('idc.statWait')}</span>
              <span className={`idc-stat${invalid > 0 ? ' bad' : ''}`}><b>{invalid}</b>{t('idc.statErr')}</span>
              <details className="idc-help"><summary>{t('idc.helpTitle')}</summary><p>{t('idc.hint')}</p></details>
            </div>

            <div className="idc-preset idc-preset-strong" style={{ display: 'block', padding: 0, overflow: 'hidden', background: 'var(--ant-color-bg-container, #fff)', border: '1.5px solid var(--ant-color-primary-border, #95de64)', boxShadow: '0 2px 10px -4px rgba(15,23,42,.18)' }}>
              {/* Đầu khung: tiêu đề + tóm tắt lựa chọn sẽ áp cho thẻ quét tiếp theo */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', padding: '10px 14px', borderBottom: '1px solid var(--ant-color-primary-border, #95de64)', background: 'var(--ant-color-primary-bg, #f0f9eb)' }}>
                <Typography.Text strong style={{ fontSize: 15, color: 'var(--ant-color-primary-text, #237804)' }}>{t('idc.pickTitle')}</Typography.Text>
                <span style={{ flex: '1 1 260px', minWidth: 0, display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  {erpM.useOrg && oDept
                    ? <>
                        <Typography.Text strong ellipsis style={{ maxWidth: '100%', fontSize: 14 }}>{[oDept, oTeam, oPart].filter((x, k, a) => x && (k === 0 || erpKey(x) !== erpKey(a[k - 1]))).join('  ›  ')}</Typography.Text>
                        {pick.title && <Tag color="blue" style={{ marginInlineEnd: 0 }}>{pick.title}</Tag>}
                        {pickIncomplete && <Tag color="warning" style={{ marginInlineEnd: 0 }}>{t('idc.pre.needTeam')}</Tag>}
                      </>
                    : <Typography.Text type="secondary">{erpM.useOrg ? t('idc.pre.none') : (pick.department || t('idc.pre.none'))}</Typography.Text>}
                </span>
                {(pick.department || oDept || pick.title || pick.position || pick.group) && (
                  <Button size="small" type="text" icon={<ClearOutlined />} onClick={() => setPick({ department: '', oDept: '', oTeam: '', oPart: '', title: '', position: '', group: '' })}>{t('idc.pre.clear')}</Button>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {/* Trái: vị trí trên màn nhân sự CMS */}
                <div style={{ flex: '3 1 520px', minWidth: 0, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Typography.Text style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--ant-color-primary-text, #237804)' }}>{t('idc.pre.hr')}</Typography.Text>
                  {erpM.useOrg ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                      <div className="idc-field" style={{ width: 'auto' }}>
                        <label style={PRESET_LABEL} htmlFor="idc-pre-dept">1 · {t('idc.col.department')}</label>
                        <Select id="idc-pre-dept" style={{ width: '100%' }} showSearch allowClear value={oDept || undefined} options={pickDepts} placeholder={t('idc.col.department')} popupMatchSelectWidth={300}
                          filterOption={foldFilter()} onChange={(v?: string) => setOrgPick(v ?? '', '', '')} />
                      </div>
                      <div className="idc-field" style={{ width: 'auto' }}>
                        <label style={PRESET_LABEL} htmlFor="idc-pre-team">2 · {t('idc.col.team')}</label>
                        <Select id="idc-pre-team" style={{ width: '100%' }} showSearch allowClear value={oTeam || undefined} options={pickTeams} placeholder={oDept && !pickTeams.length ? '—' : t('idc.col.team')} popupMatchSelectWidth={300}
                          disabled={!oDept || !pickTeams.length} status={pickIncomplete && !oTeam ? 'warning' : undefined}
                          filterOption={foldFilter()} onChange={(v?: string) => setOrgPick(oDept, v ?? '', '')} />
                      </div>
                      <div className="idc-field" style={{ width: 'auto' }}>
                        <label style={PRESET_LABEL} htmlFor="idc-pre-part">3 · {t('idc.col.part')}</label>
                        <Select id="idc-pre-part" style={{ width: '100%' }} showSearch allowClear value={oPart || undefined} options={pickParts} placeholder={oTeam && !pickParts.length ? '—' : t('idc.col.part')} popupMatchSelectWidth={300}
                          disabled={!oTeam || !pickParts.length} filterOption={foldFilter()} onChange={(v?: string) => setOrgPick(oDept, oTeam, v ?? '')} />
                      </div>
                    </div>
                  ) : (
                    <div className="idc-field" style={{ width: '100%', maxWidth: 420 }}>
                      <label style={PRESET_LABEL}>{t('idc.col.department')}</label>
                      <AutoComplete style={{ width: '100%' }} value={pick.department} options={deptOptions} allowClear placeholder={t('idc.col.department')} popupMatchSelectWidth={420}
                        status={deptWarn(pick.department) ? 'warning' : undefined} filterOption={foldFilter()} onChange={(v: string) => setPick({ department: v ?? '' })} />
                    </div>
                  )}
                  {erpM.useOrg && (
                    <div className="idc-field" style={{ width: 'auto' }}>
                      <label style={PRESET_LABEL} htmlFor="idc-pre-title">4 · {t('idc.col.title')}</label>
                      <Space wrap size={8}>
                        <Segmented aria-label={t('idc.col.title')} value={['OP', 'Staff', 'AM', 'M'].includes(pick.title) ? pick.title : ''} onChange={(v) => setPick({ title: String(v) })}
                          options={[{ value: '', label: '—' }, ...['OP', 'Staff', 'AM', 'M'].map((v) => ({ value: v, label: v }))]} />
                        <AutoComplete id="idc-pre-title" aria-label={t('idc.pre.other')} style={{ width: 160 }} allowClear placeholder={t('idc.pre.other')} options={erpM.titleOptions.filter((o) => !['OP', 'Staff', 'AM', 'M'].includes(o.value))}
                          value={['OP', 'Staff', 'AM', 'M'].includes(pick.title) ? '' : pick.title} filterOption={foldFilter()} onChange={(v: string) => setPick({ title: v ?? '' })} />
                      </Space>
                    </div>
                  )}
                </div>

                {/* Phải: những gì ghi sang ERP */}
                <div style={{ flex: '2 1 300px', minWidth: 0, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderInlineStart: '1px solid var(--idc-line)', background: 'var(--ant-color-fill-quaternary, #fafafa)' }}>
                  <Typography.Text style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--ant-color-primary-text, #237804)' }}>{t('idc.pre.erp')}</Typography.Text>
                  <div className="idc-field" style={{ width: 'auto' }}>
                    <label style={PRESET_LABEL}>{t('idc.col.erpDept')}</label>
                    <div style={{ minHeight: 32, display: 'flex', alignItems: 'center' }}>
                      {!pick.department ? <Typography.Text type="secondary">{pickIncomplete ? t('idc.pre.needTeam') : '—'}</Typography.Text>
                        : erpM.erpDeptOf(pick.department) ? <Tag color="green" style={{ fontSize: 13, padding: '3px 10px' }}>{erpM.erpDeptOf(pick.department)}</Tag>
                        : <Tag color="warning" style={{ fontSize: 13, padding: '3px 10px' }}>{t('idc.col.erpNone')}</Tag>}
                    </div>
                  </div>
                  <div className="idc-field" style={{ width: 'auto' }}>
                    <label style={PRESET_LABEL} htmlFor="idc-pre-pos">{t('idc.col.position')}</label>
                    <AutoComplete id="idc-pre-pos" style={{ width: '100%' }} value={pick.position} options={roleOptions} allowClear placeholder={t('idc.col.position')} popupMatchSelectWidth={320}
                      filterOption={foldFilter()} status={erpM.badPos(pick.position) ? 'warning' : undefined} onChange={(v: string) => setPick({ position: v ?? '' })} />
                  </div>
                  {!erpMode && (
                    <div className="idc-field" style={{ width: 'auto' }}>
                      <label style={PRESET_LABEL} htmlFor="idc-pre-group">{t('idc.col.codeGroup')}</label>
                      <Select id="idc-pre-group" style={{ width: '100%' }} allowClear placeholder={t('idc.codeGroupAuto')} value={pick.group || undefined} popupMatchSelectWidth={320}
                        options={(codeCfg.data?.groups ?? []).map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` }))} onChange={(v?: string) => setPick({ group: v ?? '' })} />
                    </div>
                  )}
                </div>
              </div>
              <div className="idc-preset-note" style={{ padding: '8px 14px', borderTop: '1px solid var(--idc-line)', color: 'var(--ant-color-text-secondary, #555)' }}>{erpMode ? t('idc.pickHintErp') : t('idc.pickHint')}</div>
            </div>

            {invalid > 0 && <Alert style={{ marginTop: 12 }} type="warning" showIcon message={t('idc.invalidRows', { n: invalid })} />}
              <Table<IdCardDraft>
                style={{ marginTop: 12 }} className="idc-grid" size="small" bordered rowKey="key" pagination={false} dataSource={rows} columns={gridCols}
                rowClassName={(_, i) => (i === target ? 'idc-target' : '')} scroll={{ x: 3450, y: 480 }}
              />
          </Card>

          <Card className="idc-card" title={<Space>{t('idc.listTitle')}<Tag color="blue">{site}</Tag>{!!list.data?.length && <span className="idc-count">{t('idc.total', { n: list.data.length })}</span>}</Space>}>
              <Space wrap className="idc-toolbar" size={[8, 8]}>
                <Segmented value={status} onChange={(v) => setStatus(String(v))} options={[{ value: '', label: t('idc.statusAll') }, { value: 'active', label: t('idc.statusActive') }, { value: 'noshow', label: t('idc.noShow') }]} />
                <DatePicker.RangePicker allowClear value={range} onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)} format="DD/MM/YYYY" placeholder={[t('idc.enteredFrom'), t('idc.enteredTo')]} presets={[
                  { label: t('idc.today'), value: [dayjs(), dayjs()] }, { label: t('idc.last7'), value: [dayjs().subtract(6, 'day'), dayjs()] }, { label: t('idc.thisMonth'), value: [dayjs().startOf('month'), dayjs()] }]} />
                <SearchBox allowClear placeholder={t('idc.searchPlaceholder')} value={search} onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setQ('') }} onSearch={(v) => setQ(v.trim())} style={{ width: 300 }} />
                <Button icon={<ReloadOutlined />} onClick={() => list.refetch()} loading={list.isFetching} />
                <Button icon={<FileExcelOutlined />} disabled={!list.data?.length} loading={exportXlsx.isPending} onClick={() => setExportOpen(true)}>{t('idc.export')}</Button>
                <Button icon={<PictureOutlined />} disabled={!list.data?.some((r) => r.photoUrl)} loading={exportPhotos.isPending} onClick={() => exportPhotos.mutate()}>{t('idc.exportPhotoZip')}</Button>
                <Button icon={<CloudUploadOutlined />} disabled={!list.data?.length} onClick={() => setErpOpen(true)}>{t('idcErp.button')}</Button>
                <Button onClick={() => setMapOpen(true)}>{t('idcMap.button')}</Button>
                <Button type="primary" icon={<SaveOutlined />} disabled={!editCount} loading={savingEdits} onClick={saveEdits}>{t('idc.listSave', { n: editCount })}</Button>
                {editCount > 0 && <Button icon={<UndoOutlined />} disabled={savingEdits} onClick={() => { setEdits({}); setOrgDraft({}) }}>{t('idc.listUndo')}</Button>}
              </Space>
            <IdCardErpModal open={erpOpen} ids={(list.data ?? []).map((r) => r.id)} onClose={() => setErpOpen(false)} />
            <IdCardOrgMapModal open={mapOpen} onClose={() => setMapOpen(false)} />
            <IdCardExportModal open={exportOpen} count={list.data?.length ?? 0} loading={exportXlsx.isPending} onClose={() => setExportOpen(false)} onExport={(columns, photos) => exportXlsx.mutate({ columns, photos })} />
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, margin: '6px 0' }}>{t('idc.cc.hint')}</Typography.Text>
            {cc.menu}
            <FilterTable<IdCardRow> size="small" rowKey="id" loading={list.isLoading} dataSource={list.data ?? []} columns={cc.decorate(listCols)} scroll={{ x: 3900 }}
              pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (n) => t('idc.total', { n }) }} />
            {list.error && <Alert style={{ marginTop: 12 }} type="error" showIcon message={errText(list.error)} />}
            <AppModal open={!!assigned} onClose={() => setAssigned(null)} size="sm" icon={<CheckCircleOutlined />} title={t('idc.assignedTitle', { n: assigned?.length ?? 0 })}
              footer={<Button type="primary" onClick={() => setAssigned(null)}>{t('idc.close')}</Button>}>
              <Typography.Paragraph type="secondary">{t('idc.assignedHint')}</Typography.Paragraph>
              <Table size="small" rowKey="code" pagination={false} dataSource={assigned ?? []} scroll={{ y: 320 }} columns={[
                { title: t('idc.col.employeeId'), dataIndex: 'code', width: 130, render: (v: string) => <Typography.Text strong copyable style={MONO_STYLE}>{v}</Typography.Text> },
                { title: t('idc.col.fullName'), dataIndex: 'name' }]} />
            </AppModal>
            <IdCardEditModal row={editing} saving={update.isPending} onClose={() => setEditing(null)} onSave={(item) => editing && update.mutate({ id: editing.id, item })} />
            <AppModal open={!!noShow} onClose={() => setNoShow(null)} size="sm" icon={<UserDeleteOutlined />} title={t('idc.noShowTitle', { name: noShow?.row.fullName ?? '' })}
              onOk={() => noShow && markNoShow.mutate({ id: noShow.row.id, on: true, reason: noShow.reason.trim() || null })} okText={t('idc.noShowMark')} cancelText={t('idc.cancel')} okLoading={markNoShow.isPending} danger>
              <Input.TextArea autoFocus maxLength={200} showCount rows={3} placeholder={t('idc.noShowReason')} value={noShow?.reason ?? ''} onChange={(e) => setNoShow((p) => (p ? { ...p, reason: e.target.value } : p))} />
            </AppModal>
          </Card>
        </>
      )}
    </div>
  )
}
