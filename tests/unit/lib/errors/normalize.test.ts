/**
 * Unit tests for lib/errors/normalize.ts — normalizeApiError and its branches.
 *
 * The type guard `isAxiosError` requires `isAxiosError === true` on the error,
 * so we build axios-shaped errors inline (the shared `makeAxiosError` factory
 * does NOT set that flag and would therefore fall through to the plain-Error
 * branch — documented in the report).
 *
 * normalize.ts has no dedicated ZodError branch: a ZodError is an Error
 * instance, matches none of the network/abort/status checks, and is normalized
 * to an UnknownError carrying its message. That actual behavior is asserted.
 */
import { describe, it, expect } from 'vitest'
import type { AxiosError } from 'axios'
import { z } from 'zod'
import { normalizeApiError } from '@/lib/errors/normalize'
import {
  ValidationError,
  NetworkError,
  TimeoutError,
  UnknownError,
  ForbiddenError,
  ServerError,
  createValidationError,
} from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

/** Minimal axios-shaped error with the flag the type guard checks. */
function makeAxios(partial: Partial<AxiosError>): AxiosError {
  return { isAxiosError: true, name: 'AxiosError', message: '', ...partial } as AxiosError
}

// ---------------------------------------------------------------------------
// Axios errors — no response (network / timeout)
// ---------------------------------------------------------------------------

describe('normalizeApiError — axios without response', () => {
  it('maps ECONNABORTED to a TimeoutError', () => {
    const result = normalizeApiError(
      makeAxios({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }),
    )
    expect(result).toBeInstanceOf(TimeoutError)
    expect(result.code).toBe(ErrorCode.TIMEOUT)
    expect(result.message).toContain('timeout of 5000ms exceeded')
  })

  it('maps a "timeout" message to a TimeoutError', () => {
    const result = normalizeApiError(makeAxios({ message: 'timeout exceeded' }))
    expect(result).toBeInstanceOf(TimeoutError)
  })

  it('maps ERR_NETWORK to a NetworkError', () => {
    const result = normalizeApiError(makeAxios({ code: 'ERR_NETWORK', message: 'Network Error' }))
    expect(result).toBeInstanceOf(NetworkError)
    expect(result.code).toBe(ErrorCode.NETWORK_ERROR)
  })

  it('maps a missing request to a NetworkError', () => {
    const result = normalizeApiError(makeAxios({ message: 'boom' }))
    expect(result).toBeInstanceOf(NetworkError)
    expect(result.message).toContain('boom')
  })

  it('maps a failed request (has request, no code) to a NetworkError', () => {
    const result = normalizeApiError(makeAxios({ message: 'failed', request: {} }))
    expect(result).toBeInstanceOf(NetworkError)
    expect(result.message).toContain('Request failed: failed')
  })
})

// ---------------------------------------------------------------------------
// Axios errors — with response (status -> ErrorCode mapping)
// ---------------------------------------------------------------------------

function axiosWithResponse(status: number, data: unknown): AxiosError {
  return makeAxios({
    response: {
      status,
      data,
      statusText: '',
      headers: {},
      config: { url: '/api/thing' } as never,
    } as AxiosError['response'],
  })
}

describe('normalizeApiError — axios with response', () => {
  it('extracts ASP.NET validation errors from a 400 .errors body', () => {
    const result = normalizeApiError(
      axiosWithResponse(400, { errors: { email: ['is required'], name: 'too short' } }),
    )
    expect(result).toBeInstanceOf(ValidationError)
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
    const ve = result as ValidationError
    expect(ve.validationErrors).toEqual([
      { field: 'email', message: 'is required' },
      { field: 'name', message: 'too short' },
    ])
  })

  it('uses data.message when present, mapping status to the ApiError code', () => {
    const result = normalizeApiError(axiosWithResponse(403, { message: 'Nope' }))
    expect(result.code).toBe(ErrorCode.FORBIDDEN)
    expect(result.message).toBe('Nope')
    expect(result.statusCode).toBe(403)
  })

  it('uses a bare string body as the message', () => {
    const result = normalizeApiError(axiosWithResponse(500, 'kaboom'))
    expect(result.code).toBe(ErrorCode.SERVER_ERROR)
    expect(result.message).toBe('kaboom')
  })

  it('maps 401 with no usable body to UNAUTHORIZED', () => {
    const result = normalizeApiError(axiosWithResponse(401, null))
    expect(result.code).toBe(ErrorCode.UNAUTHORIZED)
    expect(result.statusCode).toBe(401)
  })

  it('maps 404 with no usable body to NOT_FOUND', () => {
    const result = normalizeApiError(axiosWithResponse(404, null))
    expect(result.code).toBe(ErrorCode.NOT_FOUND)
  })

  it('maps 409 with no usable body to CONFLICT', () => {
    const result = normalizeApiError(axiosWithResponse(409, null))
    expect(result.code).toBe(ErrorCode.CONFLICT)
    expect(result.message).toBe('Resource conflict')
  })

  it('maps 500 with no usable body to SERVER_ERROR', () => {
    const result = normalizeApiError(axiosWithResponse(500, null))
    expect(result.code).toBe(ErrorCode.SERVER_ERROR)
  })

  it('maps an unhandled status to UNKNOWN_ERROR with a generic message', () => {
    const result = normalizeApiError(axiosWithResponse(418, null))
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    expect(result.message).toBe('HTTP error 418')
    expect(result.statusCode).toBe(418)
  })
})

