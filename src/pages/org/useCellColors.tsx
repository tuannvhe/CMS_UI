import { useEffect, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from 'antd'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CELL_COLORS, CELL_FIELDS, idCardError, idCards, type CellColorChange, type IdCardRow } from '../../api/idCards'
import { useToast } from '../../hooks/useToast'

type ColorMap = Record<string, Record<string, string>>
const QK = ['id-cards', 'cell-colors']

/**
 * Tô màu nền từng ô của bảng Đã lưu như Excel: bấm chuột phải vào ô → chọn màu. Màu lưu chung (Tbl_IdCards.CellColors) nên mọi người cùng thấy.
 * decorate(cột) gắn màu nền + sự kiện chuột phải vào các cột dữ liệu; menu là bảng chọn màu (đặt trong trang).
 */
export function useCellColors(enabled: boolean) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState<{ id: number; field: string; x: number; y: number } | null>(null)
  const q = useQuery({ queryKey: QK, queryFn: idCards.cellColors, enabled, retry: false, staleTime: 30_000 })
  const colorOf = (id: number, field: string) => q.data?.[String(id)]?.[field]

  const save = useMutation({
    mutationFn: (cells: CellColorChange[]) => idCards.setCellColors(cells),
    onMutate: async (cells) => {   // đổi màu ngay trên màn hình, lỗi thì tải lại từ máy chủ
      await qc.cancelQueries({ queryKey: QK })
      qc.setQueryData<ColorMap>(QK, (prev) => {
        const next: ColorMap = { ...(prev ?? {}) }
        for (const c of cells) {
          const row = { ...(next[String(c.id)] ?? {}) }
          if (c.color) row[c.field] = c.color; else delete row[c.field]
          if (Object.keys(row).length > 0) next[String(c.id)] = row; else delete next[String(c.id)]
        }
        return next
      })
    },
    onError: (e) => {
      const { code, detail } = idCardError(e)
      msg.error(code === 'column_missing' ? t('idc.cc.noColumn') : detail || code || t('idc.err.generic'))
      qc.invalidateQueries({ queryKey: QK })
    },
  })

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(null)
    const down = (e: globalThis.MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest?.('.idc-cc-menu')) close() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open])

  const decorate = (cols: ColumnsType<IdCardRow>): ColumnsType<IdCardRow> => cols.map((c) => {
    const col = c as ColumnType<IdCardRow>
    const field = String(col.key ?? (Array.isArray(col.dataIndex) ? col.dataIndex.join('.') : col.dataIndex ?? ''))
    if (!CELL_FIELDS.includes(field)) return c
    return {
      ...col,
      onCell: (r: IdCardRow) => {
        const color = colorOf(r.id, field)
        return {
          className: color ? 'idc-colored' : undefined,
          style: color ? { background: color } : undefined,
          onContextMenu: (e: MouseEvent) => { e.preventDefault(); setOpen({ id: r.id, field, x: e.clientX, y: e.clientY }) },
        }
      },
    } as typeof c
  }) as ColumnsType<IdCardRow>

  const apply = (color: string | null) => { if (open) save.mutate([{ id: open.id, field: open.field, color }]); setOpen(null) }
  const clearRow = () => {
    if (!open) return
    const row = q.data?.[String(open.id)] ?? {}
    const cells = Object.keys(row).map((field) => ({ id: open.id, field, color: null }))
    if (cells.length > 0) save.mutate(cells)
    setOpen(null)
  }
  const cur = open ? colorOf(open.id, open.field) : undefined

  const menu = open && createPortal(
    <div className="idc-cc-menu" style={{ left: Math.max(4, Math.min(open.x, window.innerWidth - 236)), top: Math.max(4, Math.min(open.y, window.innerHeight - 140)) }} onContextMenu={(e) => e.preventDefault()}>
      <div className="idc-cc-title">{t('idc.cc.title')}</div>
      <div className="idc-cc-sw">
        {CELL_COLORS.map((c) => <button key={c} type="button" className={`idc-cc-dot${cur?.toUpperCase() === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => apply(c)} />)}
      </div>
      <div className="idc-cc-act">
        <Button size="small" disabled={!cur} onClick={() => apply(null)}>{t('idc.cc.clear')}</Button>
        <Button size="small" disabled={!q.data?.[String(open.id)]} onClick={clearRow}>{t('idc.cc.clearRow')}</Button>
      </div>
    </div>, document.body)

  return { decorate, menu }
}
