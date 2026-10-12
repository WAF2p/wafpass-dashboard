import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { useAuth } from '../AuthContext'
import MandateAdministrationPage from '../pages/MandateAdministrationPage'

// Phase 5 — "the admin UI's activation section renders only for
// admin/holding_admin" (.plan.md Phase 5.2). First component-render test
// in this dashboard: the existing suite only unit-tests pure functions
// against a mocked `fetch`, so this follows that same established
// pattern rather than introducing module mocking just for this one page.

vi.mock('../AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../AuthContext')>('../AuthContext')
  return { ...actual, useAuth: vi.fn() }
})

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  (useAuth as unknown as Mock).mockReturnValue({
    user: null, accessToken: null, role: 'engineer', isLoading: false,
    mandantId: null, isHoldingAdmin: false, isHoldingViewer: false,
    login: vi.fn(), loginWithTokens: vi.fn(), logout: vi.fn(), refreshUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

function mockInstanceModeResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ data: body, meta: {} }), { status: 200 })
}

describe('MandateAdministrationPage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('shows an access-denied message for a plain, non-holding-admin role (no instance-mode call made)', async () => {
    mockAuth({ role: 'engineer', isHoldingAdmin: false })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(<MandateAdministrationPage />)

    expect(await screen.findByText(/admin or holding_admin role required/i)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders the activation control for an admin, in single-tenant mode', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockInstanceModeResponse({
      instance_mode: 'single_tenant', changed_at: null, changed_by_username: null,
      can_activate: true, user_count: 3, mandant_count: 0,
    }))

    render(<MandateAdministrationPage />)

    expect(await screen.findByText(/activate multi-mandant mode/i)).toBeInTheDocument()
    // Extensive impact info is expanded by default *before* activation.
    expect(screen.getByText(/what activating multi-mandant mode actually changes/i)).toBeInTheDocument()
  })

  it('renders the activation control for a holding_admin whose own role is not "admin"', async () => {
    mockAuth({ role: 'clevel', isHoldingAdmin: true })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockInstanceModeResponse({
      instance_mode: 'single_tenant', changed_at: null, changed_by_username: null,
      can_activate: true, user_count: 1, mandant_count: 0,
    }))

    render(<MandateAdministrationPage />)

    expect(await screen.findByText(/activate multi-mandant mode/i)).toBeInTheDocument()
  })

  it('shows the irreversible badge, and collapses the impact info behind a toggle, once already active', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockInstanceModeResponse({
      instance_mode: 'multi_mandant', changed_at: '2026-01-01T00:00:00Z', changed_by_username: 'admin1',
      can_activate: false, user_count: 5, mandant_count: 2,
    }))

    render(<MandateAdministrationPage />)

    expect(await screen.findByText(/multi-mandant mode.*irreversible/i)).toBeInTheDocument()
    expect(screen.queryByText(/activate multi-mandant mode/i)).not.toBeInTheDocument()
    // Impact info exists but is collapsed — only the toggle is visible.
    expect(screen.getByText(/what does this change\?/i)).toBeInTheDocument()
    expect(screen.queryByText(/what activating multi-mandant mode actually changes/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByText(/what does this change\?/i))
    expect(screen.getByText(/what activating multi-mandant mode actually changes/i)).toBeInTheDocument()
  })

  it('activates on confirm and then shows the irreversible badge', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockInstanceModeResponse({
        instance_mode: 'single_tenant', changed_at: null, changed_by_username: null,
        can_activate: true, user_count: 2, mandant_count: 0,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { instance_mode: 'multi_mandant', default_mandant_id: 'm1', default_mandant_name: 'Default', users_assigned: 2, activated_by: 'admin1' },
        meta: {},
      }), { status: 200 }))
      .mockResolvedValueOnce(mockInstanceModeResponse({
        instance_mode: 'multi_mandant', changed_at: '2026-01-01T00:00:00Z', changed_by_username: 'admin1',
        can_activate: false, user_count: 2, mandant_count: 1,
      }))

    render(<MandateAdministrationPage />)

    await userEvent.click(await screen.findByText(/activate multi-mandant mode/i))
    await userEvent.click(await screen.findByText(/yes, activate permanently/i))

    await waitFor(() => expect(screen.getByText(/multi-mandant mode.*irreversible/i)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const activateCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/activate-multi-mandant'))
    expect(activateCall?.[1]).toMatchObject({ method: 'POST' })
  })
})