// ---------------------------------------------------------------------------
// Plain Error instances
// ---------------------------------------------------------------------------

describe('normalizeApiError — Error instances', () => {
  it('maps a network-like TypeError to a NetworkError', () => {
    const result = normalizeApiError(new TypeError('failed to fetch'))
    expect(result).toBeInstanceOf(NetworkError)
    expect(result.message).toContain('failed to fetch')
  })

  it('maps an AbortError to a TimeoutError', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    const result = normalizeApiError(err)
    expect(result).toBeInstanceOf(TimeoutError)
  })

  it('maps an Error carrying a status property via createApiError', () => {
    const err = Object.assign(new Error('teapot'), { status: 404 })
    const result = normalizeApiError(err)
    expect(result.code).toBe(ErrorCode.NOT_FOUND)
    expect(result.statusCode).toBe(404)
    expect(result.message).toBe('teapot')
  })

  it('maps a generic Error to an UnknownError preserving name and stack', () => {
    const err = new Error('mystery')
    const result = normalizeApiError(err)
    expect(result).toBeInstanceOf(UnknownError)
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    expect(result.message).toBe('mystery')
    expect(result.details).toMatchObject({ name: 'Error' })
  })

  it('normalizes a ZodError to an UnknownError (no dedicated branch)', () => {
    const zodErr = z.string().safeParse(123)
    expect(zodErr.success).toBe(false)
    if (zodErr.success) return
    const result = normalizeApiError(zodErr.error)
    expect(result).toBeInstanceOf(UnknownError)
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    expect(result.message).toBe(zodErr.error.message)
  })
})

// ---------------------------------------------------------------------------
// String / object / unknown inputs
// ---------------------------------------------------------------------------

