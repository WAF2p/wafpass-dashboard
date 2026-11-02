import { describe, expect, it } from 'vitest'
import { sectionRequiredRole, type NavSection } from '../navigation/navModel'

function section(id: string, minRole?: string): NavSection {
  return { id, label: id, color: '#000', description: '', items: [], ...(minRole ? { minRole } : {}) }
}

describe('sectionRequiredRole', () => {
  it('leaves ungated sections visible to every authenticated role', () => {
    expect(sectionRequiredRole(section('overview'))).toBeNull()
  })

  it('inherits the role named by the section id', () => {
    expect(sectionRequiredRole(section('ciso'))).toBe('ciso')
    expect(sectionRequiredRole(section('architect'))).toBe('architect')
    expect(sectionRequiredRole(section('engineer'))).toBe('engineer')
  })

  it('honours an explicit minRole over the section id', () => {
    expect(sectionRequiredRole(section('runs', 'engineer'))).toBe('engineer')
    expect(sectionRequiredRole(section('system', 'architect'))).toBe('architect')
    expect(sectionRequiredRole(section('admin', 'admin'))).toBe('admin')
  })

  it('does not treat unrelated section ids as roles', () => {
    expect(sectionRequiredRole(section('projects', 'clevel'))).toBe('clevel')
    expect(sectionRequiredRole(section('custom-section'))).toBeNull()
  })
})
