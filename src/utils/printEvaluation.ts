import dayjs from 'dayjs'
import type { EvaluationDetail } from '../api/evaluations'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const day = (s: string | null | undefined) => (s ? dayjs(s).format('DD/MM/YYYY') : '')

type T = (key: string, opts?: Record<string, unknown>) => string

/**
 * In phiếu đánh giá của một nhân viên (bảng điểm từng vòng, chuyên cần, nhận xét, chỗ ký). Dùng khung ẩn nên không bị chặn cửa sổ bật lên;
 * trong hộp thoại in có thể chọn "Lưu thành PDF".
 */
export function printEvaluationSheet(d: EvaluationDetail, t: T) {
  const roundCount = Math.max(1, d.rounds.length, ...d.scores.map((r) => r.scores.reduce<number>((n, v, i) => (v != null ? i + 1 : n), 0)))
  const cols = Array.from({ length: roundCount }, (_, i) => i)
  const isOp = d.position?.toUpperCase() === 'OP'
  const noG = isOp && (d.scores.find((r) => r.titleId === 20)?.scores ?? []).every((v) => v == null)

  const head = `<tr><th class="l">${esc(t('print.criteria'))}</th><th>${esc(t('print.max'))}</th>${cols.map((i) => {
    const r = d.rounds.find((x) => x.no === i + 1)
    return `<th>${esc(t('line.roundN', { n: i + 1 }))}${r ? `<br/><small>${esc(r.evaluatorName)}</small>` : ''}</th>`
  }).join('')}</tr>`
  const body = d.scores.map((r) => {
    if (r.maxPoint == null) return `<tr class="sec"><td colspan="${2 + roundCount}">${esc(r.name)}</td></tr>`
    const strong = /^(Total|K[eế]t qu[aả])/i.test(r.name)
    const cells = cols.map((i) => `<td>${r.scores[i] ?? ''}</td>`).join('')
    const note = strong && /K[eế]t qu[aả]/i.test(r.name) && noG ? ` <em>(${esc(t('rev.gNone'))})</em>` : ''
    return `<tr class="${strong ? 'tot' : ''}"><td class="l">${esc(r.name)}${note}</td><td>${r.maxPoint}</td>${cells}</tr>`
  }).join('')

  const kv = (rows: { label: string; value: string }[]) => (rows.length
    ? `<table class="kv">${rows.map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join('')}</table>` : '')
  const sign = (d.rounds.length ? d.rounds : [{ no: 1, evaluatorName: '' }]).map((r) =>
    `<div class="sig"><b>${esc(t('line.roundN', { n: r.no }))}</b><span>${esc(r.evaluatorName)}</span><i></i></div>`).join('') +
    `<div class="sig"><b>HR</b><span></span><i></i></div>`

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.employeeId)} - ${esc(d.fullName)}</title><style>
    @page { size: A4; margin: 14mm; }
    body { font: 12px/1.45 'Segoe UI', Arial, sans-serif; color: #111; }
    h1 { font-size: 17px; text-align: center; margin: 0 0 2px; text-transform: uppercase; }
    .sub { text-align: center; color: #555; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #999; padding: 3px 6px; text-align: center; vertical-align: top; }
    th { background: #eef3ef; }
    .l { text-align: left; }
    tr.sec td { background: #f3f6f4; font-weight: 700; text-align: left; }
    tr.tot td { font-weight: 700; background: #fafafa; }
    .info td { text-align: left; border: 0; padding: 1px 6px; }
    .kv th { width: 34%; text-align: left; } .kv td { text-align: left; }
    h2 { font-size: 13px; margin: 12px 0 4px; }
    .signs { display: flex; gap: 14px; margin-top: 18px; }
    .sig { flex: 1; text-align: center; } .sig b, .sig span { display: block; } .sig i { display: block; height: 52px; border-bottom: 1px dotted #777; }
    small { font-weight: 400; color: #555; }
  </style></head><body>
    <h1>${esc(t('print.title'))}</h1><div class="sub">${esc(d.typeRate)} · ${esc(day(d.dateRate))}</div>
    <table class="info"><tr><td><b>${esc(t('att.name'))}:</b> ${esc(d.fullName)}</td><td><b>${esc(t('eva.employeeId'))}:</b> ${esc(d.employeeId)}</td></tr>
    <tr><td><b>${esc(t('att.dept'))}:</b> ${esc(d.department)}</td><td><b>${esc(t('print.position'))}:</b> ${esc(d.position)}</td></tr>
    <tr><td colspan="2"><b>${esc(t('print.startWork'))}:</b> ${esc(day(d.startWork))}</td></tr></table>
    <table>${head}${body}</table>
    ${d.attendance.length ? `<h2>${esc(t('print.attendance'))}</h2>${kv(d.attendance)}` : ''}
    ${d.comments.length ? `<h2>${esc(t('print.comments'))}</h2>${kv(d.comments)}` : ''}
    <div class="signs">${sign}</div>
  </body></html>`

  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open(); doc.write(html); doc.close()
  const go = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => frame.remove(), 60_000) }
  if (doc.readyState === 'complete') setTimeout(go, 150); else frame.onload = () => setTimeout(go, 150)
}
