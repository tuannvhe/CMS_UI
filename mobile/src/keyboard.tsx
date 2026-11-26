/*
 * 2026-11-26 - Mobile app: chừa chỗ cho bàn phím
 * Từ Expo SDK 53, Android luôn vẽ tràn màn hình (edge-to-edge) nên cửa sổ KHÔNG tự co lại khi bàn phím bật và
 * KeyboardAvoidingView (behavior undefined) không làm gì: ô đang gõ bị bàn phím che. KeyboardView đệm dưới đúng bằng chiều cao
 * bàn phím trên cả Android và iOS, dùng thay KeyboardAvoidingView ở mọi màn / hộp thoại có ô nhập.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Keyboard, Platform, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Chiều cao bàn phím đang hiện (0 = đang ẩn). */
export function useKeyboardHeight() {
  const [h, setH] = useState(0)
  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setH(e.endCoordinates.height))
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0))
    return () => { show.remove(); hide.remove() }
  }, [])
  return h
}

/**
 * Khung co lại khi bàn phím bật. bottomInset = phần đệm an toàn phía dưới mà nội dung đã tự chừa (thanh điều hướng / home indicator):
 * bàn phím đè lên phần đó nên trừ ra để không hở khoảng trống.
 */
export function KeyboardView({ children, style, bottomInset }: { children: ReactNode; style?: StyleProp<ViewStyle>; bottomInset?: number }) {
  const h = useKeyboardHeight()
  const insets = useSafeAreaInsets()
  const pad = h > 0 ? Math.max(0, h - (bottomInset ?? 0)) : 0
  // Android: chiều cao bàn phím chưa tính thanh điều hướng dưới (edge-to-edge) nên cộng thêm để ô nhập nằm hẳn trên bàn phím
  const extra = h > 0 && Platform.OS === 'android' ? insets.bottom : 0
  return <View style={[{ flex: 1 }, style, { paddingBottom: pad + extra }]}>{children}</View>
}
