import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorCode } from '@/types/enums'
import { AppError, NetworkError, ValidationError } from '@/lib/errors/types'

vi.mock('@/lib/errors/sentry', () => ({
  reportToSentry: vi.fn(),
}))

// eslint-disable-next-line import/first
import {
  isUnauthorized,
  isForbidden,
  isValidationError,
  isNotFoundError,
  isNetworkError,
  isServerError,
  isTimeoutError,
  isClientError,
  getUserFriendlyMessage,
  getTechnicalMessage,
  formatValidationErrors,
  shouldRetryRequest,
  shouldRedirectToLogin,
  shouldShowErrorDialog,
  shouldShowToastNotification,
  logError,
  logValidationError,
  ErrorTracker,
  globalErrorTracker,
  createErrorBoundaryState,
  handleBoundaryError,
  createErrorContext,
  sanitizeErrorForLogging,
} from '@/lib/errors/utils'
// eslint-disable-next-line import/first
import { reportToSentry } from '@/lib/errors/sentry'

// ---------------------------------------------------------------------------
// ERROR TYPE CHECKING UTILITIES
// ---------------------------------------------------------------------------

describe('isUnauthorized', () => {
  it('returns true for UNAUTHORIZED error code', () => {
    const error = new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized')
    expect(isUnauthorized(error)).toBe(true)
  })

  it('returns true for status code 401', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown', 401)
    expect(isUnauthorized(error)).toBe(true)
  })

  it('returns false for non-unauthorized error', () => {
    const error = new AppError(ErrorCode.FORBIDDEN, 'Forbidden', 403)
    expect(isUnauthorized(error)).toBe(false)
  })
})

describe('isForbidden', () => {
  it('returns true for FORBIDDEN error code', () => {
    const error = new AppError(ErrorCode.FORBIDDEN, 'Forbidden')
    expect(isForbidden(error)).toBe(true)
  })

  it('returns true for status code 403', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown', 403)
    expect(isForbidden(error)).toBe(true)
  })

  it('returns false for non-forbidden error', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found', 404)
    expect(isForbidden(error)).toBe(false)
  })
})

describe('isValidationError', () => {
  it('returns true for VALIDATION_ERROR code', () => {
    const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Bad input')
    expect(isValidationError(error)).toBe(true)
  })

  it('returns true for ValidationError instance', () => {
    const error = new ValidationError('Invalid', [{ field: 'email', message: 'required' }])
    expect(isValidationError(error)).toBe(true)
  })

  it('returns false for non-validation error', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    expect(isValidationError(error)).toBe(false)
  })
})

describe('isNotFoundError', () => {
  it('returns true for NOT_FOUND code', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found')
    expect(isNotFoundError(error)).toBe(true)
  })

  it('returns true for status code 404', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown', 404)
    expect(isNotFoundError(error)).toBe(true)
  })

  it('returns false for non-not-found error', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    expect(isNotFoundError(error)).toBe(false)
  })
})

describe('isNetworkError', () => {
  it('returns true for NETWORK_ERROR code', () => {
    const error = new AppError(ErrorCode.NETWORK_ERROR, 'Network error')
    expect(isNetworkError(error)).toBe(true)
  })

  it('returns true for NetworkError instance', () => {
    const error = new NetworkError('Connection failed')
    expect(isNetworkError(error)).toBe(true)
  })

  it('returns false for non-network error', () => {
    const error = new AppError(ErrorCode.TIMEOUT, 'Timeout', 408)
    expect(isNetworkError(error)).toBe(false)
  })
})

describe('isServerError', () => {
  it('returns true for SERVER_ERROR code', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error')
    expect(isServerError(error)).toBe(true)
  })

  it('returns true for status code >= 500', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Bad gateway', 502)
    expect(isServerError(error)).toBe(true)
  })

  it('returns true for status code 503', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Service unavailable', 503)
    expect(isServerError(error)).toBe(true)
  })

  it('returns false for client error status code', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found', 404)
    expect(isServerError(error)).toBe(false)
  })

  it('returns false when statusCode is undefined and code is not SERVER_ERROR', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown')
    expect(isServerError(error)).toBe(false)
  })
})

