import dayjs from 'dayjs'
import { inkUrl, photoUrl, SCORE_CRITERIA, scoreTotal, type AllInterview, type InkField, type RecruitDetail } from '../../api/recruit'

type T = (k: string, o?: Record<string, unknown>) => string

const esc = (v: string | number | null | undefined) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const abs = (path: string) => `${window.location.origin}${path}`
const mmyy = (v: string | null) => (v ? dayjs(v).format('MM/YYYY') : '?')

/** Mở cửa sổ in của trình duyệt (chọn "Lưu thành PDF" để lưu hồ sơ); false nếu trình duyệt chặn cửa sổ mới. */
function openPrint(title: string, css: string, body: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:"Segoe UI",Arial,sans-serif;margin:28px;color:#1f1f1f} h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px}
    .sub{color:#666;margin-bottom:16px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:12.5px;vertical-align:top}
    th{background:#fafafa} .muted{color:#667085} img.ph{width:54px;height:72px;object-fit:cover;border:1px solid #ddd} img.ink{max-width:100%;max-height:300px;border:1px solid #e5e7eb;margin-top:4px}
    .card{border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin:8px 0;page-break-inside:avoid} @media print{body{margin:10mm}}${css}</style></head><body>${body}
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`
  const w = window.open('', '_blank', 'noopener=no,width=1000,height=1000')
  if (!w) return false
  w.document.open(); w.document.write(html); w.document.close()
  return true
}

/** Danh sách một ca phỏng vấn cho lễ tân và hội đồng: ảnh, họ tên, vị trí, giờ, kinh nghiệm, học vấn. */
export function printSlotList(t: T, lang: string, title: string, rows: AllInterview[]) {
  const when = (v: string) => new Date(v).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
  const exp = (r: AllInterview) => (r.cv?.experience ?? []).map((x) => `<div>${mmyy(x.from)} – ${x.current ? esc(t('rec.cvf.now')) : mmyy(x.to)}: <b>${esc(x.company ?? '—')}</b>${x.position ? ` · ${esc(x.position)}` : ''}</div>`).join('')
  const edu = (r: AllInterview) => (r.cv?.education ?? []).map((x) => `<div>${x.fromYear ?? '?'} – ${x.toYear ?? '?'}: <b>${esc(x.school ?? '—')}</b>${x.major ? ` · ${esc(x.major)}` : ''}${x.degree ? ` (${esc(t(`rec.edu.${x.degree}`))})` : ''}</div>`).join('')
  const tr = rows.map((r) => `<tr><td>${esc(when(r.interview.startAt))}<div class="muted">${esc(t('rec.round'))} ${r.interview.round}${r.interview.location ? ` · ${esc(r.interview.location)}` : ''}</div></td>
    <td>${r.application.hasFile ? `<img class="ph" src="${esc(abs(photoUrl(r.application.id)))}" onerror="this.style.visibility='hidden'">` : ''}</td>
    <td><b>${esc(r.application.fullName)}</b><div class="muted">${esc(r.application.position)}${r.application.department ? ` · ${esc(r.application.department)}` : ''}</div></td>
    <td>${esc(r.interview.panel.map((p) => p.interviewerName ?? p.interviewerId).join(', '))}</td>
    <td>${r.application.expMonths != null ? esc(t('rec.cvf.years', { n: (Math.round(r.application.expMonths / 6) / 2).toLocaleString() })) : ''}${exp(r)}</td>
    <td>${r.application.birthYear ?? ''}</td>
    <td>${r.application.education ? `<b>${esc(t(`rec.edu.${r.application.education}`))}</b>` : ''}${edu(r)}</td></tr>`).join('')
  return openPrint(title, '', `<h1>${esc(title)}</h1><div class="sub">${rows.length} ${esc(t('rec.slot.peopleShort'))}</div>
    <table><thead><tr><th>${esc(t('rec.when'))}</th><th></th><th>${esc(t('rec.fullName'))}</th><th>${esc(t('rec.panel'))}</th><th>${esc(t('rec.cvf.exp'))}</th><th>${esc(t('rec.cvf.birth'))}</th><th>${esc(t('rec.cvf.edu'))}</th></tr></thead><tbody>${tr}</tbody></table>`)
}

const FIELDS: { f: InkField; k: 'strengths' | 'weaknesses' | 'comment' }[] = [{ f: 'strengths', k: 'strengths' }, { f: 'weaknesses', k: 'weaknesses' }, { f: 'comment', k: 'comment' }]

/** Phiếu đánh giá của hồ sơ (mọi vòng, từng người: điểm, nhận xét gõ và ảnh viết tay) để in / lưu PDF lưu hồ sơ. */
export function printEvaluation(t: T, lang: string, d: RecruitDetail) {
  const a = d.application
  const time = (v: string) => new Date(v).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
  const rounds = [...d.interviews].sort((x, y) => x.round - y.round).map((iv) => {
    const done = iv.panel.filter((p) => p.result)
    const scored = iv.panel.map((p) => p.scores).filter((s): s is NonNullable<typeof s> => !!s)
    const avg = scored.length > 0 ? Math.round((scored.reduce((n, s) => n + scoreTotal(s), 0) / scored.length) * 10) / 10 : null
    const people = done.map((p) => `<div class="card"><b>${esc(p.interviewerName ?? p.interviewerId)}</b> · ${esc(t(`rec.res.${p.result}`))}${p.scores ? ` · <b>${scoreTotal(p.scores)}/20</b> <span class="muted">(${SCORE_CRITERIA.map((k) => `${esc(t(`rec.sc.${k}`))}: ${p.scores![k]}`).join(' · ')})</span>` : ''}
      ${p.submittedAt ? `<div class="muted">${esc(time(p.submittedAt))}</div>` : ''}
      ${FIELDS.map(({ f, k }) => `${p[k] ? `<div><b>${esc(t(`rec.${k}`))}:</b> ${esc(p[k])}</div>` : ''}<img class="ink" src="${esc(abs(inkUrl(iv.id, p.interviewerId, f)))}" onerror="this.style.display='none'">`).join('')}</div>`).join('')
    return `<h2>${esc(t('rec.round'))} ${iv.round} · ${esc(time(iv.startAt))}${iv.location ? ` · ${esc(iv.location)}` : ''}${avg != null ? ` · ${esc(t('rec.avg.title'))}: <b>${avg}/20</b>` : ''}</h2>${people || `<div class="muted">${esc(t('rec.waiting'))}</div>`}`
  }).join('')
  const body = `<h1>${esc(t('rec.evalSheet'))}</h1><div class="sub">${esc(a.fullName)} · ${esc(a.position)}${a.department ? ` · ${esc(a.department)}` : ''}</div>
    <table><tr><th>${esc(t('rec.phone'))}</th><td>${esc(a.phone ?? '—')}</td><th>${esc(t('cov.status'))}</th><td>${esc(t(`rec.st.${a.status}`))}</td></tr>
    <tr><th>${esc(t('rec.scoreCol'))}</th><td>${a.score != null ? `${a.score}/20` : '—'}</td><th>${esc(t('rec.hrNote'))}</th><td>${esc(a.hrNote ?? '—')}</td></tr></table>${rounds}`
  return openPrint(`${t('rec.evalSheet')} - ${a.fullName}`, '', body)
}
