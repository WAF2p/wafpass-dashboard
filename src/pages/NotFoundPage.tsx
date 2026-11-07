import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="card" style={{ padding: '1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
      <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem' }}>
        Page not found
      </h1>
      <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 1rem' }}>
        The link is unknown or the page has moved.
      </p>
      <Link to="/dashboard" style={{ color: 'var(--waf-brand)', fontWeight: 600, textDecoration: 'none' }}>
        Back to dashboard
      </Link>
    </div>
  )
}