describe('isTimeoutError', () => {
  it('returns true for TIMEOUT code', () => {
    const error = new AppError(ErrorCode.TIMEOUT, 'Timeout')
    expect(isTimeoutError(error)).toBe(true)
  })

  it('returns true for status code 408', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Timeout', 408)
    expect(isTimeoutError(error)).toBe(true)
  })

  it('returns false for non-timeout error', () => {
    const error = new AppError(ErrorCode.NETWORK_ERROR, 'Network error')
    expect(isTimeoutError(error)).toBe(false)
  })
})

describe('isClientError', () => {
  it('returns true for status code 400', () => {
    const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Bad request', 400)
    expect(isClientError(error)).toBe(true)
  })

  it('returns true for status code 404', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found', 404)
    expect(isClientError(error)).toBe(true)
  })

  it('returns true for status code 499', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Client error', 499)
    expect(isClientError(error)).toBe(true)
  })

  it('returns false for status code 500', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    expect(isClientError(error)).toBe(false)
  })

  it('returns false when statusCode is undefined', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown')
    expect(isClientError(error)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ERROR MESSAGE UTILITIES
// ---------------------------------------------------------------------------

describe('getUserFriendlyMessage', () => {
  it('returns joined validation error messages for ValidationError instance', () => {
    const error = new ValidationError('Invalid', [
      { field: 'email', message: 'Email is required' },
      { field: 'name', message: 'Name is required' },
    ])
    expect(getUserFriendlyMessage(error)).toBe('Email is required, Name is required')
  })

  it('returns error message for VALIDATION_ERROR code that is not ValidationError instance', () => {
    const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Custom validation message')
    expect(getUserFriendlyMessage(error)).toBe('Custom validation message')
  })

  it('returns unauthorized message', () => {
    const error = new AppError(ErrorCode.UNAUTHORIZED, 'Auth failed')
    expect(getUserFriendlyMessage(error)).toBe('Your session has expired. Please log in again.')
  })

  it('returns forbidden message', () => {
    const error = new AppError(ErrorCode.FORBIDDEN, 'No permission')
    expect(getUserFriendlyMessage(error)).toBe('You do not have permission to perform this action.')
  })

  it('returns not found message', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Missing')
    expect(getUserFriendlyMessage(error)).toBe('The requested resource was not found.')
  })

  it('returns network error message', () => {
    const error = new AppError(ErrorCode.NETWORK_ERROR, 'Disconnected')
    expect(getUserFriendlyMessage(error)).toBe(
      'Network error. Please check your connection and try again.',
    )
  })

  it('returns timeout message', () => {
    const error = new AppError(ErrorCode.TIMEOUT, 'Slow')
    expect(getUserFriendlyMessage(error)).toBe('Request timed out. Please try again.')
  })

  it('returns server error message', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Broken')
    expect(getUserFriendlyMessage(error)).toBe('Server error. Please try again later.')
  })

  it('returns generic message for UNKNOWN_ERROR', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Something')
    expect(getUserFriendlyMessage(error)).toBe('An error occurred. Please try again.')
  })

  it('returns generic message for unhandled error codes (default case)', () => {
    const error = new AppError(ErrorCode.UPLOAD_ERROR, 'Upload failed')
    expect(getUserFriendlyMessage(error)).toBe('An error occurred. Please try again.')
  })
})

describe('getTechnicalMessage', () => {
  it('returns code and message', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Resource missing')
    expect(getTechnicalMessage(error)).toBe('[NOT_FOUND] Resource missing')
  })

  it('includes HTTP status code when present', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Resource missing', 404)
    expect(getTechnicalMessage(error)).toBe('[NOT_FOUND] Resource missing (HTTP 404)')
  })

  it('includes details when present', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Failed', 500, { key: 'value' })
    expect(getTechnicalMessage(error)).toBe(
      '[SERVER_ERROR] Failed (HTTP 500) - Details: {"key":"value"}',
    )
  })

  it('omits status code and details when not present', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Something went wrong')
    expect(getTechnicalMessage(error)).toBe('[UNKNOWN_ERROR] Something went wrong')
  })
})

describe('formatValidationErrors', () => {
  it('groups errors by field', () => {
    const error = new ValidationError('Invalid', [
      { field: 'email', message: 'required' },
      { field: 'email', message: 'invalid format' },
      { field: 'name', message: 'too short' },
    ])
    const result = formatValidationErrors(error)
    expect(result).toEqual({
      email: ['required', 'invalid format'],
      name: ['too short'],
    })
  })

  it('returns empty object for no validation errors', () => {
    const error = new ValidationError('Invalid', [])
    const result = formatValidationErrors(error)
    expect(result).toEqual({})
  })

  it('handles single error per field', () => {
    const error = new ValidationError('Invalid', [{ field: 'age', message: 'must be positive' }])
    expect(formatValidationErrors(error)).toEqual({ age: ['must be positive'] })
  })
})

