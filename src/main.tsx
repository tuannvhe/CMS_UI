import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import './i18n'
import './index.css'
import { AuthProvider } from './auth/AuthContext'
import { AppThemeProvider } from './theme/ThemeProvider'
import App from './App'
import { initMotion } from './utils/motion'

initMotion()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, refetchOnWindowFocus: false,
      // Máy chủ trả 429 khi màn nặng đang chạy (mỗi tài khoản 1 lần tại một thời điểm): thử lại sau vài giây thay vì báo lỗi ngay; lỗi khác thử lại 1 lần
      retry: (n, e) => ((e as { response?: { status?: number } }).response?.status === 429 ? n < 4 : n < 1),
      retryDelay: (n, e) => ((e as { response?: { status?: number } }).response?.status === 429 ? Math.min(3000 * (n + 1), 12000) : 1000),
    },
  },
})

// Cài được như ứng dụng trên điện thoại (chỉ bản chạy thật; bản dev không đăng ký để khỏi vướng khi sửa code)
if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined) })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppThemeProvider>
  </StrictMode>,
)
