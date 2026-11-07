import type { ReactNode } from 'react'

/** Shared loading/error/empty views so pages stop inventing their own markup. */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', minHeight: '120px', color: 'var(--muted)', fontSize: '0.85rem' }}
    >
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  requestId,
}: {
  message: string
  onRetry?: () => void
  requestId?: string
}) {
  return (
    <div role="alert" className="card" style={{ padding: '1rem', borderColor: 'color-mix(in srgb, var(--fail) 30%, var(--border))' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--fail-ink)', fontWeight: 600, marginBottom: '0.35rem' }}>
        {message}
      </div>
      {requestId && (
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          Request ID: <code>{requestId}</code>
        </div>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyStateView({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
          {description}
        </div>
      )}
      {action}
    </div>
  )
}
