import { describe, it, expect } from 'vitest'
import { validateSession } from '@/lib/validation/chat/validateSession'
import { ValidationError } from '@/lib/errors/types'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function validSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: VALID_UUID,
    userId: VALID_UUID_2,
    sessionName: 'Test Chat',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    messageCount: 5,
    ...overrides,
  }
}

describe('validateSession', () => {
  describe('valid input', () => {
    it('returns ok for a valid session object', () => {
      const result = validateSession(validSession())

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({
        sessionId: VALID_UUID,
        userId: VALID_UUID_2,
        sessionName: 'Test Chat',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        messageCount: 5,
      })
    })

    it('coerces date strings into Date objects', () => {
      const result = validateSession(validSession())

      const session = result._unsafeUnwrap()
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.updatedAt).toBeInstanceOf(Date)
    })

    it('trims whitespace from sessionName', () => {
      const result = validateSession(validSession({ sessionName: '  Trimmed  ' }))

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().sessionName).toBe('Trimmed')
    })

    it('accepts zero messageCount', () => {
      const result = validateSession(validSession({ messageCount: 0 }))

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().messageCount).toBe(0)
    })

    it('accepts updatedAt equal to createdAt', () => {
      const sameDate = '2024-01-01T00:00:00Z'
      const result = validateSession(validSession({ createdAt: sameDate, updatedAt: sameDate }))

      expect(result.isOk()).toBe(true)
    })
  })

  describe('missing required fields', () => {
    it('returns err when input is null', () => {
      const result = validateSession(null)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('returns err when input is undefined', () => {
      const result = validateSession(undefined)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('returns err when input is an empty object', () => {
      const result = validateSession({})

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.validationErrors.length).toBeGreaterThan(0)
    })

    it('returns err when sessionId is missing', () => {
      const { sessionId: _, ...noId } = validSession()
      const result = validateSession(noId)

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('sessionId')).toBe(true)
    })

    it('returns err when userId is missing', () => {
      const { userId: _, ...noUser } = validSession()
      const result = validateSession(noUser)

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('userId')).toBe(true)
    })

    it('returns err when sessionName is missing', () => {
      const { sessionName: _, ...noName } = validSession()
      const result = validateSession(noName)

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('sessionName')).toBe(true)
    })
  })

  describe('invalid UUID fields', () => {
    it('rejects invalid sessionId', () => {
      const result = validateSession(validSession({ sessionId: 'not-a-uuid' }))

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('sessionId')).toBe(true)
      expect(error.getFieldErrors('sessionId')[0]).toContain('valid UUID')
    })

    it('rejects invalid userId', () => {
      const result = validateSession(validSession({ userId: '12345' }))

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('userId')).toBe(true)
      expect(error.getFieldErrors('userId')[0]).toContain('valid UUID')
    })
  })

  describe('invalid types', () => {
    it('rejects number where string is expected for sessionName', () => {
      const result = validateSession(validSession({ sessionName: 123 }))

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('sessionName')).toBe(true)
    })

    it('rejects string where number is expected for messageCount', () => {
      const result = validateSession(validSession({ messageCount: 'five' }))

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('messageCount')).toBe(true)
    })

    it('rejects non-integer messageCount', () => {
      const result = validateSession(validSession({ messageCount: 3.5 }))

      expect(result.isErr()).toBe(true)
    })

    it('rejects negative messageCount', () => {
      const result = validateSession(validSession({ messageCount: -1 }))

      expect(result.isErr()).toBe(true)
    })
  })

  describe('sessionName constraints', () => {
    it('rejects empty sessionName', () => {
      const result = validateSession(validSession({ sessionName: '' }))

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('sessionName')).toBe(true)
      expect(error.getFieldErrors('sessionName')[0]).toContain('cannot be empty')
    })

    it('rejects sessionName exceeding 255 characters', () => {
      const result = validateSession(validSession({ sessionName: 'x'.repeat(256) }))

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('sessionName')).toBe(true)
      expect(error.getFieldErrors('sessionName')[0]).toContain('cannot exceed')
    })

    it('accepts sessionName at exactly 255 characters', () => {
      const result = validateSession(validSession({ sessionName: 'x'.repeat(255) }))

      expect(result.isOk()).toBe(true)
    })
  })

  describe('date validation', () => {
    it('rejects invalid date string for createdAt', () => {
      const result = validateSession(validSession({ createdAt: 'not-a-date' }))

      expect(result.isErr()).toBe(true)
    })

    it('rejects updatedAt earlier than createdAt', () => {
      const result = validateSession(
        validSession({
          createdAt: '2024-06-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      )

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.hasFieldError('updatedAt')).toBe(true)
      expect(error.getFieldErrors('updatedAt')[0]).toContain('cannot be earlier than creation date')
    })
  })

  describe('error message formatting', () => {
    it('includes field-specific messages in the error message', () => {
      const result = validateSession(validSession({ sessionId: 'bad', userId: 'bad' }))

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.message).toContain('Session validation failed')
      expect(error.validationErrors.length).toBeGreaterThanOrEqual(2)
    })

    it('collects multiple validation errors at once', () => {
      const result = validateSession({
        sessionId: 'invalid',
        userId: 'invalid',
        sessionName: '',
        createdAt: 'bad',
        updatedAt: 'bad',
        messageCount: -1,
      })

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.validationErrors.length).toBeGreaterThanOrEqual(2)
    })
  })
})
