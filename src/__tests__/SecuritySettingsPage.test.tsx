import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SecuritySettingsPage from '../pages/SecuritySettingsPage'

const mocks = vi.hoisted(() => ({
  fetchMfaStatus: vi.fn(),
  fetchSessions: vi.fn(),
  mfaSetup: vi.fn(),
  mfaVerify: vi.fn(),
  mfaDisable: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}))

vi.mock('../api', () => mocks)

const session = {
  id: 's1',
  created_at: '2026-11-07T00:00:00Z',
  last_seen_at: '2026-11-07T00:00:00Z',
  expires_at: '2026-11-14T00:00:00Z',
  revoked_at: null,
  label: 'Chrome on macOS',
  user_agent: 'Chrome',
  current: true,
}

describe('SecuritySettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchMfaStatus.mockResolvedValue({
      enabled: false, methods: [], recovery_codes_remaining: 0, required: true,
    })
    mocks.fetchSessions.mockResolvedValue([session])
    mocks.mfaSetup.mockResolvedValue({ secret: 'SECRET123', otpauth_uri: 'otpauth://x', qr_svg: null })
    mocks.mfaVerify.mockResolvedValue({ recovery_codes: ['AAAA-BBBB'] })
    mocks.mfaDisable.mockResolvedValue(undefined)
    mocks.revokeSession.mockResolvedValue(undefined)
    mocks.revokeOtherSessions.mockResolvedValue({ revoked: 1 })
  })

  it('lists sessions and walks through TOTP setup', async () => {
    render(<SecuritySettingsPage />)

    await waitFor(() => expect(screen.getByText(/Chrome on macOS/)).toBeInTheDocument())
    expect(screen.getByText(/This role requires MFA/i)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Current password'), {
      target: { value: 'correct-horse' },
    })
    fireEvent.click(screen.getByRole('button', { name: /start setup/i }))

    await waitFor(() => expect(screen.getByText(/SECRET123/)).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('6-digit code'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify and enable/i }))

    await waitFor(() => expect(screen.getByText(/AAAA-BBBB/)).toBeInTheDocument())
    expect(mocks.mfaSetup).toHaveBeenCalledWith('correct-horse')
    expect(mocks.mfaVerify).toHaveBeenCalledWith('123456')
  })

  it('revokes a session', async () => {
    render(<SecuritySettingsPage />)
    await waitFor(() => expect(screen.getByText(/Chrome on macOS/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^revoke$/i }))
    await waitFor(() => expect(mocks.revokeSession).toHaveBeenCalledWith('s1'))
  })
})
