import { useState, type ReactNode } from 'react'
import { Alert, Avatar, Button, Card, DatePicker, Empty, Skeleton, Space, Table as PlainTable, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ContainerOutlined, DollarOutlined, EnvironmentOutlined, FileSearchOutlined, FileExcelOutlined, ProfileOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { customs, customsError, type CustomsDeclaration, type CustomsRow, type HangHoa } from '../../api/customs'
import { FilterTable as Table } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { FilterBar, FilterRow, PillFilter } from '../../components/FilterBar'
import { SearchBox } from '../../components/SearchBox'
import { useToast } from '../../hooks/useToast'
import { AppModal } from '../../components/AppModal'
import { StatTiles } from '../../components/StatTiles'
import { ErpPushButtons, ErpSyncPanel } from './ErpPush'

type Loai = 'all' | 'N' | 'X'

const num = (v: number | null | undefined, lang: string) => (v == null ? '' : v.toLocaleString(lang, { maximumFractionDigits: 6 }))
const day = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '')
/**
 * ECUS ghi tên hàng dạng "<mã hàng>#&<tên hàng>#&<nước xuất xứ>", vd. "C10106-01#&Siêu tụ điện, điện dung 10F, WEC3R0106QG-B060R(1030)#&VN".
 * Tách thành mã hàng (trước "#&" đầu tiên) và tên hàng (giữa), bỏ đuôi "#&VN" vì nước xuất xứ đã có cột riêng.
 */
function splitGoodsName(raw: string | null | undefined): { code: string; name: string } {
  const s = raw ?? ''
  const i = s.indexOf('#&')
  if (i < 0) return { code: '', name: s.trim() }
  return { code: s.slice(0, i).trim(), name: s.slice(i + 2).replace(/\s*#&[A-Za-z]{2}\s*$/, '').trim() }
}

const dash = (v: ReactNode) => (v === null || v === undefined || v === '' ? <span className="cell-muted">—</span> : v)

/** Màu phân luồng ECUS: Xanh / Vàng / Đỏ (ECUS ghi tiếng Việt không dấu hoặc mã 1 / 2 / 3). */
function LaneTag({ value }: { value: string | null }) {
  const { t } = useTranslation()
  if (!value) return <span className="cell-muted">—</span>
  const v = value.toLowerCase()
  const lane = v.startsWith('x') || v === '1' ? 'green' : v.startsWith('v') || v === '2' ? 'gold' : v.startsWith('d') || v.startsWith('đ') || v === '3' ? 'red' : null
  if (!lane) return <Tag>{value}</Tag>
  return <Tag color={lane === 'green' ? 'success' : lane === 'gold' ? 'warning' : 'error'} variant="filled">{t(`cus.lane.${lane}`)}</Tag>
}

function LoaiTag({ value }: { value: string | null }) {
  const { t } = useTranslation()
  if (value === 'N') return <Tag color="blue" variant="filled">{t('cus.import')}</Tag>
  if (value === 'X') return <Tag color="purple" variant="filled">{t('cus.export')}</Tag>
  return <span className="cell-muted">{value || '—'}</span>
}

/** Một ô thông tin: nhãn nhỏ trên, giá trị dưới; trống thì gạch mờ. wide = trải hết hàng; strong = giá trị đậm. */
function Field({ label, children, wide, strong }: { label: string; children: ReactNode; wide?: boolean; strong?: boolean }) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className={`cus-field${wide ? ' wide' : ''}`}>
      <span className="cf-label">{label}</span>
      <span className={`cf-value${strong ? ' strong' : ''}${empty ? ' empty' : ''}`}>{empty ? '—' : children}</span>
    </div>
  )
}

/** Khối thông tin: đầu khối có icon màu + tiêu đề, thân là lưới các ô. */
function Section({ icon, tone, title, extra, children, flush }: { icon: ReactNode; tone: string; title: ReactNode; extra?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="cus-card" style={{ ['--tone' as string]: tone } as React.CSSProperties}>
      <header className="cus-card-head"><span className="cc-icon">{icon}</span><span className="cc-title">{title}</span>{extra && <span className="cc-extra">{extra}</span>}</header>
      <div className={flush ? 'cus-card-body flush' : 'cus-card-body'}>{children}</div>
    </section>
  )
}

