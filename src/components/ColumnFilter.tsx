import { isValidElement, useEffect, useMemo, useState, type Key, type ReactNode } from 'react'
import { Button, Checkbox, Input, Segmented, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import type { FilterDropdownProps } from 'antd/es/table/interface'
import { useTranslation } from 'react-i18next'

/**
 * Bộ lọc ở tiêu đề cột kiểu Excel / DevExpress: tab "Giá trị" (liệt kê giá trị khác nhau trong cột, có ô tìm và tích chọn)
 * và tab "Lọc theo văn bản" (chứa / không chứa / bằng / bắt đầu / kết thúc). Lọc trên dữ liệu đang có ở trình duyệt.
 * DataTable tự gắn cho mọi cột có dataIndex mà chưa tự khai báo filters/filterDropdown/onFilter.
 */

type Op = 'contains' | 'notContains' | 'equals' | 'startsWith' | 'endsWith'
const OPS: Op[] = ['contains', 'notContains', 'equals', 'startsWith', 'endsWith']
const MAX_SHOWN = 1000

const norm = (s: string) => s.normalize('NFC').toLowerCase()

function pick(record: unknown, dataIndex: unknown): unknown {
  if (Array.isArray(dataIndex)) return dataIndex.reduce((o: unknown, k) => (o == null ? o : (o as Record<string, unknown>)[String(k)]), record)
  return (record as Record<string, unknown>)?.[String(dataIndex)]
}

function primitiveText(v: unknown): string | null {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
  return null
}

/** Chữ hiển thị của ô: ưu tiên kết quả render (nếu là chữ/số), nếu không thì giá trị gốc. */
function cellText<T>(col: ColumnType<T>, record: T): string {
  const raw = pick(record, col.dataIndex)
  try {
    if (col.render) {
      let r: unknown = col.render(raw as never, record, 0)
      if (r && typeof r === 'object' && !isValidElement(r) && 'children' in (r as object)) r = (r as { children: unknown }).children
      if (isValidElement(r)) r = (r.props as { children?: unknown }).children
      const p = primitiveText(r)
      if (p !== null && (p !== '' || raw == null || raw === '')) return p.trim()
    }
  } catch { /* render phụ thuộc ngữ cảnh khác: dùng giá trị gốc */ }
  return (primitiveText(raw) ?? '').trim()
}

function matchText(text: string, op: Op, q: string): boolean {
  const a = norm(text), b = norm(q)
  switch (op) {
    case 'contains': return a.includes(b)
    case 'notContains': return !a.includes(b)
    case 'equals': return a === b
    case 'startsWith': return a.startsWith(b)
    default: return a.endsWith(b)
  }
}

type PanelProps<T> = FilterDropdownProps & { col: ColumnType<T>; data: readonly T[]; pageOnly?: boolean }

function FilterPanel<T>({ col, data, pageOnly, selectedKeys, setSelectedKeys, confirm, clearFilters, close }: PanelProps<T>) {
  const { t } = useTranslation()
  const keys = selectedKeys.map(String)
  const sig = keys.join('\u0001')
  const textKey = keys.find((k) => k.startsWith('t:'))
  const [mode, setMode] = useState<'values' | 'text'>(textKey ? 'text' : 'values')
  const [picked, setPicked] = useState<string[]>(keys.filter((k) => k.startsWith('v:')).map((k) => k.slice(2)))
  const [op, setOp] = useState<Op>((textKey?.split(':')[1] as Op) || 'contains')
  const [q, setQ] = useState(textKey ? textKey.split(':').slice(2).join(':') : '')
  const [search, setSearch] = useState('')

  // đồng bộ khi bộ lọc bị xoá/đặt từ nơi khác
  useEffect(() => {
    const tk = sig.split('\u0001').find((k) => k.startsWith('t:'))
    setMode(tk ? 'text' : 'values')
    setPicked(sig.split('\u0001').filter((k) => k.startsWith('v:')).map((k) => k.slice(2)))
    setOp((tk?.split(':')[1] as Op) || 'contains')
    setQ(tk ? tk.split(':').slice(2).join(':') : '')
  }, [sig])

  const values = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of data) { const v = cellText(col, r); m.set(v, (m.get(v) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })))
  }, [data, col])

  const shown = useMemo(() => {
    const s = norm(search.trim())
    return (s ? values.filter(([v]) => norm(v).includes(s) || (v === '' && norm(t('common.colFilter.blanks')).includes(s))) : values).slice(0, MAX_SHOWN)
  }, [values, search, t])

  const shownKeys = shown.map(([v]) => v)
  const allChecked = shownKeys.length > 0 && shownKeys.every((v) => picked.includes(v))
  const someChecked = shownKeys.some((v) => picked.includes(v))
  const toggleAll = (on: boolean) => setPicked((p) => on ? [...new Set([...p, ...shownKeys])] : p.filter((v) => !shownKeys.includes(v)))
  const toggle = (v: string, on: boolean) => setPicked((p) => on ? [...p, v] : p.filter((x) => x !== v))

  const apply = () => {
    let next: Key[] = []
    if (mode === 'values') { if (picked.length > 0 && picked.length < values.length) next = picked.map((v) => `v:${v}`) }
    else if (q.trim() !== '') next = [`t:${op}:${q.trim()}`]
    setSelectedKeys(next)
    confirm({ closeDropdown: true })
  }
  const clear = () => {
    setPicked([]); setQ(''); setSearch(''); setSelectedKeys([])
    clearFilters?.({ confirm: true, closeDropdown: false })
  }

  return (
    <div className="col-filter" style={{ width: 290, padding: 10 }} onKeyDown={(e) => { if (e.key === 'Enter' && mode === 'text') apply() }}>
      <Segmented<'values' | 'text'> block size="small" value={mode} onChange={setMode}
        options={[{ value: 'values', label: t('common.colFilter.values') }, { value: 'text', label: t('common.colFilter.text') }]} />
      {mode === 'values' ? (
        <div style={{ marginTop: 8 }}>
          <Input size="small" allowClear prefix={<SearchOutlined />} placeholder={t('common.colFilter.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 6, border: '1px solid var(--c-border, #e5e7eb)', borderRadius: 6, padding: '4px 8px' }}>
            {shown.length === 0 ? <div style={{ color: 'var(--c-muted, #98a2b3)', padding: '8px 0', textAlign: 'center' }}>{t('common.colFilter.empty')}</div> : (
              <>
                <div style={{ padding: '2px 0', borderBottom: '1px solid var(--c-border, #eef0f3)' }}>
                  <Checkbox checked={allChecked} indeterminate={!allChecked && someChecked} onChange={(e) => toggleAll(e.target.checked)}>{t('common.colFilter.all')}</Checkbox>
                </div>
                {shown.map(([v, n]) => (
                  <div key={v || '\u0000blank'} style={{ padding: '2px 0', display: 'flex', alignItems: 'center' }}>
                    <Checkbox checked={picked.includes(v)} onChange={(e) => toggle(v, e.target.checked)} style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ wordBreak: 'break-word', ...(v === '' ? { color: 'var(--c-muted, #98a2b3)', fontStyle: 'italic' } : {}) }}>{v === '' ? t('common.colFilter.blanks') : v}</span>
                    </Checkbox>
                    <span style={{ color: 'var(--c-muted, #98a2b3)', fontSize: 12, marginInlineStart: 6 }}>{n}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Select<Op> size="small" value={op} onChange={setOp} options={OPS.map((o) => ({ value: o, label: t(`common.colFilter.op.${o}`) }))} />
          <Input size="small" allowClear autoFocus placeholder={t('common.colFilter.textPh')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {pageOnly && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-muted, #98a2b3)' }}>{t('common.colFilter.pageOnly')}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <Button size="small" onClick={clear}>{t('common.colFilter.clear')}</Button>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <Button size="small" onClick={() => close()}>{t('common.colFilter.close')}</Button>
          <Button size="small" type="primary" onClick={apply}>{t('common.colFilter.apply')}</Button>
        </span>
      </div>
    </div>
  )
}

/** Gắn bộ lọc kiểu Excel cho các cột chưa có bộ lọc riêng (đệ quy cả cột nhóm). */
export function withColumnFilters<T extends object>(columns: ColumnsType<T>, getData: () => readonly T[], pageOnly = false): ColumnsType<T> {
  return columns.map((c) => {
    if ('children' in c && c.children) return { ...c, children: withColumnFilters(c.children as ColumnsType<T>, getData, pageOnly) } as typeof c
    const col = c as ColumnType<T>
    const di = col.dataIndex as unknown
    if (di === undefined || di === null || di === '' || (Array.isArray(di) && di.length === 0)) return c
    if (col.filters || col.filterDropdown || col.onFilter || col.filteredValue !== undefined || col.filterIcon !== undefined) return c
    const title = col.title as ReactNode
    if (title === undefined || title === null || title === '') return c
    return {
      ...col,
      filterDropdown: (p: FilterDropdownProps) => <FilterPanel<T> {...p} col={col} data={getData()} pageOnly={pageOnly} />,
      onFilter: (value: boolean | Key, record: T) => {
        const k = String(value)
        const text = cellText(col, record)
        if (k.startsWith('t:')) {
          const rest = k.slice(2), i = rest.indexOf(':')
          return matchText(text, rest.slice(0, i) as Op, rest.slice(i + 1))
        }
        return text === k.slice(2)
      },
    } as typeof c
  }) as ColumnsType<T>
}
