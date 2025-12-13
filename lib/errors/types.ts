/**
 * Error types for the application
 * Provides consistent error handling throughout the application
 */

import { ErrorCode } from '@/types/enums'

// ============================================================================
// BASE ERROR CLASSES
// ============================================================================

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  // Helper method to check if this is a specific error type
  isErrorCode(code: ErrorCode): boolean {
    return this.code === code
  }

  // Convert to JSON-serializable format
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack
    }
  }
}

// ============================================================================
// SPECIFIC ERROR TYPES
// ============================================================================

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly validationErrors: Array<{ field: string; message: string }>,
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, { validationErrors })
    this.name = 'ValidationError'
  }

  // Helper to get errors for a specific field
  getFieldErrors(field: string): string[] {
    return this.validationErrors
      .filter(error => error.field === field)
      .map(error => error.message)
  }

  // Helper to check if a specific field has validation errors
  hasFieldError(field: string): boolean {
    return this.validationErrors.some(error => error.field === field)
  }

  // Helper to get all field names that have errors
  getErrorFields(): string[] {
    return [...new Set(this.validationErrors.map(error => error.field))]
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, message, 403)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(ErrorCode.NOT_FOUND, message, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(ErrorCode.CONFLICT, message, 409)
    this.name = 'ConflictError'
  }
}

export class ServerError extends AppError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(ErrorCode.SERVER_ERROR, message, 500, details)
    this.name = 'ServerError'
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error occurred') {
    super(ErrorCode.NETWORK_ERROR, message)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Request timeout') {
    super(ErrorCode.TIMEOUT, message, 408)
    this.name = 'TimeoutError'
  }
}

export class UnknownError extends AppError {
  constructor(message = 'An unknown error occurred', details?: unknown) {
    super(ErrorCode.UNKNOWN_ERROR, message, undefined, details)
    this.name = 'UnknownError'
  }
}

// ============================================================================
// CONTEXT-SPECIFIC ERRORS
// ============================================================================

export class AuthenticationError extends UnauthorizedError {
  constructor(message = 'Authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message = 'Authentication token has expired') {
    super(message)
    this.name = 'TokenExpiredError'
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message = 'Invalid authentication token') {
    super(message)
    this.name = 'InvalidTokenError'
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor(message = 'Invalid username or password') {
    super(message)
    this.name = 'InvalidCredentialsError'
  }
}

export class ConnectionError extends NetworkError {
  constructor(message = 'Connection failed') {
    super(message)
    this.name = 'ConnectionError'
  }
}

export class SignalRConnectionError extends ConnectionError {
  constructor(message = 'SignalR connection failed') {
    super(message)
    this.name = 'SignalRConnectionError'
  }
}

export class ApiError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    public readonly endpoint?: string,
    public readonly requestId?: string,
    additionalDetails?: unknown
  ) {
    // Map HTTP status codes to error codes
    let code: ErrorCode
    switch (statusCode) {
      case 400:
        code = ErrorCode.VALIDATION_ERROR
        break
      case 401:
        code = ErrorCode.UNAUTHORIZED
        break
      case 403:
        code = ErrorCode.FORBIDDEN
        break
      case 404:
        code = ErrorCode.NOT_FOUND
        break
      case 408:
        code = ErrorCode.TIMEOUT
        break
      case 409:
        code = ErrorCode.CONFLICT
        break
      case 500:
      case 502:
      case 503:
      case 504:
        code = ErrorCode.SERVER_ERROR
        break
      default:
        code = ErrorCode.UNKNOWN_ERROR
    }

    const details = { endpoint, requestId }
    if (additionalDetails && typeof additionalDetails === 'object') {
      Object.assign(details, additionalDetails)
    }
    super(code, message, statusCode, details)
    this.name = 'ApiError'
  }
}

export class CacheError extends AppError {
  constructor(message = 'Cache operation failed', public readonly cacheKey?: string) {
    super(ErrorCode.UNKNOWN_ERROR, message, undefined, { cacheKey })
    this.name = 'CacheError'
  }
}

export class ConfigurationError extends AppError {
  constructor(message = 'Configuration error', public readonly configKey?: string) {
    super(ErrorCode.UNKNOWN_ERROR, message, undefined, { configKey })
    this.name = 'ConfigurationError'
  }
}

// ============================================================================
// ERROR GUARD TYPES
// ============================================================================

// Type guard to check if an error is an instance of AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

// Type guard to check if an error is a specific error type
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError
}

export function isInvalidCredentialsError(error: unknown): error is InvalidCredentialsError {
  return error instanceof InvalidCredentialsError
}

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

export function createValidationError(
  errors: Array<{ field: string; message: string }>
): ValidationError {
  const message = errors.length > 0
    ? `Validation failed: ${errors.map(e => e.message).join(', ')}`
    : 'Validation failed'

  return new ValidationError(message, errors)
}

export function createApiError(
  statusCode: number,
  message: string,
  endpoint?: string,
  requestId?: string,
  details?: unknown
): ApiError {
  return new ApiError(message, statusCode, endpoint, requestId, details)
}

export function createNetworkError(originalError: unknown): NetworkError {
  if (originalError instanceof Error) {
    return new NetworkError(originalError.message)
  }
  return new NetworkError('Network error occurred')
}

export function createTimeoutError(timeoutMs: number): TimeoutError {
  return new TimeoutError(`Request timed out after ${timeoutMs}ms`)
}

// ============================================================================
// ERROR BAG CLASS
// ============================================================================

export class ErrorBag {
  private errors: AppError[] = []

  add(error: AppError): void {
    this.errors.push(error)
  }

  addAll(errors: AppError[]): void {
    this.errors.push(...errors)
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  hasErrorCode(code: ErrorCode): boolean {
    return this.errors.some(error => error.code === code)
  }

  getErrorsByCode(code: ErrorCode): AppError[] {
    return this.errors.filter(error => error.code === code)
  }

  getValidationErrors(): ValidationError[] {
    return this.errors.filter((error): error is ValidationError => error instanceof ValidationError)
  }

  getNetworkErrors(): NetworkError[] {
    return this.errors.filter((error): error is NetworkError => error instanceof NetworkError)
  }

  getServerErrors(): ServerError[] {
    return this.errors.filter((error): error is ServerError => error instanceof ServerError)
  }

  getAll(): AppError[] {
    return [...this.errors]
  }

  clear(): void {
    this.errors = []
  }

  clearByCode(code: ErrorCode): void {
    this.errors = this.errors.filter(error => error.code !== code)
  }

  // Get user-friendly summary of all errors
  getSummary(): string {
    if (this.errors.length === 0) return ''

    const messages = this.errors.map(error => {
      if (error instanceof ValidationError) {
        return error.validationErrors.map(ve => ve.message).join(', ')
      }
      return error.message
    }).filter(Boolean)

    return [...new Set(messages)].join('; ')
  }
}