import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from './theme'
import { migrateLegacyStorage } from './legacyStorage'
import './index.css'

migrateLegacyStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
