import { describe, expect, it } from 'vitest'
import { safeImageUrl } from '../safeUrl'
import { yamlQuote } from '../yamlQuote'

describe('yamlQuote', () => {
  it('escapes quotes, backslashes and control characters', () => {
    expect(yamlQuote('a"b')).toBe('"a\\"b"')
    expect(yamlQuote('a\\b')).toBe('"a\\\\b"')
    expect(yamlQuote('a\nb')).toBe('"a\\nb"')
    expect(yamlQuote('a\tb')).toBe('"a\\tb"')
    expect(yamlQuote('a\rb')).toBe('"a\\rb"')
  })

  it('treats empty and nullish values as empty strings', () => {
    expect(yamlQuote('')).toBe('""')
    expect(yamlQuote(null)).toBe('""')
    expect(yamlQuote(undefined)).toBe('""')
  })
})

describe('safeImageUrl', () => {
  it('accepts http(s) image URLs', () => {
    expect(safeImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(safeImageUrl('http://example.com/a.png')).toBe('http://example.com/a.png')
    expect(safeImageUrl('/avatars/a.png')).toContain('/avatars/a.png')
  })

  it('accepts raster image data URLs', () => {
    expect(safeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(safeImageUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe('data:image/jpeg;base64,/9j/4AAQ')
    expect(safeImageUrl('data:image/svg+xml,<svg/>')).toBeNull()
    expect(safeImageUrl('data:image/svg+xml,<svg/>', { allowSvgData: true })).toBe('data:image/svg+xml,<svg/>')
  })

  it('rejects script and navigation URLs', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeImageUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBeNull()
    expect(safeImageUrl('//evil.example/a.png')).toBeNull()
    expect(safeImageUrl('mailto:test@example.com')).toBeNull()
    expect(safeImageUrl('')).toBeNull()
    expect(safeImageUrl(null)).toBeNull()
  })
})
