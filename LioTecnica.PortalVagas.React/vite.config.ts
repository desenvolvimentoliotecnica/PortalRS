import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 7093,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:5056',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:5056',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
