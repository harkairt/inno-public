import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { ChatSessionSchema } from '@/lib/types/chat'
import { ValidationError } from '@/lib/errors/types'
import type { ChatSession } from '@/lib/types/chat'

/**
 * Validates a session object against the ChatSession schema
 *
 * @param session - The session object to validate (unknown/any type)
 * @returns Result<ChatSession, ValidationError> - Returns validated session on success,
 *          ValidationError with detailed error information on failure
 */
export function validateSession(session: unknown): Result<ChatSession, ValidationError> {
  const parseResult = ChatSessionSchema.safeParse(session)

  if (!parseResult.success) {
    // Extract validation errors from Zod error
    const validationErrors = parseResult.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: getValidationErrorMessage(issue)
    }))

    const errorMessage = validationErrors.length > 0
      ? `Session validation failed: ${validationErrors.map(e => e.message).join(', ')}`
      : 'Session validation failed'

    return err(new ValidationError(errorMessage, validationErrors))
  }

  return ok(parseResult.data)
}

/**
 * Converts Zod validation issues to user-friendly error messages
 *
 * @param issue - Zod validation issue
 * @returns User-friendly error message
 */
function getValidationErrorMessage(issue: {
  code: string
  path: PropertyKey[]
  message: string
  expected?: string
  received?: string
  minimum?: number | bigint
  maximum?: number | bigint
}): string {
  const field = issue.path.join('.')

  switch (issue.code) {
    case 'invalid_uuid':
      return `${field} must be a valid UUID`

    case 'invalid_string':
      if (issue.received === 'undefined' || issue.received === 'null') {
        return `${field} is required`
      }
      return `${field} must be a valid string`

    case 'too_small':
      if (issue.minimum === 1) {
        return `${field} cannot be empty`
      }
      return `${field} must be at least ${issue.minimum} characters`

    case 'too_big':
      return `${field} cannot exceed ${issue.maximum} characters`

    case 'invalid_date':
      return `${field} must be a valid date`

    case 'invalid_number':
      return `${field} must be a valid number`

    case 'negative':
      return `${field} cannot be negative`

    case 'invalid_type':
      if (issue.expected === 'number' && issue.received === 'nan') {
        return `${field} must be a valid number`
      }
      return `${field} must be of type ${issue.expected}`

    case 'custom':
      if (field === 'updatedAt' && issue.message.includes('updatedAt must be >= createdAt')) {
        return 'Updated date cannot be earlier than creation date'
      }
      return issue.message

    default:
      return `${field}: ${issue.message}`
  }
}