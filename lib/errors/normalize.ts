/**
 * Error normalization utilities
 * Converts various error types into consistent AppError instances
 */

import { err, ok, type Result } from 'neverthrow'
import type { AxiosError } from 'axios'
import type { AppError } from './types'
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ServerError,
  NetworkError,
  TimeoutError,
  UnknownError,
  TokenExpiredError,
  createValidationError,
  createApiError,
} from './types'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ErrorNormalize')

// ============================================================================
// ERROR TYPE GUARDS
// ============================================================================

function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    typeof (error as AxiosError).isAxiosError === 'boolean' &&
    (error as AxiosError).isAxiosError === true
  )
}

function isNetworkLikeError(error: Error): boolean {
  // Check for common network error patterns
  return (
    error.name === 'NetworkError' ||
    error.name === 'TypeError' ||
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('ETIMEDOUT')
  )
}

// ============================================================================
// MAIN ERROR NORMALIZATION FUNCTION
// ============================================================================

/**
 * Normalizes backend API errors (which vary in format) into consistent AppError
 */
export function normalizeApiError(error: unknown): AppError {
  if (import.meta.dev) logger.warn('Normalizing error:', error)

  // Axios error (most common for HTTP requests)
  if (isAxiosError(error)) {
    return normalizeAxiosError(error)
  }

  // Error instances - delegate to specialized handler
  if (error instanceof Error) {
    return normalizeErrorInstance(error)
  }

  // String error
  if (typeof error === 'string') {
    return new UnknownError(error)
  }

  // Object with message property
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? 'Unknown error occurred')
    return new UnknownError(message, error)
  }

  // Fallback for completely unknown error types
  return new UnknownError('An unknown error occurred', error)
}

/**
 * Normalize a JavaScript Error instance into an AppError
 */
function normalizeErrorInstance(error: Error): AppError {
  // Network-like errors (fetch failures, etc.)
  if (isNetworkLikeError(error)) {
    return new NetworkError(`Network error: ${error.message}`)
  }

  // AbortError (request cancelled)
  if (error.name === 'AbortError') {
    return new TimeoutError('Request was cancelled or timed out')
  }

  // Error with status property (like fetch Response errors)
  if ('status' in error) {
    const status = (error as { status?: number }).status ?? 500
    return createApiError(
      status || 500,
      error.message ?? 'Request failed',
      (error as { url?: string }).url,
      (error as { requestId?: string }).requestId,
    )
  }

  return new UnknownError(error.message, {
    name: error.name,
    stack: error.stack,
  })
}

// ============================================================================
// AXIOS ERROR NORMALIZATION
// ============================================================================

function normalizeAxiosError(error: AxiosError): AppError {
  const response = error.response

  // No response received - network or timeout error
  if (!response) {
    return normalizeNoResponseError(error)
  }

  // Have response - process based on status code and data
  const { status, data } = response
  const url = response.config?.url
  const requestId = response.headers?.['x-request-id'] as string | undefined

  return normalizeResponseData(status, data, url, requestId)
}

/**
 * Normalize an Axios error where no HTTP response was received
 */
function normalizeNoResponseError(error: AxiosError): AppError {
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return new TimeoutError(`Request timeout: ${error.message}`)
  }

  if (error.code === 'ERR_NETWORK' || !error.request) {
    return new NetworkError(`Network error: ${error.message}`)
  }

  return new NetworkError(`Request failed: ${error.message}`)
}

/**
 * Normalize based on response status and data
 */
function normalizeResponseData(
  status: number,
  data: unknown,
  url?: string,
  requestId?: string,
): AppError {
  // Backend returns validation errors in .errors format (ASP.NET style)
  if (status === 400 && data && typeof data === 'object' && 'errors' in data) {
    const validationError = extractValidationErrors(data as { errors: unknown })
    if (validationError) return validationError
  }

  // Backend returns simple message in data.message
  if (
    data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof (data as { message: unknown }).message === 'string'
  ) {
    return createApiError(status, (data as { message: string }).message, url, requestId)
  }

  // Backend returns string data directly
  if (typeof data === 'string') {
    return createApiError(status, data, url, requestId)
  }

  // Handle specific HTTP status codes with default messages
  return handleStatusCode(status, url, requestId)
}

