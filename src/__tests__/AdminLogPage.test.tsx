import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AdminLogPage from '../pages/AdminLogPage'
import type { AdminAuditLogEntry } from '../api'

const mockLogs: AdminAuditLogEntry[] = [
  {
    id: 'log-1',
    actor_id: 'user-1',
    actor_username: 'alice',
    action: 'login',
    detail: { user_agent: 'Mozilla/5.0' },
    ip: '10.0.0.1',
    mandant_id: 'mandate-1',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'log-2',
    actor_id: 'user-2',
    actor_username: 'bob',
    action: 'user.delete',
    detail: { target_user_id: 'user-3' },
    ip: '10.0.0.2',
    mandant_id: null,
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
]

function makeFetch(data: AdminAuditLogEntry[], ok = true) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    ({
      ok,
      status: ok ? 200 : 403,
      json: async () => ({ data }),
    }) as Response
  )
}

describe('AdminLogPage', () => {
  let fetchMock: ReturnType<typeof makeFetch>

  beforeEach(() => {
    fetchMock = makeFetch(mockLogs)
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockClear()
  })

  it('renders the panel title and loads server-side audit events', async () => {
    render(<AdminLogPage />)

    expect(screen.getByText('Admin Audit Log')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument()
      expect(screen.getByText('bob')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const logCall = fetchMock.mock.calls.find(c => /\/api\/v1\/admin\/logs$/.test(new URL(c[0] as string).pathname))
    expect(logCall).toBeDefined()
    const url = new URL(logCall![0] as string)
    expect(url.searchParams.get('limit')).toBe('500')
  })

  it('filters events by search term', async () => {
    render(<AdminLogPage />)
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/Search actions, actors, IPs/i)
    fireEvent.change(searchInput, { target: { value: 'bob' } })

    await waitFor(() => {
      expect(screen.queryByText('alice')).not.toBeInTheDocument()
      expect(screen.getByText('bob')).toBeInTheDocument()
    })
  })

  it('filters events by action type', async () => {
    render(<AdminLogPage />)
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument())

    const actionSelect = screen.getByRole('combobox', { name: '' })
    fireEvent.change(actionSelect, { target: { value: 'user.delete' } })

    await waitFor(() => {
      expect(screen.queryByText('alice')).not.toBeInTheDocument()
      expect(screen.getByText('bob')).toBeInTheDocument()
    })
  })

  it('shows an access-denied message when the API returns 403', async () => {
    globalThis.fetch = makeFetch(mockLogs, false)

    render(<AdminLogPage />)

    await waitFor(() => {
      expect(screen.getByText(/Admin role required/i)).toBeInTheDocument()
    })
  })

  it('switches to the raw details sub-tab', async () => {
    render(<AdminLogPage />)
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument())

    const detailsTab = screen.getByRole('button', { name: /Raw Details \(\d+\)/i })
    fireEvent.click(detailsTab)

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /Timestamp/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /Action/i })).toBeInTheDocument()
    })
  })
})
