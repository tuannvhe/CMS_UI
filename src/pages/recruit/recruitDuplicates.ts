import type { RecruitApplication } from '../../api/recruit'

/** Lý do trùng giữa hai hồ sơ: SĐT, email, hoặc cùng họ tên + năm sinh. */
export type DupReason = 'phone' | 'email' | 'nameBirth'
export interface DupInfo { ids: number[]; reasons: DupReason[] }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
/** Chỉ giữ chữ số, đầu 84 đổi thành 0 (cùng quy tắc chuẩn hoá SĐT ở máy chủ); dưới 9 số coi như không có. */
const phoneKey = (p?: string | null) => {
  let d = (p ?? '').replace(/\D/g, '')
  if (d.startsWith('84')) d = '0' + d.slice(2)
  return d.length >= 9 ? d : null
}
const emailKey = (e?: string | null) => { const v = (e ?? '').trim().toLowerCase(); return v.includes('@') ? v : null }
const nameKey = (a: RecruitApplication) => { const n = fold(a.fullName); return n && a.birthYear != null ? `${n}|${a.birthYear}` : null }

/** Tìm các hồ sơ trùng nhau trong danh sách: map từ mã hồ sơ sang các hồ sơ còn lại cùng nhóm và lý do. Hồ sơ không trùng ai thì không có trong map. */
export function findDuplicates(apps: RecruitApplication[]): Map<number, DupInfo> {
  const buckets = new Map<string, number[]>()
  const add = (k: string | null, tag: DupReason, id: number) => { if (k) { const key = `${tag}:${k}`; const b = buckets.get(key); if (b) b.push(id); else buckets.set(key, [id]) } }
  for (const a of apps) { add(phoneKey(a.phone), 'phone', a.id); add(emailKey(a.email), 'email', a.id); add(nameKey(a), 'nameBirth', a.id) }
  const out = new Map<number, DupInfo>()
  for (const [key, ids] of buckets) {
    if (ids.length < 2) continue
    const reason = key.slice(0, key.indexOf(':')) as DupReason
    for (const id of ids) {
      const cur = out.get(id) ?? { ids: [], reasons: [] }
      for (const o of ids) if (o !== id && !cur.ids.includes(o)) cur.ids.push(o)
      if (!cur.reasons.includes(reason)) cur.reasons.push(reason)
      out.set(id, cur)
    }
  }
  return out
}
