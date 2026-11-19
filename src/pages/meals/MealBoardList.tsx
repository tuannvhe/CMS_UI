import { useMemo, useState, type ReactNode } from 'react'
import { Button, Card, Empty, Input, Popconfirm, Popover, Segmented, Space, Switch, Tag, Typography } from 'antd'
import { CaretDownOutlined, CaretRightOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { MEAL_ORDER_CODES, MEAL_SITES, type MealCode, type MealOrder, type MealSite } from '../../api/meals'
import { StatTiles } from '../../components/StatTiles'
import { foldText } from '../../utils/search'
import { useDebouncedValue } from '../../hooks/useDebounce'
import { trData } from '../../utils/dataText'

const COLORS: Record<MealCode, string> = { lunch: '#2E9E4F', dinner: '#2563eb', night: '#6D5BD0', overtime: '#E11D48', breakfast: '#F59E0B' }
type StatusFilter = 'active' | 'approved' | 'pending' | 'rejected'

/** Ngày đăng ký của một đơn: bữa sáng thuộc ngày hôm trước (đăng ký ngày D = trưa / chiều / đêm / tăng ca ngày D + sáng ngày D+1). */
const regDay = (o: MealOrder) => (o.meal === 'breakfast' ? dayjs(o.date).subtract(1, 'day') : dayjs(o.date)).format('YYYY-MM-DD')
const counts = (o: MealOrder) => o.status === 'approved' && o.replacesId == null && !o.cancel

interface Line { key: string; day: string; dept: string; cells: Record<MealCode, MealOrder[]> }

/**
 * Danh sách đăng ký dạng bảng theo nhà máy: mỗi dòng một bộ phận trong một ngày, 5 cột bữa (số đã tính, kèm số đơn chờ duyệt),
 * dòng tổng cuối bảng. Bấm vào ô để xem từng đơn trong ô và sửa / xoá (theo quyền). Có thống kê và bộ lọc ở trên.
 */
export function MealBoardList({ rows, loading, toolbar, userId, canEdit, canDelete, asRequest, onEdit, onDelete, statusCell }: {
  rows: MealOrder[]; loading: boolean; toolbar: ReactNode; userId?: string
  canEdit: (o: MealOrder) => boolean; canDelete: (o: MealOrder) => boolean; asRequest: (o: MealOrder) => boolean
  onEdit: (o: MealOrder) => void; onDelete: (id: number) => void; statusCell: (o: MealOrder) => ReactNode
}) {
  const { t, i18n } = useTranslation()
  const [site, setSite] = useState<'ALL' | MealSite>('ALL')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const dSearch = useDebouncedValue(search)   // gõ xong mới lọc, không lọc lại sau mỗi phím
  const [onlyMine, setOnlyMine] = useState(false)
  const [folded, setFolded] = useState<Set<string>>(new Set())   // ngày đang thu gọn (khoá = nhà máy|ngày)
  const [daysShown, setDaysShown] = useState<Record<string, number>>({})
  const me = (userId ?? '').trim().toLowerCase()

  const shown = useMemo(() => {
    const q = foldText(dSearch.trim())
    return rows.filter((o) => (site === 'ALL' || o.site === site)
      && (status === 'active' ? o.status !== 'rejected' : o.status === status)
      && (!q || foldText(o.department ?? '').includes(q) || foldText(o.registeredByName ?? o.registeredBy ?? '').includes(q))
      && (!onlyMine || (o.registeredBy ?? '').trim().toLowerCase() === me))
  }, [rows, site, status, dSearch, onlyMine, me])

  const linesOf = (s: MealSite): Line[] => {
    const map = new Map<string, Line>()
    for (const o of shown.filter((x) => x.site === s)) {
      const day = regDay(o)
      const dept = (o.department ?? '').trim() || '—'
      const key = `${day}\u0001${dept.toLowerCase()}`
      let l = map.get(key)
      if (!l) { l = { key, day, dept, cells: { lunch: [], dinner: [], night: [], overtime: [], breakfast: [] } }; map.set(key, l) }
      l.cells[o.meal].push(o)
    }
    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day) || a.dept.localeCompare(b.dept))
  }
  const qty = (list: MealOrder[]) => list.filter(counts).reduce((n, o) => n + o.qty, 0)
  const sumMeal = (list: MealOrder[], m: MealCode) => qty(list.filter((o) => o.meal === m))
  const sitesShown = (site === 'ALL' ? MEAL_SITES : [site]).filter((s) => shown.some((o) => o.site === s))

  const cell = (list: MealOrder[], meal: MealCode, l: Line) => {
    if (list.length === 0) return <span className="cell-muted">·</span>
    const n = qty(list)
    const pend = list.filter((o) => o.status === 'pending').length
    const rej = list.filter((o) => o.status === 'rejected').length
    const content = (
      <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        {list.map((o) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <b style={o.cancel ? { textDecoration: 'line-through' } : undefined}>{o.qty}</b> <span className="cell-muted">· {o.registeredByName || o.registeredBy} · {dayjs(o.createdAt).format('HH:mm DD/MM')}</span>
              <div>{statusCell(o)}</div>
              {o.note && <div className="cell-muted" style={{ fontSize: 12 }}>{o.note}</div>}
            </div>
            <Space size={4}>
              {canEdit(o) && <Button size="small" icon={<EditOutlined />} title={t('mealReg.edit')} onClick={() => onEdit(o)} />}
              {canDelete(o) && (
                <Popconfirm title={t(asRequest(o) ? 'mealReg.cancelAsk' : 'mealReg.deleteAsk')} okText={t(asRequest(o) ? 'mealReg.cancelOk' : 'req.delete')}
                  cancelText={t('req.cancel')} onConfirm={() => onDelete(o.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </Space>
          </div>
        ))}
      </div>
    )
    return (
      <Popover trigger="click" content={content} title={`${t(`meal.code.${meal}`)} · ${l.dept} · ${dayjs(list[0].date).format('DD/MM/YYYY')}`}>
        <button type="button" className="mb-cell">
          <b>{n > 0 ? n : status === 'rejected' ? list.reduce((s, o) => s + o.qty, 0) : 0}</b>
          {pend > 0 && <Tag color="orange" className="mb-tag">{t('mealReg.pendingN', { n: pend })}</Tag>}
          {status !== 'rejected' && rej > 0 && <Tag color="red" className="mb-tag">{rej}</Tag>}
        </button>
      </Popover>
    )
  }


  const WEEK_FMT = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'long' })
  const todayStr = dayjs().format('YYYY-MM-DD')
  const heat = (n: number, max: number) => ({ background: `color-mix(in srgb, var(--c-primary) ${Math.round(5 + 17 * (max > 0 ? n / max : 0))}%, transparent)` })

  /** Bảng theo ngày: mỗi ngày một dải tiêu đề (tổng ngày theo bữa), dưới là từng bộ phận. Màu nền ô đậm dần theo số suất. */
  const Board = ({ lines, ofSite }: { lines: Line[]; ofSite: MealOrder[] }) => {
    const siteKey = ofSite[0]?.site ?? ''
    const groups = new Map<string, Line[]>()
    for (const l of lines) { const a = groups.get(l.day); if (a) a.push(l); else groups.set(l.day, [l]) }
    const days = [...groups.keys()]
    const limit = daysShown[siteKey] ?? 7
    const maxByMeal = Object.fromEntries(MEAL_ORDER_CODES.map((m) => [m, Math.max(0, ...lines.map((l) => qty(l.cells[m])))])) as Record<MealCode, number>
    return (
      <div className="mb2-wrap">
        <div className="mb2">
          <div className="mb2-row mb2-head">
            <div>{t('meal.dept')}</div>
            {MEAL_ORDER_CODES.map((m) => (
              <div key={m} className="mb2-num"><i className="mb-dot" style={{ background: COLORS[m] }} />{t(`meal.code.${m}`)}{m === 'breakfast' && <small>{t('mealReg.nextDay')}</small>}</div>
            ))}
            <div className="mb2-num">{t('meal.total')}</div>
          </div>
          {days.slice(0, limit).map((d) => {
            const ls = groups.get(d)!
            const k = `${siteKey}|${d}`
            const isFolded = folded.has(k)
            const dayOrders = ls.flatMap((l) => MEAL_ORDER_CODES.flatMap((m) => l.cells[m]))
            const dayPend = dayOrders.filter((o) => o.status === 'pending').length
            return (
              <div key={d} className="mb2-day">
                <button type="button" className={`mb2-row mb2-dayhead${d === todayStr ? ' today' : ''}`} aria-expanded={!isFolded}
                  onClick={() => setFolded((f) => { const n = new Set(f); if (n.has(k)) n.delete(k); else n.add(k); return n })}>
                  <div className="mb2-dayname">
                    {isFolded ? <CaretRightOutlined /> : <CaretDownOutlined />}
                    <b>{dayjs(d).format('DD/MM')}</b><span>{WEEK_FMT(d)}</span>
                    {d === todayStr && <Tag color="green" className="mb-tag">{t('mealReg.today')}</Tag>}
                    <small>{t('mealReg.deptN', { n: ls.length })}</small>
                    {dayPend > 0 && <Tag color="orange" className="mb-tag">{t('mealReg.pendingN', { n: dayPend })}</Tag>}
                  </div>
                  {MEAL_ORDER_CODES.map((m) => { const v = sumMeal(dayOrders, m); return <div key={m} className="mb2-num">{v > 0 ? v : <span className="cell-muted">·</span>}</div> })}
                  <div className="mb2-num mb2-tot">{qty(dayOrders)}</div>
                </button>
                {!isFolded && ls.map((l) => {
                  const rowTotal = MEAL_ORDER_CODES.reduce((n, m) => n + qty(l.cells[m]), 0)
                  return (
                    <div key={l.key} className="mb2-row mb2-line">
                      <div className="mb2-dept" title={l.dept}>{trData(l.dept)}</div>
                      {MEAL_ORDER_CODES.map((m) => {
                        const n = qty(l.cells[m])
                        return <div key={m} className="mb2-num mb2-c" style={n > 0 ? heat(n, maxByMeal[m]) : undefined}>{cell(l.cells[m], m, l)}</div>
                      })}
                      <div className="mb2-num mb2-tot">{rowTotal}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div className="mb2-row mb2-foot">
            <div>{t('mealReg.sumRow')}</div>
            {MEAL_ORDER_CODES.map((m) => <div key={m} className="mb2-num">{sumMeal(ofSite, m)}</div>)}
            <div className="mb2-num mb2-tot">{qty(ofSite)}</div>
          </div>
        </div>
        {days.length > limit && (
          <div className="mb2-more"><Button size="small" onClick={() => setDaysShown((s) => ({ ...s, [siteKey]: limit + 7 }))}>{t('mealReg.moreDays', { n: days.length - limit })}</Button></div>
        )}
      </div>
    )
  }

  const totalShown = shown.filter(counts).reduce((n, o) => n + o.qty, 0)
  const pendingShown = shown.filter((o) => o.status === 'pending').length

  return (
    <Card style={{ marginTop: 16 }} title={<Typography.Title level={5} style={{ margin: 0 }}>{t('mealReg.listAll')}</Typography.Title>} extra={toolbar}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented value={site} onChange={(v) => setSite(v as 'ALL' | MealSite)}
          options={[{ value: 'ALL', label: t('mealStats.allSites') }, ...MEAL_SITES.map((s) => ({ value: s, label: t(`meal.siteName.${s}`) }))]} />
        <Segmented value={status} onChange={(v) => setStatus(v as StatusFilter)} options={[
          { value: 'active', label: t('mealReg.fActive') },
          { value: 'approved', label: t('mealReg.status.approved') },
          { value: 'pending', label: t('mealReg.status.pending') },
          { value: 'rejected', label: t('mealReg.status.rejected') },
        ]} />
        <Input.Search allowClear placeholder={t('mealReg.fSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
        <Space size={6}><Switch size="small" checked={onlyMine} onChange={setOnlyMine} /><span>{t('mealReg.fMine')}</span></Space>
      </Space>

      <StatTiles items={[
        { label: t('mealReg.sTotal'), value: totalShown, color: '#0F172A' },
        ...MEAL_ORDER_CODES.map((m) => ({ label: t(`meal.code.${m}`), value: sumMeal(shown, m), color: COLORS[m] })),
        { label: t('mealReg.sPending'), value: pendingShown, color: pendingShown ? '#D97706' : undefined },
      ]} />

      {loading ? <Card loading size="small" /> : sitesShown.length === 0 ? <Empty description={t('mealReg.empty')} /> : sitesShown.map((s) => {
        const lines = linesOf(s)
        const ofSite = shown.filter((o) => o.site === s)
        return (
          <div key={s} style={{ marginTop: 12 }}>
            <div className="mb-site">
              <b>{t(`meal.siteName.${s}`)}</b>
              <span className="mb-site-total">{qty(ofSite)}</span>
              <span className="cell-muted">{t('mealReg.sSite', { n: qty(ofSite), d: new Set(lines.map((l) => l.dept)).size })}</span>
            </div>
            <Board lines={lines} ofSite={ofSite} />
          </div>
        )
      })}
    </Card>
  )
}
