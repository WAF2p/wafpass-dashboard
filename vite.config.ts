import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.VITE_API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // API routes are versioned under /api/v1; /api catches them all.
      '/api':              { target: API, changeOrigin: true },
      '/health':           { target: API, changeOrigin: true },
      '/framework-update-info.yml': { target: API, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    // Emit source maps for error reporting. They are not referenced by the
    // nginx-served app; upload them to the telemetry backend, not the CDN.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown requires the function form.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // Keep the always-loaded framework/runtime code in stable vendor
          // chunks. Charts and maps stay with their lazy routes so the initial
          // HTML does not preload maplibre/recharts on the login screen.
          if (id.includes('@tanstack/react-query')) return 'query'
          if (id.includes('react-router') || id.includes('/react/') || id.includes('react-dom')) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
})