// ---------------------------------------------------------------------------
// ERROR RECOVERY UTILITIES
// ---------------------------------------------------------------------------

describe('shouldRetryRequest', () => {
  it('returns true for network errors', () => {
    const error = new NetworkError('Connection failed')
    expect(shouldRetryRequest(error)).toBe(true)
  })

  it('returns true for timeout errors', () => {
    const error = new AppError(ErrorCode.TIMEOUT, 'Timeout', 408)
    expect(shouldRetryRequest(error)).toBe(true)
  })

  it('returns true for server errors', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    expect(shouldRetryRequest(error)).toBe(true)
  })

  it('returns false for client errors', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found', 404)
    expect(shouldRetryRequest(error)).toBe(false)
  })

  it('returns false for validation errors', () => {
    const error = new ValidationError('Bad input', [{ field: 'x', message: 'y' }])
    expect(shouldRetryRequest(error)).toBe(false)
  })
})

describe('shouldRedirectToLogin', () => {
  it('returns true for unauthorized errors', () => {
    const error = new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401)
    expect(shouldRedirectToLogin(error)).toBe(true)
  })

  it('returns false for forbidden errors', () => {
    const error = new AppError(ErrorCode.FORBIDDEN, 'Forbidden', 403)
    expect(shouldRedirectToLogin(error)).toBe(false)
  })
})

describe('shouldShowErrorDialog', () => {
  it('returns true for client errors', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found', 404)
    expect(shouldShowErrorDialog(error)).toBe(true)
  })

  it('returns true for UNKNOWN_ERROR', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown')
    expect(shouldShowErrorDialog(error)).toBe(true)
  })

  it('returns false for server errors without UNKNOWN_ERROR code', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    expect(shouldShowErrorDialog(error)).toBe(false)
  })

  it('returns false for network errors', () => {
    const error = new NetworkError('Offline')
    expect(shouldShowErrorDialog(error)).toBe(false)
  })
})

describe('shouldShowToastNotification', () => {
  it('returns true for network errors', () => {
    const error = new NetworkError('Offline')
    expect(shouldShowToastNotification(error)).toBe(true)
  })

  it('returns true for server errors', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    expect(shouldShowToastNotification(error)).toBe(true)
  })

  it('returns true for timeout errors', () => {
    const error = new AppError(ErrorCode.TIMEOUT, 'Timeout', 408)
    expect(shouldShowToastNotification(error)).toBe(true)
  })

  it('returns false for client errors', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found', 404)
    expect(shouldShowToastNotification(error)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ERROR LOGGING UTILITIES
// ---------------------------------------------------------------------------

describe('logError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(reportToSentry).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs error to console', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    logError(error)
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledWith(
      '[ErrorUtils]',
      'Application Error:',
      expect.objectContaining({
        code: ErrorCode.SERVER_ERROR,
        message: 'Server error',
        statusCode: 500,
      }),
    )
  })

  it('calls reportToSentry', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500)
    const context = { operation: 'test' }
    logError(error, context)
    expect(reportToSentry).toHaveBeenCalledWith(error, context)
  })
})

