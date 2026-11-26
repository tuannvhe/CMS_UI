/* 2026-11-23 [Truong] - Mobile app: root layout (providers + login guard)
 * 2026-11-26: ThemeProvider (màu + sáng / tối), màn Cài đặt, trạng thái khoá (đăng nhập vân tay / Face ID) dùng màn đăng nhập. */
import { useEffect, useState } from 'react'
import { ActivityIndicator, AppState, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import '../i18n'
import { AuthProvider, useAuth } from '../auth/AuthProvider'
import { ThemeProvider, useTheme } from '../theme'

function RootNavigator() {
  const { status } = useAuth()
  const { C } = useTheme()
  if (status === 'loading') return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.brand} /></View>
  const signedIn = status === 'signedIn'
  return (
    <>
      <StatusBar style={C.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerShown: false, contentStyle: { backgroundColor: C.bg },
        headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerTintColor: C.brand,
        headerTitleStyle: { color: C.text, fontWeight: '700' }, headerBackButtonDisplayMode: 'minimal',
      }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="approval-group" options={{ headerShown: true }} />
          <Stack.Screen name="request-form" options={{ headerShown: true }} />
          <Stack.Screen name="settings" options={{ headerShown: true }} />
          <Stack.Screen name="qa" options={{ headerShown: true }} />
          <Stack.Screen name="qa-thread" options={{ headerShown: true }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  )
}

export default function RootLayout() {
  // Quay lại app (từ nền / màn khác) thì react-query tải lại các màn đang mở, như khi bấm lại vào tab trình duyệt trên web
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => focusManager.setFocused(st === 'active'))
    return () => sub.remove()
  }, [])
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }))
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
