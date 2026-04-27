/**
 * Zod schemas for runtime validation
 * Generated from DTOs for type-safe API communication
 */

import { z } from 'zod'
import { ok, err, type Result } from 'neverthrow'
import {
  AIAnswerType,
  AIQuestionType,
  AuthenticationMode,
  ErrorCode,
  LogLevel
} from '../enums'
import { AppError } from '@/lib/errors/types'

// ============================================================================
// BASE SCHEMAS
// ============================================================================

// ============================================================================
// ENUM VALUE MAPPINGS (for lowercase string parsing from backend)
// ============================================================================

// AIAnswerType: Backend sends lowercase strings
const AI_ANSWER_TYPE_VALUES = [
  'text',
  'command',
  'dataTable',
  'options',
  'url',
  'question',
  'errorText',
  'serverTask',
  'empty'
] as const

const aiAnswerTypeMap: Record<typeof AI_ANSWER_TYPE_VALUES[number], AIAnswerType> = {
  'text': AIAnswerType.Text,
  'command': AIAnswerType.Command,
  'dataTable': AIAnswerType.DataTable,
  'options': AIAnswerType.Options,
  'url': AIAnswerType.URL,
  'question': AIAnswerType.Question,
  'errorText': AIAnswerType.ErrorText,
  'serverTask': AIAnswerType.ServerTask,
  'empty': AIAnswerType.Empty
}

// AIQuestionType: Backend sends lowercase strings
const AI_QUESTION_TYPE_VALUES = ['text', 'options'] as const

const aiQuestionTypeMap: Record<typeof AI_QUESTION_TYPE_VALUES[number], AIQuestionType> = {
  'text': AIQuestionType.Text,
  'options': AIQuestionType.Options
}

// AuthenticationMode: Backend sends lowercase strings
const AUTHENTICATION_MODE_VALUES = ['basic', 'ibsystem'] as const

const authenticationModeMap: Record<typeof AUTHENTICATION_MODE_VALUES[number], AuthenticationMode> = {
  'basic': AuthenticationMode.Basic,
  'ibsystem': AuthenticationMode.IBSystem
}

// LogLevel: Backend sends lowercase strings - simplified to match API docs
const LOG_LEVEL_VALUES = [
  'debug',
  'info',
  'warning',
  'error'
] as const

const logLevelMap: Record<typeof LOG_LEVEL_VALUES[number], LogLevel> = {
  'debug': LogLevel.Debug,
  'info': LogLevel.Info,
  'warning': LogLevel.Warning,
  'error': LogLevel.Error
}

// ============================================================================
// MODERN ZOD ENUM SCHEMAS (with lowercase string transformation)
// ============================================================================

// Parse lowercase strings from backend and transform to TypeScript enum values
const AIAnswerTypeSchema = z.enum(AI_ANSWER_TYPE_VALUES).transform(val => aiAnswerTypeMap[val])
const AIQuestionTypeSchema = z.enum(AI_QUESTION_TYPE_VALUES).transform(val => aiQuestionTypeMap[val])
const AuthenticationModeSchema = z.enum(AUTHENTICATION_MODE_VALUES).transform(val => authenticationModeMap[val])
const LogLevelSchema = z.enum(LOG_LEVEL_VALUES).transform(val => logLevelMap[val])

// UserStatus is now a string union type, not an enum
const UserStatusSchema = z.enum(['active', 'inactive', 'suspended', 'pending'])


// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number().nullable().optional(),
  details: z.unknown().nullable().optional(),
  validationErrors: z.array(z.object({
    field: z.string(),
    message: z.string()
  })).nullable().optional()
})

// Generic API response wrapper - implemented below
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  data: dataSchema,
  success: z.string().nullable().optional(),
  warning: z.string().nullable().optional(),
  error: ApiErrorSchema.nullable().optional()
})

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserDTOSchema = z.object({
  id: z.number(),
  createdAt: z.string(), // ISO datetime
  updatedAt: z.string().nullable(),
  name: z.string(),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'),
  status: UserStatusSchema,
  invitationAccepted: z.boolean(),
  roles: z.array(z.string()),
  isVirtual: z.boolean(),
  url: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  darkImage: z.string().nullable().optional(),
  userIds: z.array(z.number()),
  users: z.array(z.unknown()).nullable().optional(),
  isAvailable: z.boolean()
})

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const LoginRequestDTOSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  mode: AuthenticationModeSchema
})

export const LoginResponseDTOSchema = ApiResponseSchema(z.object({
  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  user: UserDTOSchema.nullable().optional()
}))

export const RefreshTokenRequestDTOSchema = z.object({}).optional()

export const RefreshTokenResponseDTOSchema = z.object({
  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional()
})