describe('logValidationError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(reportToSentry).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes validation errors in context', () => {
    const error = new ValidationError('Invalid', [{ field: 'email', message: 'required' }])
    logValidationError(error, { extra: 'data' })
    expect(reportToSentry).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: 'data',
        validationErrors: [{ field: 'email', message: 'required' }],
        fieldsWithErrors: ['email'],
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// ERROR TRACKER
// ---------------------------------------------------------------------------

describe('ErrorTracker', () => {
  let tracker: ErrorTracker

  beforeEach(() => {
    tracker = new ErrorTracker()
  })

  describe('track', () => {
    it('increments totalCount', () => {
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      expect(tracker.getMetrics().totalCount).toBe(2)
    })

    it('tracks count by error code', () => {
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      expect(tracker.getMetrics().countByCode).toEqual({
        SERVER_ERROR: 2,
        NOT_FOUND: 1,
      })
    })

    it('tracks count by status code', () => {
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      expect(tracker.getMetrics().countByStatusCode).toEqual({
        500: 1,
        404: 1,
      })
    })

    it('does not track status code when undefined', () => {
      tracker.track(new AppError(ErrorCode.UNKNOWN_ERROR, 'Error'))
      expect(tracker.getMetrics().countByStatusCode).toEqual({})
    })

    it('adds to recentErrors', () => {
      const error = new AppError(ErrorCode.SERVER_ERROR, 'Error', 500)
      tracker.track(error)
      const recent = tracker.getMetrics().recentErrors
      expect(recent).toHaveLength(1)
      expect(recent[0].error).toBe(error)
      expect(recent[0].timestamp).toBeDefined()
    })

    it('trims recentErrors when exceeding max (100)', () => {
      for (let i = 0; i < 105; i++) {
        tracker.track(new AppError(ErrorCode.SERVER_ERROR, `Error ${i}`, 500))
      }
      expect(tracker.getMetrics().recentErrors).toHaveLength(100)
      // The first 5 errors should have been trimmed; the oldest remaining is Error 5
      expect(tracker.getMetrics().recentErrors[0].error.message).toBe('Error 5')
    })
  })

  describe('getMetrics', () => {
    it('returns a copy of metrics', () => {
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      const metrics1 = tracker.getMetrics()
      const metrics2 = tracker.getMetrics()
      expect(metrics1).not.toBe(metrics2)
      expect(metrics1).toEqual(metrics2)
    })
  })

  describe('getMostCommonError', () => {
    it('returns null when no errors tracked', () => {
      expect(tracker.getMostCommonError()).toBeNull()
    })

    it('returns the most common error code', () => {
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      expect(tracker.getMostCommonError()).toEqual({ code: 'NOT_FOUND', count: 3 })
    })

    it('returns one of the top codes when tied', () => {
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      const result = tracker.getMostCommonError()
      expect(result).not.toBeNull()
      expect(result!.count).toBe(1)
    })
  })

  describe('getErrorRate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns 0 when no errors', () => {
      expect(tracker.getErrorRate()).toBe(0)
    })

    it('calculates errors per minute within time window', () => {
      // Track 10 errors at current time
      for (let i = 0; i < 10; i++) {
        tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      }
      // Default window is 5 minutes → 10 / 5 = 2 per minute
      expect(tracker.getErrorRate()).toBe(2)
    })

    it('excludes errors outside the time window', () => {
      // Track 5 errors
      for (let i = 0; i < 5; i++) {
        tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      }

      // Advance time past the default 5 minute window
      vi.advanceTimersByTime(300001)

      // Track 2 more errors
      for (let i = 0; i < 2; i++) {
        tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      }

      // Only the 2 recent errors should count: 2 / 5 = 0.4 per minute
      expect(tracker.getErrorRate()).toBeCloseTo(0.4)
    })

    it('accepts a custom time window', () => {
      for (let i = 0; i < 6; i++) {
        tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      }
      // 1 minute window: 6 errors / 1 minute = 6 per minute
      expect(tracker.getErrorRate(60000)).toBe(6)
    })
  })

  describe('reset', () => {
    it('clears all metrics', () => {
      tracker.track(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
      tracker.track(new AppError(ErrorCode.NOT_FOUND, 'Error', 404))
      tracker.reset()
      const metrics = tracker.getMetrics()
      expect(metrics.totalCount).toBe(0)
      expect(metrics.countByCode).toEqual({})
      expect(metrics.countByStatusCode).toEqual({})
      expect(metrics.recentErrors).toEqual([])
    })
  })
})

// ---------------------------------------------------------------------------
// ERROR BOUNDARY HELPERS
// ---------------------------------------------------------------------------

describe('createErrorBoundaryState', () => {
  it('returns initial boundary state', () => {
    const state = createErrorBoundaryState()
    expect(state).toEqual({
      hasError: false,
      error: null,
      errorInfo: undefined,
    })
  })
})

describe('handleBoundaryError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(reportToSentry).mockClear()
    globalErrorTracker.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns boundary state with AppError directly', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server broke', 500)
    const state = handleBoundaryError(error)
    expect(state.hasError).toBe(true)
    expect(state.error).toBe(error)
  })

  it('wraps a plain Error into AppError with UNKNOWN_ERROR code', () => {
    const error = new Error('Something went wrong')
    const state = handleBoundaryError(error)
    expect(state.hasError).toBe(true)
    expect(state.error).toBeInstanceOf(AppError)
    expect(state.error!.code).toBe(ErrorCode.UNKNOWN_ERROR)
    expect(state.error!.message).toBe('Something went wrong')
  })

  it('wraps a string into AppError with UNKNOWN_ERROR code', () => {
    const state = handleBoundaryError('string error')
    expect(state.hasError).toBe(true)
    expect(state.error).toBeInstanceOf(AppError)
    expect(state.error!.code).toBe(ErrorCode.UNKNOWN_ERROR)
    expect(state.error!.message).toBe('string error')
  })

  it('preserves errorInfo', () => {
    const errorInfo = { componentStack: 'at MyComponent' }
    const state = handleBoundaryError(new Error('fail'), errorInfo)
    expect(state.errorInfo).toBe(errorInfo)
  })

  it('tracks the error in globalErrorTracker', () => {
    handleBoundaryError(new AppError(ErrorCode.SERVER_ERROR, 'Error', 500))
    expect(globalErrorTracker.getMetrics().totalCount).toBe(1)
  })

  it('logs the error via logError', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Error', 500)
    handleBoundaryError(error, { componentStack: 'at Comp' })
    expect(reportToSentry).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        componentStack: 'at Comp',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------

describe('createErrorContext', () => {
  it('includes operation and timestamp', () => {
    const ctx = createErrorContext('fetchUser')
    expect(ctx.operation).toBe('fetchUser')
    expect(ctx.timestamp).toBeDefined()
    expect(typeof ctx.timestamp).toBe('string')
  })

  it('merges additional data', () => {
    const ctx = createErrorContext('fetchUser', { userId: '123' })
    expect(ctx.userId).toBe('123')
    expect(ctx.operation).toBe('fetchUser')
  })

  it('includes userAgent when navigator is available', () => {
    const ctx = createErrorContext('test')
    // In the test environment navigator is defined
    if (typeof navigator !== 'undefined') {
      expect(ctx.userAgent).toBeDefined()
    } else {
      expect(ctx.userAgent).toBeUndefined()
    }
  })

  it('includes url when window is available', () => {
    const ctx = createErrorContext('test')
    if (typeof window !== 'undefined') {
      expect(ctx.url).toBeDefined()
    } else {
      expect(ctx.url).toBeUndefined()
    }
  })
})

describe('sanitizeErrorForLogging', () => {
  it('returns basic error properties', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Server error', 500, { key: 'val' })
    const sanitized = sanitizeErrorForLogging(error)
    expect(sanitized.name).toBe('AppError')
    expect(sanitized.code).toBe(ErrorCode.SERVER_ERROR)
    expect(sanitized.message).toBe('Server error')
    expect(sanitized.statusCode).toBe(500)
    expect(sanitized.details).toEqual({ key: 'val' })
  })

  it('replaces large details with placeholder', () => {
    const largeDetails = { data: 'x'.repeat(11000) }
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Error', 500, largeDetails)
    const sanitized = sanitizeErrorForLogging(error)
    expect(sanitized.details).toBe('[Object too large or potentially sensitive]')
  })

  it('replaces details with circular references with placeholder', () => {
    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Error', 500, circular)
    const sanitized = sanitizeErrorForLogging(error)
    expect(sanitized.details).toBe('[Object too large or potentially sensitive]')
  })

  it('handles undefined details', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Error', 500)
    const sanitized = sanitizeErrorForLogging(error)
    // undefined && ... short-circuits to undefined (falsy)
    expect(sanitized.details).toBe('[Object too large or potentially sensitive]')
  })

  it('handles non-object details (string)', () => {
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Error', 500, 'some string')
    const sanitized = sanitizeErrorForLogging(error)
    // typeof 'some string' !== 'object' => falsy branch
    expect(sanitized.details).toBe('[Object too large or potentially sensitive]')
  })

  it('includes stack trace only in development', () => {
    const originalEnv = process.env.NODE_ENV

    process.env.NODE_ENV = 'development'
    const error = new AppError(ErrorCode.SERVER_ERROR, 'Error', 500)
    const devSanitized = sanitizeErrorForLogging(error)
    expect(devSanitized.stack).toBeDefined()

    process.env.NODE_ENV = 'production'
    const prodSanitized = sanitizeErrorForLogging(error)
    expect(prodSanitized.stack).toBeUndefined()

    process.env.NODE_ENV = originalEnv
  })
})
