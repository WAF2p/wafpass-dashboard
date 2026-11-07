import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppErrorBoundary from '../components/AppErrorBoundary'

vi.mock('../lib/telemetry', () => ({
  reportError: vi.fn(),
}))

function Bomb(): never {
  throw new Error('boom')
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the fallback instead of a blank app', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })

  it('renders normal children unchanged', () => {
    render(
      <AppErrorBoundary>
        <div>healthy</div>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })
})
