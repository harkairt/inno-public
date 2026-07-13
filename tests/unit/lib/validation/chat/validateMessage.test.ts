/**
 * Unit tests for lib/validation/chat/validateMessage.ts — validateMessage,
 * isValidMessage and validateMessages. Mirrors validateSession.test.ts:
 * assertions target the classified outcome (which field failed, ok vs err),
 * not the cosmetic message-formatting strings.
 */
import { describe, it, expect } from 'vitest'
import {
  validateMessage,
  isValidMessage,
  validateMessages,
} from '@/lib/validation/chat/validateMessage'
import { ValidationError } from '@/lib/errors/types'
import { MessageStatus, MessageType } from '@/lib/types/chat'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const VALID_UUID_3 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

function validMessage(overrides: Record<string, unknown> = {}) {
  return {
    messageId: VALID_UUID,
    sessionId: VALID_UUID_2,
    userId: VALID_UUID_3,
    content: 'Hello there',
    timestamp: '2024-01-01T00:00:00Z',
    status: MessageStatus.SENT,
    messageType: MessageType.USER_QUESTION,
    ...overrides,
  }
}

describe('validateMessage', () => {
  describe('valid input', () => {
    it('returns ok for a valid message object', () => {
      const result = validateMessage(validMessage())

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({
        messageId: VALID_UUID,
        sessionId: VALID_UUID_2,
        userId: VALID_UUID_3,
        content: 'Hello there',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        status: MessageStatus.SENT,
        messageType: MessageType.USER_QUESTION,
      })
    })

    it('coerces the timestamp string into a Date', () => {
      const result = validateMessage(validMessage())
      expect(result._unsafeUnwrap().timestamp).toBeInstanceOf(Date)
    })

    it('trims whitespace from content', () => {
      const result = validateMessage(validMessage({ content: '  spaced  ' }))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().content).toBe('spaced')
    })
  })

  describe('missing / invalid required fields', () => {
    it('returns err (ValidationError) for null', () => {
      const result = validateMessage(null)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('flags a missing messageId', () => {
      const { messageId: _omit, ...rest } = validMessage()
      const error = validateMessage(rest)._unsafeUnwrapErr()
      expect(error.hasFieldError('messageId')).toBe(true)
    })

    it('rejects an invalid sessionId UUID', () => {
      const error = validateMessage(validMessage({ sessionId: 'not-a-uuid' }))._unsafeUnwrapErr()
      expect(error.hasFieldError('sessionId')).toBe(true)
      expect(error.getFieldErrors('sessionId')[0]).toContain('valid UUID')
    })

    it('rejects empty content', () => {
      const error = validateMessage(validMessage({ content: '' }))._unsafeUnwrapErr()
      expect(error.hasFieldError('content')).toBe(true)
      expect(error.getFieldErrors('content')[0]).toContain('cannot be empty')
    })

    it('rejects content exceeding 10000 characters', () => {
      const error = validateMessage(validMessage({ content: 'x'.repeat(10001) }))._unsafeUnwrapErr()
      expect(error.hasFieldError('content')).toBe(true)
      expect(error.getFieldErrors('content')[0]).toContain('cannot exceed')
    })

    it('rejects an invalid status enum value', () => {
      const error = validateMessage(validMessage({ status: 'NOPE' }))._unsafeUnwrapErr()
      expect(error.hasFieldError('status')).toBe(true)
    })

    it('rejects an invalid messageType enum value', () => {
      const error = validateMessage(validMessage({ messageType: 'NOPE' }))._unsafeUnwrapErr()
      expect(error.hasFieldError('messageType')).toBe(true)
    })
  })

  describe('error aggregation (validationErrors.length > 0 boundary)', () => {
    // Both directions of the boundary: a valid payload must produce ok (never
    // the err branch), an invalid one must produce a populated ValidationError.
    it('does not enter the error branch for a valid message', () => {
      expect(validateMessage(validMessage()).isOk()).toBe(true)
    })

    it('collects errors and builds a failure message for an invalid message', () => {
      const error = validateMessage({
        content: '',
        status: 'x',
        messageType: 'y',
      })._unsafeUnwrapErr()
      // Assert a field-specific fragment (not just the shared prefix): the
      // detailed vs generic message ternary picks the detailed branch here.
      expect(error.message).toContain('content cannot be empty')
      expect(error.validationErrors.length).toBeGreaterThan(0)
    })
  })
})

describe('isValidMessage', () => {
  it('returns true for a valid message', () => {
    expect(isValidMessage(validMessage())).toBe(true)
  })

  it('returns false for an invalid message', () => {
    expect(isValidMessage(validMessage({ messageId: 'bad' }))).toBe(false)
  })
})

describe('validateMessages', () => {
  it('returns err when the input is not an array', () => {
    const error = validateMessages({} as unknown as unknown[])._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.hasFieldError('messages')).toBe(true)
  })

  it('returns ok with every validated message for an all-valid array', () => {
    const result = validateMessages([validMessage(), validMessage({ content: 'second' })])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(2)
  })

  it('prefixes field names with the array index on failure', () => {
    const error = validateMessages([
      validMessage(),
      validMessage({ content: '' }),
    ])._unsafeUnwrapErr()
    expect(error.hasFieldError('[1].content')).toBe(true)
  })
})
