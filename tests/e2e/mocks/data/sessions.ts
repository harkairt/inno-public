/**
 * Mock session data for E2E tests
 * Data matches Zod AISessionDTO and AISessionHeaderDTO schemas
 */

// Type definitions (match schema from types/api/schemas.ts)
interface SessionMember {
  email: string
  name: string
  isVirtual: boolean
}

interface AISessionMessageDTO {
  isRated: boolean
  messageID: string
  messageText: string | null
  messageType: string
  rating: number | null
  readByUsers: string[] | null
  sendDate: string
  senderName: string
  senderUserCode: string
  sessionId: string
  dataTable?: { columns: string[]; rows: unknown[][] } | null
  options?: Array<{ column: string; orginalValue: string; selectedValue: string }> | null
}

interface AISessionHeaderDTO {
  agentDarkImage?: string | null
  agentId: number
  agentImage?: string | null
  insertDate: string
  modifiedAt?: string | null
  members: string[]
  memberDetails?: SessionMember[] | null
  sessionId: string
  sessionName: string
  userCode: string
}

interface AISessionDTO extends AISessionHeaderDTO {
  messages?: AISessionMessageDTO[] | null
}

export const mockSessions = {
  // Empty sessions list
  empty: [] as AISessionHeaderDTO[],

  // Basic session header (for list queries)
  basicHeader: {
    agentDarkImage: '/images/agent-dark.png',
    agentId: 100,
    agentImage: '/images/agent.png',
    insertDate: '2024-01-15T10:30:00Z',
    members: ['test@example.com', 'ai@virtual.agent'],
    memberDetails: [
      { email: 'test@example.com', name: 'Test User', isVirtual: false },
      { email: 'ai@virtual.agent', name: 'AI Assistant', isVirtual: true },
    ],
    sessionId: 'session-123',
    sessionName: 'Chat with AI Assistant',
    userCode: 'test@example.com',
  } satisfies AISessionHeaderDTO,

  // Full session with messages
  withMessages: {
    agentDarkImage: '/images/agent-dark.png',
    agentId: 100,
    agentImage: '/images/agent.png',
    insertDate: '2024-01-15T10:30:00Z',
    members: ['test@example.com', 'ai@virtual.agent'],
    memberDetails: [
      { email: 'test@example.com', name: 'Test User', isVirtual: false },
      { email: 'ai@virtual.agent', name: 'AI Assistant', isVirtual: true },
    ],
    messages: [
      {
        isRated: false,
        messageID: 'msg-001',
        messageText: 'Hello AI!',
        messageType: 'text', // AIAnswerType.Text (wire value is the lowercase string)
        rating: null,
        readByUsers: ['ai@virtual.agent'],
        sendDate: '2024-01-15T10:31:00Z',
        senderName: 'Test User',
        senderUserCode: 'test@example.com',
        sessionId: 'session-123',
        dataTable: null,
        options: null,
      },
      {
        isRated: false,
        messageID: 'msg-002',
        messageText: 'Hello! How can I help you today?',
        messageType: 'text', // AIAnswerType.Text (wire value is the lowercase string)
        rating: null,
        readByUsers: ['test@example.com'],
        sendDate: '2024-01-15T10:31:30Z',
        senderName: 'AI Assistant',
        senderUserCode: 'ai@virtual.agent',
        sessionId: 'session-123',
        dataTable: null,
        options: null,
      },
    ],
    sessionId: 'session-123',
    sessionName: 'Chat with AI Assistant',
    userCode: 'test@example.com',
  } satisfies AISessionDTO,

  // Session with unread messages
  withUnread: {
    agentDarkImage: '/images/agent-dark.png',
    agentId: 100,
    agentImage: '/images/agent.png',
    insertDate: '2024-01-16T14:20:00Z',
    members: ['test@example.com', 'ai@virtual.agent'],
    memberDetails: [
      { email: 'test@example.com', name: 'Test User', isVirtual: false },
      { email: 'ai@virtual.agent', name: 'AI Assistant', isVirtual: true },
    ],
    sessionId: 'session-456',
    sessionName: 'Important Discussion',
    userCode: 'test@example.com',
  } satisfies AISessionHeaderDTO,

  // Multi-member session
  multiMember: {
    agentDarkImage: '/images/agent-dark.png',
    agentId: 100,
    agentImage: '/images/agent.png',
    insertDate: '2024-01-17T09:00:00Z',
    members: ['test@example.com', 'admin@example.com', 'ai@virtual.agent'],
    memberDetails: [
      { email: 'test@example.com', name: 'Test User', isVirtual: false },
      { email: 'admin@example.com', name: 'Admin User', isVirtual: false },
      { email: 'ai@virtual.agent', name: 'AI Assistant', isVirtual: true },
    ],
    sessionId: 'session-789',
    sessionName: 'Team Discussion',
    userCode: 'test@example.com',
  } satisfies AISessionHeaderDTO,
}

// Helper to create a custom session header
export function createMockSessionHeader(
  overrides: Partial<AISessionHeaderDTO>,
): AISessionHeaderDTO {
  return {
    ...mockSessions.basicHeader,
    sessionId: `session-${Date.now()}`,
    ...overrides,
  }
}

// Helper to create a custom full session
export function createMockSession(overrides: Partial<AISessionDTO>): AISessionDTO {
  const { messages, ...headerFields } = mockSessions.withMessages
  return {
    ...headerFields,
    messages: messages ?? [],
    sessionId: `session-${Date.now()}`,
    ...overrides,
  }
}

// Array of session headers for list tests
export const mockSessionHeaders: AISessionHeaderDTO[] = [
  mockSessions.basicHeader,
  mockSessions.withUnread,
  mockSessions.multiMember,
]

// Unread counts mock data
export const mockUnreadCounts = [
  { sessionId: 'session-456', unreadMessageCount: 3 },
  { sessionId: 'session-789', unreadMessageCount: 1 },
]
