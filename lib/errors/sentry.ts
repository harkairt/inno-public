/**
 * Sentry integration for error reporting
 *
 * Provides a single function to report AppErrors to Sentry with
 * structured context. Filters out noise (validation errors, expected 401s)
 * so Sentry only receives actionable errors.
 */

import * as Sentry from '@sentry/nuxt'
import type { AppError } from './types'

/** Error codes that should NOT be reported to Sentry */
const IGNORED_ERROR_CODES = new Set([
  'UNAUTHORIZED', // Expected auth flow (token refresh handles these)
  'RATE_LIMITED', // Transient, handled by retry logic
])

/**
 * Report an AppError to Sentry with structured context.
 * Filters out expected/non-actionable errors automatically.
 *
 * @param error - The normalized AppError to report
 * @param context - Optional extra context (endpoint, operation, etc.)
 */
export function reportToSentry(error: AppError, context?: Record<string, unknown>): void {
  if (IGNORED_ERROR_CODES.has(error.code)) return

  Sentry.withScope((scope) => {
    scope.setTag('error.code', error.code)

    if (error.statusCode) {
      scope.setTag('http.status_code', String(error.statusCode))
    }

    if (context) {
      scope.setContext('error_context', context)
    }

    // Attach AppError metadata as structured context
    scope.setContext('app_error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    })

    // Set the error level based on status code
    if (error.statusCode && error.statusCode >= 500) {
      scope.setLevel('error')
    } else {
      scope.setLevel('warning')
    }

    Sentry.captureException(error)
  })
}