// ============================================================================
// AI CHAT SCHEMAS
// ============================================================================

export const AIQuestionOptionDTOSchema = z.object({
  Column: z.string(),
  OrginalValue: z.string(),
  SelectedValue: z.string()
})

export const AiQuestionRequestDTOSchema = z.object({
  userCode: z.string(),
  sessionId: z.string(),
  agentId: z.number(),
  members: z.array(z.string()),
  question: z.string(),
  group: z.string(),
  pquestionType: AIQuestionTypeSchema,
  options: z.array(AIQuestionOptionDTOSchema).default([])
})

export const AiQuestionResponseDTOSchema = z.object({
  type: z.number(),
  question: z.string(),
  group: z.string(),
  options: z.array(AIQuestionOptionDTOSchema).default([])
})

export const AIAnswerDTOSchema = z.object({
  answer: z.string(),
  isRated: z.boolean(),
  messageID: z.string(),
  rating: z.number().nullable().optional(),
  answerType: AIAnswerTypeSchema
})

// DataTable structure (for messageType = 'dataTable')
export const DataTableSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown()))
})

// Options structure (for messageType = 'options')
export const MessageOptionSchema = z.object({
  column: z.string(),
  orginalValue: z.string(),
  selectedValue: z.string()
})

// Options message payload (parsed from messageText when messageType = 'options')
export const OptionsMessagePayloadSchema = z.object({
  Text: z.string(),
  MultiSelectEnabled: z.boolean(),
  IsPlainTextEnabled: z.boolean().optional().default(false),
  UIControlType: z.number().optional().default(0),
  Items: z.array(z.object({
    Key: z.string(),
    Value: z.string()
  }))
})
export type OptionsMessagePayload = z.infer<typeof OptionsMessagePayloadSchema>

