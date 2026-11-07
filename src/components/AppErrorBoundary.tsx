import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/telemetry'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Root render-error boundary. A page error must never blank the whole app.
 * Route-level errors are also caught by the router's errorElement.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack ?? undefined, type: 'render' })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: '1rem',
      }}>
        <div className="card" style={{ padding: '1.5rem', maxWidth: '520px', width: '100%' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 1rem' }}>
            The dashboard hit an unexpected error. Your data is safe. Reload the page or return to the dashboard.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid var(--waf-brand)',
                background: 'var(--waf-brand)', color: '#fff', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reload
            </button>
            <a
              href="#/dashboard"
              onClick={() => this.setState({ error: null })}
              style={{
                padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }
}
