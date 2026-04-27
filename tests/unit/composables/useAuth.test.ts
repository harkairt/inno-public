import { describe, it, expect } from 'vitest'
import { authQueryKeys } from '~/composables/useAuth'

// ---------------------------------------------------------------------------
// Query key structure
// ---------------------------------------------------------------------------

describe('authQueryKeys — cache key structure', () => {
  it('all returns base key', () => {
    expect(authQueryKeys.all).toEqual(['auth'])
  })

  it('user returns scoped key', () => {
    expect(authQueryKeys.user()).toEqual(['auth', 'user'])
  })

  it('current is scoped under user', () => {
    expect(authQueryKeys.current()).toEqual(['auth', 'user', 'current'])
  })

  it('profile key includes email', () => {
    expect(authQueryKeys.profile('test@example.com')).toEqual([
      'auth', 'user', 'test@example.com'
    ])
  })

  it('different emails produce different profile keys', () => {
    const key1 = authQueryKeys.profile('a@example.com')
    const key2 = authQueryKeys.profile('b@example.com')

    expect(key1).not.toEqual(key2)
  })

  it('current is always the same regardless of user', () => {
    expect(authQueryKeys.current()).toEqual(authQueryKeys.current())
  })
})
