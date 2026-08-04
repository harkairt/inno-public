/**
 * Shared test factories for vonno/InnoChat unit tests.
 *
 * Usage:
 *   import { makeApiResponse, makeAxiosError, makeUser, makeSession, makeMessage } from '@/../tests/utils/factories'
 */

import type { UserDTO, AISessionHeaderDTO, AISessionMessageDTO } from '@/types/api/schemas'
import { AIAnswerType } from '@/types/enums'

// ---------------------------------------------------------------------------
// API response wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps data in the Axios response shape that services receive:
 * { data: { data: T, success: null, warning: null, error: null } }
 */
export function makeApiResponse<T>(data: T) {
  return {
    data: {
      data,
      success: null,
      warning: null,
      error: null,
    },
  }
}

// ---------------------------------------------------------------------------
// Axios error
// ---------------------------------------------------------------------------

/**
 * Creates a typed Axios-style error with an HTTP status code.
 *
 * @example
 * vi.mocked(apiClient.post).mockRejectedValue(makeAxiosError(401, 'UNAUTHORIZED'))
 */
export function makeAxiosError(
  status: number,
  code?: string,
): Error & { response: { status: number; data?: unknown } } {
  const error = new Error(code ?? `HTTP ${status}`) as Error & {
    response: { status: number; data?: unknown }
  }
  error.response = { status, data: code ? { error: { code } } : undefined }
  return error
}

// ---------------------------------------------------------------------------
// UserDTO factory
// ---------------------------------------------------------------------------

let _userIdCounter = 1

/**
 * Creates a valid UserDTO with sensible defaults. Pass overrides to customise.
 *
 * @example
 * makeUser({ email: 'admin@example.com', roles: ['admin'] })
 */
export function makeUser(overrides: Partial<UserDTO> = {}): UserDTO {
  const id = _userIdCounter++
  return {
    id,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    name: `Test User ${id}`,
    email: `user${id}@example.com`,
    status: 'active',
    invitationAccepted: true,
    roles: ['user'],
    isVirtual: false,
    url: null,
    image: null,
    darkImage: null,
    userIds: [],
    users: null,
    isAvailable: true,
    ...overrides,
  }
}

/** Resets the auto-incrementing user ID counter (call in beforeEach if stable IDs matter). */
export function resetUserIdCounter(): void {
  _userIdCounter = 1
}

// ---------------------------------------------------------------------------
// Wire-shape message (for MSW handlers)
// ---------------------------------------------------------------------------

/**
 * Message in the shape the backend actually serializes on the wire: messageType
 * is the lowercase string the API sends (`'text'`, `'options'`, ...), which
 * AISessionMessageDTOSchema transforms into the AIAnswerType enum on parse.
 *
 * Use this in MSW handlers (`apiOk(makeRawMessage())`); use makeMessage() for
 * already-parsed domain-side AISessionMessageDTO fixtures.
 */
export function makeRawMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...makeMessage(), messageType: 'text', ...overrides }
}

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------

let _sessionIdCounter = 1

/**
 * Creates a valid AISessionHeaderDTO with sensible defaults.
 */
export function makeSession(overrides: Partial<AISessionHeaderDTO> = {}): AISessionHeaderDTO {
  const n = _sessionIdCounter++
  return {
    sessionId: `session-${n}`,
    sessionName: `Test Session ${n}`,
    agentId: 1,
    agentImage: null,
    agentDarkImage: null,
    insertDate: '2024-01-01T00:00:00Z',
    modifiedAt: null,
    members: ['testuser'],
    memberDetails: null,
    userCode: 'testuser',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Message factory
// ---------------------------------------------------------------------------

let _messageIdCounter = 1

/**
 * Creates a valid AISessionMessageDTO with sensible defaults.
 */
export function makeMessage(overrides: Partial<AISessionMessageDTO> = {}): AISessionMessageDTO {
  const n = _messageIdCounter++
  return {
    messageID: `msg-${n}`,
    messageText: `Test message ${n}`,
    messageType: AIAnswerType.Text,
    isRated: false,
    rating: null,
    readByUsers: null,
    sendDate: '2024-01-01T00:00:00Z',
    senderName: 'Test User',
    senderUserCode: 'testuser',
    sessionId: 'session-1',
    dataTable: null,
    options: null,
    ...overrides,
  }
}
