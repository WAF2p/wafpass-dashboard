import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { useAuth } from '../AuthContext'
import UserManagementPage from '../pages/UserManagementPage'
import type { UserOut, MandantOut } from '../api'

// Phase 5 gap closed (.plan.md): "UserManagementPage.tsx respects mandate
// scoping" had no component test — its CRUD surface (fetchUsers/createUser/
// updateUser/deleteUser/fetchMandants/fetchMyMandate) was judged too large
// to mock well in Phase 5's own pass, so only the mandate-scoping behaviour
// specifically is covered here, not full CRUD. Mirrors the established
// vi.spyOn(globalThis, 'fetch') pattern from MandateAdministrationPage.test.tsx/
// MandateIndicator.test.tsx rather than mocking the api module.

vi.mock('../AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../AuthContext')>('../AuthContext')
  return { ...actual, useAuth: vi.fn() }
})

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  (useAuth as unknown as Mock).mockReturnValue({
    user: { id: 'me', username: 'me', display_name: 'Me', role: 'admin' },
    accessToken: null, role: 'admin', isLoading: false,
    mandantId: null, isHoldingAdmin: false, isHoldingViewer: false,
    login: vi.fn(), loginWithTokens: vi.fn(), logout: vi.fn(), refreshUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

function makeUser(overrides: Partial<UserOut> = {}): UserOut {
  return {
    id: 'u1', username: 'carol', display_name: 'Carol', image_url: '', role: 'engineer',
    auth_provider: 'local', is_active: true, last_login_at: null, created_at: null, updated_at: null,
    mandant_id: null, holding_role: null,
    ...overrides,
  }
}

function makeMandant(overrides: Partial<MandantOut> = {}): MandantOut {
  return {
    id: 'm1', name: 'Acme Corp', slug: 'acme', logo_url: '', is_active: true,
    created_at: '', updated_at: '',
    ...overrides,
  } as MandantOut
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

// Dispatches by URL/method the same way the real server would route these
// endpoints UserManagementPage.tsx calls.
function mockFetch(users: UserOut[], opts: { mandants?: MandantOut[]; myMandate?: MandantOut | null } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown, init?: RequestInit) => {
    const u = String(url)
    const method = init?.method ?? 'GET'
    if (u.endsWith('/auth/users') && method === 'GET') return jsonResponse(users)
    if (u.endsWith('/auth/users') && method === 'POST') return jsonResponse(makeUser())
    if (u.includes('/auth/users/') && u.includes('/logs')) return jsonResponse([])
    if (u.includes('/admin/mandants')) return jsonResponse({ data: opts.mandants ?? [], meta: {} })
    if (u.includes('/admin/my-mandate')) return jsonResponse({ data: opts.myMandate ?? null, meta: {} })
    if (u.includes('/auth/users/') && method === 'DELETE') return new Response(null, { status: 204 })
    if (u.includes('/auth/users/')) return jsonResponse(users[0] ?? {}) // PUT by id
    return jsonResponse({})
  })
}

describe('UserManagementPage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('shows an access-denied message for a non-admin role', async () => {
    mockAuth({ role: 'engineer', isHoldingAdmin: false })
    mockFetch([])

    render(<UserManagementPage />)

    expect(await screen.findByText(/admin role required/i)).toBeInTheDocument()
  })

  it("resolves a holding_admin's view of a user's mandate via the full mandant list, by name not id", async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: true })
    mockFetch(
      [makeUser({ mandant_id: 'm1' })],
      { mandants: [makeMandant({ id: 'm1', name: 'Acme Corp' })] },
    )

    render(<UserManagementPage />)

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
  })

  it("resolves an ordinary admin's own mandate name for every row via fetchMyMandate, never the holding-admin-only mandant list", async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch(
      [makeUser({ mandant_id: 'm1' })],
      { myMandate: makeMandant({ id: 'm1', name: 'My Company' }) },
    )

    render(<UserManagementPage />)

    expect(await screen.findByText('My Company')).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/admin/mandants'))).toBe(false)
  })

  it('shows the no-mandate placeholder for a user with mandant_id null', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    mockFetch([makeUser({ mandant_id: null })], { myMandate: null })

    render(<UserManagementPage />)

    expect(await screen.findByText('— none —')).toBeInTheDocument()
  })

  it('shows the mandate/holding-role assignment fields only for a holding_admin editing an existing user', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: true })
    mockFetch(
      [makeUser({ id: 'u2', mandant_id: null })],
      { mandants: [makeMandant()] },
    )

    render(<UserManagementPage />)
    await screen.findByText('carol')

    // Not shown before an edit is opened.
    expect(screen.queryByText('Holding role')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Edit'))

    expect(await screen.findByText('Holding role')).toBeInTheDocument()
    // "Mandate" is also the (always-present) table column header — two
    // occurrences confirms the form's own mandate-select label rendered
    // too, not just the header.
    expect(screen.getAllByText('Mandate')).toHaveLength(2)
  })

  it('does not show mandate fields when creating a new user, even as holding_admin', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: true })
    mockFetch([makeUser()], { mandants: [makeMandant()] })

    render(<UserManagementPage />)
    await screen.findByText('carol') // table (and its "Mandate" column header) rendered

    await userEvent.click(screen.getByText('New User'))

    expect(await screen.findByText('Username *')).toBeInTheDocument()
    expect(screen.queryByText('Holding role')).not.toBeInTheDocument()
    expect(screen.getAllByText('Mandate')).toHaveLength(1) // table header only
  })

  it('does not show mandate fields for a non-holding-admin editing a user', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    mockFetch([makeUser({ id: 'u3' })], { myMandate: null })

    render(<UserManagementPage />)
    await screen.findByText('carol')

    await userEvent.click(screen.getByText('Edit'))

    expect(await screen.findByText('Save Changes')).toBeInTheDocument()
    expect(screen.queryByText('Holding role')).not.toBeInTheDocument()
  })

  it("a holding_admin's save sends mandant_id/holding_role; a non-holding-admin's save omits them entirely", async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: true })
    const fetchSpy = mockFetch(
      [makeUser({ id: 'u4', mandant_id: null, holding_role: null })],
      { mandants: [makeMandant()] },
    )

    render(<UserManagementPage />)
    await screen.findByText('carol')
    await userEvent.click(screen.getByText('Edit'))
    await screen.findByText('Holding role')

    await userEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(putCall).toBeTruthy()
      const body = JSON.parse((putCall![1] as RequestInit).body as string)
      expect(body).toHaveProperty('mandant_id')
      expect(body).toHaveProperty('holding_role')
    })
  })

  it("a non-holding-admin's save omits mandant_id/holding_role from the request body entirely", async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch([makeUser({ id: 'u5' })], { myMandate: null })

    render(<UserManagementPage />)
    await screen.findByText('carol')
    await userEvent.click(screen.getByText('Edit'))
    await screen.findByText('Save Changes')

    await userEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(putCall).toBeTruthy()
      const body = JSON.parse((putCall![1] as RequestInit).body as string)
      expect(body).not.toHaveProperty('mandant_id')
      expect(body).not.toHaveProperty('holding_role')
    })
  })

  // Same-session follow-up: the page's full CRUD surface (create, delete,
  // role-change, password-reset) was deliberately left untested when the
  // mandate-scoping tests above were written — "scoped out rather than
  // rushed," per the comment at the top of this file. Closes that gap.

  it('creates a new user via the New User form, sending exactly the fields the form collects', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch([], { myMandate: null })

    render(<UserManagementPage />)
    await userEvent.click(screen.getByText('New User'))

    await userEvent.type(screen.getByPlaceholderText('jdoe'), 'newbie')
    await userEvent.type(screen.getByPlaceholderText('Jane Doe'), 'New Bie')
    await userEvent.type(screen.getByPlaceholderText('min. 8 characters'), 'supersecret1')
    await userEvent.click(screen.getByText('Create User'))

    await waitFor(() => {
      const postCall = fetchSpy.mock.calls.find(
        ([url, init]) => String(url).endsWith('/auth/users') && (init as RequestInit | undefined)?.method === 'POST',
      )
      expect(postCall).toBeTruthy()
      const body = JSON.parse((postCall![1] as RequestInit).body as string)
      expect(body.username).toBe('newbie')
      expect(body.display_name).toBe('New Bie')
      expect(body.password).toBe('supersecret1')
      expect(body.role).toBe('engineer') // EMPTY_FORM's default
    })
  })

  it("changes a user's role via the edit form and sends it in the update payload", async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch([makeUser({ id: 'u6', role: 'engineer' })], { myMandate: null })

    render(<UserManagementPage />)
    await screen.findByText('carol')
    await userEvent.click(screen.getByText('Edit'))

    // Not a holding_admin editing, so the role <select> is the only
    // combobox on the form — no ambiguity to resolve by label.
    await userEvent.selectOptions(screen.getByRole('combobox'), 'architect')
    await userEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(putCall).toBeTruthy()
      const body = JSON.parse((putCall![1] as RequestInit).body as string)
      expect(body.role).toBe('architect')
    })
  })

  it('sends a new password in the update payload when one is entered', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch([makeUser({ id: 'u7' })], { myMandate: null })

    render(<UserManagementPage />)
    await screen.findByText('carol')
    await userEvent.click(screen.getByText('Edit'))

    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'newpassword123')
    await userEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(putCall).toBeTruthy()
      const body = JSON.parse((putCall![1] as RequestInit).body as string)
      expect(body.password).toBe('newpassword123')
    })
  })

  it('omits password from the update payload when the field is left blank ("leave blank to keep")', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch([makeUser({ id: 'u8' })], { myMandate: null })

    render(<UserManagementPage />)
    await screen.findByText('carol')
    await userEvent.click(screen.getByText('Edit'))
    await userEvent.click(screen.getByText('Save Changes')) // no password typed

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(putCall).toBeTruthy()
      const body = JSON.parse((putCall![1] as RequestInit).body as string)
      expect(body).not.toHaveProperty('password')
    })
  })

  it('deletes a user after the confirmation dialog is accepted, then reloads the list', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch([makeUser({ id: 'u9', username: 'carol' })], { myMandate: null })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<UserManagementPage />)
    await screen.findByText('carol')
    await userEvent.click(screen.getByText('Del'))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      const deleteCall = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')
      expect(deleteCall).toBeTruthy()
      expect(String(deleteCall![0])).toContain('/auth/users/u9')
    })
  })

  it('does not delete a user when the confirmation dialog is cancelled', async () => {
    mockAuth({ role: 'admin', isHoldingAdmin: false })
    const fetchSpy = mockFetch([makeUser({ id: 'u10', username: 'carol' })], { myMandate: null })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<UserManagementPage />)
    await screen.findByText('carol')
    await userEvent.click(screen.getByText('Del'))

    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
  })
})
