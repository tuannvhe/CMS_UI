import { useState } from 'react'
import { Form, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { erpKey, orgValueOf, useErpMasters } from './erpMasters'
import { foldFilter } from '../../utils/search'

const uniq = (xs: (string | null)[]) =>
  [...new Set(xs.filter((x): x is string => !!x && !!x.trim()))].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ value: v }))

/**
 * Ba ô Bộ phận › Team › Part theo cây nhân sự CMS (giống màn nhân sự). Giá trị (value / onChange) là chuỗi lưu trên thẻ "Bộ phận / Team / Part";
 * chưa chọn đủ (bộ phận có Team mà chưa chọn Team) thì trả ''. Giá trị cũ không thuộc cây (tên bộ phận ERP) hiện ở dòng ghi chú.
 * onPart: gọi khi chọn Part (để điền chức danh OP).
 */
export default function OrgDeptFields({ value, onChange, site, onPart }: { value?: string; onChange?: (v: string) => void; site?: string; onPart?: () => void }) {
  const { t } = useTranslation()
  const erpM = useErpMasters()
  const org = erpM.org.filter((o) => { const s = erpM.siteOf(o.value); return !s || !site || s === site })
  const cur = erpM.org.find((o) => erpKey(o.value) === erpKey(value))
  // Lựa chọn dở dang (chọn Bộ phận chưa chọn Team): value lúc đó là '' nên giữ riêng ở đây.
  const [draft, setDraft] = useState<{ d: string; t: string } | null>(null)
  const d = cur?.dept ?? draft?.d ?? '', tm = cur?.team ?? draft?.t ?? '', pt = cur?.part ?? ''
  const teams = uniq(org.filter((o) => erpKey(o.dept) === erpKey(d)).map((o) => o.team))
  const parts = uniq(org.filter((o) => erpKey(o.dept) === erpKey(d) && erpKey(o.team) === erpKey(tm)).map((o) => o.part))
  const set = (nd: string, nt: string, np: string) => {
    const same = (x: { dept: string; team: string | null; part: string | null }) => erpKey(x.dept) === erpKey(nd) && erpKey(x.team) === erpKey(nt) && erpKey(x.part) === erpKey(np)
    // Chọn tới Team là đủ (Part không bắt buộc): mục khớp theo nhà máy, không có thì trong cả cây, vẫn không có thì ghép "Bộ phận / Team".
    const o = org.find(same) ?? erpM.org.find(same)
    setDraft({ d: nd, t: nt })
    onChange?.(o?.value ?? (nt ? orgValueOf(nd, nt, np) : ''))
    if (np) onPart?.()
  }
  const legacy = !!value?.trim() && !cur   // tên bộ phận ERP cũ trên thẻ
  return (
    <>
      <Form.Item label={t('idc.col.department')} extra={legacy ? t('idc.col.legacyDept', { v: value }) : cur ? `ERP: ${cur.erpDept ?? t('idc.col.erpNone')}` : undefined}>
        <Select showSearch allowClear value={d || undefined} options={uniq(org.map((o) => o.dept))} popupMatchSelectWidth={320} filterOption={foldFilter()}
          onChange={(v?: string) => set(v ?? '', '', '')} />
      </Form.Item>
      <Form.Item label={t('idc.col.team')}>
        <Select showSearch allowClear value={tm || undefined} options={teams} disabled={!d || !teams.length} popupMatchSelectWidth={320} filterOption={foldFilter()}
          status={!!d && !value && !tm && teams.length ? 'warning' : undefined} onChange={(v?: string) => set(d, v ?? '', '')} />
      </Form.Item>
      <Form.Item label={t('idc.col.part')}>
        <Select showSearch allowClear value={pt || undefined} options={parts} disabled={!tm || !parts.length} popupMatchSelectWidth={320} filterOption={foldFilter()}
          onChange={(v?: string) => set(d, tm, v ?? '')} />
      </Form.Item>
    </>
  )
}
