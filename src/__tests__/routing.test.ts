import { describe, expect, it } from 'vitest'
import { pageFromPath } from '../routing'

describe('pageFromPath', () => {
  it('maps a route path to its page slug', () => {
    expect(pageFromPath('/findings')).toBe('findings')
    expect(pageFromPath('/framework-detail/')).toBe('framework-detail')
  })

  it('defaults the root to dashboard', () => {
    expect(pageFromPath('/')).toBe('dashboard')
    expect(pageFromPath('')).toBe('dashboard')
  })

  it('falls back to dashboard for unknown paths', () => {
    expect(pageFromPath('/not-a-page')).toBe('dashboard')
  })
})
