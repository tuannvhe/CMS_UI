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

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
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
