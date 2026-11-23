/* 2026-11-23 [Truong] - Mobile app: approver chain (same rules as the web ApproverChain: min 2 levels, next level appears after the previous one) */
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Approver } from '@web/api/requests'
import { MIN_APPROVERS } from '../requests'
import { C, s } from '../ui'
import { SelectField, type SheetOption } from './SelectSheet'

export function ApproverChainField({ count, values, onChange, approvers, disabled, loading }: {
  count: number; values: (string | undefined)[]; onChange: (next: (string | undefined)[]) => void; approvers: Approver[]; disabled?: boolean; loading?: boolean
}) {
  const { t } = useTranslation()
  const lastFilled = values.slice(0, count).reduce((m, v, i) => (v ? i : m), -1)
  const visible = Math.min(count, Math.max(MIN_APPROVERS, lastFilled + 2))
  const chosen = values.slice(0, count).filter(Boolean).length
  const options: SheetOption[] = approvers.map((a) => ({ value: a.userId, label: a.name, hint: a.email ?? t('sh.noEmail') }))
  const set = (i: number, v: string | undefined) => {
    const next = Array.from({ length: count }, (_, j) => values[j])
    next[i] = v
    if (!v) for (let j = i + 1; j < count; j++) next[j] = undefined   // bỏ một cấp thì bỏ luôn các cấp sau
    onChange(next)
  }
  // Người duyệt chưa có email: vẫn chọn được, nhưng không nhận được mail báo đơn chờ duyệt (ApproverEmailWarning của web)
  const noEmail = Array.from(new Set(values.filter(Boolean) as string[])).map((id) => approvers.find((a) => a.userId === id)).filter((a) => a && !a.email).map((a) => a!.name)

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.muted}>{t('req.chainDone', { n: chosen, total: count })}</Text>
      {Array.from({ length: visible }, (_, i) => (
        <SelectField key={i} label={t('req.approverLevel', { n: i + 1 })} value={values[i]} options={options} onChange={(v) => set(i, v)}
          disabled={disabled} loading={loading} allowClear />
      ))}
      {noEmail.length > 0 && <Text style={[s.muted, { color: '#B54708' }]}>{t('req.noEmailWarn', { names: noEmail.join(', '), count: noEmail.length })}</Text>}
      {disabled && <Text style={[s.muted, { color: C.muted }]}>{t('mobile.reqf.pickPeopleFirst')}</Text>}
    </View>
  )
}