/** Thẻ doanh nghiệp / đối tác: chữ cái đầu, vai trò, tên, mã, địa chỉ từng dòng. */
function PartyCard({ role, tone, name, code, codeLabel, lines, country }: { role: string; tone: string; name: string; code?: string | null; codeLabel?: string; lines: string[]; country?: string | null }) {
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-zÀ-ỹ]/.test(w) && !/^(CO|LTD|CONG|TY|TNHH|JSC|INC)\.?,?$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  return (
    <div className="cus-party" style={{ ['--tone' as string]: tone } as React.CSSProperties}>
      <div className="cp-avatar" aria-hidden>{initials}</div>
      <div className="cp-main">
        <div className="cp-role">{role}{country && <span className="cp-country">{country}</span>}</div>
        <div className="cp-name" title={name}>{name || '—'}</div>
        {code && <div className="cp-code"><span>{codeLabel}</span>{code}</div>}
        {lines.length > 0 && <div className="cp-addr"><EnvironmentOutlined />{lines.join(', ')}</div>}
      </div>
    </div>
  )
}

/** Chi tiết một tờ khai (modal chuẩn AppModal): thanh trạng thái + nút ERP, ô tổng tiền, các nhóm thông tin, danh sách hàng. */
function DetailModal({ soToKhai, onClose }: { soToKhai: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const q = useQuery({ queryKey: ['customs', 'detail', soToKhai], queryFn: () => customs.get(soToKhai!), enabled: !!soToKhai, retry: false })
  const d: CustomsDeclaration | undefined = q.data
  const n = (v: number | null | undefined) => num(v, i18n.language)
  const join = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(' · ')
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString(i18n.language, { maximumFractionDigits: 4 })}%`)
  const goodsCols: ColumnsType<HangHoa> = [
    { title: '#', dataIndex: 'soDong', width: 44 },
    { title: t('cus.goodsCode'), width: 130, render: (_: unknown, r) => {
      const { code } = splitGoodsName(r.tenHang)
      const main = r.maNplSp || code
      return <div><b>{main || '—'}</b>{r.maHang && r.maHang !== main && <div className="cell-muted">{r.maHang}</div>}</div>
    } },
    { title: t('cus.goodsName'), render: (_: unknown, r) => splitGoodsName(r.tenHang).name || '—' },
    { title: t('cus.hs'), dataIndex: 'maHS', width: 96 },
    { title: t('cus.origin'), width: 72, render: (_: unknown, r) => r.maNuocXuatXu || '—' },
    { title: t('cus.qty'), width: 120, align: 'right', render: (_: unknown, r) => `${n(r.soLuong)} ${r.donViTinh ?? ''}` },
    { title: t('cus.unitPrice'), width: 110, align: 'right', render: (_: unknown, r) => `${n(r.donGiaHoaDon)} ${r.maTienTeDonGia ?? ''}` },
    { title: t('cus.invoiceValue'), width: 120, align: 'right', render: (_: unknown, r) => n(r.triGiaHoaDon) },
    { title: t('cus.taxValue'), width: 130, align: 'right', render: (_: unknown, r) => n(r.triGiaTinhThue) },
    { title: t('cus.tariff'), dataIndex: 'maBieuThueNhapKhau', width: 80 },
    { title: t('cus.erp.taxRates'), children: [
      { title: t('cus.erp.excise'), dataIndex: 'tsTtdb', width: 72, align: 'right', render: (v: number | null) => pct(v) },
      { title: t('cus.erp.env'), dataIndex: 'tsBvmt', width: 72, align: 'right', render: (v: number | null) => pct(v) },
      { title: 'VAT', dataIndex: 'tsVat', width: 72, align: 'right', render: (v: number | null) => pct(v) },
      { title: t('cus.erp.import'), dataIndex: 'tsXnk', width: 72, align: 'right', render: (v: number | null) => pct(v) },
    ] },
    { title: t('cus.taxAmounts'), children: [
      { title: t('cus.erp.import'), dataIndex: 'thueXnk', width: 110, align: 'right', render: (v: number | null) => n(v) },
      { title: 'VAT', dataIndex: 'thueVat', width: 110, align: 'right', render: (v: number | null) => n(v) },
    ] },
  ]
  const tk = d?.toKhai
  const c = tk?.thongTinChung
  return (
    <AppModal open={!!soToKhai} onClose={onClose} size="full" icon={<FileSearchOutlined />}
      title={`${t('cus.detailTitle')} ${soToKhai ?? ''}`}
      subtitle={c ? join(day(c.ngayDangKy), c.maHaiQuan && `${c.maHaiQuan}${c.tenHaiQuan ? ` – ${c.tenHaiQuan}` : ''}`) : undefined}>
      {q.isLoading && <Skeleton active />}
      {q.isError && <Alert type="error" showIcon title={t('cus.err.load')} />}
      {tk && c && d && (
        <div className="cus-detail">
          <div className="rec-toolbar">
            <LoaiTag value={c.loai} />
            {c.maLoaiHinh && <Tag>{c.maLoaiHinh}</Tag>}
            <LaneTag value={c.phanLuong} />
            <span className="cus-toolbar-actions"><ErpPushButtons target={c.loai === 'N' || c.loai === 'X' ? { kind: c.loai === 'N' ? 'import' : 'export', soToKhai: c.soToKhai } : null} /></span>
          </div>

          <StatTiles items={[
            { label: t('cus.invoiceTotal'), value: n(tk.hoaDon.tongTriGia) || '—', unit: tk.hoaDon.maTienTe ?? undefined, color: '#2F6FB0' },
            { label: t('cus.taxBase'), value: n(d.tongCong?.tongTriGiaTinhThue) || '—', color: '#7A5AF8' },
            { label: t('cus.taxTotal'), value: n(d.tongCong?.tongTienThue) || '0', color: '#D48806' },
            { label: t('cus.secGoods'), value: d.hangHoa.length, unit: t('cus.lines'), color: '#2E9E4F' },
          ]} />

          <div className="cus-grid-2">
            <PartyCard role={t('cus.importer')} tone="#2F6FB0" name={tk.nguoiNhapKhau.ten.join(' ')} code={tk.nguoiNhapKhau.ma} codeLabel={t('cus.taxCode')}
              lines={[tk.nguoiNhapKhau.diaChi, tk.nguoiNhapKhau.dienThoai].filter((x): x is string => !!x)} />
            <PartyCard role={t('cus.exporter')} tone="#7A5AF8" name={tk.nguoiXuatKhau.ten.join(' ')} lines={tk.nguoiXuatKhau.diaChi} country={tk.nguoiXuatKhau.maNuoc} />
          </div>

          <div className="cus-grid-3">
            <Section icon={<ProfileOutlined />} tone="#2F6FB0" title={t('cus.secGeneral')}>
              <Field label={t('cus.number')} strong>{c.soToKhai}</Field>
              <Field label={t('cus.date')}>{day(c.ngayDangKy)}</Field>
              <Field label={t('cus.office')} wide>{join(c.maHaiQuan, c.tenHaiQuan)}</Field>
              <Field label={t('cus.firstNumber')}>{c.soToKhaiDauTien}</Field>
              <Field label={t('cus.tempNumber')}>{c.soToKhaiTamNhapTaiXuat}</Field>
              <Field label={t('cus.transport')}>{c.maPhuongThucVanChuyen}</Field>
              <Field label={t('cus.declarant')}>{join(tk.nguoiKhaiHaiQuan.ma, tk.nguoiKhaiHaiQuan.ten)}</Field>
            </Section>
            <Section icon={<DollarOutlined />} tone="#D48806" title={t('cus.secInvoice')}>
              <Field label={t('cus.invoice')} strong wide>{tk.hoaDon.soHoaDon}</Field>
              <Field label={t('cus.invoiceDate')}>{day(tk.hoaDon.ngayPhatHanh)}</Field>
              <Field label={t('cus.terms')}>{join(tk.hoaDon.dieuKienGiaoHang, tk.hoaDon.phuongThucThanhToan)}</Field>
              <Field label={t('cus.freight')}>{tk.khaiTriGia.phiVanChuyen ? `${n(tk.khaiTriGia.phiVanChuyen.triGia)} ${tk.khaiTriGia.phiVanChuyen.maTienTe ?? ''}` : ''}</Field>
              <Field label={t('cus.declaredRate')}>{(c.tyGia ?? []).map((r) => `${r.maTienTe ?? ''} ${n(r.tyGia)}`.trim()).join(' · ')}</Field>
              <Field label={t('cus.insurance')}>{tk.khaiTriGia.phiBaoHiem ? `${n(tk.khaiTriGia.phiBaoHiem.triGia)} ${tk.khaiTriGia.phiBaoHiem.maTienTe ?? ''}` : ''}</Field>
              <Field label={t('cus.valuation')}>{tk.khaiTriGia.maPhanLoai}</Field>
              <Field label={t('cus.taxDeadline')}>{tk.thue.maXacDinhThoiHanNop}</Field>
            </Section>
            <Section icon={<ContainerOutlined />} tone="#2E9E4F" title={t('cus.secShipping')}>
              <Field label={t('cus.bill')} strong wide>{tk.vanDon.danhSach.map((v) => join(v.so, day(v.ngay))).join('; ')}</Field>
              <Field label={t('cus.packages')}>{tk.vanDon.soLuongKien == null ? '' : `${n(tk.vanDon.soLuongKien)} ${tk.vanDon.donViKien ?? ''}`}</Field>
              <Field label={t('cus.weight')}>{tk.vanDon.tongTrongLuong == null ? '' : `${n(tk.vanDon.tongTrongLuong)} ${tk.vanDon.donViTrongLuong ?? ''}`}</Field>
              <Field label="MAWB">{tk.vanDon.soMawb.join(', ')}</Field>
              <Field label={t('cus.contract')}>{join(tk.hopDong.so, day(tk.hopDong.ngay))}</Field>
              <Field label={t('cus.licences')} wide>{[...tk.vanBanGiayPhep.maVanBanPhapQuy, ...tk.vanBanGiayPhep.giayPhep.map((g) => [g.ma, g.so].filter(Boolean).join(' '))].join(', ')}</Field>
            </Section>
          </div>

          <Section icon={<UnorderedListOutlined />} tone="#475467" title={t('cus.secGoods')} extra={<Tag variant="filled">{d.hangHoa.length} {t('cus.lines')}</Tag>} flush>
            <PlainTable<HangHoa> size="small" rowKey="soDong" columns={goodsCols} dataSource={d.hangHoa} pagination={d.hangHoa.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 1500 }} bordered />
          </Section>
        </div>
      )}
    </AppModal>
  )
}

/** Tra cứu tờ khai hải quan đọc từ phần mềm ECUS: lọc theo ngày đăng ký, nhập / xuất, từ khoá; xem chi tiết và xuất Excel. Chỉ đọc. */
export default function CustomsDeclarationsPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [loai, setLoai] = useState<Loai>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [open, setOpen] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), loai: loai === 'all' ? undefined : loai, q: search }

  const status = useQuery({ queryKey: ['customs', 'status'], queryFn: customs.status, staleTime: 300_000 })
  const maxDays = status.data?.maxRangeDays ?? 92
  const tooLong = range[1].diff(range[0], 'day') + 1 > maxDays
  const ready = !!status.data?.configured && !tooLong
  const list = useQuery({ queryKey: ['customs', 'list', params, page, pageSize], queryFn: () => customs.list({ ...params, page, pageSize }), enabled: ready, retry: false, placeholderData: (p) => p })
  const listErr = useQuery({ queryKey: ['customs', 'list-err', list.errorUpdatedAt], queryFn: () => customsError(list.error), enabled: list.isError })

  const doExport = async () => {
    setExporting(true)
    try { await customs.exportExcel(params) }
    catch (e) {
      const { code, detail } = await customsError(e)
      toast.error(code === 'too_many' ? t('cus.err.tooMany', { count: Number(detail) || 0, max: status.data?.maxExport ?? 3000 }) : t('cus.err.export'))
    }
    finally { setExporting(false) }
  }

  const n = (v: number | null | undefined) => num(v, i18n.language)
  const columns: ColumnsType<CustomsRow> = [
    { title: t('cus.number'), dataIndex: 'soToKhai', width: 140, fixed: 'left', render: (v: string) => <a onClick={() => setOpen(v)}><b>{v}</b></a> },
    { title: t('cus.date'), dataIndex: 'ngayDangKy', width: 105, render: (v: string | null) => day(v) },
    { title: t('cus.kind'), width: 130, render: (_: unknown, r) => <Space size={4}><LoaiTag value={r.loai} /><span>{r.maLoaiHinh}</span></Space> },
    { title: t('cus.lane.title'), dataIndex: 'phanLuong', width: 90, render: (v: string | null) => <LaneTag value={v} /> },
    { title: t('cus.partner'), render: (_: unknown, r) => <div>{dash(r.nguoiXuatKhau)}{r.nuocXuatKhau && <span className="cell-muted"> · {r.nuocXuatKhau}</span>}</div> },   // ECUS: MA_DV / TEN_DV là công ty mình, DV_DT là đối tác (cả nhập lẫn xuất)
    { title: t('cus.invoice'), dataIndex: 'soHoaDon', width: 140, render: (v: string | null) => dash(v) },
    { title: t('cus.bill'), dataIndex: 'vanDon', width: 150, render: (v: string | null) => dash(v) },
    { title: t('cus.invoiceTotal'), width: 150, align: 'right', render: (_: unknown, r) => (r.tongTriGiaHoaDon == null ? '' : `${n(r.tongTriGiaHoaDon)} ${r.maTienTe ?? ''}`) },
    { title: t('cus.taxTotal'), dataIndex: 'tongTienThue', width: 130, align: 'right', render: (v: number | null) => n(v) },
    { title: t('cus.office'), width: 160, render: (_: unknown, r) => <span title={r.tenHaiQuan ?? ''}>{r.maHaiQuan}{r.tenHaiQuan ? <div className="cell-muted">{r.tenHaiQuan}</div> : null}</span> },
  ]

  const reset = () => setPage(1)
  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<FileSearchOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.customsDeclarations')} subtitle={t('nav.customsDeclarationsDesc')} />
      {status.data && !status.data.configured && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={t('cus.notConfigured')} />}
      <Card size="small" style={{ margin: '12px 0' }}>
        <FilterBar>
          <FilterRow kind="status">
            <PillFilter value={loai} onChange={(k) => { setLoai(k); reset() }}
              options={[{ key: 'all', label: t('cus.all'), tone: '#475467' }, { key: 'N', label: t('cus.import'), tone: '#2F6FB0' }, { key: 'X', label: t('cus.export'), tone: '#7A5AF8' }]} />
          </FilterRow>
          <FilterRow kind="find">
            <DatePicker.RangePicker allowClear={false} format="DD/MM/YYYY" value={range} onChange={(v) => { if (v && v[0] && v[1]) { setRange([v[0], v[1]]); reset() } }} />
            <SearchBox allowClear style={{ width: 300 }} placeholder={t('cus.searchPh')} onSearch={(v) => { setSearch(v); reset() }} />
            <Button icon={<ReloadOutlined />} onClick={() => list.refetch()} loading={list.isFetching} disabled={!ready}>{t('org.recheck')}</Button>
            <Button icon={<FileExcelOutlined />} onClick={doExport} loading={exporting} disabled={!ready || !list.data?.total}>{t('cus.exportExcel')}</Button>
            <ErpPushButtons target={loai === 'all' ? null : { kind: loai === 'N' ? 'import' : 'export', from: params.from, to: params.to }}
              disabledReason={loai === 'all' ? t('cus.erp.pickKind') : range[1].diff(range[0], 'day') + 1 > 31 ? t('cus.erp.range31') : search.trim() ? t('cus.erp.noKeyword') : null} />
          </FilterRow>
        </FilterBar>
      </Card>
      <ErpSyncPanel />
      {tooLong && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('cus.err.range', { days: maxDays })} />}
      {list.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={listErr.data?.code === 'ecus_unavailable' ? t('cus.err.unavailable') : t('cus.err.load')} />}
      <Card size="small" title={list.data ? t('cus.found', { count: list.data.total }) : t('nav.customsDeclarations')}>
        {status.data && !status.data.configured ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
          <Table<CustomsRow> size="small" rowKey="soToKhai" loading={list.isFetching} columns={columns} dataSource={list.data?.rows ?? []} scroll={{ x: 1400 }}
            onRow={(r) => ({ onDoubleClick: () => setOpen(r.soToKhai) })}
            pagination={{ current: page, pageSize, total: list.data?.total ?? 0, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200], onChange: (p, s) => { setPage(s !== pageSize ? 1 : p); setPageSize(s) } }} />
        )}
      </Card>
      <DetailModal soToKhai={open} onClose={() => setOpen(null)} />
    </div>
  )
}
