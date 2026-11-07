import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'

import App from './App'
import { AuthProvider } from './AuthContext'
import AppErrorBoundary from './components/AppErrorBoundary'
import { queryClient } from './lib/queryClient'
import { initTelemetry } from './lib/telemetry'
import { migrateLegacyStorage } from './legacyStorage'
import { ThemeProvider } from './theme'
import './index.css'

migrateLegacyStorage()
initTelemetry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>
)
