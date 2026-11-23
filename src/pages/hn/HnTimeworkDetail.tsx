import type { ReactNode } from 'react'
import { CalendarOutlined, ClockCircleOutlined, FieldTimeOutlined, MoreOutlined, ScheduleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { HnRow } from '../../api/hn'
import { useHnLabel } from '../../hooks/useHnLabel'
import { cell, fmtCell, isEmptyCell } from '../../utils/hnFormat'

/*
 * 2026-11-24 [Truong] - HN timework: one period laid out like the old system's "Bảng chấm công tháng" (rendered full page by HnTimeworkSheetPage)
 * (employee header table, then Work days / Leave on the left, Overtime official / probation / Other on the right). Every item is shown, "-" when empty.
 */

type Tone = 'work' | 'leave' | 'ot' | 'plain'
interface Item { col: string; short?: string; strong?: boolean }
interface Card { key: string; icon: ReactNode; tone: Tone; items: Item[]; /** Chỉ hiện khi có số liệu (hệ thống cũ không có, nhưng nguồn vẫn có dữ liệu) */ extra?: string[] }

const OT = (p: 'ct' | 'tv'): Item[] => ['150', '200', '210', '300', '390'].map((n) => ({ col: `lamthem${p}${n}`, short: `${n}%` }))

const LEFT: Card[] = [
  {
    key: 'work', icon: <CalendarOutlined />, tone: 'work',
    items: [{ col: 'giocongcttvwfh' }, { col: 'giocongcadem130' }, { col: 'thuvieccangay' }, { col: 'thuvieccadem' }, { col: 'tonggiocongtinhluong', strong: true }],
  },
  {
    key: 'leave', icon: <ScheduleOutlined />, tone: 'leave',
    items: [
      { col: 'gionghiphep' }, { col: 'nghihuongluong50tiv' }, { col: 'nghihuong70tongct' }, { col: 'gionghikhongluong' },
      { col: 'tongnghikhongluong' }, { col: 'pheptontinhdenthang' }, { col: 'truphep' }, { col: 'nghihieule' },
      { col: 'nghichedobhxh' }, { col: 'giopheptondauky' }, { col: 'giophepconlai', strong: true }, { col: 'truphepthangnay' },
    ],
    extra: ['nghihuongluongtv70', 'nghihuong50tiv', 'nghihieuletv', 'nghibu100'],
  },
]
const RIGHT: Card[] = [
  { key: 'otCt', icon: <FieldTimeOutlined />, tone: 'ot', items: OT('ct') },
  { key: 'otTv', icon: <ClockCircleOutlined />, tone: 'ot', items: OT('tv') },
  { key: 'other', icon: <MoreOutlined />, tone: 'plain', items: [{ col: 'sb' }, { col: 'fp' }], extra: ['tonggiolamthemot', 'kyten'] },
]
const HEAD = ['hovaten', 'manv', 'bophan', 'chucvu', 'process', 'ngayvao', 'kyluong']
const COLOR: Record<Tone, string> = { work: '#16a34a', leave: '#D48806', ot: 'var(--c-primary)', plain: 'var(--c-text)' }

/** Nguồn ghi "-" cho ô không có số liệu. */
const blank = (v: unknown) => isEmptyCell(v) || (typeof v === 'string' && /^-+$/.test(v.trim()))

export function TimeworkSheet({ row }: { row: HnRow }) {
  const { t } = useTranslation()
  const label = useHnLabel()

  const keyOf = (c: string) => Object.keys(row).find((k) => k.toLowerCase() === c)
  // Giữ nguyên số như nguồn / hệ thống cũ (213.5, 217.0) để đối chiếu với bảng chấm công giấy
  const show = (v: unknown) => (blank(v) ? '-' : fmtCell(v).trim())
  // Cột có trong nguồn nhưng không thuộc thẻ nào (cột mới thêm sau): vào thẻ "Khác" nếu có số liệu
  const known = new Set([...HEAD, ...[...LEFT, ...RIGHT].flatMap((c) => [...c.items.map((i) => i.col), ...(c.extra ?? [])])])
  const unknown = Object.keys(row).filter((k) => !known.has(k.toLowerCase()) && !blank(row[k])).map((k) => k.toLowerCase())

  const itemsOf = (c: Card): Item[] => [
    ...c.items.filter((i) => keyOf(i.col) || c.key !== 'other'),
    ...(c.extra ?? []).filter((x) => !blank(cell(row, x))).map((col) => ({ col })),
    ...(c.key === 'other' ? unknown.map((col) => ({ col })) : []),
  ]
  const renderCard = (c: Card) => (
    <SheetCard key={c.key} icon={c.icon} title={t(`hn.timework.sec.${c.key}`)}>
      {itemsOf(c).map((it) => {
        const v = cell(row, it.col)
        return <Field key={it.col} label={it.short ?? label(keyOf(it.col) ?? it.col)} value={show(v)} color={blank(v) ? undefined : COLOR[c.tone]} strong={it.strong} />
      })}
    </SheetCard>
  )

  const head: [string, string][] = HEAD.map((c) => [label(keyOf(c) ?? c), blank(cell(row, c)) ? '' : fmtCell(cell(row, c))] as [string, string]).filter(([, v]) => v)

  return (
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Thông tin nhân viên: bảng 2 cặp nhãn – giá trị mỗi dòng */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
          {head.map(([l, v]) => (
            <div key={l} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 40%) 1fr', borderBottom: '1px solid var(--c-border)', marginBottom: -1 }}>
              <div style={{ padding: '10px 16px', background: 'var(--c-tint)', color: 'var(--c-primary)', fontWeight: 600, borderRight: '1px solid var(--c-border)' }}>{l}</div>
              <div style={{ padding: '10px 16px', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 16 }}>{LEFT.map(renderCard)}</div>
          <div style={{ display: 'grid', gap: 16 }}>{RIGHT.map(renderCard)}</div>
        </div>
      </div>
  )
}

function SheetCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--c-border)', borderRadius: 12, background: 'var(--c-surface)' }}>
      <h4 style={{ margin: 0, padding: '12px 18px', fontSize: 15, fontWeight: 600, borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: 'var(--c-primary)' }}>{icon}</span>{title}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', columnGap: 24, padding: '8px 18px 12px' }}>{children}</div>
    </section>
  )
}

function Field({ label, value, color, strong }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '1px dashed var(--c-border)', fontSize: 14.5 }}>
      <span style={{ fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: strong ? 700 : 600, color: color ?? 'var(--c-muted)' }}>{value}</span>
    </div>
  )
}
