/**
 * Unit tests for lib/errors/types.ts — the AppError hierarchy, ValidationError
 * field helpers, the status→ErrorCode factory mapping, and the type guards.
 *
 * Focus is behavioral: the ValidationError helpers (getFieldErrors /
 * hasFieldError / getErrorFields) drive real UI decisions, so multi-field
 * fixtures pin them against method-swap mutants (e.g. `.some` → `.every`).
 */
import { describe, it, expect } from 'vitest'
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  InvalidCredentialsError,
  ApiError,
  createValidationError,
  createApiError,
  createNetworkError,
  createTimeoutError,
  isAppError,
  isUnauthorizedError,
  isInvalidCredentialsError,
} from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

describe('AppError', () => {
  it('exposes code / statusCode and matches via isErrorCode', () => {
    const err = new AppError(ErrorCode.SERVER_ERROR, 'boom', 500)
    expect(err.code).toBe(ErrorCode.SERVER_ERROR)
    expect(err.statusCode).toBe(500)
    expect(err.isErrorCode(ErrorCode.SERVER_ERROR)).toBe(true)
    expect(err.isErrorCode(ErrorCode.NETWORK_ERROR)).toBe(false)
  })

  it('serialises to a plain object via toJSON', () => {
    const err = new AppError(ErrorCode.NOT_FOUND, 'missing', 404, { hint: 'x' })
    expect(err.toJSON()).toEqual({
      name: 'AppError',
      code: ErrorCode.NOT_FOUND,
      message: 'missing',
      statusCode: 404,
      details: { hint: 'x' },
    })
  })
})

describe('ValidationError field helpers', () => {
  function multiFieldError() {
    return new ValidationError('bad', [
      { field: 'email', message: 'is required' },
      { field: 'email', message: 'is invalid' },
      { field: 'name', message: 'too short' },
    ])
  }

  it('getFieldErrors returns only the messages for the requested field', () => {
    expect(multiFieldError().getFieldErrors('email')).toEqual(['is required', 'is invalid'])
    expect(multiFieldError().getFieldErrors('missing')).toEqual([])
  })

  it('hasFieldError is true for a present field even when other fields exist', () => {
    // Distinguishes `.some` from a `.every` mutant: `every(f => f === 'name')`
    // would be false here because not all entries are `name`.
    const error = multiFieldError()
    expect(error.hasFieldError('name')).toBe(true)
    expect(error.hasFieldError('missing')).toBe(false)
  })

  it('getErrorFields returns the de-duplicated set of field names', () => {
    expect(multiFieldError().getErrorFields()).toEqual(['email', 'name'])
  })
})

describe('ApiError status → ErrorCode mapping', () => {
  it.each([
    [400, ErrorCode.VALIDATION_ERROR],
    [401, ErrorCode.UNAUTHORIZED],
    [403, ErrorCode.FORBIDDEN],
    [404, ErrorCode.NOT_FOUND],
    [408, ErrorCode.TIMEOUT],
    [409, ErrorCode.CONFLICT],
    [500, ErrorCode.SERVER_ERROR],
    [503, ErrorCode.SERVER_ERROR],
    [418, ErrorCode.UNKNOWN_ERROR],
  ])('maps status %i to %s', (status, code) => {
    const err = createApiError(status, 'msg', '/endpoint', 'req-1')
    expect(err.code).toBe(code)
    expect(err.statusCode).toBe(status)
  })

  it('carries endpoint and requestId through to the instance', () => {
    const err = new ApiError({ message: 'm', statusCode: 500, endpoint: '/x', requestId: 'r' })
    expect(err.endpoint).toBe('/x')
    expect(err.requestId).toBe('r')
  })
})

describe('error factory helpers', () => {
  it('createValidationError aggregates messages into the summary', () => {
    const err = createValidationError([
      { field: 'a', message: 'first' },
      { field: 'b', message: 'second' },
    ])
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.message).toContain('first')
    expect(err.message).toContain('second')
  })

  it('createValidationError handles the empty list without listing fields', () => {
    const err = createValidationError([])
    expect(err.message).toBe('Validation failed')
  })

  it('createNetworkError preserves the original error message', () => {
    expect(createNetworkError(new Error('offline')).message).toBe('offline')
    expect(createNetworkError('weird').message).toBe('Network error occurred')
  })

  it('createTimeoutError includes the timeout duration', () => {
    expect(createTimeoutError(5000).message).toContain('5000ms')
  })
})

describe('type guards', () => {
  it('isAppError distinguishes AppError from plain errors', () => {
    expect(isAppError(new UnauthorizedError())).toBe(true)
    expect(isAppError(new Error('plain'))).toBe(false)
  })

  it('isUnauthorizedError matches the subclass hierarchy', () => {
    expect(isUnauthorizedError(new InvalidCredentialsError())).toBe(true)
    expect(isUnauthorizedError(new Error('plain'))).toBe(false)
  })

  it('isInvalidCredentialsError is specific to InvalidCredentialsError', () => {
    expect(isInvalidCredentialsError(new InvalidCredentialsError())).toBe(true)
    expect(isInvalidCredentialsError(new UnauthorizedError())).toBe(false)
  })
})
