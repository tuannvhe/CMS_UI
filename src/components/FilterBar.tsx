import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** Khung thanh lọc chuẩn: các hàng có nhãn chữ hoa nhỏ (TRẠNG THÁI, TÌM & LỌC, SẮP XẾP, THAO TÁC) như màn Tuyển dụng. Đặt trong `toolbar` của DataTable. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flt-bar">{children}</div>
}

type RowKind = 'status' | 'find' | 'sort' | 'actions'

/** Một hàng của thanh lọc: nhãn bên trái (chọn sẵn theo `kind` hoặc tự đặt bằng `label`) và các điều khiển bên phải. Hàng không có gì thì bỏ qua. */
export function FilterRow({ kind, label, children }: { kind?: RowKind; label?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flt-row">
      {(kind || label) && <span className="flt-label">{label ?? t(`rec.bar.${kind}`)}</span>}
      {children}
    </div>
  )
}

export interface PillOption<K extends string> { key: K; label: ReactNode; count?: number; tone?: string }

/** Bộ lọc dạng thẻ pill có chấm màu và số đếm (tuỳ chọn); thẻ đang chọn được tô đặc. Thay cho Segmented/Radio khi lọc theo trạng thái. */
export function PillFilter<K extends string>({ value, onChange, options, disabled }: { value: K; onChange: (key: K) => void; options: PillOption<K>[]; disabled?: boolean }) {
  return (
    <div className="pill-flt" role="tablist">
      {options.map((o) => (
        <button key={o.key || 'all'} type="button" role="tab" disabled={disabled} aria-selected={value === o.key} className={value === o.key ? 'on' : ''}
          style={o.tone ? ({ ['--tone' as string]: o.tone } as CSSProperties) : undefined} onClick={() => onChange(o.key)}>
          <span className="dot" />
          <span>{o.label}</span>
          {o.count !== undefined && <span className="n">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
