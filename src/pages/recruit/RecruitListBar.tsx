import { useTranslation } from 'react-i18next'
import { RECRUIT_FILTERS } from '../../api/recruit'

/** Màu nhận biết từng nhóm trạng thái (chấm màu + số lượng), để nhìn lướt là phân biệt được. */
const TONE: Record<string, string> = {
  '': '#475467', new: '#D48806', waiting: '#2F6FB0', evaluated: '#7C3AED', postponed: '#C2410C', absent: '#C0392B',
  round2: '#EA580C', consider: '#0E7490', pass: '#2E9E4F', fail: '#B42318', withdrawn: '#667085',
}

/** Thanh lọc trạng thái dạng thẻ có đếm số hồ sơ: thẻ đang chọn được tô đặc, các thẻ khác viền mảnh. */
export function StatusFilter({ value, onChange, counts, round2 }: { value: string; onChange: (key: string) => void; counts: Record<string, number>; round2?: boolean }) {
  const { t } = useTranslation()
  const items = [{ key: '', label: t('org.all') }, ...RECRUIT_FILTERS.filter((f) => f.key !== 'round2' || round2).map((f) => ({ key: f.key, label: t(`rec.fl.${f.key}`) }))]
  return (
    <div className="rec-flt" role="tablist">
      {items.map((it) => (
        <button key={it.key || 'all'} type="button" role="tab" aria-selected={value === it.key} className={value === it.key ? 'on' : ''} style={{ ['--tone' as string]: TONE[it.key] }} onClick={() => onChange(it.key)}>
          <span className="dot" />
          <span>{it.label}</span>
          <span className="n">{counts[it.key] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}
