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
    // Suppress chunk size warnings for expected large chunks:
    // - Recharts bundles D3 internally (~200KB), providing charts for 3 pages
    // - Leaflet is a full mapping library (~150KB), only used in Regions page
    // - index.html and main bundle (~500KB) includes all app logic
    // These chunks are loaded on-demand and benefit from browser caching
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {},
      },
    },
  },
  // Custom logger to suppress chunk size warnings
  customLogger: {
    warn(msg) {
      if (msg.includes('larger than 500 kB after minification')) return
    },
    info(msg) {
      if (msg.includes('larger than 500 kB after minification')) return
    },
    error(msg) {
      if (msg.includes('larger than 500 kB after minification')) return
    },
    debug(msg) {
      if (msg.includes('larger than 500 kB after minification')) return
    },
  },
})
