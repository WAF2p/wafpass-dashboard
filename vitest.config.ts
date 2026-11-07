import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Playwright specs live in e2e/ and must not be collected by Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/__tests__/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      // Baseline ratchet: measured 2026-11-06 at 8.05% statements / 5.8%
      // branches / 6.83% functions / 8.67% lines. Raise these as Wave 3 adds
      // tests; never lower them to make a red build green.
      thresholds: {
        statements: 8,
        branches: 6,
        functions: 7,
        lines: 8.5,
      },
    },
  },
})
