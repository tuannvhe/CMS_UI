/* 2026-11-23 [Truong] - Mobile app: who the request is for — myself, or on behalf of others (department → tick employees, or type codes) */
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { lookups } from '@web/api/requests'
import { foldText } from '@web/utils/search'
import { Button, useTheme } from '../ui'
import { SelectField } from './SelectSheet'

export type PeopleMode = 'self' | 'proxy'

export interface PeopleValue { mode: PeopleMode; department?: string; checked: string[]; manual: string }

export const splitCodes = (v: string) => v.split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean)

/** Mã nhân viên sẽ gửi lên (chế độ "Cho tôi": mã của tài khoản). */
export function peopleIds(v: PeopleValue, selfId: string) {
  return v.mode === 'self' ? (selfId ? [selfId] : []) : Array.from(new Set([...v.checked, ...splitCodes(v.manual)]))
}

const LONG = 10 * 60 * 1000

export function EmployeePicker({ value, onChange, selfId, selfName }: { value: PeopleValue; onChange: (v: PeopleValue) => void; selfId: string; selfName: string }) {
  const { C, s } = useTheme()
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const departments = useQuery({ queryKey: ['req', 'departments'], queryFn: lookups.departments, staleTime: LONG, enabled: value.mode === 'proxy' })
  const employees = useQuery({ queryKey: ['req', 'employees', value.department], queryFn: () => lookups.employees(value.department!), enabled: value.mode === 'proxy' && !!value.department, staleTime: 60_000 })
  const visible = useMemo(() => {
    const f = foldText(filter.trim())
    return (employees.data ?? []).filter((e) => !f || foldText(e.label).includes(f))
  }, [employees.data, filter])
  const set = (patch: Partial<PeopleValue>) => onChange({ ...value, ...patch })
  const toggle = (id: string) => set({ checked: value.checked.includes(id) ? value.checked.filter((x) => x !== id) : [...value.checked, id] })

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['self', 'proxy'] as const).map((m) => (
          <Pressable key={m} onPress={() => set({ mode: m })}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', borderColor: value.mode === m ? C.brand : C.border, backgroundColor: value.mode === m ? C.brand : C.card }}>
            <Text style={{ color: value.mode === m ? C.onBrand : C.text, fontWeight: '600' }}>{t(m === 'self' ? 'mobile.reqf.forMe' : 'mobile.reqf.forOthers')}</Text>
          </Pressable>
        ))}
      </View>

      {value.mode === 'self' ? (
        <Text style={s.body}>{selfId ? `${selfId} · ${selfName}` : t('att.noEmployee')}</Text>
      ) : (
        <>
          <SelectField label={t('req.deptPlaceholder')} value={value.department} allowClear loading={departments.isLoading}
            options={(departments.data ?? []).map((d) => ({ value: d, label: d }))}
            onChange={(d) => { setFilter(''); onChange({ ...value, department: d, checked: [] }) }} />
          {!!value.department && (
            <View style={{ gap: 8 }}>
              <TextInput style={s.input} value={filter} onChangeText={setFilter} placeholder={t('req.filterEmp')} autoCorrect={false} />
              <View style={[s.row, { gap: 8 }]}>
                <Text style={[s.muted, { flex: 1 }]}>{t('req.countSelected', { n: value.checked.length, total: employees.data?.length ?? 0 })}</Text>
                <Button small kind="ghost" title={t('req.selectAll')} onPress={() => set({ checked: Array.from(new Set([...value.checked, ...visible.map((e) => e.value)])) })} />
                <Button small kind="ghost" title={t('req.clearAll')} onPress={() => set({ checked: [] })} />
              </View>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 280, borderWidth: 1, borderColor: C.border, borderRadius: 10 }}>
                {employees.isLoading && <Text style={[s.muted, { padding: 12 }]}>{t('mobile.loading')}</Text>}
                {visible.map((e) => {
                  const on = value.checked.includes(e.value)
                  return (
                    <Pressable key={e.value} onPress={() => toggle(e.value)} style={{ flexDirection: 'row', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: C.border, backgroundColor: on ? C.unread : C.card }}>
                      <Text style={{ color: on ? C.brand : C.muted, fontSize: 18 }}>{on ? '☑' : '☐'}</Text>
                      <Text style={[s.body, { flex: 1 }]}>{e.label}</Text>
                    </Pressable>
                  )
                })}
                {employees.isSuccess && visible.length === 0 && <Text style={[s.muted, { padding: 12 }]}>{t('mobile.empty')}</Text>}
              </ScrollView>
            </View>
          )}
          <TextInput style={s.input} value={value.manual} onChangeText={(m) => set({ manual: m })} placeholder={t('req.manualIds')}
            autoCapitalize="characters" autoCorrect={false} />
          <Text style={[s.muted, { fontSize: 12 }]}>{t('req.manualHint')}</Text>
          <CodeInfo value={value.manual} />
        </>
      )}
    </View>
  )
}

/** Tên / bộ phận của từng mã gõ tay (EmployeeCodeInfo của web); mã không có báo đỏ. */
function CodeInfo({ value }: { value: string }) {
  const { C, s } = useTheme()
  const { t } = useTranslation()
  const codes = Array.from(new Set(splitCodes(value).filter((c) => /^[\w-]{3,30}$/.test(c)))).slice(0, 50)
  const key = codes.join(',')
  const [probe, setProbe] = useState('')
  useEffect(() => { const h = setTimeout(() => setProbe(key), 400); return () => clearTimeout(h) }, [key])
  const q = useQuery({ queryKey: ['req', 'employee-info', probe], queryFn: () => lookups.employeeInfo(probe.split(',')), enabled: !!probe, staleTime: 5 * 60 * 1000, retry: false })
  if (!probe || codes.length === 0) return null
  const found = new Map((q.data ?? []).map((e) => [e.employeeId.toLowerCase(), e]))
  return (
    <View style={{ gap: 4 }}>
      {codes.filter((c) => probe.split(',').includes(c)).map((c) => {
        const e = found.get(c.toLowerCase())
        if (q.isLoading) return <Text key={c} style={s.muted}>{c} …</Text>
        if (!e) return <Text key={c} style={[s.muted, { color: C.danger }]}>{c} · {t('req.codeNotFound')}</Text>
        return <Text key={c} style={s.muted}><Text style={{ fontWeight: '700', color: C.text }}>{e.employeeId} · {e.fullName}</Text>{` · ${[e.position, e.department].filter(Boolean).join(' · ')}`}</Text>
      })}
    </View>
  )
}