export function parseOptionsPayload(
  messageText: string | null | undefined
): OptionsMessagePayload | null {
  if (!messageText) return null
  try {
    // Backend may return multi-encoded JSON strings (e.g. "\"{\\\"Text\\\": ...}\"")
    // Unwrap iteratively until we get a non-string value
    let parsed: unknown = messageText
    for (let i = 0; i < 5 && typeof parsed === 'string'; i++) {
      parsed = JSON.parse(parsed)
    }
    const result = OptionsMessagePayloadSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export const AISessionMessageDTOSchema = z.object({
  isRated: z.boolean(),
  messageID: z.string(),
  messageText: z.string().nullable().optional().transform((val) => {
    // Backend may double-encode messageText (e.g. "\"Milyen d\\u00f6nt\\u00e9sek...\"")
    // Unwrap one level of extra JSON encoding if detected
    if (typeof val !== 'string') return val
    try {
      const parsed = JSON.parse(val)
      if (typeof parsed === 'string') return parsed
    } catch { /* not double-encoded, return as-is */ }
    return val
  }),
  messageType: AIAnswerTypeSchema,
  rating: z.number().nullable().optional(),
  readByUsers: z.array(z.string()).nullable().optional(),
  sendDate: z.string(), // ISO date string
  senderName: z.string(),
  senderUserCode: z.string(),
  sessionId: z.string(),
  // Discriminated union fields - present based on messageType
  dataTable: DataTableSchema.nullable().optional(),
  options: z.array(MessageOptionSchema).nullable().optional()
})

// Session member details schema
export const SessionMemberSchema = z.object({
  email: z.string(),
  name: z.string(),
  isVirtual: z.boolean()
})

// Session header without messages (for list queries)
export const AISessionHeaderDTOSchema = z.object({
  agentDarkImage: z.string().nullable().optional(),
  agentId: z.number(),
  agentImage: z.string().nullable().optional(),
  insertDate: z.string(), // ISO date string
  members: z.array(z.string()),
  memberDetails: z.array(SessionMemberSchema).nullable().optional(),
  sessionId: z.string(),
  sessionName: z.string(),
  userCode: z.string(),
})

// Full session with messages (for individual session queries)
export const AISessionDTOSchema = z.object({
  agentDarkImage: z.string().nullable().optional(),
  agentId: z.number(),
  agentImage: z.string().nullable().optional(),
  insertDate: z.string(), // ISO date string
  members: z.array(z.string()),
  memberDetails: z.array(SessionMemberSchema).nullable().optional(),
  messages: z.array(AISessionMessageDTOSchema).nullable().optional(),
  sessionId: z.string(),
  sessionName: z.string(),
  userCode: z.string(),
})

export const AIWelcomeMessageDTOSchema = z.object({
  message: z.string()
})

// ============================================================================
// SESSION MANAGEMENT SCHEMAS
// ============================================================================

export const GetSessionHeadersByUserIdRequestDTOSchema = z.object({
  userCode: z.string(),
  agents: z.array(z.number()),
  filterText: z.string()
})

export const GetSessionByIdRequestDTOSchema = z.object({
  sessionId: z.string(),
  agentId: z.number()
})

export const SetSessionNameRequestDTOSchema = z.object({
  sessionId: z.string(),
  sessionName: z.string(),
  agentId: z.number()
})

export const DeleteSessionByIdrequestDTOSchema = z.object({
  sessionId: z.string(),
  agentId: z.number()
})

export const AddUserToSessionRequestDTOSchema = z.object({
  sessionId: z.string(),
  userCode: z.string(),
  agentId: z.number()
})

export const RemoveUserFromSessionRequestDTOSchema = z.object({
  sessionId: z.string(),
  userCode: z.string(),
  agentId: z.number()
})

// ============================================================================
// MESSAGE MANAGEMENT SCHEMAS
// ============================================================================

export const GetMessageRequestDTOSchema = z.object({
  messageID: z.string(),
  agentId: z.number()
})

export const SetSessionMessageRatingRequestDTOSchema = z.object({
  sessionId: z.string(),
  messageId: z.string(),
  rating: z.boolean(),
  agentId: z.number()
})

export const SetSessionMessagesReadRequestDTOSchema = z.object({
  sessionID: z.string().optional(),
  agent: z.number().optional(),
  userCode: z.string().optional()
})

export const GetSessionUnreadMessagesRequestDTOSchema = z.object({
  userEmail: z.string(),
  sessionId: z.string(),
  agentId: z.number()
})

export const GetUnreadMessagesRequestDTOSchema = z.object({
  userCode: z.string()
})

export const GetUnreadMessagesDTOSchema = z.object({
  sessionId: z.string(),
  unreadMessageCount: z.number()
})

// ============================================================================
// REACTIONS AND NOTIFICATIONS SCHEMAS
// ============================================================================

export const ReactDTOSchema = z.object({
  sessionId: z.string().optional(),
  messageId: z.string().optional(),
  agentId: z.number()
})

export const NotifyDtoSchema = z.object({
  SessionId: z.string().optional(),
  AgentId: z.string().optional()
})

// ============================================================================
// PUBLIC CHAT SCHEMAS
// ============================================================================

export const AIPublicChatStartDTOSchema = z.object({
  user: UserDTOSchema.nullable().optional(),
  agent: UserDTOSchema.nullable().optional()
})

export const StartPublicChatrequestDTOSchema = z.object({
  userEmail: z.string().optional(),
  agentId: z.number()
})

// ============================================================================
// LOGGING SCHEMAS
// ============================================================================

export const LogInfoDTOSchema = z.object({
  source: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  loglevel: LogLevelSchema.optional(),
  user: z.string().optional(),
  details: z.union([
    z.string(),
    z.object({
      stack: z.object({
        minifiedTrace: z.string().optional(),
        cause: z.unknown(),
        name: z.string(),
      }).optional(),
      validationIssues: z.array(z.object({
        code: z.string(),
        message: z.string(),
        path: z.array(z.union([z.string(), z.number()])),
      })).optional(),
      chatDetails: z.object({
        sessionId: z.string(),
        userDetails: z.object({
          id: z.number(),
          email: z.string(),
        }),
      }).optional(),
    }),
  ]).optional(),
})

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

export const InnoChatConfigSchema = z.object({
  mainColor: z.string(),
  backgroundColor: z.string(),
  watermarkEnabled: z.boolean(),
  partnerMessageBackgroundColor: z.string(),
  ownMessageBackgroundColor: z.string(),
  messageBorderThickness: z.number(),
  messageBorderColor: z.string(),
  messageBorderStyle: z.enum(['dotted', 'solid', 'dashed', 'double']),
  messageBorderRounded: z.number(),
  messageTextOwnItalic: z.boolean(),
  messageTextOwnBold: z.boolean(),
  messageTextOwnSize: z.number(),
  messageTextPartnerItalic: z.boolean(),
  messageTextPartnerBold: z.boolean(),
  messageTextPartnerSize: z.number(),
  axiosTimeout: z.number(),
  publicMode: z.union([z.literal(0), z.literal(1)]),
  publicLoginEmail: z.string().nullable(),
  publicLoginPassword: z.string().nullable(),
  publicAgent: z.union([z.literal(-1), z.number()])
})


// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

// Common email validation
export const EmailSchema = z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format')

// Common UUID validation
export const UUIDSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'Invalid UUID format')

// Common ISO date validation
export const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, 'Invalid datetime format')

// Pagination schemas
export const PaginationRequestSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20)
})

export const SortRequestSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('desc')
})

