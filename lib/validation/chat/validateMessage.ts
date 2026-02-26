import { MessageSchema, type Message } from '@/lib/types/chat'
import { err, ok, type Result } from 'neverthrow'
import { ValidationError } from '@/lib/errors/types'

/**
 * Validates a message object against the MessageSchema
 *
 * @param message - The message object to validate (unknown/any type)
 * @returns Result<Message, ValidationError> - Success with validated message or error with validation details
 */
export function validateMessage(message: unknown): Result<Message, ValidationError> {
  const result = MessageSchema.safeParse(message)

  if (result.success) {
    return ok(result.data)
  }

  // Convert Zod errors to ValidationError format
  const validationErrors = result.error.issues.map(issue => ({
    field: issue.path.join('.'), // Convert path array to dot notation
    message: getValidationErrorMessage(issue)
  }))

  const errorMessage = validationErrors.length > 0
    ? `Message validation failed: ${validationErrors.map(e => e.message).join(', ')}`
    : 'Message validation failed'

  return err(new ValidationError(errorMessage, validationErrors))
}

/**
 * Converts Zod validation error issues to user-friendly error messages
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

    case 'invalid_type':
      if (issue.received === 'undefined') {
        return `${field} is required`
      }
      if (issue.expected === 'number' && issue.received === 'nan') {
        return `${field} must be a valid number`
      }
      return `${field} must be of type ${issue.expected}`

    case 'too_small':
      if (issue.minimum === 1) {
        return `${field} cannot be empty`
      }
      return `${field} must be at least ${issue.minimum} characters`

    case 'too_big':
      return `${field} cannot exceed ${issue.maximum} characters`

    case 'invalid_enum_value':
      return `${field} must be one of the valid enum values`

    case 'invalid_date':
      return `${field} must be a valid date`

    case 'invalid_number':
      return `${field} must be a valid number`

    case 'custom':
      return issue.message

    default:
      return `${field}: ${issue.message}`
  }
}

/**
 * Type guard to check if a value is a valid Message
 *
 * @param message - The value to check
 * @returns boolean - True if the value is a valid Message
 */
export function isValidMessage(message: unknown): message is Message {
  return MessageSchema.safeParse(message).success
}

/**
 * Validates an array of message objects
 *
 * @param messages - Array of message objects to validate
 * @returns Result<Message[], ValidationError> - Success with validated messages or error with validation details
 */
export function validateMessages(messages: unknown[]): Result<Message[], ValidationError> {
  if (!Array.isArray(messages)) {
    return err(new ValidationError('Input must be an array', [{
      field: 'messages',
      message: 'Input must be an array'
    }]))
  }

  const validatedMessages: Message[] = []
  const validationErrors: Array<{ field: string; message: string }> = []

  messages.forEach((message, index) => {
    const result = validateMessage(message)
    if (result.isOk()) {
      validatedMessages.push(result.value)
    } else {
      // Add index prefix to field names for array validation errors
      const indexedErrors = result.error.validationErrors.map(error => ({
        field: error.field.startsWith('[')
          ? `[${index}]${error.field}`
          : `[${index}].${error.field}`,
        message: error.message
      }))
      validationErrors.push(...indexedErrors)
    }
  })

  if (validationErrors.length > 0) {
    const errorMessage = `Messages validation failed: ${validationErrors.map(e => e.message).join(', ')}`
    return err(new ValidationError(errorMessage, validationErrors))
  }

  return ok(validatedMessages)
}