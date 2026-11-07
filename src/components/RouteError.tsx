import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'

/** Router-level error element: keeps the navigation shell usable. */
export default function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected routing error'

  return (
    <div className="card" style={{ padding: '1.5rem', maxWidth: '560px', margin: '2rem auto' }}>
      <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem' }}>
        This page could not be loaded
      </h1>
      <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 1rem' }}>
        {message}
      </p>
      <Link to="/dashboard" style={{ color: 'var(--waf-brand)', fontWeight: 600, textDecoration: 'none' }}>
        Back to dashboard
      </Link>
    </div>
  )
}
