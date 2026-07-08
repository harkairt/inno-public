/**
 * Unit tests for app/utils/user.ts — getInitials (avatar initials helper).
 *
 * NOTE: the JSDoc example claims getInitials('alice@example.com') => 'AL', but
 * the implementation splits on spaces only, so a single token (an email) yields
 * just its first letter uppercased ('A'). These tests assert the ACTUAL
 * behavior; the docstring example is inaccurate (documented in the report).
 */
import { describe, it, expect } from 'vitest'
import { getInitials } from '@/app/utils/user'

describe('getInitials', () => {
  it('returns first-letter initials of a two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('uppercases lowercase names', () => {
    expect(getInitials('john doe')).toBe('JD')
  })

  it('caps at two characters for three-or-more words', () => {
    expect(getInitials('John Ronald Reuel')).toBe('JR')
  })

  it('returns only the first letter for a single token (e.g. an email)', () => {
    expect(getInitials('alice@example.com')).toBe('A')
  })

  it('returns an empty string for an empty input', () => {
    expect(getInitials('')).toBe('')
  })

  it('handles a single lowercase word', () => {
    expect(getInitials('madonna')).toBe('M')
  })
})
