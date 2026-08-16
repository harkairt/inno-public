import { describe, it, expect } from 'vitest'
import { getInitials } from '@/app/utils/user'

describe('getInitials', () => {
  it('returns first-letter initials of a two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('preserves original casing', () => {
    expect(getInitials('john doe')).toBe('jd')
  })

  it('takes first char of first and last word for three-or-more words', () => {
    expect(getInitials('John Ronald Reuel')).toBe('JR')
  })

  it('returns first two characters for a single token', () => {
    expect(getInitials('alice@example.com')).toBe('al')
  })

  it('returns an empty string for an empty input', () => {
    expect(getInitials('')).toBe('')
  })

  it('returns first two characters for a single word', () => {
    expect(getInitials('madonna')).toBe('ma')
  })

  it('handles null and undefined', () => {
    expect(getInitials(null)).toBe('')
    expect(getInitials(undefined)).toBe('')
  })

  it('handles whitespace-only input', () => {
    expect(getInitials('   ')).toBe('')
  })

  it('handles irregular whitespace between words', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD')
  })
})