// ============================================================================
// MUTATION SUCCESS RESPONSE SCHEMA
// ============================================================================

/**
 * Backend mutation success response schema
 * Backend returns: { data: "{\"message\":\"kész.\"}" }
 */
export const MutationSuccessResponseSchema = z.string().transform((val, ctx) => {
  try {
    const parsed = JSON.parse(val)
    if (parsed.message === 'kész.') {
      return true as const
    }
    ctx.addIssue({
      code: 'custom',
      message: 'Expected success message "kész."',
    })
    return z.NEVER
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'Invalid JSON in mutation response',
    })
    return z.NEVER
  }
})

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

// Type inference helpers for use in components and services
export type LoginRequestDTO = z.infer<typeof LoginRequestDTOSchema>
export type LoginResponseDTO = z.infer<typeof LoginResponseDTOSchema>
export type RefreshTokenRequestDTO = z.infer<typeof RefreshTokenRequestDTOSchema>
export type RefreshTokenResponseDTO = z.infer<typeof RefreshTokenResponseDTOSchema>
export type UserDTO = z.infer<typeof UserDTOSchema>
export type AiQuestionRequestDTO = z.infer<typeof AiQuestionRequestDTOSchema>
export type SessionMember = z.infer<typeof SessionMemberSchema>
export type AISessionHeaderDTO = z.infer<typeof AISessionHeaderDTOSchema>
export type AISessionDTO = z.infer<typeof AISessionDTOSchema>
export type AISessionMessageDTO = z.infer<typeof AISessionMessageDTOSchema>
export type DataTable = z.infer<typeof DataTableSchema>
export type MessageOption = z.infer<typeof MessageOptionSchema>
export type AIWelcomeMessageDTO = z.infer<typeof AIWelcomeMessageDTOSchema>
export type GetSessionHeadersByUserIdRequestDTO = z.infer<typeof GetSessionHeadersByUserIdRequestDTOSchema>
export type GetSessionByIdRequestDTO = z.infer<typeof GetSessionByIdRequestDTOSchema>
export type SetSessionNameRequestDTO = z.infer<typeof SetSessionNameRequestDTOSchema>
export type DeleteSessionByIdrequestDTO = z.infer<typeof DeleteSessionByIdrequestDTOSchema>
export type AddUserToSessionRequestDTO = z.infer<typeof AddUserToSessionRequestDTOSchema>
export type RemoveUserFromSessionRequestDTO = z.infer<typeof RemoveUserFromSessionRequestDTOSchema>
export type SetSessionMessageRatingRequestDTO = z.infer<typeof SetSessionMessageRatingRequestDTOSchema>
export type GetUnreadMessagesRequestDTO = z.infer<typeof GetUnreadMessagesRequestDTOSchema>
export type GetUnreadMessagesDTO = z.infer<typeof GetUnreadMessagesDTOSchema>
export type ReactDTO = z.infer<typeof ReactDTOSchema>
export type LogInfoDTO = z.infer<typeof LogInfoDTOSchema>
export type InnoChatConfig = z.infer<typeof InnoChatConfigSchema>
export type GetMessageRequestDTO = z.infer<typeof GetMessageRequestDTOSchema>
export type GetSessionUnreadMessagesRequestDTO = z.infer<typeof GetSessionUnreadMessagesRequestDTOSchema>
export type StartPublicChatrequestDTO = z.infer<typeof StartPublicChatrequestDTOSchema>
export type AIPublicChatStartDTO = z.infer<typeof AIPublicChatStartDTOSchema>

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

// Helper function to validate unknown data against a schema
export function validateDTO<T>(schema: z.ZodType<T>, data: unknown): {
  success: boolean
  data?: T
  errors?: z.ZodError
} {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

// Helper to extract error messages from Zod error
export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
}

// Helper to create a validation middleware for API responses
export function createAPIResponseValidator<T>(schema: z.ZodType<T>) {
  return (response: unknown): T => {
    const result = schema.safeParse(response)
    if (!result.success) {
      throw new Error(`Invalid API response: ${formatZodError(result.error).join(', ')}`)
    }
    return result.data
  }
}

/**
 * Validates if an API response indicates mutation success
 * @param response - The API response data (expected to be stringified JSON with message)
 * @returns Result<true, AppError> - ok(true) on success, err(AppError) on failure
 */
export function validateMutationSuccess(
  response: unknown,
): Result<true, AppError> {
  const result = MutationSuccessResponseSchema.safeParse(response)

  if (result.success) {
    return ok(true)
  }

  return err(new AppError(
    ErrorCode.VALIDATION_ERROR,
    'Invalid mutation success response',
    undefined,
    result.error,
  ))
}