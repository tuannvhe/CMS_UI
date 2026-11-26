/*
 * 2026-11-26 - Mobile app: bong bóng chat Hỏi đáp nổi trên các tab (kiểu chat head của Messenger)
 * Kéo đi được, thả ra thì tự dạt về mép trái / phải gần nhất (không che nút dưới màn hình). Chấm đỏ = số chủ đề nhân sự trả lời mà chưa xem.
 * Chỉ hiện khi trang Hỏi đáp đang mở cho người này (ngày 1–7 hằng tháng hoặc theo phân quyền), xem access.ts.
 */
import { useMemo, useRef } from 'react'
import { Animated, PanResponder, Text, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { qa } from '@web/api/qa'
import { qaThreadsKey, useQaSeen } from '../qaSeen'
import { useTheme } from '../ui'

const SIZE = 58
const EDGE = 12
/** Chiều cao thanh tab (không tính phần an toàn dưới) để bong bóng nằm trên thanh tab. */
const TAB_BAR = 56

export function QaBubble() {
  const { t } = useTranslation()
  const { C } = useTheme()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: qaThreadsKey, queryFn: () => qa.allThreads('mine'), refetchInterval: 60_000 })
  const { unread } = useQaSeen(q.data)
  const waiting = (q.data ?? []).some((x) => x.awaitingStaff)

  const minY = insets.top + 8
  const maxY = height - insets.bottom - TAB_BAR - SIZE - EDGE
  const pos = useRef(new Animated.ValueXY({ x: width - SIZE - EDGE, y: maxY - 90 })).current
  const last = useRef({ x: width - SIZE - EDGE, y: maxY - 90 })

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
    onPanResponderGrant: () => { pos.setOffset(last.current); pos.setValue({ x: 0, y: 0 }) },
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      pos.flattenOffset()
      // Chạm nhẹ (gần như không kéo) = mở Hỏi đáp
      if (Math.abs(g.dx) + Math.abs(g.dy) < 6) { router.push('/qa'); return }
      const cx = last.current.x + g.dx + SIZE / 2
      const x = cx < width / 2 ? EDGE : width - SIZE - EDGE
      const y = Math.min(maxY, Math.max(minY, last.current.y + g.dy))
      last.current = { x, y }
      Animated.spring(pos, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start()
    },
  }), [pos, width, minY, maxY])

  return (
    <Animated.View {...pan.panHandlers} accessibilityRole="button" accessibilityLabel={t('qa.panel')}
      style={{ position: 'absolute', left: 0, top: 0, transform: pos.getTranslateTransform(), zIndex: 50 }}>
      <View style={{
        width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, borderColor: C.card, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
      }}>
        <Ionicons name="chatbubble-ellipses" size={27} color={C.onBrand} />
      </View>
      {unread > 0 ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : waiting ? (
        <View style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: C.warn, borderWidth: 2, borderColor: C.card }} />
      ) : null}
    </Animated.View>
  )
}
