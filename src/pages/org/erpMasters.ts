import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { idCards, type OrgDeptOption } from '../../api/idCards'

/** Khoá so tên danh mục ERP (giống ErpPushService.Key phía máy chủ): bỏ khoảng trắng thừa, không phân biệt hoa thường. */
export const erpKey = (s: string | null | undefined) => (s ?? '').normalize('NFC').trim().split(/\s+/).filter(Boolean).join(' ').toLowerCase()

/**
 * Chuỗi lưu trên thẻ cho một lựa chọn Bộ phận / Team / Part: các tên nối " / ", bỏ ô trống và tên trùng tên liền trước (Bộ phận thường trùng Team).
 * Cùng công thức với OrgErpDeptMap.ValueOf ở máy chủ.
 */
export const orgValueOf = (...segments: (string | null | undefined)[]) => {
  const parts: string[] = []
  for (const s of segments) {
    const t = (s ?? '').trim()
    if (!t || (parts.length > 0 && erpKey(parts[parts.length - 1]) === erpKey(t))) continue
    parts.push(t)
  }
  return parts.join(' / ')
}

/** Nhà máy ERP (bộ phận cấp 1) → sheet CMS: "Bắc Ninh Factory" = BN, mọi nhà máy khác = HY. */
export const erpFactorySite = (factory: string | null | undefined): 'BN' | 'HY' =>
  erpKey(factory).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd') === 'bac ninh factory' ? 'BN' : 'HY'

/**
 * Danh mục Bộ phận + Vị trí cho màn CCCD.
 * Bộ phận: chọn theo cây nhân sự CMS (Bộ phận / Team / Part, giống màn nhân sự); khi đồng bộ, máy chủ quy đổi sang bộ phận ERP
 * (theo người cùng nhóm đang có trong ERP, hoặc gán tay). Chưa có cây nhân sự thì chọn thẳng tên bộ phận ERP như trước.
 * Tên bộ phận ERP cũ đã lưu trên thẻ vẫn hợp lệ. Vị trí: danh mục ERP (UMJpSeq).
 */
export function useErpMasters() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['id-cards', 'erp-masters'], queryFn: idCards.erpMasters, staleTime: 600000, retry: false })
  const depts = q.data?.depts ?? []
  const org = q.data?.org ?? []
  const useOrg = org.length > 0
  const hasBn = depts.some((d) => erpFactorySite(d.factory) === 'BN')

  // --- bộ phận ERP (dùng khi chưa có cây nhân sự, và để nhận tên ERP cũ trên thẻ)
  const erpOptionsOf = (list: typeof depts) => {
    const byName = new Map<string, string[]>()
    for (const d of list) byName.set(d.name, [...(byName.get(d.name) ?? []), d.path])
    return [...byName.entries()].map(([name, paths]) => ({ value: name, label: paths.join(' | ') }))
  }
  const erpSites = new Map<string, Set<'BN' | 'HY'>>()
  for (const d of depts) { if (!d.factory) continue; const k = erpKey(d.name); erpSites.set(k, (erpSites.get(k) ?? new Set()).add(erpFactorySite(d.factory))) }
  const erpKeys = new Set(depts.map((d) => erpKey(d.name)))

  // --- bộ phận theo cây nhân sự
  const orgByKey = new Map<string, OrgDeptOption>(org.map((o) => [erpKey(o.value), o]))
  const orgLabel = (o: OrgDeptOption) => `${o.value}  →  ERP: ${o.erpDept ?? t('idc.erpUnmapped')}`
  const orgOptionsOf = (list: OrgDeptOption[]) => list.map((o) => ({ value: o.value, label: orgLabel(o) }))
  /** Nhà máy của lựa chọn nhân sự = nhà máy của bộ phận ERP quy đổi; '' = chưa rõ (dùng được ở cả hai sheet). */
  const orgSite = (o: OrgDeptOption): 'BN' | 'HY' | '' => (!hasBn || !o.erpFactory ? '' : erpFactorySite(o.erpFactory))

  const deptOptions = useOrg ? orgOptionsOf(org) : erpOptionsOf(depts)
  /** Bộ phận dùng được ở nhà máy của sheet đang chọn (BN = Bắc Ninh Factory, HY = còn lại); chưa rõ nhà máy thì hiện ở cả hai. */
  const deptOptionsFor = (site: string) => useOrg
    ? orgOptionsOf(org.filter((o) => { const s = orgSite(o); return !s || !site || s === site }))
    : (hasBn ? erpOptionsOf(depts.filter((d) => !d.factory || erpFactorySite(d.factory) === site)) : deptOptions)
  /** Sheet của bộ phận; '' = không rõ. */
  const siteOf = (v: string | null | undefined): 'BN' | 'HY' | '' => {
    if (!hasBn) return ''
    const o = orgByKey.get(erpKey(v))
    if (o) return orgSite(o)
    const s = erpSites.get(erpKey(v)); return s && s.size === 1 ? [...s][0] : ''
  }
  /** Bộ phận ERP sẽ ghi cho giá trị trên thẻ (null = chưa quy đổi được / không có). */
  const erpDeptOf = (v: string | null | undefined): string | null => {
    const o = orgByKey.get(erpKey(v)); if (o) return o.erpDept
    return erpKeys.has(erpKey(v)) ? (v ?? '').trim() : null
  }
  const posOptions = [...new Set((q.data?.positions ?? []).map((p) => p.name))].map((v) => ({ value: v }))
  const posKeys = new Set(posOptions.map((o) => erpKey(o.value)))
  /** Chức danh đang dùng trên màn nhân sự CMS (OP trước nếu chưa có). */
  const titleOptions = [...new Set(['OP', ...(q.data?.titles ?? [])])].map((v) => ({ value: v }))
  const loaded = !!q.data
  /** true = đã tải danh mục và giá trị này không quy đổi được sang bộ phận ERP (ô trống không tính). */
  const badDept = (v: string | null | undefined) => loaded && !!erpKey(v) && !erpDeptOf(v)
  const badPos = (v: string | null | undefined) => loaded && !!erpKey(v) && !posKeys.has(erpKey(v))
  /** true = bộ phận (ERP quy đổi) thuộc nhà máy của sheet kia. */
  const otherSite = (v: string | null | undefined, site: string) => { const s = siteOf(v); return !!s && !!site && s !== site }
  return { deptOptions, deptOptionsFor, siteOf, otherSite, erpDeptOf, posOptions, titleOptions, badDept, badPos, loaded, failed: q.isError, org, depts, useOrg }
}
