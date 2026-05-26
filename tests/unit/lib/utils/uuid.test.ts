import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateUUID } from '@/lib/utils/uuid'

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('generateUUID', () => {
  describe('with crypto.randomUUID available (default)', () => {
    it('returns a valid UUID v4 format', () => {
      const uuid = generateUUID()
      expect(uuid).toMatch(UUID_V4_REGEX)
    })

    it('has version nibble set to 4', () => {
      const uuid = generateUUID()
      expect(uuid[14]).toBe('4')
    })

    it('has correct variant bits (8, 9, a, or b)', () => {
      const uuid = generateUUID()
      expect(['8', '9', 'a', 'b']).toContain(uuid[19])
    })

    it('produces different UUIDs on successive calls', () => {
      const a = generateUUID()
      const b = generateUUID()
      expect(a).not.toBe(b)
    })
  })

  describe('fallback: crypto.getRandomValues only', () => {
    let originalRandomUUID: typeof crypto.randomUUID

    beforeEach(() => {
      originalRandomUUID = crypto.randomUUID
      // Remove randomUUID so the function falls through to getRandomValues path
      vi.stubGlobal('crypto', {
        getRandomValues: crypto.getRandomValues.bind(crypto),
        randomUUID: undefined,
      })
    })

    afterEach(() => {
      vi.stubGlobal('crypto', {
        getRandomValues: crypto.getRandomValues.bind(crypto),
        randomUUID: originalRandomUUID,
      })
    })

    it('returns a valid UUID v4 format', () => {
      const uuid = generateUUID()
      expect(uuid).toMatch(UUID_V4_REGEX)
    })

    it('has version nibble set to 4', () => {
      const uuid = generateUUID()
      expect(uuid[14]).toBe('4')
    })

    it('has correct variant bits (8, 9, a, or b)', () => {
      const uuid = generateUUID()
      expect(['8', '9', 'a', 'b']).toContain(uuid[19])
    })

    it('produces different UUIDs on successive calls', () => {
      const a = generateUUID()
      const b = generateUUID()
      expect(a).not.toBe(b)
    })
  })

  describe('fallback: Math.random (no crypto)', () => {
    let originalCrypto: Crypto

    beforeEach(() => {
      originalCrypto = globalThis.crypto
      vi.stubGlobal('crypto', undefined as unknown as Crypto)
    })

    afterEach(() => {
      vi.stubGlobal('crypto', originalCrypto)
    })

    it('returns a valid UUID v4 format', () => {
      const uuid = generateUUID()
      expect(uuid).toMatch(UUID_V4_REGEX)
    })

    it('has version nibble set to 4', () => {
      const uuid = generateUUID()
      expect(uuid[14]).toBe('4')
    })

    it('has correct variant bits (8, 9, a, or b)', () => {
      const uuid = generateUUID()
      expect(['8', '9', 'a', 'b']).toContain(uuid[19])
    })

    it('produces different UUIDs on successive calls', () => {
      const a = generateUUID()
      const b = generateUUID()
      expect(a).not.toBe(b)
    })
  })
})
