import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.VITE_API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':     { target: API, changeOrigin: true },
      '/runs':     { target: API, changeOrigin: true },
      '/controls': { target: API, changeOrigin: true },
      '/waivers':  { target: API, changeOrigin: true },
      '/risks':    { target: API, changeOrigin: true },
      '/sandbox':  { target: API, changeOrigin: true },
      '/scan':     { target: API, changeOrigin: true },
      '/health':   { target: API, changeOrigin: true },
      '/projects': { target: API, changeOrigin: true },
      '/sso':      { target: API, changeOrigin: true },
      '/evidence': { target: API, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
})