describe('normalizeApiError — non-Error inputs', () => {
  it('wraps a string into an UnknownError', () => {
    const result = normalizeApiError('just a string')
    expect(result).toBeInstanceOf(UnknownError)
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    expect(result.message).toBe('just a string')
  })

  it('extracts message from a plain object with a message property', () => {
    const result = normalizeApiError({ message: 'object message' })
    expect(result).toBeInstanceOf(UnknownError)
    expect(result.message).toBe('object message')
    expect(result.details).toEqual({ message: 'object message' })
  })

  it('falls back for null', () => {
    const result = normalizeApiError(null)
    expect(result).toBeInstanceOf(UnknownError)
    expect(result.message).toBe('An unknown error occurred')
  })

  it('falls back for an unknown primitive', () => {
    const result = normalizeApiError(42)
    expect(result).toBeInstanceOf(UnknownError)
    expect(result.message).toBe('An unknown error occurred')
    expect(result.details).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// isNetworkLikeError — the name-based branch in isolation (normalize.ts L43)
// The existing TypeError('failed to fetch') case ALSO matches via the message
// heuristic, so it can't prove the `error.name` checks matter. These use
// non-network messages so only the name decides the classification.
// ---------------------------------------------------------------------------

describe('normalizeApiError — network classification by error name', () => {
  it('classifies an error named NetworkError (non-network message) as NetworkError', () => {
    const err = new Error('boom')
    err.name = 'NetworkError'
    expect(normalizeApiError(err)).toBeInstanceOf(NetworkError)
  })

  it('classifies a TypeError with a non-network message as NetworkError', () => {
    // typeof-mismatch failures surface as TypeError; message here matches none
    // of the fetch/network/ECONN* heuristics, so only error.name === 'TypeError'
    // can route it to NetworkError.
    expect(normalizeApiError(new TypeError('boom'))).toBeInstanceOf(NetworkError)
  })
})

// ---------------------------------------------------------------------------
// No-response axios branch — ERR_NETWORK vs missing-request in isolation (L148)
// Both operands and the fallback all yield a NetworkError, so the message
// prefix ("Network error:" vs "Request failed:") is the discriminator.
// ---------------------------------------------------------------------------

describe('normalizeApiError — no-response network branch', () => {
  it('treats ERR_NETWORK as a network error even when a request object exists', () => {
    const result = normalizeApiError(makeAxios({ code: 'ERR_NETWORK', message: 'x', request: {} }))
    expect(result).toBeInstanceOf(NetworkError)
    expect(result.message).toContain('Network error')
  })

  it('treats a missing request (no code) as a network error', () => {
    const result = normalizeApiError(makeAxios({ message: 'y' }))
    expect(result).toBeInstanceOf(NetworkError)
    expect(result.message).toContain('Network error')
  })
})

// ---------------------------------------------------------------------------
// Validation-error detection guards (L165 / L194 / L204)
// ---------------------------------------------------------------------------

describe('normalizeApiError — 400 validation detection', () => {
  it('does not treat a 400 without an errors object as a ValidationError', () => {
    const result = normalizeApiError(axiosWithResponse(400, { detail: 'nope' }))
    expect(result).not.toBeInstanceOf(ValidationError)
    expect(result.message).toBe('Bad request')
  })

  it('ignores a 400 whose errors field is not an object', () => {
    const result = normalizeApiError(axiosWithResponse(400, { errors: 'oops' }))
    expect(result).not.toBeInstanceOf(ValidationError)
    expect(result.message).toBe('Bad request')
  })

  it('does not extract validation errors from a non-400 response that carries an errors object', () => {
    // The `status === 400 && …` guard must gate on the status: a 500 body that
    // happens to contain an `errors` object is a server error, not a
    // ValidationError. Kills the `status === 400 || data` / always-true mutants.
    const result = normalizeApiError(axiosWithResponse(500, { errors: { field: ['x'] } }))
    expect(result).not.toBeInstanceOf(ValidationError)
    expect(result).toBeInstanceOf(ServerError)
  })

  it('handles a 400 with a plain string body as an ApiError message', () => {
    // The `typeof data === 'object'` guard must run before `'errors' in data`;
    // dropping it would apply the `in` operator to a primitive and throw.
    const result = normalizeApiError(axiosWithResponse(400, 'plain text error'))
    expect(result).not.toBeInstanceOf(ValidationError)
    expect(result.message).toBe('plain text error')
  })

  it('falls back to Bad request for a 400 with an empty errors object', () => {
    // Boundary for `validationErrors.length > 0`: zero extracted errors must
    // NOT produce a ValidationError.
    const result = normalizeApiError(axiosWithResponse(400, { errors: {} }))
    expect(result).not.toBeInstanceOf(ValidationError)
    expect(result.message).toBe('Bad request')
  })
})

// ---------------------------------------------------------------------------
// Status-code switch (handleStatusCode, L213–239). Assert the AppError SUBTYPE
// per status: a removed `case` falls through to the default (a generic
// ApiError), which is not an instance of these subclasses.
// ---------------------------------------------------------------------------

describe('normalizeApiError — bare status-code mapping', () => {
  it.each([
    [403, ForbiddenError],
    [408, TimeoutError],
    [502, ServerError],
    [503, ServerError],
    [504, TimeoutError],
  ])('maps a bare %i response to the right AppError subtype', (status, Ctor) => {
    expect(normalizeApiError(axiosWithResponse(status, null))).toBeInstanceOf(Ctor)
  })

  it('maps a bare 429 to a rate-limit ApiError', () => {
    const result = normalizeApiError(axiosWithResponse(429, null))
    expect(result.statusCode).toBe(429)
    expect(result.message).toBe('Too many requests')
  })

  it('distinguishes 502 from 503 by message', () => {
    // Both are ServerError, so an emptied `case 502:` falls through to 503 and
    // stays a ServerError — only the message separates them.
    expect(normalizeApiError(axiosWithResponse(502, null)).message).toBe('Bad gateway')
    expect(normalizeApiError(axiosWithResponse(503, null)).message).toBe('Service unavailable')
  })
})

// ---------------------------------------------------------------------------
// AppError passthrough (idempotency). The response interceptor rejects with an
// already-normalized AppError; a service catch then re-runs normalizeApiError on
// it. Without the passthrough, an AppError (statusCode, not status) falls through
// to UnknownError and loses its statusCode — which silently disables the >=500
// welcome-message memoization guard. These pin the passthrough.
// ---------------------------------------------------------------------------

describe('normalizeApiError — AppError passthrough (idempotency)', () => {
  it('returns the same ServerError instance, statusCode and subclass intact', () => {
    const original = new ServerError('Internal server error')
    const result = normalizeApiError(original)
    expect(result).toBe(original)
    expect(result).toBeInstanceOf(ServerError)
    expect(result.statusCode).toBe(500)
    expect(result.code).toBe(ErrorCode.SERVER_ERROR)
  })

  it('preserves a ValidationError payload unchanged', () => {
    const original = createValidationError([{ field: 'email', message: 'is required' }])
    const result = normalizeApiError(original)
    expect(result).toBe(original)
    expect(result).toBeInstanceOf(ValidationError)
    expect((result as ValidationError).validationErrors).toEqual([
      { field: 'email', message: 'is required' },
    ])
  })

  it('double-normalizing an axios 500 is a no-op after the first pass', () => {
    const first = normalizeApiError(axiosWithResponse(500, null))
    expect(first).toBeInstanceOf(ServerError)
    expect(first.statusCode).toBe(500)

    const second = normalizeApiError(first)
    expect(second).toBe(first)
    expect(second.statusCode).toBe(500)
  })
})