/**
 * Extract validation errors from ASP.NET-style error response
 */
function extractValidationErrors(data: { errors: unknown }): AppError | null {
  const errors = data.errors
  if (!errors || typeof errors !== 'object') return null

  const validationErrors = Object.entries(errors).flatMap(([field, messages]) => {
    const messageArray = Array.isArray(messages) ? messages : [messages]
    return messageArray.map((message) => ({
      field,
      message: String(message),
    }))
  })

  return validationErrors.length > 0 ? createValidationError(validationErrors) : null
}

// ============================================================================
// HTTP STATUS CODE HANDLING
// ============================================================================

function handleStatusCode(status: number, url?: string, requestId?: string): AppError {
  switch (status) {
    case 400:
      return createApiError(status, 'Bad request', url, requestId)
    case 401:
      return new UnauthorizedError('Authentication required')
    case 403:
      return new ForbiddenError('Access forbidden')
    case 404:
      return new NotFoundError('Resource not found')
    case 408:
      return new TimeoutError('Request timeout')
    case 409:
      return createApiError(status, 'Resource conflict', url, requestId)
    case 422:
      return createApiError(status, 'Unprocessable entity', url, requestId)
    case 429:
      return createApiError(status, 'Too many requests', url, requestId)
    case 500:
      return new ServerError('Internal server error')
    case 502:
      return new ServerError('Bad gateway')
    case 503:
      return new ServerError('Service unavailable')
    case 504:
      return new TimeoutError('Gateway timeout')
    default:
      return createApiError(status, `HTTP error ${status}`, url, requestId)
  }
}

// ============================================================================
// BATCH ERROR NORMALIZATION
// ============================================================================

/**
 * Normalizes an array of mixed error types
 */
export function normalizeBatchErrors(errors: unknown[]): AppError[] {
  return errors.map((error) => normalizeApiError(error))
}

// ============================================================================
// RESULT TYPE HELPERS
// ============================================================================

/**
 * Creates an Err Result with normalized error
 */
export function createErrorResult<T>(error: unknown): Result<T, AppError> {
  return err(normalizeApiError(error))
}

/**
 * Wraps a promise with error normalization
 */
export async function normalizeAsyncError<T>(promise: Promise<T>): Promise<Result<T, AppError>> {
  try {
    const result = await promise
    return ok(result)
  } catch (error) {
    return createErrorResult(error)
  }
}

/**
 * Wraps a synchronous function with error normalization
 */
export function normalizeSyncError<T>(fn: () => T): Result<T, AppError> {
  try {
    const result = fn()
    return ok(result)
  } catch (error) {
    return createErrorResult(error)
  }
}

// ============================================================================
// ERROR RECOVERY HELPERS
// ============================================================================

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: AppError): boolean {
  return (
    error instanceof NetworkError ||
    error instanceof TimeoutError ||
    (error instanceof ServerError && error.statusCode !== undefined && error.statusCode >= 500) ||
    error.code === 'TIMEOUT'
  )
}

/**
 * Determines if an error suggests the user should re-authenticate
 */
export function shouldReauthenticate(error: AppError): boolean {
  return (
    error instanceof UnauthorizedError ||
    error instanceof TokenExpiredError ||
    (error.statusCode === 401 && !error.message.includes('Invalid credentials'))
  )
}

/**
 * Extracts user-friendly message from error
 */
export function getUserFriendlyMessage(error: AppError): string {
  // For validation errors, show the field-specific messages
  if (error instanceof ValidationError) {
    return error.validationErrors.map((ve) => ve.message).join(', ')
  }

  // For authentication errors, provide helpful guidance
  if (error instanceof UnauthorizedError) {
    return 'Please log in to continue'
  }

  if (error instanceof TokenExpiredError) {
    return 'Your session has expired. Please log in again'
  }

  // For network errors, provide connectivity guidance
  if (error instanceof NetworkError) {
    return 'Network error. Please check your connection and try again'
  }

  if (error instanceof TimeoutError) {
    return 'Request timed out. Please try again'
  }

  // For server errors, be reassuring
  if (error instanceof ServerError) {
    return 'Server error. Please try again in a moment'
  }

  // Default to the original message
  return error.message
}
