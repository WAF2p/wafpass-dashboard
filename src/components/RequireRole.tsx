import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { hasMinRole } from '../AuthContext'

export function ForbiddenPage() {
  return (
    <div className="card" style={{ padding: '1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
      <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem' }}>
        Access denied
      </h1>
      <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 1rem' }}>
        Your role does not grant access to this page. Ask an administrator if you need it.
      </p>
      <Link to="/dashboard" style={{ color: 'var(--waf-brand)', fontWeight: 600, textDecoration: 'none' }}>
        Back to dashboard
      </Link>
    </div>
  )
}

/** Client-side route gate. The server still enforces every permission. */
export default function RequireRole({
  userRole,
  minimum,
  children,
}: {
  userRole: string
  minimum: string
  children: ReactNode
}) {
  if (!hasMinRole(userRole, minimum)) return <ForbiddenPage />
  return <>{children}</>
}
