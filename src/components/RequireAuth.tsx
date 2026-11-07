import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import ForcePasswordChange from './ForcePasswordChange'

/** Session gate for every authenticated route. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.must_change_password) return <ForcePasswordChange />
  return <>{children}</>
}
