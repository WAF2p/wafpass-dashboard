import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { useAuth } from '../AuthContext'
import { MandateIndicator, ActiveMandateLogo } from '../components/TopNavigation'

// Phase 5 / 6a / 6b — ".plan.md"'s Phase 5.2 spec originally called this
// "the mandate switcher appears in multi-mandant mode"; Phase 6a built a
// real switcher for holding_admin (holding_viewer stayed a read-only
// label, since GET /mandants — holding_admin-strict — gave it no list to
// populate a dropdown with). Phase 6b / ADR-004 adds group_admin/
// group_viewer and a role-agnostic GET /admin/mandants/switchable
// endpoint every switchable role can call — which, as a side effect,
// also upgrades holding_viewer from a label to a real switcher, since
// there's now an endpoint it can call too. This tests what's actually
// shipped today, not the superseded Phase 3/6a wording.

vi.mock('../AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../AuthContext')>('../AuthContext')
  return { ...actual, useAuth: vi.fn() }
})

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  (useAuth as unknown as Mock).mockReturnValue({
    user: null, accessToken: null, role: 'engineer', isLoading: false,
    mandantId: null, isHoldingAdmin: false, isHoldingViewer: false, isGroupAdmin: false, isGroupViewer: false,
    effectiveMandantId: null, effectiveMandantName: null, effectiveMandantLogoUrl: null, setEffectiveMandantId: vi.fn(),
    login: vi.fn(), loginWithTokens: vi.fn(), logout: vi.fn(), refreshUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

describe('MandateIndicator', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('renders nothing for an ordinary mandate-scoped user with no mandate yet resolved', () => {
    mockAuth({})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: null, meta: {} }), { status: 200 }),
    )
    const { container } = render(<MandateIndicator />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the ordinary user's own mandate name once resolved", async () => {
    mockAuth({})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'm1', name: 'Acme Corp', slug: 'acme', logo_url: '', is_active: true, created_at: '', updated_at: '' },
      meta: {},
    }), { status: 200 }))

    render(<MandateIndicator />)
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
  })

  it('shows "All mandates (N)" for a holding_admin, from the real mandant list length', async () => {
    mockAuth({ isHoldingAdmin: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: '1' }, { id: '2' }, { id: '3' }], meta: {},
    }), { status: 200 }))

    render(<MandateIndicator />)
    expect(await screen.findByText('All mandates (3)')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/admin/mandants/switchable'), expect.anything())
  })

  it('gives holding_viewer a real switcher too, via the same switchable endpoint', async () => {
    mockAuth({ isHoldingViewer: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: '1' }, { id: '2' }], meta: {},
    }), { status: 200 }))

    render(<MandateIndicator />)
    expect(await screen.findByText('All mandates (2)')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/admin/mandants/switchable'), expect.anything())
  })

  it('gives a group_admin a switcher scoped to just their own subtree', async () => {
    mockAuth({ isGroupAdmin: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'sub-a', name: 'Subsidiary A' }, { id: 'div-a1', name: 'Division A1' }], meta: {},
    }), { status: 200 }))

    render(<MandateIndicator />)
    expect(await screen.findByText('All mandates (2)')).toBeInTheDocument()
    expect(await screen.findByText('Division A1')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/admin/mandants/switchable'), expect.anything())
  })

  it('gives a group_viewer the same switcher as group_admin', async () => {
    mockAuth({ isGroupViewer: true })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'sub-b', name: 'Subsidiary B' }], meta: {},
    }), { status: 200 }))

    render(<MandateIndicator />)
    expect(await screen.findByText('All mandates (1)')).toBeInTheDocument()
  })
})

// Same-session follow-up — the active mandate's own logo, always visible
// in the top bar right next to the WAF++ logo (TopNavigation.tsx), not
// just on the Mandates page.

describe('ActiveMandateLogo', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it("renders nothing for an ordinary mandate-scoped user with no mandate yet resolved", () => {
    mockAuth({})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: null, meta: {} }), { status: 200 }),
    )
    const { container } = render(<ActiveMandateLogo />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the ordinary user's own mandate logo once resolved, via fetchMyMandate()", async () => {
    mockAuth({})
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'm1', name: 'Acme Corp', slug: 'acme', logo_url: 'https://example.com/acme.png', is_active: true, created_at: '', updated_at: '' },
      meta: {},
    }), { status: 200 }))

    render(<ActiveMandateLogo />)
    expect(await screen.findByTitle('Acme Corp')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/admin/my-mandate'), expect.anything())
  })

  it('renders nothing for a switchable role viewing "All mandates" (not narrowed)', () => {
    mockAuth({ isHoldingAdmin: true, effectiveMandantId: null })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { container } = render(<ActiveMandateLogo />)
    expect(container).toBeEmptyDOMElement()
    // No fetch at all — the narrowed state (or lack of it) already lives
    // in AuthContext, no extra round trip needed just for the logo.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows the narrowed mandate\'s own logo for a holding_admin, straight from AuthContext — no fetch needed', () => {
    mockAuth({
      isHoldingAdmin: true,
      effectiveMandantId: 'mandate-b', effectiveMandantName: 'Mandate B', effectiveMandantLogoUrl: 'https://example.com/b.png',
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<ActiveMandateLogo />)
    expect(screen.getByTitle('Mandate B')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
