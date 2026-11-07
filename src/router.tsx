import { createHashRouter, Navigate } from 'react-router-dom'

import { useAuth } from './AuthContext'
import AppShell from './components/AppShell'
import RequireAuth from './components/RequireAuth'
import RouteError from './components/RouteError'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import { pageRoutes } from './routes'

function LoginRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }
  if (user) return <Navigate to="/dashboard" replace />
  return <LoginPage />
}

/**
 * Hash router keeps the existing #/page?run=... deep links working while
 * giving every page a real route and a shared error boundary.
 */
export const router = createHashRouter([
  { path: '/login', element: <LoginRoute /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...pageRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
