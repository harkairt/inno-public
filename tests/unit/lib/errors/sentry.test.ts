/**
 * Tests reportToSentry's filtering + scope-enrichment contract.
 *
 * @sentry/nuxt is a genuine no-op in tests (no client is initialized), so
 * asserting the "capture path" requires observing the SDK calls. We mock the SDK
 * with spies and drive a fake scope through withScope to verify the tags, level,
 * and capture — plus the ignored-code early return.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nuxt'
import { reportToSentry } from '@/lib/errors/sentry'
import { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

vi.mock('@sentry/nuxt', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}))

const scope = {
  setTag: vi.fn(),
  setContext: vi.fn(),
  setLevel: vi.fn(),
}

beforeEach(() => {
  vi.mocked(Sentry.withScope).mockImplementation((cb: (s: unknown) => unknown) => {
    cb(scope)
  })
})

describe('reportToSentry — filtering', () => {
  it('drops UNAUTHORIZED without touching the SDK', () => {
    reportToSentry(new AppError(ErrorCode.UNAUTHORIZED, 'nope', 401))
    expect(Sentry.withScope).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('drops RATE_LIMITED without touching the SDK', () => {
    reportToSentry(new AppError(ErrorCode.RATE_LIMITED, 'slow down', 429))
    expect(Sentry.withScope).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('reportToSentry — capture path', () => {
  it('captures a 5xx error at level "error" with code + status tags', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'boom', 500)
    reportToSentry(error)

    expect(scope.setTag).toHaveBeenCalledWith('error.code', 'SERVER_ERROR')
    expect(scope.setTag).toHaveBeenCalledWith('http.status_code', '500')
    expect(scope.setLevel).toHaveBeenCalledWith('error')
    expect(scope.setContext).toHaveBeenCalledWith(
      'app_error',
      expect.objectContaining({ code: 'SERVER_ERROR', statusCode: 500 }),
    )
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('uses level "warning" for a 4xx error', () => {
    reportToSentry(new AppError(ErrorCode.NOT_FOUND, 'gone', 404))
    expect(scope.setLevel).toHaveBeenCalledWith('warning')
  })

  it('omits the status tag and uses "warning" when there is no statusCode', () => {
    reportToSentry(new AppError(ErrorCode.UNKNOWN_ERROR, 'huh'))
    expect(scope.setTag).not.toHaveBeenCalledWith('http.status_code', expect.anything())
    expect(scope.setLevel).toHaveBeenCalledWith('warning')
  })

  it('attaches the caller-provided context', () => {
    reportToSentry(new AppError(ErrorCode.SERVER_ERROR, 'boom', 500), {
      endpoint: '/api/x',
    })
    expect(scope.setContext).toHaveBeenCalledWith('error_context', { endpoint: '/api/x' })
  })
})
