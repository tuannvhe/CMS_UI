import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// API .NET chạy ở http://localhost:5285 (profile "http" trong launchSettings.json)
export default defineConfig(({ mode }) => {
  // API_TARGET (tuỳ chọn) trong .env.local hoặc biến môi trường để trỏ sang API khác
  const apiTarget = loadEnv(mode, '.', '').API_TARGET || 'http://localhost:5285'
  return {
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          vendor: ['@tanstack/react-query', 'axios', 'i18next', 'react-i18next'],
        },
      },
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/hubs': { target: apiTarget, changeOrigin: true, ws: true },
    },
  },
}
})
