import { describe, it, expect } from 'vitest'
import { sanitizeFileUrl } from '@/app/utils/url'

describe('sanitizeFileUrl', () => {
  it('accepts relative paths starting with /', () => {
    expect(sanitizeFileUrl('/api/storage/file.png')).toBe('/api/storage/file.png')
  })

  it('accepts absolute http URLs', () => {
    expect(sanitizeFileUrl('http://example.com/file.png')).toBe('http://example.com/file.png')
  })

  it('accepts absolute https URLs', () => {
    expect(sanitizeFileUrl('https://example.com/file.png')).toBe('https://example.com/file.png')
  })

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeFileUrl('//evil.com/file.png')).toBe('')
  })

  it('rejects javascript: URLs', () => {
    expect(sanitizeFileUrl('javascript:alert(1)')).toBe('')
  })

  it('rejects data: URLs', () => {
    expect(sanitizeFileUrl('data:text/html,<h1>hi</h1>')).toBe('')
  })

  it('rejects ftp: URLs', () => {
    expect(sanitizeFileUrl('ftp://example.com/file')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeFileUrl('')).toBe('')
  })

  it('returns empty string for garbage input', () => {
    expect(sanitizeFileUrl('not a url at all')).toBe('')
  })
})
