export interface Tile {
  label: string
  value: string | number
  unit?: string
  /** Màu nhấn của thẻ (CSS color) */
  color?: string
}

/** Dải ô thống kê gọn: nhãn nhỏ, số lớn, viền nhấn màu. Dùng cho mọi trang báo cáo để đồng nhất. */
export function StatTiles({ items }: { items: Tile[] }) {
  return (
    <div className="stat-grid">
      {items.map((i) => (
        <div key={i.label} className="stat-tile" style={i.color ? ({ ['--tile' as string]: i.color } as React.CSSProperties) : undefined}>
          <div className="st-label" title={i.label}>{i.label}</div>
          <div>
            <span className="st-value">{i.value}</span>
            {i.unit && <span className="st-unit">{i.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
