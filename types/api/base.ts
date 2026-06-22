import type { ErrorCode } from '../enums'

export interface ApiResponse<T> {
  data: T | null
  success?: string | null
  info?: string | null
  warning?: string | null
  error?: ApiError | null
}

interface ApiError {
  code: ErrorCode
  message: string
  statusCode?: number | null
  details?: unknown
  validationErrors?: ValidationError[] | null
}

interface ValidationError {
  field: string
  message: string
}

/**
 * Result type for mutation operations that return success confirmation.
 * Backend returns: { data: "{\"message\":\"kész.\"}" }
 */
export type MutationSuccess = true
