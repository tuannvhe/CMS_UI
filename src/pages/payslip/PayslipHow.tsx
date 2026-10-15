import { useTranslation } from 'react-i18next'
import { Skeleton } from 'antd'
import type { PayslipExplainLine } from '../../api/payslip'

type Tok = string | { v: string; k?: 'num' | 'op' | 'res' }

/** "Cách tính phiếu lương": mỗi khoản một hàng gồm tên, phép tính bằng số thật và kết quả; hàng thực nhận được tô nổi bật. */
export function PayslipHow({ lines, loading, fmt }: { lines: PayslipExplainLine[]; loading: boolean; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />
  const unitH = t('pay.how.unit.hours')

  const row = (l: PayslipExplainLine): { expr: Tok[]; result: string } => {
    const a = l.args
    const n = (x: number) => fmt(x)
    const plus = (items: [number, string?][]): Tok[] => items.filter(([x]) => x !== 0).flatMap(([x, op], i) => (i === 0 ? [n(x)] : [{ v: op ?? '+', k: 'op' as const }, n(x)]))
    switch (l.key) {
      case 'hours': return { expr: [`${n(a.hours)} ${unitH}`], result: `${n(a.hours)} ${unitH}` }
      case 'base': return { expr: [n(a.contract), { v: '×', k: 'op' }, `${n(a.hours)}/${n(a.std)}`], result: n(a.amount) }
      case 'night': return { expr: a.hours > 0 ? [`${n(a.hours)} ${unitH}`, { v: '×', k: 'op' }, `${n(a.pct)}%`, { v: '×', k: 'op' }, n(a.rate)] : [], result: n(a.amount) }
      case 'allow': return { expr: plus([[a.living], [a.travel]]), result: n(a.living + a.travel) }
      case 'rate': return { expr: [n(a.base), { v: '÷', k: 'op' }, `${n(a.std)} ${unitH}`], result: n(a.rate) }
      case 'otType': return { expr: [`${n(a.hours)} ${unitH}`, { v: '×', k: 'op' }, `${n(a.coef)}%`, { v: '×', k: 'op' }, n(a.rate)], result: n(a.amount) }
      case 'overtime': return { expr: [`${n(a.hours)} ${unitH}`, { v: '×', k: 'op' }, `${n(a.avg)}`, { v: '×', k: 'op' }, n(a.rate)], result: n(a.pay) }
      case 'hungyen': return { expr: [`${n(a.pct)}%`, { v: '×', k: 'op' }, n(a.base), { v: '×', k: 'op' }, `${n(a.days)}/${n(a.required)}`, { v: '+', k: 'op' }, `${n(a.days)} × ${n(a.meal)}`], result: n(a.amount) }
      case 'insurance': return { expr: [`${n(a.pct)}%`, { v: '×', k: 'op' }, n(a.base)], result: n(a.amount) }
      case 'union': return { expr: [`${n(a.pct)}%`, { v: '×', k: 'op' }, n(a.base)], result: n(a.amount) }
      case 'deduction': return { expr: plus([[a.ins], [a.union], [a.tax]]), result: n(a.total) }
      case 'net': return { expr: [...plus([[a.base], [a.allow], [a.ot], [a.leave], [a.adj]]), { v: '−', k: 'op' }, n(a.ded)], result: n(a.net) }
      default: return { expr: [], result: n(a.amount ?? 0) }
    }
  }

  return (
    <ol className="how-list">
      {lines.map((l) => {
        const { expr, result } = row(l)
        return (
          <li key={l.key === 'otType' ? `ot${l.args.idx}` : l.key} className={`how-item${l.key === 'net' ? ' net' : ''}${l.key === 'otType' ? ' sub' : ''}`}>
            <div className="how-main">
              <b>{l.key === 'otType' ? t(`pay.how.ot.${l.args.idx}`) : t(`pay.how.t.${l.key}`)}</b>
              {l.key !== 'otType' && <span className="how-note">{t(`pay.how.n.${l.key}`, Object.fromEntries(Object.entries(l.args).map(([k, v]) => [k, fmt(v)])))}</span>}
            </div>
            <div className="how-expr">{expr.map((x, i) => (typeof x === 'string' ? <span key={i} className="how-chip">{x}</span> : <span key={i} className="how-op">{x.v}</span>))}</div>
            <div className="how-res">= {result}</div>
          </li>
        )
      })}
    </ol>
  )
}
