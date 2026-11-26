/* 2026-11-23 [Truong] - Mobile app: status of each approval level of a submitted request */
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ApprovalStep, StepStatus } from '@web/api/requests'
import { Tag, useTheme, type Colors } from '../ui'

export const statusColor = (C: Colors): Record<StepStatus, string> => ({ none: C.muted, waiting: C.info, approved: C.dark ? '#32D583' : '#079455', rejected: C.danger })

/** steps: [nhãn cấp, trạng thái]; cấp không dùng (none) không hiện. */
export function StepStatusList({ steps }: { steps: [string, ApprovalStep][] }) {
  const { C, s } = useTheme()
  const { t } = useTranslation()
  const active = steps.filter(([, st]) => st.status !== 'none')
  if (active.length === 0) return null
  return (
    <View style={{ gap: 4 }}>
      {active.map(([label, st]) => (
        <View key={label} style={{ gap: 2 }}>
          <View style={[s.row, { gap: 8 }]}>
            <Text style={[s.muted, { width: 96 }]} numberOfLines={1}>{label}</Text>
            <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{st.name}</Text>
            <Tag text={t(`req.status.${st.status}`)} color={statusColor(C)[st.status]} />
          </View>
          {!!st.rejectReason && <Text style={[s.muted, { color: C.danger, paddingLeft: 104 }]}>{st.rejectReason}</Text>}
        </View>
      ))}
    </View>
  )
}
