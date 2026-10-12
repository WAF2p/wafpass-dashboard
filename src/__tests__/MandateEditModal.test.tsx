import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MandateEditModal from '../components/MandateEditModal'
import type { MandantOut } from '../api'

function makeMandant(overrides: Partial<MandantOut> = {}): MandantOut {
  return {
    id: 'm1', name: 'Acme Corp', slug: 'acme', logo_url: '', is_active: true,
    created_at: '', updated_at: '',
    ...overrides,
  } as MandantOut
}

// Same-session follow-up: mandate logos were URL-only — no file-upload
// affordance existed anywhere for them, despite the identical base64-data-URL
// pattern already working for user avatars (UserManagementPage.tsx) and
// project images (PassportDashboardPage.tsx). Confirms it's wired up the same
// way here, with no new server endpoint needed — logo_url stays a plain text
// field either way, just populated by a data: URL instead of an http(s) one.
describe('MandateEditModal — logo upload', () => {
  it('shows the plain size hint before any upload, and loads a picked image into the logo preview', async () => {
    render(
      <MandateEditModal mandant={makeMandant()} allMandants={[]} onClose={() => {}} onSaved={() => {}} />,
    )

    expect(screen.getByText(/stored directly/i)).toBeInTheDocument()

    const file = new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' })
    const input = document.getElementById('mandate-logo-upload') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByText('Image loaded')).toBeInTheDocument()
  })

  it('still accepts a plain URL typed directly, unaffected by the upload control', async () => {
    render(
      <MandateEditModal mandant={makeMandant()} allMandants={[]} onClose={() => {}} onSaved={() => {}} />,
    )

    const urlInput = screen.getByPlaceholderText('https://example.com/logo.png')
    await userEvent.type(urlInput, 'https://example.com/acme.png')
    expect(urlInput).toHaveValue('https://example.com/acme.png')
  })
})

// ADR-005: the Governance tab's Authentication select, defaulting to
// "inherit" for a mandate that predates this field, and sent through on save.
describe('MandateEditModal — auth_mode (ADR-005)', () => {
  it('defaults to "inherit" for a mandate with no auth_mode set, and saves the chosen value', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: makeMandant() }), { status: 200 }),
    )
    render(
      <MandateEditModal mandant={makeMandant()} allMandants={[]} onClose={() => {}} onSaved={() => {}} />,
    )

    await userEvent.click(screen.getByText('Governance & Sovereignty'))
    const select = screen.getByLabelText('Authentication') as HTMLSelectElement
    expect(select.value).toBe('inherit')

    await userEvent.selectOptions(select, 'local_only')
    expect(select.value).toBe('local_only')

    await userEvent.click(screen.getByText('Save'))

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.auth_mode).toBe('local_only')
  })

  it('a mandate already set to local_only loads with that selected', async () => {
    render(
      <MandateEditModal mandant={makeMandant({ auth_mode: 'local_only' })} allMandants={[]} onClose={() => {}} onSaved={() => {}} />,
    )
    // Already on the General tab by default; switch to see the field.
    await userEvent.click(screen.getByText('Governance & Sovereignty'))
    const select = screen.getByLabelText('Authentication') as HTMLSelectElement
    expect(select.value).toBe('local_only')
  })
})
